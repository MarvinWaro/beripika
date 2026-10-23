<?php

use App\Models\Graduate;
use App\Models\User;
use App\Services\GraduateData;

test('editing a graduate normalises the date and keeps lookup keys in sync', function () {
    $graduate = Graduate::create(['hei_uii' => '12001', 'so_number' => 'SO-1', 'last_name' => 'Cruz', 'first_name' => 'Ana', 'program_name' => 'BS IT', 'date_graduated' => '2023-04-01']);
    $this->actingAs(User::factory()->withRole('admin')->create());

    $this->putJson("/graduates/{$graduate->id}", [
        'last_name' => 'Cruz', 'first_name' => 'Ana', 'so_number' => 'SO-1',
        'program_name' => 'BS Information Technology', 'date_graduated' => '06/15/2024',
    ])->assertOk();

    $fresh = $graduate->fresh();
    expect($fresh->date_graduated)->toBe('2024-06-15')
        ->and($fresh->graduation_year)->toBe(2024)
        ->and($fresh->program_key)->toBe(GraduateData::nameKey('BS Information Technology'));
});

test('two graduates of the same HEI cannot share an SO number', function () {
    Graduate::create(['hei_uii' => '12001', 'so_number' => 'SO-1', 'last_name' => 'A', 'first_name' => 'A', 'program_name' => 'X', 'date_graduated' => '2024-01-01']);
    $other = Graduate::create(['hei_uii' => '12001', 'so_number' => 'SO-2', 'last_name' => 'B', 'first_name' => 'B', 'program_name' => 'X', 'date_graduated' => '2024-01-01']);
    $this->actingAs(User::factory()->withRole('admin')->create());

    $this->putJson("/graduates/{$other->id}", ['last_name' => 'B', 'first_name' => 'B', 'so_number' => 'SO-1', 'program_name' => 'X'])
        ->assertJsonValidationErrors('so_number');
});
