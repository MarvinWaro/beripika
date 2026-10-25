<?php

use App\Models\User;

beforeEach(function () {
    $this->withoutVite();
});

test('import, users, roles and activity logs render inside settings', function (string $uri, string $component) {
    $this->actingAs(User::factory()->superAdmin()->create())
        ->get($uri)
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component($component));
})->with([
    ['/import', 'settings/import'],
    ['/users', 'settings/users'],
    ['/roles', 'settings/roles'],
    ['/logs', 'settings/logs'],
]);

test('records staff can open the graduate import page', function () {
    $this->actingAs(User::factory()->withRole('staff')->create())
        ->get('/import')
        ->assertOk()
        ->assertInertia(fn ($page) => $page->component('settings/import'));
});

test('verifiers cannot open the import page or upload graduate masterlists', function () {
    $this->actingAs(User::factory()->withRole('verifier')->create());

    $this->get('/import')->assertForbidden();
    $this->postJson('/import/graduates')->assertForbidden();
});
