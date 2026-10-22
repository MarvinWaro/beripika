<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Concern;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ConcernController extends Controller
{
    /** Admin list of concerns. */
    public function index(Request $request)
    {
        Gate::authorize('viewConcerns');

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', Rule::in(Concern::STATUSES)],
        ]);

        $concerns = Concern::query()
            ->with('resolver:id,name')
            ->when($filters['q'] ?? null, fn ($query, $search) => $query->where(fn ($q) => $q
                ->where('school', 'like', "%{$search}%")
                ->orWhere('program', 'like', "%{$search}%")
                ->orWhere('concern', 'like', "%{$search}%")))
            ->when($filters['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->paginate(10)
            ->withQueryString()
            ->through(fn (Concern $concern) => [
                'id' => $concern->id,
                'institution_code' => $concern->institution_code,
                'school' => $concern->school,
                'program' => $concern->program,
                'concern' => $concern->concern,
                'status' => $concern->status,
                'resolved_by' => $concern->resolver?->name,
                'resolved_at' => $concern->resolved_at?->format('M d, Y h:i A'),
                'created_at' => $concern->created_at->format('M d, Y h:i A'),
            ]);

        return Inertia::render('concerns/index', [
            'concerns' => $concerns,
            'filters' => ['q' => $filters['q'] ?? null, 'status' => $filters['status'] ?? null],
            'statusCounts' => Concern::selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status'),
            'statuses' => Concern::STATUSES,
        ]);
    }

    /** Change the status of a concern. */
    public function update(Request $request, Concern $concern)
    {
        Gate::authorize('updateConcerns');

        $validated = $request->validate(['status' => ['required', Rule::in(Concern::STATUSES)]]);
        $before = $concern->status;
        $closed = in_array($validated['status'], ['resolved', 'dismissed'], true);
        $concern->update([
            'status' => $validated['status'],
            'resolved_by' => $closed ? $request->user()->id : null,
            'resolved_at' => $closed ? now() : null,
        ]);
        ActivityLog::record('concern_update', "Concern #{$concern->id} marked {$concern->status}", $concern, ['before' => $before, 'after' => $concern->status]);

        return $request->expectsJson() && ! $request->header('X-Inertia')
            ? response()->json(['success' => true])
            : redirect()->back()->with('success', 'Concern updated.');
    }

    /** Public API: submit a concern from the welcome page. */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'institution_code' => ['nullable', 'string', 'max:32'],
            'school' => ['required', 'string', 'max:255'],
            'program' => ['required', 'string', 'max:255'],
            'concern' => ['required', 'string', 'max:5000'],
        ]);

        Concern::create($validated);

        return response()->json(['message' => 'Concern logged successfully']);
    }
}
