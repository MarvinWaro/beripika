<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        Gate::authorize('viewActivityLogs');

        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:255'],
            'action' => ['nullable', 'string', 'max:64'],
        ]);

        $logs = ActivityLog::with('user:id,name,email')
            ->when($filters['action'] ?? null, fn ($q, $action) => $q->where('action', $action))
            ->when($filters['q'] ?? null, fn ($q, $search) => $q->where(fn ($q) => $q
                ->where('summary', 'like', "%{$search}%")
                ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"))))
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('logs/index', [
            'logs' => $logs->through(fn (ActivityLog $log) => [
                'id' => $log->id,
                'user_name' => $log->user?->name ?? 'System',
                'user_email' => $log->user?->email,
                'action' => $log->action,
                'summary' => $log->summary,
                'properties' => $log->properties,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at->toDateTimeString(),
            ]),
            'filters' => ['q' => $filters['q'] ?? null, 'action' => $filters['action'] ?? null],
            'actions' => ActivityLog::query()->distinct()->orderBy('action')->pluck('action'),
        ]);
    }
}
