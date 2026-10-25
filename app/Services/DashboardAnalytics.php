<?php

namespace App\Services;

use App\Models\Graduate;
use App\Models\ProgramCatalog;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class DashboardAnalytics
{
    /** Top-N lists on the dashboard. */
    private const TOP_LIMIT = 10;

    /** Provinces shown before the rest fold into "Other". */
    private const PROVINCE_LIMIT = 8;

    /** Portal spellings that name the same province. */
    private const PROVINCE_ALIASES = ['NORTH COTABATO' => 'COTABATO'];

    /** Fixed order so a sector keeps its colour whatever the filter. */
    private const SECTORS = ['SUC', 'LUC', 'Private', 'Other', 'Not in portal'];

    private const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /**
     * @param  array<int, array<string, mixed>>  $schools  CHED portal directory (PortalService::schoolSnapshot()['data'])
     * @return array<string, mixed>
     */
    public function summarize(?int $year, ?string $institution, array $schools): array
    {
        $directory = collect($schools)->filter(fn ($school) => isset($school['instCode']))->keyBy('instCode')->all();
        $names = collect($directory)->map(fn ($school) => $school['instName'] ?? null);
        $query = Graduate::query()->when($year, fn ($q) => $q->where('graduation_year', $year))
            ->when($institution !== null, fn ($q) => $q->where('hei_uii', $institution));
        $programs = (clone $query)->whereNotNull('program_key')->where('program_key', '!=', GraduateData::nameKey(''));
        $institutions = (clone $query)->whereNotNull('hei_uii')->where('hei_uii', '!=', '');
        $total = (clone $query)->count();

        // One grouped query each; every per-HEI and per-program chart below is derived from these.
        $perHei = (clone $institutions)->selectRaw('hei_uii, COUNT(*) as total')->groupBy('hei_uii')->pluck('total', 'hei_uii')
            ->map(fn ($count) => (int) $count);
        // toBase(): aggregate rows are plain records, not Graduate models.
        $perProgram = (clone $programs)->toBase()->selectRaw('program_key, MIN(program_name) as label, COUNT(*) as count')->groupBy('program_key')->get()
            ->map(fn ($row) => ['label' => GraduateData::normalized($row->label), 'count' => (int) $row->count]);

        ['periods' => $periods, 'undated' => $undated] = $this->periodsBySex($query, $year);
        $sex = $this->sexTotals($query);
        $catalog = ProgramCatalog::pluck('program_type', 'normalized_name');

        return [
            'stats' => [
                'graduates' => $total,
                'institutions' => $perHei->count(),
                'programs' => $perProgram->count(),
                'female' => $sex['Female'],
                'male' => $sex['Male'],
                'notRecorded' => $sex['Not recorded'],
                'change' => $this->change($query, $institution, $year, $periods),
            ],
            'chartData' => [
                'trend' => $periods->map(fn ($counts, $label) => ['label' => (string) $label, 'count' => array_sum($counts)])->values()->all(),
                'undated' => $undated,
                'sex' => collect($sex)->map(fn ($count, $label) => ['label' => $label, 'count' => $count])->values()->all(),
                'sexTrend' => $periods->map(fn ($counts, $label) => ['label' => (string) $label] + $counts)->values()->all(),
                'topPrograms' => $perProgram->sortBy([['count', 'desc'], ['label', 'asc']])->take(self::TOP_LIMIT)->values()->all(),
                'topInstitutions' => $perHei->sortKeys()->sortDesc()->take(self::TOP_LIMIT)
                    ->map(fn ($count, $code) => ['label' => $names->get($code) ?: 'HEI '.$code, 'count' => $count])->values()->all(),
                'sectors' => $this->sectors($perHei, $directory),
                'provinces' => $this->provinces($perHei, $directory),
                'programTypes' => $this->programTypes($perProgram, $catalog),
            ],
            'quality' => $this->quality($query, $perHei, $perProgram, $directory, $catalog),
            'options' => [
                'years' => Graduate::whereNotNull('graduation_year')->distinct()->orderByDesc('graduation_year')->pluck('graduation_year'),
                'institutions' => Graduate::whereNotNull('hei_uii')->where('hei_uii', '!=', '')->distinct()->pluck('hei_uii')
                    ->map(fn ($code) => ['code' => (string) $code, 'name' => $names->get($code) ?: 'HEI '.$code])->sortBy('name')->values(),
            ],
            'hasRecords' => Graduate::exists(),
        ];
    }

    /**
     * Graduates per period split by sex: years, or months when a year is selected.
     * Months are derived in PHP so the query stays portable across MySQL and SQLite.
     *
     * @param  Builder<Graduate>  $query
     * @return array{periods: Collection<string, array{female: int, male: int, notRecorded: int}>, undated: int}
     */
    private function periodsBySex(Builder $query, ?int $year): array
    {
        $empty = ['female' => 0, 'male' => 0, 'notRecorded' => 0];
        $undated = (clone $query)->whereNull('graduation_year')->count();
        $periods = [];
        if ($year) {
            $periods = array_fill_keys(self::MONTHS, $empty);
            $rows = (clone $query)->toBase()->selectRaw('date_graduated, sex, COUNT(*) as total')->groupBy('date_graduated', 'sex')->get();
            foreach ($rows as $row) {
                try {
                    $month = self::MONTHS[(int) substr(GraduateData::date($row->date_graduated), 5, 2) - 1];
                } catch (\RuntimeException) {
                    $undated += (int) $row->total;

                    continue;
                }
                $periods[$month][$this->sexKey($row->sex)] += (int) $row->total;
            }
        } else {
            $rows = (clone $query)->toBase()->whereNotNull('graduation_year')->selectRaw('graduation_year, sex, COUNT(*) as total')
                ->groupBy('graduation_year', 'sex')->orderBy('graduation_year')->get();
            foreach ($rows as $row) {
                $periods[(string) $row->graduation_year] ??= $empty;
                $periods[(string) $row->graduation_year][$this->sexKey($row->sex)] += (int) $row->total;
            }
        }

        return ['periods' => collect($periods), 'undated' => $undated];
    }

    /** @return 'female'|'male'|'notRecorded' */
    private function sexKey(?string $sex): string
    {
        return match (GraduateData::normalized($sex)) {
            'MALE' => 'male', 'FEMALE' => 'female', default => 'notRecorded',
        };
    }

    /**
     * @param  Builder<Graduate>  $query
     * @return array{Male: int, Female: int, 'Not recorded': int}
     */
    private function sexTotals(Builder $query): array
    {
        $sex = ['Male' => 0, 'Female' => 0, 'Not recorded' => 0];
        foreach ((clone $query)->toBase()->selectRaw('sex, COUNT(*) as total')->groupBy('sex')->get() as $row) {
            $sex[match ($this->sexKey($row->sex)) {
                'male' => 'Male', 'female' => 'Female', default => 'Not recorded',
            }] += (int) $row->total;
        }

        return $sex;
    }

    /**
     * Year-over-year: the selected year against the one before, or the latest year against the one before it.
     *
     * @param  Builder<Graduate>  $query
     * @param  Collection<string, array{female: int, male: int, notRecorded: int}>  $periods
     * @return array{label: string, current: int, previous: int}|null
     */
    private function change(Builder $query, ?string $institution, ?int $year, Collection $periods): ?array
    {
        $current = $year ?? (int) $periods->keys()->last();
        if (! $current) {
            return null;
        }
        $count = fn (int $target) => Graduate::query()->where('graduation_year', $target)
            ->when($institution !== null, fn ($q) => $q->where('hei_uii', $institution))->count();

        return [
            'label' => $current.' vs '.($current - 1),
            'current' => $year ? (clone $query)->count() : $count($current),
            'previous' => $count($current - 1),
        ];
    }

    /**
     * @param  Collection<array-key, int>  $perHei
     * @param  array<array-key, array<string, mixed>>  $directory
     * @return list<array{label: string, count: int}>
     */
    private function sectors(Collection $perHei, array $directory): array
    {
        $totals = array_fill_keys(self::SECTORS, 0);
        foreach ($perHei as $code => $count) {
            $school = $directory[$code] ?? null;
            $sector = $school === null ? 'Not in portal' : match (GraduateData::normalized($school['ownershipHei_type'] ?? '')) {
                'SUC', 'SUC-SAT' => 'SUC',
                'LUC' => 'LUC',
                'PRIVATE' => 'Private',
                default => 'Other',
            };
            $totals[$sector] += $count;
        }

        return array_values(collect($totals)->filter()->map(fn ($count, $label) => ['label' => (string) $label, 'count' => $count])->all());
    }

    /**
     * @param  Collection<array-key, int>  $perHei
     * @param  array<array-key, array<string, mixed>>  $directory
     * @return list<array{label: string, count: int}>
     */
    private function provinces(Collection $perHei, array $directory): array
    {
        $totals = [];
        foreach ($perHei as $code => $count) {
            $school = $directory[$code] ?? null;
            $province = GraduateData::normalized($school['province'] ?? '');
            $label = match (true) {
                $school === null => 'Not in portal',
                $province === '' => 'Not recorded',
                default => mb_convert_case(self::PROVINCE_ALIASES[$province] ?? $province, MB_CASE_TITLE),
            };
            $totals[$label] = ($totals[$label] ?? 0) + $count;
        }
        arsort($totals);
        $rows = collect($totals)->map(fn ($count, $label) => ['label' => (string) $label, 'count' => $count])->values();
        $rest = $rows->slice(self::PROVINCE_LIMIT)->sum('count');

        return array_values($rows->take(self::PROVINCE_LIMIT)
            ->when($rest > 0, fn ($top) => $top->push(['label' => 'Other', 'count' => $rest]))->all());
    }

    /**
     * @param  Collection<int, array{label: string, count: int}>  $perProgram
     * @param  Collection<string, string>  $catalog
     * @return list<array{label: string, count: int}>
     */
    private function programTypes(Collection $perProgram, Collection $catalog): array
    {
        $totals = ['Board' => 0, 'Non-Board' => 0, 'Unclassified' => 0];
        foreach ($perProgram as $program) {
            $type = $catalog->get(ProgramCatalog::normalizeName($program['label']));
            $totals[in_array($type, ['Board', 'Non-Board'], true) ? $type : 'Unclassified'] += $program['count'];
        }

        return array_values(collect($totals)->filter()->map(fn ($count, $label) => ['label' => (string) $label, 'count' => $count])->all());
    }

    /**
     * Masterlist gaps Records can fix. A check is null when it cannot be measured yet.
     *
     * @param  Builder<Graduate>  $query
     * @param  Collection<array-key, int>  $perHei
     * @param  Collection<int, array{label: string, count: int}>  $perProgram
     * @param  array<array-key, array<string, mixed>>  $directory
     * @param  Collection<string, string>  $catalog
     * @return list<array{key: string, label: string, count: int|null}>
     */
    private function quality(Builder $query, Collection $perHei, Collection $perProgram, array $directory, Collection $catalog): array
    {
        $missing = fn (string $column) => (clone $query)->where(fn ($q) => $q->whereNull($column)->orWhere($column, ''))->count();

        return [
            ['key' => 'sex', 'label' => 'Sex not recorded', 'count' => $missing('sex')],
            ['key' => 'psced', 'label' => 'PSCED code missing', 'count' => $missing('psced_code')],
            ['key' => 'academic_year', 'label' => 'Academic year missing', 'count' => $missing('academic_year')],
            ['key' => 'hei', 'label' => 'HEI code not in the CHED portal', 'count' => $directory === [] ? null
                : $perHei->reject(fn ($count, $code) => isset($directory[$code]))->sum()],
            ['key' => 'catalog', 'label' => 'Program name not in the Program Catalog', 'count' => $catalog->isEmpty() ? null
                : $perProgram->reject(fn ($program) => $catalog->has(ProgramCatalog::normalizeName($program['label'])))->sum('count')],
        ];
    }
}
