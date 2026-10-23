<?php

use App\Models\Concern;
use App\Models\Graduate;
use App\Models\Institution;
use App\Models\Permission;
use App\Models\Program;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;

test('the public can submit a concern', function () {
    $this->postJson('/api/concerns', ['school' => 'Example College', 'program' => 'BS IT', 'concern' => 'Permit not listed', 'institution_code' => '12001'])
        ->assertOk();

    expect(Concern::sole())->status->toBe('pending')->institution_code->toBe('12001');
});

test('staff can update concern status and it records who resolved it', function () {
    $concern = Concern::create(['school' => 'A', 'program' => 'B', 'concern' => 'C']);
    $staff = User::factory()->withRole('staff')->create();

    $this->actingAs($staff)->patch("/concerns/{$concern->id}", ['status' => 'resolved'])->assertRedirect();

    expect($concern->fresh())->status->toBe('resolved')->resolved_by->toBe($staff->id)->resolved_at->not->toBeNull();
});

test('viewing concerns does not allow updating them', function () {
    $role = Role::create(['name' => 'reader', 'display_name' => 'Reader']);
    Artisan::call('rbac:sync');
    $role->permissions()->sync(Permission::where('name', 'view_concerns')->pluck('id'));
    $concern = Concern::create(['school' => 'A', 'program' => 'B', 'concern' => 'C']);

    $this->actingAs(User::factory()->create(['role_id' => $role->id]));
    $this->get('/concerns')->assertOk();
    $this->patch("/concerns/{$concern->id}", ['status' => 'resolved'])->assertForbidden();
});

test('the permit proxy refuses URLs outside the CHED portal', function () {
    $this->postJson('/api/permit-pdf-proxy', ['url' => 'https://evil.example.com/file.pdf'])->assertStatus(422);
});

test('the public program endpoint never exposes graduate personal data', function () {
    $inst = Institution::create(['institution_code' => '12001', 'name' => 'Example', 'type' => 'Private']);
    $program = Program::create(['institution_id' => $inst->id, 'program_name' => 'BS IT', 'permit_number' => 'GR-1']);
    Graduate::create(['program_id' => $program->id, 'last_name' => 'Cruz', 'first_name' => 'Ana', 'program_name' => 'BS IT', 'date_graduated' => '2024-06-01']);

    $this->getJson("/api/program/{$program->id}")
        ->assertOk()
        ->assertJsonPath('program.graduates', [])
        ->assertJsonPath('program.graduates_count', 1)
        ->assertDontSee('Cruz');
});
