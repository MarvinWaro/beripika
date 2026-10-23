<?php

namespace App\Console\Commands;

use App\Models\CatalogSyncRun;
use App\Services\CatalogSyncService;
use Illuminate\Console\Command;

class SyncProgramCatalog extends Command
{
    protected $signature = 'ched:sync-program-catalog {--retry= : Retry a failed or partial run ID}';

    protected $description = 'Queue a portal catalog sync (requires the database queue worker)';

    public function handle(CatalogSyncService $sync): int
    {
        $retry = $this->option('retry') ? CatalogSyncRun::find($this->option('retry')) : null;
        if ($this->option('retry') && ! $retry) {
            $this->error('Sync run not found.');

            return self::FAILURE;
        }
        $run = $sync->start(null, $retry);
        $this->info("Catalog sync #{$run->id}: {$run->status}. View progress in Program Catalog.");
        $this->line('Worker: php artisan queue:work database --queue=default --timeout=45 --tries=1');

        return self::SUCCESS;
    }
}
