<?php

use App\Models\Role;
use App\Models\User;
use Database\Seeders\DemoUsersSeeder;

beforeEach(function () {
    $this->artisan('rbac:sync')->assertSuccessful();
});

test('only the super administrator can clear imported data', function () {
    expect(Role::where('name', 'admin')->first()->permissions()->where('name', 'clear_data')->exists())->toBeFalse();

    $this->actingAs(User::factory()->withRole('admin')->create())
        ->postJson('/import/graduates/clear')->assertForbidden();
    $this->actingAs(User::factory()->withRole('admin')->create())
        ->postJson('/import/institutions/clear')->assertForbidden();
});

test('demo users are not created outside local', function () {
    $this->seed(DemoUsersSeeder::class);

    expect(User::whereIn('email', array_column(DemoUsersSeeder::ACCOUNTS, 1))->count())->toBe(0);
});

test('demo users get one account per default role locally', function () {
    $this->app->detectEnvironment(fn () => 'local');

    $this->seed(DemoUsersSeeder::class);
    $this->seed(DemoUsersSeeder::class); // re-running is safe

    foreach (DemoUsersSeeder::ACCOUNTS as $role => [, $email]) {
        $user = User::where('email', $email)->sole();
        expect($user->role->name)->toBe($role)->and($user->is_active)->toBeTrue();
    }
});
