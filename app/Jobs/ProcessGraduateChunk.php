<?php

namespace App\Jobs;

use App\Models\GraduateImport;
use App\Models\GraduateImportChunk;
use App\Services\GraduateImportService;
use App\Services\SoaisReader;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class ProcessGraduateChunk implements ShouldQueue
{
    use Queueable;

    public int $timeout = 45;

    public int $tries = 1;

    public bool $failOnTimeout = true;

    public function __construct(public int $chunkId, public string $phase) {}

    public function handle(GraduateImportService $service, SoaisReader $reader): void
    {
        Cache::put('imports:worker_seen', now()->toIso8601String(), now()->addDays(7));
        $lock = Cache::lock('graduate-import:chunk:'.$this->chunkId, 75);
        if (! $lock->get()) {
            // Keep the delivery available while an interrupted worker's lock expires.
            $this->release(75);

            return;
        }
        try {
            $chunk = GraduateImportChunk::findOrFail($this->chunkId);
            $run = GraduateImport::findOrFail($chunk->graduate_import_id);
            if (! $run->active_slot || $chunk->phase !== $this->phase) {
                return;
            }
            if ($chunk->status === 'completed') {
                $service->advance($run->id);

                return;
            }
            $run->update(['status' => 'processing']);
            $chunk->update(['status' => 'processing']);
            if ($this->phase === 'reading') {
                $service->readChunk($chunk, $run, $reader);
            } else {
                $service->writeChunk($chunk, $run);
            }
            $service->advance($run->id);
        } finally {
            $lock->release();
        }
    }

    public function failed(?\Throwable $exception): void
    {
        $chunk = GraduateImportChunk::find($this->chunkId);
        if ($chunk && $chunk->phase === $this->phase) {
            if ($chunk->status !== 'completed') {
                $chunk->update(['status' => 'failed', 'error' => 'Chunk failed or timed out. Retry this import to resume.']);
            }
            app(GraduateImportService::class)->advance($chunk->graduate_import_id);
        }
    }
}
