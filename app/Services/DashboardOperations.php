<?php

namespace App\Services;

use App\Enums\Permission;
use App\Models\ActivityLog;
use App\Models\Concern;
use App\Models\GraduateImport;
use App\Models\User;

/**
 * Operational panel of the dashboard. Each section is only built for users who may open the
 * matching module; otherwise it is null and the page hides it.
 */
class DashboardOperations
{
    private const CONCERN_STATUSES = ['pending' => 'Pending', 'in_progress' => 'In progress', 'resolved' => 'Resolved', 'dismissed' => 'Dismissed'];

    private const RECENT_IMPORTS = 5;

    private const LOOKUP_MONTHS = 6;

    public function __construct(private GraduateImportService $imports) {}

    /**
     * @return array{concerns: list<array{status: string, label: string, count: int}>|null, imports: list<array<string, mixed>>|null, lookups: list<array{label: string, views: int, searches: int}>|null}
     */
    public function summarize(User $user): array
    {
        return [
            'concerns' => $user->hasPermission(Permission::VIEW_CONCERNS) ? $this->concerns() : null,
            'imports' => $user->hasPermission(Permission::VIEW_IMPORTS) ? $this->recentImports() : null,
            'lookups' => $user->hasPermission(Permission::VIEW_ACTIVITY_LOGS) ? $this->lookups() : null,
        ];
    }

    /** @return list<array{status: string, label: string, count: int}> */
    private function concerns(): array
    {
        $counts = Concern::query()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        return array_values(collect(self::CONCERN_STATUSES)
            ->map(fn ($label, $status) => ['status' => $status, 'label' => $label, 'count' => (int) ($counts[$status] ?? 0)])
            ->all());
    }

    /** @return list<array<string, mixed>> */
    private function recentImports(): array
    {
        return array_values(GraduateImport::query()->latest('id')->limit(self::RECENT_IMPORTS)->get()
            ->map(function (GraduateImport $run) {
                $summary = $this->imports->serialize($run);

                return ['id' => $summary['id'], 'filename' => $summary['filename'], 'status' => $summary['status'],
                    'created_at' => $summary['created_at'], 'counts' => $summary['counts']];
            })->all());
    }

    /**
     * Graduate record views and searches written by GraduateLookupLog, per month.
     *
     * @return list<array{label: string, views: int, searches: int}>
     */
    private function lookups(): array
    {
        $start = now()->startOfMonth()->subMonths(self::LOOKUP_MONTHS - 1);
        $months = [];
        for ($month = $start->copy(); $month <= now(); $month = $month->addMonth()) {
            $months[$month->format('Y-m')] = ['label' => $month->format('M Y'), 'views' => 0, 'searches' => 0];
        }
        // DATE() works on MySQL and SQLite; months are folded in PHP.
        $rows = ActivityLog::query()->toBase()->whereIn('action', ['graduate_view', 'graduate_search'])->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as day, action, COUNT(*) as total')->groupBy('day', 'action')->get();
        foreach ($rows as $row) {
            $key = substr((string) $row->day, 0, 7);
            if (isset($months[$key])) {
                $months[$key][$row->action === 'graduate_view' ? 'views' : 'searches'] += (int) $row->total;
            }
        }

        return array_values($months);
    }
}
