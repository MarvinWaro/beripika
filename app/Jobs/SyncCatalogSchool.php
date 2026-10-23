<?php

namespace App\Jobs;

use App\Models\CatalogSyncRun;
use App\Models\CatalogSyncSchool;
use App\Services\CatalogSyncService;
use App\Services\PortalService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

class SyncCatalogSchool implements ShouldQueue
{
    use Queueable;

    public int $timeout = 45;

    public int $tries = 1;

    public bool $failOnTimeout = true;

    public function __construct(public int $schoolId) {}

    public function handle(PortalService $portal, CatalogSyncService $sync): void
    {
        $lock = Cache::lock('catalog-sync:school:'.$this->schoolId, 60);
        if (! $lock->get()) {
            // A duplicate delivery must not fail the school being handled by its lock owner.

            return;
        }
        try {
            $school = CatalogSyncSchool::findOrFail($this->schoolId);
            if ($school->status === 'completed') {
                return;
            }
            CatalogSyncRun::whereKey($school->catalog_sync_run_id)->update(['status' => 'running']);
            $school->update(['status' => 'running']);
            $snapshot = $portal->programSnapshot($school->institution_code, true);
            if ($snapshot['error']) {
                $school->update(['status' => 'failed', 'error' => $snapshot['error']]);
            } else {
                DB::transaction(function () use ($school, $snapshot, $sync) {
                    $created = $sync->insertPrograms($snapshot['data']);
                    $school->update(['status' => 'completed', 'error' => null, 'created_count' => $created]);
                });
            }
            $sync->finishIfReady($school->catalog_sync_run_id);
        } finally {
            $lock->release();
        }
    }

    public function failed(?Throwable $exception): void
    {
        $school = CatalogSyncSchool::find($this->schoolId);
        if ($school && $school->status !== 'completed') {
            $school->update(['status' => 'failed', 'error' => 'School sync failed or timed out. Retry this school.']);
            app(CatalogSyncService::class)->finishIfReady($school->catalog_sync_run_id);
        }
    }
}
