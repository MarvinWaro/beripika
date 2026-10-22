<?php

use App\Enums\Permission as P;
use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Support\DefaultRoles;

beforeEach(function () {
    $this->artisan('rbac:sync')->assertSuccessful();
});

test('rbac:sync creates every enum permission and the default roles', function () {
    expect(Permission::count())->toBe(count(P::cases()))
        ->and(Role::pluck('name')->sort()->values()->all())->toBe(['admin', 'staff', 'super_admin', 'verifier', 'viewer'])
        ->and(Role::where('name', DefaultRoles::SUPER_ADMIN)->value('is_system'))->toBeTrue();

    // Running it again is safe and keeps customised roles.
    $staff = Role::where('name', 'staff')->first();
    $staff->permissions()->sync([]);
    $this->artisan('rbac:sync')->assertSuccessful();
    expect($staff->permissions()->count())->toBe(0)->and(Permission::count())->toBe(count(P::cases()));
});

test('super admin has every permission and inactive users have none', function () {
    $super = User::factory()->superAdmin()->create();
    expect($super->permissionNames())->toEqualCanonicalizing(P::values());

    $inactive = User::factory()->superAdmin()->inactive()->create();
    expect($inactive->permissionNames())->toBe([])->and($inactive->hasPermission(P::VIEW_DASHBOARD))->toBeFalse();
});

test('shared auth props expose role and permissions to the frontend', function () {
    $user = User::factory()->withRole('verifier')->create();

    $this->actingAs($user)->get('/dashboard')->assertInertia(fn ($page) => $page
        ->where('auth.user.role.name', 'verifier')
        ->where('auth.user.is_super_admin', false)
        ->where('auth.user.permissions', fn ($p) => collect($p)->sort()->values()->all() === collect(['view_dashboard', 'view_institutions', 'view_programs', 'view_graduates'])->sort()->values()->all()));
});

test('routes are guarded by permissions', function (string $method, string $uri) {
    $this->actingAs(User::factory()->withRole('viewer')->create())
        ->json($method, $uri)
        ->assertForbidden();
})->with([
    ['GET', '/graduates'],
    ['GET', '/dashboard/search?q=ab'],
    ['GET', '/import'],
    ['GET', '/users'],
    ['GET', '/roles'],
    ['GET', '/logs'],
    ['GET', '/concerns'],
    ['POST', '/programs/catalog/sync'],
]);

test('verifier can read graduates but not change them', function () {
    $graduate = Graduate::create(['last_name' => 'Cruz', 'first_name' => 'Ana', 'program_name' => 'BS IT', 'date_graduated' => '2024-06-01', 'hei_uii' => '12001', 'so_number' => 'SO-1']);
    $this->actingAs(User::factory()->withRole('verifier')->create());

    $this->get('/graduates')->assertOk();
    $this->getJson('/dashboard/search?q=Cruz')->assertOk()->assertJsonPath('0.so_number', 'SO-1');
    $this->putJson("/graduates/{$graduate->id}", ['last_name' => 'X', 'first_name' => 'Y', 'program_name' => 'Z'])->assertForbidden();
    $this->deleteJson("/graduates/{$graduate->id}")->assertForbidden();
});

test('deactivated users cannot sign in', function () {
    $user = User::factory()->withRole('admin')->inactive()->create();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors('email');
    $this->assertGuest();
});

test('a user deactivated mid-session is signed out', function () {
    $user = User::factory()->withRole('admin')->create();
    $this->actingAs($user);
    $user->update(['is_active' => false]);

    $this->get('/graduates')->assertRedirect(route('login'));
    $this->assertGuest();
});

test('sign-ins are audited and update last_login_at', function () {
    $user = User::factory()->withRole('viewer')->create();
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    $this->assertAuthenticatedAs($user);
    expect($user->fresh()->last_login_at)->not->toBeNull()
        ->and(ActivityLog::where('action', 'login')->where('user_id', $user->id)->exists())->toBeTrue();
});

describe('role management', function () {
    beforeEach(function () {
        $this->actingAs(User::factory()->superAdmin()->create());
    });

    test('creates a role with permissions and logs it', function () {
        $ids = Permission::whereIn('name', ['view_dashboard', 'view_graduates'])->pluck('id')->all();
        $this->post('/roles', ['display_name' => 'PRC Verifier', 'description' => 'Partner', 'permissions' => $ids])
            ->assertRedirect('/roles');

        $role = Role::where('name', 'prc_verifier')->firstOrFail();
        expect($role->permissions()->pluck('name')->sort()->values()->all())->toBe(['view_dashboard', 'view_graduates'])
            ->and(ActivityLog::where('action', 'role_create')->exists())->toBeTrue();
    });

    test('updating a role takes effect for its users', function () {
        $role = Role::where('name', 'viewer')->first();
        $user = User::factory()->create(['role_id' => $role->id]);
        expect($user->hasPermission('view_graduates'))->toBeFalse();

        $ids = $role->permissions()->pluck('permissions.id')->push(Permission::where('name', 'view_graduates')->value('id'))->all();
        $this->put("/roles/{$role->id}", ['name' => 'viewer', 'display_name' => 'Viewer', 'permissions' => $ids])->assertRedirect();

        expect(User::find($user->id)->hasPermission('view_graduates'))->toBeTrue();
        $log = ActivityLog::where('action', 'role_update')->latest('id')->first();
        expect($log->properties['added'])->toBe(['view_graduates']);
    });

    test('system roles cannot be edited or deleted', function () {
        $super = Role::where('name', DefaultRoles::SUPER_ADMIN)->first();
        $this->put("/roles/{$super->id}", ['display_name' => 'Hacked', 'permissions' => []])->assertSessionHas('error');
        $this->delete("/roles/{$super->id}")->assertSessionHas('error');
        expect($super->fresh()->display_name)->toBe('Super Administrator')->and(Role::whereKey($super->id)->exists())->toBeTrue();
    });

    test('roles that still have users cannot be deleted', function () {
        $role = Role::where('name', 'staff')->first();
        User::factory()->create(['role_id' => $role->id]);
        $this->delete("/roles/{$role->id}")->assertSessionHas('error');
        expect(Role::whereKey($role->id)->exists())->toBeTrue();
    });

    test('duplicating a role copies its permissions', function () {
        $role = Role::where('name', 'verifier')->first();
        $this->post("/roles/{$role->id}/duplicate")->assertRedirect();
        $copy = Role::where('name', 'verifier_copy')->firstOrFail();
        expect($copy->permissions()->pluck('name')->sort()->values()->all())
            ->toBe($role->permissions()->pluck('name')->sort()->values()->all());
    });
});

describe('user management', function () {
    test('admin creates a user with a generated temporary password', function () {
        $this->actingAs(User::factory()->withRole('admin')->create());
        $role = Role::where('name', 'verifier')->first();

        $this->post('/users', ['name' => 'PRC Officer', 'email' => 'officer@prc.gov.ph', 'role_id' => $role->id])
            ->assertSessionHas('success', fn ($message) => str_contains($message, 'Temporary password'));

        $user = User::where('email', 'officer@prc.gov.ph')->firstOrFail();
        expect($user->role_id)->toBe($role->id)->and($user->is_active)->toBeTrue()->and($user->email_verified_at)->not->toBeNull();
    });

    test('only super admins can assign or manage the super admin role', function () {
        $admin = User::factory()->withRole('admin')->create();
        $super = User::factory()->superAdmin()->create();
        $superRole = Role::where('name', DefaultRoles::SUPER_ADMIN)->value('id');
        $this->actingAs($admin);

        $this->post('/users', ['name' => 'X', 'email' => 'x@example.com', 'role_id' => $superRole])->assertSessionHasErrors('role_id');
        $this->put("/users/{$super->id}", ['name' => 'Changed', 'email' => $super->email, 'role_id' => $superRole])->assertForbidden();
        $this->delete("/users/{$super->id}")->assertForbidden();
        $this->patch("/users/{$super->id}/toggle-active")->assertForbidden();
    });

    test('users cannot delete, deactivate or re-role themselves', function () {
        $admin = User::factory()->withRole('admin')->create();
        $this->actingAs($admin);

        $this->delete("/users/{$admin->id}")->assertForbidden();
        $this->patch("/users/{$admin->id}/toggle-active")->assertForbidden();
        $this->put("/users/{$admin->id}", ['name' => $admin->name, 'email' => $admin->email, 'role_id' => Role::where('name', 'viewer')->value('id')])
            ->assertSessionHas('error');
        expect($admin->fresh()->role->name)->toBe('admin');
    });

    test('user list sorting only accepts known columns', function () {
        $this->actingAs(User::factory()->withRole('admin')->create());
        $this->get('/users?sort_by=password')->assertSessionHasErrors('sort_by');
        $this->get('/users?sort_by=name&sort_order=asc')->assertOk();
    });
});
