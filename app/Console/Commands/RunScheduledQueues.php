<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class RunScheduledQueues extends Command
{
    protected $signature = 'app:work-queues';

    protected $description = 'Run database queues briefly for shared-hosting cron (with overlap protection)';

    public function handle(): int
    {
        $lock = Cache::lock('app:scheduled-worker', 180);
        if (! $lock->get()) {
            $this->info('A worker is already active.');

            return self::SUCCESS;
        }
        try {
            Cache::put('imports:worker_seen', now()->toIso8601String(), now()->addDays(7));

            return $this->call('queue:work', ['connection' => 'database', '--queue' => 'default,imports',
                '--stop-when-empty' => true, '--max-time' => 50, '--timeout' => 45, '--tries' => 1, '--sleep' => 1]);
        } finally {
            $lock->release();
        }
    }
}
