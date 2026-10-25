<?php

use App\Models\ActivityLog;
use App\Models\Concern;
use App\Models\Graduate;
use App\Models\ProgramCatalog;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

function portalSchools(array $schools): void
{
    Cache::put('portal:v2:schools', ['data' => $schools, 'last_fetched_at' => now()->toIso8601String()]);
}

function makeGraduate(string $so, string $hei, string $date, ?string $sex, string $program = 'BS IT'): Graduate
{
    return Graduate::create(['so_number' => $so, 'last_name' => 'Test', 'first_name' => $so, 'hei_uii' => $hei,
        'program_name' => $program, 'date_graduated' => $date, 'sex' => $sex]);
}

beforeEach(function () {
    $this->withoutVite();
    portalSchools([
        ['instCode' => '12001', 'instName' => 'Alpha State College', 'ownershipHei_type' => 'SUC-SAT', 'province' => 'NORTH COTABATO '],
        ['instCode' => '12002', 'instName' => 'Beta College', 'ownershipHei_type' => 'PRIVATE', 'province' => 'South Cotabato'],
        ['instCode' => '12003', 'instName' => 'Gamma City College', 'ownershipHei_type' => 'LUC', 'province' => ''],
    ]);
    makeGraduate('SO-1', '12001', '2023-06-01', 'FEMALE');
    makeGraduate('SO-2', '12001', '2024-06-01', 'MALE');
    makeGraduate('SO-3', '12002', '2024-06-01', 'FEMALE');
    makeGraduate('SO-4', '12002', '2024-06-01', 'FEMALE');
    makeGraduate('SO-5', '12003', '2024-06-01', null, 'BS Nursing');
    makeGraduate('SO-6', '12099', '2023-06-01', 'MALE');
    ProgramCatalog::create(['program_name' => 'BS IT', 'normalized_name' => 'BS IT', 'program_type' => 'Board']);
    $this->actingAs(User::factory()->withRole('admin')->create());
});

test('consolidated stats include sex split and year-over-year change', function () {
    $this->get('/dashboard')->assertOk()->assertInertia(fn ($page) => $page
        ->where('stats.graduates', 6)
        ->where('stats.female', 3)
        ->where('stats.male', 2)
        ->where('stats.notRecorded', 1)
        ->where('stats.change', ['label' => '2024 vs 2023', 'current' => 4, 'previous' => 2]));
});

test('sex per period adds up to the trend, by year and by month', function () {
    $this->get('/dashboard')->assertInertia(fn ($page) => $page
        ->where('chartData.trend', [['label' => '2023', 'count' => 2], ['label' => '2024', 'count' => 4]])
        ->where('chartData.sexTrend', [
            ['label' => '2023', 'female' => 1, 'male' => 1, 'notRecorded' => 0],
            ['label' => '2024', 'female' => 2, 'male' => 1, 'notRecorded' => 1],
        ]));

    $this->get('/dashboard?year=2024')->assertInertia(fn ($page) => $page
        ->has('chartData.trend', 12)
        ->where('chartData.trend.5', ['label' => 'Jun', 'count' => 4])
        ->where('chartData.sexTrend.5', ['label' => 'Jun', 'female' => 2, 'male' => 1, 'notRecorded' => 1])
        ->where('stats.change', ['label' => '2024 vs 2023', 'current' => 4, 'previous' => 2]));
});

test('school profile groups sectors and normalizes provinces from the portal', function () {
    $this->get('/dashboard')->assertInertia(fn ($page) => $page
        ->where('chartData.sectors', [
            ['label' => 'SUC', 'count' => 2],
            ['label' => 'LUC', 'count' => 1],
            ['label' => 'Private', 'count' => 2],
            ['label' => 'Not in portal', 'count' => 1],
        ])
        ->where('chartData.provinces', fn ($provinces) => collect($provinces)->sortBy('label')->values()->all() === [
            ['label' => 'Cotabato', 'count' => 2],
            ['label' => 'Not in portal', 'count' => 1],
            ['label' => 'Not recorded', 'count' => 1],
            ['label' => 'South Cotabato', 'count' => 2],
        ]));
});

test('provinces beyond the top eight fold into Other', function () {
    $schools = [];
    foreach (range(1, 10) as $i) {
        $code = (string) (13000 + $i);
        $schools[] = ['instCode' => $code, 'instName' => "School {$i}", 'ownershipHei_type' => 'PRIVATE', 'province' => "Province {$i}"];
        foreach (range(1, 11 - $i) as $n) {
            makeGraduate("P{$i}-{$n}", $code, '2024-06-01', 'FEMALE');
        }
    }
    portalSchools($schools);

    $this->get('/dashboard')->assertInertia(fn ($page) => $page
        ->has('chartData.provinces', 9)
        ->where('chartData.provinces.8.label', 'Other'));
});

test('board share and data quality follow the catalog and the portal', function () {
    $this->get('/dashboard')->assertInertia(fn ($page) => $page
        ->where('chartData.programTypes', [['label' => 'Board', 'count' => 5], ['label' => 'Unclassified', 'count' => 1]])
        ->where('quality', fn ($checks) => collect($checks)->pluck('count', 'key')->all() === [
            'sex' => 1, 'psced' => 6, 'academic_year' => 6, 'hei' => 1, 'catalog' => 1,
        ]));
});

test('operations sections follow permissions', function (string $role, array $present) {
    Concern::create(['institution_code' => '12001', 'school' => 'Alpha', 'program' => 'BS IT', 'concern' => 'Test', 'status' => 'pending']);
    ActivityLog::record('graduate_view', 'Viewed graduate', userId: null);
    $this->actingAs(User::factory()->withRole($role)->create());

    $this->get('/dashboard')->assertOk()->assertInertia(function ($page) use ($present) {
        foreach (['concerns', 'imports', 'lookups'] as $section) {
            in_array($section, $present, true)
                ? $page->whereNot("operations.{$section}", null)
                : $page->where("operations.{$section}", null);
        }
    });
})->with([
    'admin sees everything' => ['admin', ['concerns', 'imports', 'lookups']],
    'records staff sees concerns and imports' => ['staff', ['concerns', 'imports']],
    'PRC sees no operations' => ['verifier', []],
    'viewer sees no operations' => ['viewer', []],
]);

test('operations counts concerns by status and lookups per month', function () {
    Concern::create(['institution_code' => '12001', 'school' => 'Alpha', 'program' => 'BS IT', 'concern' => 'Test', 'status' => 'pending']);
    ActivityLog::record('graduate_view', 'Viewed graduate', userId: null);
    ActivityLog::record('graduate_search', 'Searched graduates', userId: null);

    $this->get('/dashboard')->assertInertia(fn ($page) => $page
        ->where('operations.concerns.0', ['status' => 'pending', 'label' => 'Pending', 'count' => 1])
        ->has('operations.lookups', 6)
        ->where('operations.lookups.5.views', 1)
        ->where('operations.lookups.5.searches', 1));
});
