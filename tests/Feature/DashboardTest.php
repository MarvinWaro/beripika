<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('users with view_dashboard can visit the dashboard', function () {
    $this->actingAs(User::factory()->withRole('viewer')->create());

    $this->get(route('dashboard'))->assertOk();
});

test('users without view_dashboard are sent to the first module they can open', function () {
    $this->artisan('rbac:sync');
    $role = Role::create(['name' => 'graduates_only', 'display_name' => 'Graduates only']);
    $role->permissions()->sync(Permission::where('name', 'view_graduates')->pluck('id'));
    $user = User::factory()->create(['role_id' => $role->id]);

    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('graduates.index'));
});

test('users without a role land on their profile with a notice', function () {
    $this->actingAs(User::factory()->create())
        ->get(route('dashboard'))
        ->assertRedirect(route('profile.edit'));
});
