<?php

namespace App\Jobs;

use App\Models\GraduateImport;
use App\Services\GraduateImportService;
use App\Services\SoaisReader;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class InitializeGraduateImport implements ShouldQueue
{
    use Queueable;

    public int $timeout = 45;

    public int $tries = 1;

    public bool $failOnTimeout = true;

    public function __construct(public int $runId) {}

    public function handle(GraduateImportService $service, SoaisReader $reader): void
    {
        Cache::put('imports:worker_seen', now()->toIso8601String(), now()->addDays(7));
        $lock = Cache::lock('graduate-import:init:'.$this->runId, 75);
        if (! $lock->get()) {
            // A killed worker may leave its lock until expiry. Never acknowledge pending work as completed.
            $this->release(75);

            return;
        }
        try {
            $service->initialize(GraduateImport::findOrFail($this->runId), $reader);
        } finally {
            $lock->release();
        }
    }

    public function failed(?\Throwable $exception): void
    {
        GraduateImport::whereKey($this->runId)->where('active_slot', 1)->whereDoesntHave('chunks')->update([
            'status' => 'failed', 'active_slot' => null,
            'error' => $exception instanceof \RuntimeException && ! ($exception instanceof QueryException)
                ? mb_substr($exception->getMessage(), 0, 500) : 'Could not read the spreadsheet. Check its format and retry.',
        ]);
    }
}
