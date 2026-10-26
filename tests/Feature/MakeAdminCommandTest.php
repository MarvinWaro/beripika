<?php

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use App\Support\DefaultRoles;
use Illuminate\Support\Facades\Hash;

test('make:admin creates an active, verified super administrator on a fresh database', function () {
    expect(Role::count())->toBe(0);

    $this->artisan('make:admin')
        ->expectsQuestion('Name', 'Marvin Waro')
        ->expectsQuestion('Email', 'marvin@ched.gov.ph')
        ->expectsQuestion('Password', 'Secret-pass-123')
        ->expectsQuestion('Confirm password', 'Secret-pass-123')
        ->expectsOutputToContain('Super administrator created: marvin@ched.gov.ph')
        ->assertSuccessful();

    $user = User::where('email', 'marvin@ched.gov.ph')->sole();
    expect($user->role->name)->toBe(DefaultRoles::SUPER_ADMIN)
        ->and($user->isSuperAdmin())->toBeTrue()
        ->and($user->email_verified_at)->not->toBeNull()
        ->and(Hash::check('Secret-pass-123', $user->password))->toBeTrue()
        ->and(ActivityLog::where('action', 'user_create')->where('subject_id', $user->id)->exists())->toBeTrue();
});

// On a real terminal an invalid answer is asked again; under test Laravel stops at the first one.
test('make:admin rejects an email that is already taken', function () {
    User::factory()->create(['email' => 'taken@ched.gov.ph']);

    $this->artisan('make:admin')
        ->expectsQuestion('Name', 'Second Admin')
        ->expectsQuestion('Email', 'taken@ched.gov.ph')
        ->expectsOutputToContain('The email has already been taken.')
        ->assertFailed();

    expect(User::count())->toBe(1);
});

test('make:admin rejects mismatched passwords', function () {
    $this->artisan('make:admin')
        ->expectsQuestion('Name', 'Second Admin')
        ->expectsQuestion('Email', 'second@ched.gov.ph')
        ->expectsQuestion('Password', 'Secret-pass-123')
        ->expectsQuestion('Confirm password', 'Something-else-1')
        ->expectsOutputToContain('The passwords do not match.')
        ->assertFailed();

    expect(User::where('email', 'second@ched.gov.ph')->exists())->toBeFalse();
});
