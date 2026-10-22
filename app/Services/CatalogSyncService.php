<?php

namespace App\Services;

use App\Jobs\InitializeCatalogSync;
use App\Jobs\SyncCatalogSchool;
use App\Models\ActivityLog;
use App\Models\CatalogSyncRun;
use App\Models\ProgramCatalog;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class CatalogSyncService
{
    public function start(?int $userId, ?CatalogSyncRun $retry = null): CatalogSyncRun
    {
        return Cache::lock('catalog-sync:start', 10)->block(3, function () use ($userId, $retry) {
            return DB::transaction(function () use ($userId, $retry) {
                if ($active = CatalogSyncRun::where('active_slot', 1)->first()) {
                    return $active;
                }
                if ($retry) {
                    $retry->refresh();
                    abort_unless(in_array($retry->status, ['partial', 'failed']), 422, 'This run has no failed work to retry.');
                    $retry->update(['active_slot' => 1, 'status' => 'queued', 'error' => null, 'finished_at' => null]);
                    if ($retry->schools()->exists()) {
                        $schools = $retry->schools()->where('status', 'failed')->get();
                        foreach ($schools as $school) {
                            $school->update(['status' => 'queued', 'error' => null]);
                            SyncCatalogSchool::dispatch($school->id)->onConnection('database')->afterCommit();
                        }
                    } else {
                        InitializeCatalogSync::dispatch($retry->id)->onConnection('database')->afterCommit();
                    }

                    return $retry;
                }
                $run = CatalogSyncRun::create(['user_id' => $userId, 'active_slot' => 1, 'status' => 'queued']);
                InitializeCatalogSync::dispatch($run->id)->onConnection('database')->afterCommit();

                return $run;
            });
        });
    }

    /** Insert only missing normalized names; existing manual classifications are authoritative. */
    public function insertPrograms(array $records): int
    {
        $created = 0;
        foreach ($records as $record) {
            $name = trim($record['programName']);
            $program = ProgramCatalog::firstOrCreate(
                ['normalized_name' => ProgramCatalog::normalizeName($name)],
                ['program_name' => $name, 'program_type' => 'Unknown'],
            );
            $created += (int) $program->wasRecentlyCreated;
        }

        return $created;
    }

    public function finishIfReady(int $runId): void
    {
        DB::transaction(function () use ($runId) {
            $run = CatalogSyncRun::lockForUpdate()->findOrFail($runId);
            if (! $run->active_slot || $run->schools()->whereIn('status', ['queued', 'running'])->exists()) {
                return;
            }
            $failed = $run->schools()->where('status', 'failed')->count();
            $total = $run->schools()->count();
            $status = $failed === 0 ? 'completed' : ($failed === $total ? 'failed' : 'partial');
            $run->update(['status' => $status, 'active_slot' => null, 'finished_at' => now()]);
            ActivityLog::create([
                'user_id' => $run->user_id, 'action' => 'catalog_sync', 'subject_type' => CatalogSyncRun::class,
                'subject_id' => $run->id, 'summary' => "Catalog sync {$status}: {$total} schools, {$failed} failed.",
                'properties' => ['created' => $run->schools()->sum('created_count'), 'failed' => $failed],
            ]);
        });
    }

    public function serialize(CatalogSyncRun $run): array
    {
        $schools = $run->schools()->get();

        return [
            'id' => $run->id, 'status' => $run->status, 'error' => $run->error,
            'total' => $schools->count(),
            'processed' => $schools->whereIn('status', ['completed', 'failed'])->count(),
            'created' => $schools->sum('created_count'),
            'failed_schools' => $schools->where('status', 'failed')->map(fn ($school) => [
                'code' => $school->institution_code, 'name' => $school->institution_name, 'error' => $school->error,
            ])->values()->all(),
            'finished_at' => $run->finished_at?->toIso8601String(),
        ];
    }
}
