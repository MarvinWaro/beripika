<?php

namespace App\Services;

use App\Jobs\InitializeGraduateImport;
use App\Jobs\ProcessGraduateChunk;
use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\GraduateImport;
use App\Models\GraduateImportChunk;
use App\Models\Institution;
use App\Models\Program;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class GraduateImportService
{
    public function start(UploadedFile $file, int $userId): GraduateImport
    {
        return Cache::lock('graduates:mutation', 15)->block(3, function () use ($file, $userId) {
            abort_if(GraduateImport::where('active_slot', 1)->exists(), 409, 'A graduate import is already active. Follow its progress in import history.');
            $path = $file->store('graduate-imports', 'local');
            abort_unless($path, 500, 'Could not store the uploaded file.');
            try {
                return DB::transaction(function () use ($file, $userId, $path) {
                    $run = GraduateImport::create(['user_id' => $userId, 'filename' => mb_substr($file->getClientOriginalName(), 0, 255),
                        'path' => $path, 'active_slot' => 1, 'status' => 'queued', 'phase' => 'reading']);
                    InitializeGraduateImport::dispatch($run->id)->onConnection('database')->onQueue('imports')->beforeCommit();

                    return $run;
                });
            } catch (\Throwable $exception) {
                Storage::disk('local')->delete($path);
                throw $exception;
            }
        });
    }

    public function retry(GraduateImport $run): GraduateImport
    {
        return Cache::lock('graduates:mutation', 15)->block(3, function () use ($run) {
            abort_if(GraduateImport::where('active_slot', 1)->exists(), 409, 'Another import is active.');
            abort_if(GraduateImport::where('id', '>', $run->id)->exists(), 409, 'A newer import exists. Upload the corrected masterlist as a new import instead.');
            abort_unless($run->status === 'failed' && $run->path && Storage::disk('local')->exists($run->path), 422, 'This import cannot be retried.');

            return DB::transaction(function () use ($run) {
                $run->update(['active_slot' => 1, 'status' => 'queued', 'error' => null, 'finished_at' => null]);
                if (! $run->chunks()->exists()) {
                    InitializeGraduateImport::dispatch($run->id)->onConnection('database')->onQueue('imports')->beforeCommit();
                } else {
                    foreach ($run->chunks()->where('status', 'failed')->get() as $chunk) {
                        $chunk->update(['status' => 'queued', 'error' => null]);
                        $this->dispatch($chunk);
                    }
                }

                return $run;
            });
        });
    }

    public function dispatch(GraduateImportChunk $chunk): void
    {
        ProcessGraduateChunk::dispatch($chunk->id, $chunk->phase)->onConnection('database')->onQueue('imports')->beforeCommit();
    }

    public function initialize(GraduateImport $run, SoaisReader $reader): void
    {
        if (! $run->active_slot || $run->chunks()->exists()) {
            return;
        }
        $run->update(['status' => 'processing']);
        $metadata = $reader->metadata(Storage::disk('local')->path($run->path));
        DB::transaction(function () use ($run, $metadata) {
            $locked = GraduateImport::lockForUpdate()->findOrFail($run->id);
            if ($locked->chunks()->exists()) {
                return;
            }
            $locked->update(['sheet' => $metadata['sheet'], 'total_rows' => $metadata['last_row'] - 3, 'status' => 'processing']);
            for ($start = 4; $start <= $metadata['last_row']; $start += 500) {
                $chunk = $locked->chunks()->create(['start_row' => $start, 'end_row' => min($start + 499, $metadata['last_row']), 'phase' => 'reading', 'status' => 'queued']);
                $this->dispatch($chunk);
            }
        });
    }

    public function readChunk(GraduateImportChunk $chunk, GraduateImport $run, SoaisReader $reader): void
    {
        $rows = $reader->rows(Storage::disk('local')->path($run->path), $run->sheet, $chunk->start_row, $chunk->end_row);
        $staged = [];
        $issues = [];
        $skipped = 0;
        $invalid = 0;
        foreach ($rows as $number => $row) {
            try {
                $data = $reader->normalize($row);
                if (! $data) {
                    $skipped++;

                    continue;
                }
                $json = json_encode($data, JSON_THROW_ON_ERROR);
                $staged[] = ['graduate_import_id' => $run->id, 'graduate_import_chunk_id' => $chunk->id, 'row_number' => $number,
                    'identity_key' => $data['identity_key'], 'fingerprint' => hash('sha256', $json), 'data' => $json];
            } catch (\RuntimeException $exception) {
                $invalid++;
                $issues[] = $this->issue($run->id, $number, 'error', $exception->getMessage());
            }
        }
        DB::transaction(function () use ($chunk, $staged, $issues, $skipped, $invalid) {
            $locked = GraduateImportChunk::lockForUpdate()->findOrFail($chunk->id);
            if ($locked->status === 'completed') {
                return;
            }
            if ($staged) {
                DB::table('graduate_import_rows')->insert($staged);
            }
            if ($issues) {
                DB::table('graduate_import_issues')->insert($issues);
            }
            $locked->update(['status' => 'completed', 'skipped' => $skipped, 'invalid' => $invalid, 'error' => null]);
        });
    }

    public function writeChunk(GraduateImportChunk $chunk, GraduateImport $run): void
    {
        DB::transaction(function () use ($chunk, $run) {
            $locked = GraduateImportChunk::lockForUpdate()->findOrFail($chunk->id);
            if ($locked->status === 'completed') {
                return;
            }
            $rows = DB::table('graduate_import_rows')->where('graduate_import_chunk_id', $chunk->id)->orderBy('row_number')->get();
            $keys = $rows->pluck('identity_key')->unique()->all();
            $groups = DB::table('graduate_import_rows')->where('graduate_import_id', $run->id)->whereIn('identity_key', $keys)
                ->selectRaw('identity_key, MIN(`row_number`) AS first_row, MIN(fingerprint) AS first_hash, MAX(fingerprint) AS last_hash')->groupBy('identity_key')->get()->keyBy('identity_key');
            $existing = Graduate::whereIn('identity_key', $keys)->get()->keyBy('identity_key');
            $payloads = $rows->map(fn ($row) => json_decode($row->data, true));
            $institutions = Institution::whereIn('institution_code', $payloads->pluck('hei_uii')->unique())->get()->keyBy('institution_code');
            $programs = Program::whereIn('institution_id', $institutions->pluck('id'))->get()->groupBy(fn ($p) => $p->institution_id.'|'.GraduateData::nameKey($p->program_name).'|'.GraduateData::nameKey($p->major));
            $writes = [];
            $issues = [];
            $counts = ['created' => 0, 'updated' => 0, 'unchanged' => 0, 'skipped' => $locked->skipped, 'invalid' => $locked->invalid];
            foreach ($rows as $row) {
                $group = $groups[$row->identity_key];
                if ($group->first_hash !== $group->last_hash) {
                    $counts['invalid']++;
                    $issues[] = $this->issue($run->id, $row->row_number, 'error', 'Conflicting rows share this HEI + SO number. None of these rows was applied.');

                    continue;
                }
                if ((int) $group->first_row !== $row->row_number) {
                    $counts['skipped']++;

                    continue;
                }
                $data = json_decode($row->data, true);
                $institution = $institutions->get($data['hei_uii']);
                $matches = $programs->get(($institution?->id ?? '').'|'.$data['program_key'].'|'.$data['major_key'], collect());
                $data['institution_id'] = $institution?->id;
                $data['program_id'] = $matches->count() === 1 ? $matches->first()->id : null;
                if (! $data['program_id']) {
                    $issues[] = $this->issue($run->id, $row->row_number, 'warning', 'No unique local program match. Excel institution, program and major were retained.');
                }
                $old = $existing->get($row->identity_key);
                $changed = ! $old || collect($data)->contains(fn ($value, $key) => (string) $old->getAttribute($key) !== (string) $value);
                if (! $changed) {
                    $counts['unchanged']++;

                    continue;
                }
                $counts[$old ? 'updated' : 'created']++;
                $writes[] = $data + ['created_at' => $old?->created_at ?? now(), 'updated_at' => now()];
            }
            foreach (array_chunk($writes, 100) as $batch) {
                Graduate::upsert($batch, ['identity_key'], array_values(array_diff(array_keys($batch[0]), ['identity_key', 'created_at'])));
            }
            if ($issues) {
                DB::table('graduate_import_issues')->insert($issues);
            }
            $locked->update($counts + ['status' => 'completed', 'error' => null]);
        });
    }

    private function issue(int $run, int $row, string $severity, string $message): array
    {
        return ['graduate_import_id' => $run, 'row_number' => $row, 'severity' => $severity, 'message' => mb_substr($message, 0, 500)];
    }

    public function advance(int $id): void
    {
        DB::transaction(function () use ($id) {
            $run = GraduateImport::lockForUpdate()->findOrFail($id);
            if (! $run->active_slot || $run->chunks()->whereIn('status', ['queued', 'processing'])->exists()) {
                return;
            }
            if ($run->chunks()->where('status', 'failed')->exists()) {
                $run->update(['status' => 'failed', 'active_slot' => null, 'error' => 'Some chunks failed. Retry to resume completed progress.']);

                return;
            }
            if ($run->phase === 'reading') {
                $run->update(['phase' => 'writing']);
                foreach ($run->chunks()->get() as $chunk) {
                    $chunk->update(['phase' => 'writing', 'status' => 'queued']);
                    $this->dispatch($chunk);
                }

                return;
            }
            $hasIssues = DB::table('graduate_import_issues')->where('graduate_import_id', $run->id)->exists();
            $run->update(['status' => $hasIssues ? 'completed_with_issues' : 'completed', 'active_slot' => null, 'finished_at' => now()]);
            ActivityLog::create(['user_id' => $run->user_id, 'action' => 'graduates_import', 'subject_type' => GraduateImport::class,
                'subject_id' => $run->id, 'summary' => 'SOAIS import #'.$run->id.' '.$run->status,
                'properties' => $this->serialize($run)]);
        });
    }

    public function serialize(GraduateImport $run): array
    {
        $chunks = $run->chunks()->get();
        $counts = [];
        foreach (['created', 'updated', 'unchanged', 'skipped', 'invalid'] as $field) {
            $counts[$field] = $chunks->sum($field);
        }

        return ['id' => $run->id, 'filename' => $run->filename, 'status' => $run->status, 'phase' => $run->phase,
            'total_rows' => (int) $run->total_rows, 'total_chunks' => $chunks->count(), 'completed_chunks' => $chunks->where('status', 'completed')->count(),
            'counts' => $counts, 'error' => $run->error, 'created_at' => $run->created_at->toIso8601String(),
            'finished_at' => $run->finished_at?->toIso8601String(),
            'issues' => DB::table('graduate_import_issues')->where('graduate_import_id', $run->id)->count(),
            'failed_chunks' => $chunks->where('status', 'failed')->map(fn ($c) => ['start_row' => $c->start_row, 'end_row' => $c->end_row, 'error' => $c->error])->values()->all()];
    }
}
