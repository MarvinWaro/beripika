<?php

namespace App\Services;

use App\Models\GraduateImport;
use Illuminate\Queue\Worker;
use Illuminate\Queue\WorkerOptions;
use Illuminate\Support\Facades\Cache;

/** Process a bounded batch using the same reserved jobs as the scheduled worker. */
class GraduateImportProcessor
{
    public function process(GraduateImport $run): void
    {
        if (! $run->active_slot) {
            return;
        }
        $lock = Cache::lock('graduate-import:browser-processing', 75);
        if (! $lock->get()) {
            return;
        }
        try {
            // Initialization is one streaming pass; subsequent requests handle short chunks.
            // Upstream web-server limits still apply and must be checked on hosting.
            if (function_exists('set_time_limit')) {
                set_time_limit(45);
            }
            /** @var Worker $worker */
            $worker = app('queue.worker');
            $options = new WorkerOptions(name: 'graduate-upload', memory: 256, timeout: 45, sleep: 0, maxTries: 1);
            $started = microtime(true);
            for ($jobs = 0; $jobs < 20 && microtime(true) - $started < 8; $jobs++) {
                if (! $run->fresh()->active_slot || memory_get_usage(true) > 192 * 1024 * 1024) {
                    break;
                }
                // Database reservations and per-job locks also protect against concurrent cron workers.
                $worker->runNextJob('database', 'imports', $options);
            }
        } finally {
            $lock->release();
        }
    }
}
