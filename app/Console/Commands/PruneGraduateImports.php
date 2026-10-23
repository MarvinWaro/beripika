<?php

namespace App\Console\Commands;

use App\Models\GraduateImport;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PruneGraduateImports extends Command
{
    protected $signature = 'graduates:prune-imports';

    protected $description = 'Remove private source files and staged rows 30 days after completed imports';

    public function handle(): int
    {
        foreach (GraduateImport::whereIn('status', ['completed', 'completed_with_issues'])->where('finished_at', '<', now()->subDays(30))->whereNotNull('path')->cursor() as $run) {
            if (Storage::disk('local')->exists($run->path) && ! Storage::disk('local')->delete($run->path)) {
                continue;
            }
            DB::table('graduate_import_rows')->where('graduate_import_id', $run->id)->delete();
            Storage::disk('local')->deleteDirectory($run->path.'.parts');
            $run->update(['path' => null]);
        }

        return self::SUCCESS;
    }
}
