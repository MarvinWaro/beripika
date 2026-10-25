<?php

use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    $this->withoutVite();
    // Portal school list served from cache so tests never call the CHED portal.
    Cache::put('portal:v2:schools', ['data' => [
        ['instCode' => '12001', 'instName' => 'Alpha College'],
        ['instCode' => '12002', 'instName' => 'Beta University'],
    ], 'last_fetched_at' => now()->toIso8601String()]);

    $make = fn (string $so, string $last, string $hei, string $program, string $date, string $sex) => Graduate::create([
        'so_number' => $so, 'last_name' => $last, 'first_name' => 'Test', 'hei_uii' => $hei,
        'program_name' => $program, 'date_graduated' => $date, 'sex' => $sex,
    ]);
    $make('SO-1', 'Cruz', '12001', 'BS IT', '2024-06-01', 'FEMALE');
    $make('SO-2', 'Cruz', '12002', 'BS IT', '2024-06-01', 'MALE');
    $make('SO-3', 'Reyes', '12001', 'BS Nursing', '2023-06-01', 'FEMALE');
    $make('SO-4', 'Santos', '12002', 'BS Criminology', '2023-06-01', 'MALE');

    $this->actingAs(User::factory()->withRole('staff')->create());
});

function graduateSoNumbers(string $query): array
{
    return collect(test()->get('/graduates'.$query)->assertOk()->viewData('page')['props']['graduates']['data'])
        ->pluck('so_number')->sort()->values()->all();
}

test('each filter narrows the graduate list', function (string $query, array $expected) {
    expect(graduateSoNumbers($query))->toBe($expected);
})->with([
    'institution' => ['?hei=12001', ['SO-1', 'SO-3']],
    'program (case and spacing insensitive)' => ['?program=bs%20%20it', ['SO-1', 'SO-2']],
    'year graduated' => ['?year=2023', ['SO-3', 'SO-4']],
    'sex' => ['?sex=MALE', ['SO-2', 'SO-4']],
    'combined' => ['?hei=12002&year=2024&sex=MALE', ['SO-2']],
]);

test('filters are ANDed with the whole search, not just its last OR branch', function () {
    expect(graduateSoNumbers('?q=Cruz&hei=12001'))->toBe(['SO-1']);
});

test('filter options come from existing graduates and programs follow the chosen institution', function () {
    $this->get('/graduates?hei=12002')->assertOk()->assertInertia(fn ($page) => $page
        ->where('filters.hei', '12002')
        ->where('filterOptions.institutions', [
            ['value' => '12001', 'label' => '12001 — Alpha College'],
            ['value' => '12002', 'label' => '12002 — Beta University'],
        ])
        ->where('filterOptions.programs', ['BS Criminology', 'BS IT'])
        ->where('filterOptions.years', [2024, 2023]));
});

test('invalid filter values are rejected', function () {
    $this->get('/graduates?sex=X')->assertSessionHasErrors('sex');
    $this->get('/graduates?year=abc')->assertSessionHasErrors('year');
});

test('verifier lookups record the filters used', function () {
    $this->actingAs(User::factory()->withRole('verifier')->create());

    $this->get('/graduates?hei=12001&year=2024')->assertOk();

    $log = ActivityLog::where('action', 'graduate_search')->sole();
    expect($log->summary)->toBe('Filtered graduate list · hei: 12001, year: 2024 (page 1, 1 total)')
        ->and($log->properties['filters'])->toBe(['hei' => '12001', 'year' => 2024]);
});
