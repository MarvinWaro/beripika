<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use RuntimeException;

class PortalService
{
    public function fetchPrograms(string $instCode): array
    {
        return collect($this->fetchProgramRecords($instCode))->pluck('programName')
            ->map(fn ($name) => trim((string) $name))->filter()->unique()->values()->all();
    }

    public function fetchMajors(string $instCode, string $programName): array
    {
        return collect($this->fetchProgramRecords($instCode))
            ->filter(fn ($row) => trim($row['programName']) === trim($programName))
            ->pluck('majorName')->map(fn ($name) => trim((string) $name))->filter()->unique()->values()->all();
    }

    public function fetchProgramRecords(string $instCode): array
    {
        return $instCode === '' ? [] : $this->programSnapshot($instCode)['data'];
    }

    public function fetchAllHEI(): array
    {
        return $this->schoolSnapshot()['data'];
    }

    /** @return array{data: array, last_fetched_at: ?string, stale: bool, error: ?string} */
    public function schoolSnapshot(bool $force = false): array
    {
        return $this->snapshot('schools', '/fetch-all-hei', null, $force);
    }

    /** @return array{data: array, last_fetched_at: ?string, stale: bool, error: ?string} */
    public function programSnapshot(string $instCode, bool $force = false): array
    {
        return $this->snapshot('programs:'.hash('sha256', $instCode), '/fetch-programs', $instCode, $force);
    }

    private function snapshot(string $resource, string $path, ?string $instCode, bool $force): array
    {
        $key = 'portal:v2:'.$resource;
        if (! $force && ($cached = Cache::get($key))) {
            return $cached + ['stale' => false, 'error' => null];
        }
        $lock = Cache::lock($key.':refresh', 60);
        if (! $lock->get()) {
            return $this->fallback($key, 'A refresh is already in progress. Please try again shortly.');
        }
        try {
            if (! $force && ($cached = Cache::get($key))) {
                return $cached + ['stale' => false, 'error' => null];
            }
            $apiKey = (string) config('services.portal.key');
            if ($apiKey === '') {
                throw new RuntimeException('Portal credentials are not configured.');
            }
            $request = Http::withHeaders(['PORTAL-API' => $apiKey])->acceptJson()
                ->connectTimeout(5)->timeout(15)->retry(2, 300);
            $url = rtrim(config('services.portal.base_url'), '/').$path;
            $response = $instCode === null
                ? $request->get($url)
                : $request->asForm()->post($url, ['instCode' => $instCode]);
            $response->throw();
            // Associative decoding turns an empty JSON object into [], which is not a valid list.
            if (is_object(json_decode($response->body()))) {
                throw new RuntimeException('Invalid portal response.');
            }
            $rows = $this->normalize($response->json(), $instCode === null);
            if ($instCode === null) {
                $fields = array_fill_keys(['instCode', 'instName', 'instOwnership', 'province', 'municipalityCity',
                    'status', 'xCoordinate', 'yCoordinate', 'ownershipSector', 'ownershipHei_type'], null);
                $rows = array_map(fn ($row) => array_intersect_key($row, $fields) + $fields, $rows);
                $rows = collect($rows)->sortBy('instName', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();
            }
            $snapshot = ['data' => $rows, 'last_fetched_at' => now()->toIso8601String()];
            Cache::put($key.':last_success', $snapshot, now()->addDays(7));
            Cache::put($key, $snapshot, 600);
            // Derive names/majors from this snapshot; no separately cached derived lists.
            if ($force && $instCode !== null) {
                foreach ($rows as $row) {
                    if ($pdfUrl = $this->buildPermitUrl($row['filename'] ?? null)) {
                        Cache::forget('pdf_proxy_'.md5($pdfUrl));
                    }
                }
            }

            return $snapshot + ['stale' => false, 'error' => null];
        } catch (\Throwable $exception) {
            Log::warning('Portal fetch failed', ['resource' => $resource, 'exception' => $exception::class]);

            return $this->fallback($key, 'Could not fetch updates from the portal. Please check your connection and try again.');
        } finally {
            $lock->release();
        }
    }

    private function fallback(string $key, string $message): array
    {
        $previous = Cache::get($key.':last_success');

        return ($previous ?? ['data' => [], 'last_fetched_at' => null])
            + ['stale' => true, 'error' => $message];
    }

    private function normalize(mixed $data, bool $schools): array
    {
        if (is_string($data) && str_starts_with($data, 'Array[')) {
            $data = json_decode(substr($data, 5), true);
        }
        if (! is_array($data) || ! array_is_list($data)) {
            throw new RuntimeException('Invalid portal response.');
        }
        foreach ($data as $row) {
            foreach ($schools ? ['instCode', 'instName'] : ['programName'] as $field) {
                if (! is_array($row) || ! isset($row[$field]) || ! is_string($row[$field]) || trim($row[$field]) === '') {
                    throw new RuntimeException('Invalid portal record.');
                }
            }
            $optional = $schools
                ? ['instOwnership', 'province', 'municipalityCity', 'ownershipSector', 'ownershipHei_type']
                : ['majorName', 'permit_4thyr', 'filename', 'program_status'];
            foreach ($optional as $field) {
                if (isset($row[$field]) && ! is_string($row[$field])) {
                    throw new RuntimeException('Invalid portal field.');
                }
            }
        }

        return $data;
    }

    public function buildPermitUrl(?string $filename): ?string
    {
        $filename = trim((string) $filename);

        return $filename === '' ? null : rtrim(config('services.portal.permit_base_url'), '/').'/'.str_replace(' ', '%20', $filename);
    }
}
