<?php

namespace App\Http\Controllers;

use App\Models\GraduateImport;
use App\Services\GraduateImportProcessor;
use App\Services\GraduateImportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class GraduateImportController extends Controller
{
    public function store(Request $request, GraduateImportService $service)
    {
        $request->validate(['file' => 'required|file|mimes:xlsx,xls|max:32768']);

        return response()->json(['run' => $service->serialize($service->start($request->file('file'), $request->user()->id))], 202);
    }

    public function index(Request $request, GraduateImportService $service)
    {
        $runs = GraduateImport::latest('id')->paginate(10)->through(fn ($run) => $service->serialize($run));

        return response()->json(['runs' => $runs, 'active_id' => GraduateImport::where('active_slot', 1)->value('id'),
            'worker_last_seen' => Cache::get('imports:worker_seen'), 'max_upload_mb' => 32]);
    }

    public function show(GraduateImport $run, GraduateImportService $service)
    {
        return response()->json(['run' => $service->serialize($run), 'worker_last_seen' => Cache::get('imports:worker_seen')]);
    }

    public function retry(GraduateImport $run, GraduateImportService $service)
    {
        return response()->json(['run' => $service->serialize($service->retry($run))], 202);
    }

    public function process(GraduateImport $run, GraduateImportProcessor $processor, GraduateImportService $service)
    {
        $processor->process($run);

        return response()->json(['run' => $service->serialize($run->fresh())]);
    }

    public function review(Request $request, GraduateImport $run)
    {
        $request->validate(['page' => 'sometimes|integer|min:1']);

        return response()->json(DB::table('graduate_import_issues')->where('graduate_import_id', $run->id)
            ->orderBy('row_number')->orderBy('id')->paginate(25, ['id', 'row_number', 'severity', 'message']));
    }

    public function issues(GraduateImport $run)
    {
        return response()->streamDownload(function () use ($run) {
            $stream = fopen('php://output', 'w');
            fputcsv($stream, ['Excel row', 'Severity', 'Issue']);
            foreach (DB::table('graduate_import_issues')->where('graduate_import_id', $run->id)->orderBy('row_number')->cursor() as $issue) {
                fputcsv($stream, [$issue->row_number, $issue->severity, $issue->message]);
            }
            fclose($stream);
        }, 'import-'.$run->id.'-issues.csv', ['Content-Type' => 'text/csv', 'Cache-Control' => 'private, no-store']);
    }
}
