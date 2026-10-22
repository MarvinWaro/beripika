<?php

namespace App\Http\Controllers;

use App\Enums\Permission;
use App\Models\ActivityLog;
use App\Models\CatalogSyncRun;
use App\Models\ProgramCatalog;
use App\Services\CatalogSyncService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ProgramCatalogController extends Controller
{
    public function index(Request $request, CatalogSyncService $sync)
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'type' => ['nullable', Rule::in(['Board', 'Non-Board', 'Unknown'])],
            'per_page' => ['nullable', 'integer', Rule::in([10, 25, 50])],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $q = trim($validated['q'] ?? '');
        $type = $validated['type'] ?? '';
        $perPage = (int) ($validated['per_page'] ?? 10);
        $query = ProgramCatalog::query()->when($q !== '', fn ($builder) => $builder->where('program_name', 'like', '%'.$q.'%'));
        $counts = (clone $query)->selectRaw('program_type, COUNT(*) AS total')->groupBy('program_type')->pluck('total', 'program_type');
        $query->when($type !== '', fn ($builder) => $builder->where('program_type', $type));
        $page = min((int) ($validated['page'] ?? 1), max(1, (int) ceil((clone $query)->count() / $perPage)));
        $programs = $query->orderBy('program_name')->paginate($perPage, ['*'], 'page', $page)->withQueryString();
        $run = $request->user()->hasPermission(Permission::UPDATE_PROGRAM_CATALOG)
            ? CatalogSyncRun::latest('id')->first() : null;

        return Inertia::render('programs/catalog', [
            'programs' => $programs,
            'filters' => ['q' => $q, 'type' => $type, 'per_page' => $perPage],
            'counts' => ['all' => $counts->sum(), 'Board' => (int) ($counts['Board'] ?? 0),
                'Non-Board' => (int) ($counts['Non-Board'] ?? 0), 'Unknown' => (int) ($counts['Unknown'] ?? 0)],
            'sync_run' => $run ? $sync->serialize($run) : null,
        ]);
    }

    public function update(Request $request, ProgramCatalog $programCatalog)
    {
        $validated = $request->validate(['program_type' => ['required', Rule::in(['Board', 'Non-Board', 'Unknown'])]]);
        DB::transaction(function () use ($request, $programCatalog, $validated) {
            $program = ProgramCatalog::lockForUpdate()->findOrFail($programCatalog->id);
            $before = $program->program_type;
            if ($before === $validated['program_type']) {
                return;
            }
            $program->update($validated);
            ActivityLog::create([
                'user_id' => $request->user()->id, 'action' => 'program_catalog_update',
                'subject_type' => ProgramCatalog::class, 'subject_id' => $program->id,
                'summary' => 'Updated classification for '.$program->program_name,
                'properties' => ['before' => $before, 'after' => $program->program_type],
            ]);
        });

        return response()->json(['data' => $programCatalog->fresh()]);
    }

    public function startSync(Request $request, CatalogSyncService $sync)
    {
        $validated = $request->validate(['retry_run_id' => ['nullable', 'integer', 'exists:catalog_sync_runs,id']]);
        $retry = isset($validated['retry_run_id']) ? CatalogSyncRun::findOrFail($validated['retry_run_id']) : null;
        $run = $sync->start($request->user()->id, $retry);

        return response()->json($sync->serialize($run), 202);
    }

    public function syncStatus(CatalogSyncRun $run, CatalogSyncService $sync)
    {
        return response()->json($sync->serialize($run));
    }
}
