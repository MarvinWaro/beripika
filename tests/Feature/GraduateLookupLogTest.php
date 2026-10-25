<?php

use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\User;

beforeEach(function () {
    $this->withoutVite();
    $this->graduate = Graduate::create([
        'last_name' => 'Cruz', 'first_name' => 'Ana', 'program_name' => 'BS IT',
        'date_graduated' => '2024-06-01', 'hei_uii' => '12001', 'so_number' => 'SO-1',
    ]);
});

test('verifier opening a graduate record is logged', function () {
    $verifier = User::factory()->withRole('verifier')->create();

    $this->actingAs($verifier)->getJson("/dashboard/graduate/{$this->graduate->id}")->assertOk();

    $log = ActivityLog::where('action', 'graduate_view')->sole();
    expect($log->user_id)->toBe($verifier->id)
        ->and($log->subject_id)->toBe($this->graduate->id)
        ->and($log->summary)->toBe('Viewed graduate Ana Cruz (SO: SO-1)');
});

test('verifier quick search refinements collapse into one entry, a new search adds another', function () {
    $this->actingAs(User::factory()->withRole('verifier')->create());

    $this->getJson('/dashboard/search?q=cr')->assertOk();
    $this->getJson('/dashboard/search?q=cru')->assertOk();
    $this->getJson('/dashboard/search?q=Cruz')->assertOk();

    $log = ActivityLog::where('action', 'graduate_search')->sole();
    expect($log->properties)->toMatchArray(['source' => 'dashboard', 'query' => 'Cruz', 'results' => 1]);

    $this->getJson('/dashboard/search?q=Santos')->assertOk();
    expect(ActivityLog::where('action', 'graduate_search')->count())->toBe(2);
});

test('verifier browsing the graduates page and a program list is logged', function () {
    $this->actingAs(User::factory()->withRole('verifier')->create());

    $this->get('/graduates?q=Cruz')->assertOk();
    $this->getJson('/institutions/12001/programs/graduates?program_name=BS%20IT')->assertOk()->assertJsonPath('total', 1);

    $sources = ActivityLog::where('action', 'graduate_search')->orderBy('id')->get()->pluck('properties.source')->all();
    expect($sources)->toBe(['graduates', 'program'])
        ->and(ActivityLog::where('action', 'graduate_search')->orderBy('id')->first()->summary)
        ->toBe('Searched graduates for "Cruz" (page 1, 1 total)');
});

test('lookups by staff who maintain graduate records are not logged', function (string $role) {
    $this->actingAs(User::factory()->withRole($role)->create());

    $this->getJson('/dashboard/search?q=Cruz')->assertOk();
    $this->getJson("/dashboard/graduate/{$this->graduate->id}")->assertOk();
    $this->get('/graduates')->assertOk();

    expect(ActivityLog::whereIn('action', ['graduate_view', 'graduate_search'])->count())->toBe(0);
})->with(['staff', 'admin', 'super_admin']);
