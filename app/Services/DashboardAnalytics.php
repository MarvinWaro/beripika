<?php

namespace App\Services;

use App\Models\Graduate;

class DashboardAnalytics
{
    public function summarize(?int $year, ?string $institution, array $schools): array
    {
        $names = collect($schools)->pluck('instName', 'instCode');
        $query = Graduate::query()->when($year, fn ($q) => $q->where('graduation_year', $year))
            ->when($institution !== null, fn ($q) => $q->where('hei_uii', $institution));
        $programs = (clone $query)->whereNotNull('program_key')->where('program_key', '!=', GraduateData::nameKey(''));
        $institutions = (clone $query)->whereNotNull('hei_uii')->where('hei_uii', '!=', '');
        $total = (clone $query)->count();
        $missingYear = (clone $query)->whereNull('graduation_year')->count();
        $trend = [];
        $undated = $missingYear;
        if ($year) {
            $months = array_fill(1, 12, 0);
            $dates = (clone $query)->selectRaw('date_graduated, COUNT(*) as total')->groupBy('date_graduated')->get();
            foreach ($dates as $date) {
                try {
                    $normalized = GraduateData::date($date->date_graduated);
                    $months[(int) substr($normalized, 5, 2)] += (int) $date->total;
                } catch (\RuntimeException) {
                    $undated += (int) $date->total;
                }
            }
            foreach ($months as $month => $count) {
                $trend[] = ['label' => date('M', mktime(0, 0, 0, $month, 1)), 'count' => $count];
            }
        } else {
            $trend = (clone $query)->whereNotNull('graduation_year')->selectRaw('graduation_year, COUNT(*) as total')
                ->groupBy('graduation_year')->orderBy('graduation_year')->get()
                ->map(fn ($row) => ['label' => (string) $row->graduation_year, 'count' => (int) $row->total])->all();
        }
        $sex = ['Male' => 0, 'Female' => 0, 'Not recorded' => 0];
        foreach ((clone $query)->selectRaw('sex, COUNT(*) as total')->groupBy('sex')->get() as $row) {
            $label = match (GraduateData::normalized($row->sex)) {
                'MALE' => 'Male', 'FEMALE' => 'Female', default => 'Not recorded',
            };
            $sex[$label] += (int) $row->total;
        }

        return [
            'stats' => ['graduates' => $total, 'institutions' => (clone $institutions)->distinct()->count('hei_uii'),
                'programs' => (clone $programs)->distinct()->count('program_key')],
            'chartData' => [
                'trend' => $trend, 'undated' => $undated,
                'sex' => collect($sex)->map(fn ($count, $label) => ['label' => $label, 'count' => $count])->values()->all(),
                'topPrograms' => (clone $programs)->selectRaw('program_key, MIN(program_name) as label, COUNT(*) as count')
                    ->groupBy('program_key')->orderByDesc('count')->orderBy('label')->limit(10)->get()
                    ->map(fn ($row) => ['label' => GraduateData::normalized($row->label), 'count' => (int) $row->count])->all(),
                'topInstitutions' => (clone $institutions)->selectRaw('hei_uii, COUNT(*) as count')
                    ->groupBy('hei_uii')->orderByDesc('count')->orderBy('hei_uii')->limit(10)->get()
                    ->map(fn ($row) => ['label' => $names->get($row->hei_uii) ?: 'HEI '.$row->hei_uii, 'count' => (int) $row->count])->all(),
            ],
            'options' => [
                'years' => Graduate::whereNotNull('graduation_year')->distinct()->orderByDesc('graduation_year')->pluck('graduation_year'),
                'institutions' => Graduate::whereNotNull('hei_uii')->where('hei_uii', '!=', '')->distinct()->pluck('hei_uii')
                    ->map(fn ($code) => ['code' => (string) $code, 'name' => $names->get($code) ?: 'HEI '.$code])->sortBy('name')->values(),
            ],
            'hasRecords' => Graduate::exists(),
        ];
    }
}
