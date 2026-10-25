<?php

namespace App\Services;

use App\Enums\Permission;
use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Audit trail of graduate lookups by read-only users (e.g. PRC verifiers).
 *
 * Graduate records hold personal data (names, birthdates), so every search and record view by a
 * user who can see graduates but not maintain them is written to Activity Logs. Staff who can edit
 * graduates are not logged here; their changes are already logged by GraduateController.
 */
class GraduateLookupLog
{
    /** Dashboard typeahead requests refining the same search within this window update one entry. */
    private const TYPEAHEAD_WINDOW_SECONDS = 30;

    public function applies(User $user): bool
    {
        return $user->hasPermission(Permission::VIEW_GRADUATES)
            && ! $user->hasPermission(Permission::UPDATE_GRADUATES);
    }

    public function view(User $user, Graduate $graduate): void
    {
        if (! $this->applies($user)) {
            return;
        }

        ActivityLog::record(
            'graduate_view',
            sprintf('Viewed graduate %s (SO: %s)', $graduate->fullName(), $graduate->so_number ?? 'N/A'),
            $graduate,
            ['so_number' => $graduate->so_number],
            $user->id,
        );
    }

    /** Dashboard quick search: typing "cru" → "cruz" refines one entry instead of logging each request. */
    public function quickSearch(User $user, string $query, int $results): void
    {
        if (! $this->applies($user)) {
            return;
        }

        $summary = sprintf('Searched graduates for "%s" (%d %s)', $query, $results, $results === 1 ? 'result' : 'results');
        $properties = ['source' => 'dashboard', 'query' => $query, 'results' => $results];

        $key = "graduate-lookup:typeahead:{$user->id}";
        $previous = Cache::get($key);
        $log = is_array($previous) && is_int($previous['log_id'] ?? null) && is_string($previous['query'] ?? null)
            && $this->refines($previous['query'], $query)
            ? ActivityLog::whereKey($previous['log_id'])->first()
            : null;

        if ($log) {
            $log->update(['summary' => $summary, 'properties' => $properties]);
        } else {
            $log = ActivityLog::record('graduate_search', $summary, properties: $properties, userId: $user->id);
        }

        Cache::put($key, ['log_id' => $log->id, 'query' => $query], now()->addSeconds(self::TYPEAHEAD_WINDOW_SECONDS));
    }

    /**
     * Graduates page: every page of results is logged, with or without a search term or filters.
     *
     * @param  array<string, string|int|null>  $filters
     */
    public function listSearch(User $user, ?string $query, int $page, int $total, array $filters = []): void
    {
        if (! $this->applies($user)) {
            return;
        }

        $filters = array_filter($filters, fn ($value) => $value !== null && $value !== '');
        $scope = $filters
            ? ' · '.implode(', ', array_map(fn ($key, $value) => "{$key}: {$value}", array_keys($filters), $filters))
            : '';
        $summary = match (true) {
            (bool) $query => sprintf('Searched graduates for "%s"%s (page %d, %d total)', $query, $scope, $page, $total),
            (bool) $filters => sprintf('Filtered graduate list%s (page %d, %d total)', $scope, $page, $total),
            default => sprintf('Browsed graduate list (page %d, %d total)', $page, $total),
        };

        ActivityLog::record('graduate_search', $summary, properties: [
            'source' => 'graduates', 'query' => $query, 'filters' => $filters ?: null, 'page' => $page, 'results' => $total,
        ], userId: $user->id);
    }

    /** Institutions → program → graduates dialog. */
    public function programList(User $user, string $instCode, string $program, ?string $major, ?int $year, int $page, int $total): void
    {
        if (! $this->applies($user)) {
            return;
        }

        $programLabel = $major ? "{$program} ({$major})" : $program;
        $summary = sprintf('Listed graduates of %s at HEI %s%s (page %d, %d total)',
            $programLabel, $instCode, $year ? ", {$year}" : '', $page, $total);

        ActivityLog::record('graduate_search', $summary, properties: [
            'source' => 'program', 'institution_code' => $instCode, 'program_name' => $program,
            'major' => $major, 'year' => $year, 'page' => $page, 'results' => $total,
        ], userId: $user->id);
    }

    private function refines(string $previous, string $current): bool
    {
        $previous = mb_strtolower($previous);
        $current = mb_strtolower($current);

        return str_starts_with($current, $previous) || str_starts_with($previous, $current);
    }
}
