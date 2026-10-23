<?php

namespace App\Jobs;

use App\Models\CatalogSyncRun;
use App\Services\CatalogSyncService;
use App\Services\PortalService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Throwable;

class InitializeCatalogSync implements ShouldQueue
{
    use Queueable;

    public int $timeout = 45;

    public int $tries = 1;

    public bool $failOnTimeout = true;

    public function __construct(public int $runId) {}

    public function handle(PortalService $portal, CatalogSyncService $sync): void
    {
        $lock = Cache::lock('catalog-sync:initialize:'.$this->runId, 60);
        if (! $lock->get()) {
            return;
        }
        try {
            $this->initialize($portal, $sync);
        } finally {
            $lock->release();
        }
    }

    private function initialize(PortalService $portal, CatalogSyncService $sync): void
    {
        $run = CatalogSyncRun::findOrFail($this->runId);
        if (! $run->active_slot || $run->schools()->exists()) {
            return;
        }
        $run->update(['status' => 'running']);
        $snapshot = $portal->schoolSnapshot(true);
        if ($snapshot['error']) {
            throw new RuntimeException($snapshot['error']);
        }
        DB::transaction(function () use ($snapshot, $run) {
            foreach (collect($snapshot['data'])->unique('instCode') as $school) {
                $entry = $run->schools()->create([
                    'institution_code' => $school['instCode'], 'institution_name' => $school['instName'],
                ]);
                SyncCatalogSchool::dispatch($entry->id)->onConnection('database')->afterCommit();
            }
        });
        $sync->finishIfReady($run->id);
    }

    public function failed(?Throwable $exception): void
    {
        CatalogSyncRun::whereKey($this->runId)->where('active_slot', 1)->whereDoesntHave('schools')->update([
            'status' => 'failed', 'active_slot' => null, 'finished_at' => now(),
            'error' => 'Could not load the portal school list. Check connectivity and retry.',
        ]);
    }
}
