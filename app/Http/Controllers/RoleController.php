<?php

namespace App\Http\Controllers;

use App\Enums\Permission as PermissionEnum;
use App\Models\ActivityLog;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RoleController extends Controller
{
    public function index(): Response
    {
        $roles = Role::with('permissions:id,name')->withCount('users')->orderByDesc('is_system')->orderBy('display_name')->get()
            ->map(fn (Role $role) => [
                'id' => $role->id,
                'name' => $role->name,
                'display_name' => $role->display_name,
                'description' => $role->description,
                'is_system' => $role->is_system,
                'users_count' => $role->users_count,
                'permissions' => $role->isSuperAdmin()
                    ? Permission::pluck('id')->all()
                    : $role->permissions->pluck('id')->all(),
                'permission_names' => $role->isSuperAdmin()
                    ? PermissionEnum::values()
                    : $role->permissions->pluck('name')->all(),
            ]);

        return Inertia::render('settings/roles', [
            'roles' => $roles,
            'permissionGroups' => $this->permissionGroups(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $this->validated($request);

        $role = DB::transaction(function () use ($validated) {
            $role = Role::create([
                'name' => $validated['name'],
                'display_name' => $validated['display_name'],
                'description' => $validated['description'] ?? null,
            ]);
            $role->permissions()->sync($validated['permissions']);

            return $role;
        });

        ActivityLog::record('role_create', "Created role {$role->display_name}", $role, [
            'permissions' => $role->permissions()->pluck('name')->all(),
        ]);

        return redirect()->route('roles.index')->with('success', 'Role created successfully.');
    }

    public function update(Request $request, Role $role): RedirectResponse
    {
        if ($role->is_system) {
            return redirect()->route('roles.index')->with('error', 'System roles cannot be changed.');
        }

        $validated = $this->validated($request, $role);
        $before = $role->permissions()->pluck('name')->all();

        DB::transaction(function () use ($role, $validated) {
            $role->update([
                'name' => $validated['name'],
                'display_name' => $validated['display_name'],
                'description' => $validated['description'] ?? null,
            ]);
            $role->permissions()->sync($validated['permissions']);
        });

        $after = $role->permissions()->pluck('name')->all();
        ActivityLog::record('role_update', "Updated role {$role->display_name}", $role, [
            'added' => array_values(array_diff($after, $before)),
            'removed' => array_values(array_diff($before, $after)),
        ]);

        return redirect()->route('roles.index')->with('success', 'Role updated successfully.');
    }

    public function destroy(Role $role): RedirectResponse
    {
        if ($role->is_system) {
            return redirect()->route('roles.index')->with('error', 'System roles cannot be deleted.');
        }
        if ($role->users()->exists()) {
            return redirect()->route('roles.index')->with('error', 'Move the users of this role to another role before deleting it.');
        }

        $name = $role->display_name;
        $role->delete();
        ActivityLog::record('role_delete', "Deleted role {$name}", properties: ['role' => $name]);

        return redirect()->route('roles.index')->with('success', 'Role deleted successfully.');
    }

    /** Create a copy of a role to use as a starting point. */
    public function duplicate(Role $role): RedirectResponse
    {
        $base = $role->name.'_copy';
        $name = $base;
        for ($i = 2; Role::where('name', $name)->exists(); $i++) {
            $name = $base.'_'.$i;
        }
        $copy = DB::transaction(function () use ($role, $name) {
            $copy = Role::create([
                'name' => $name,
                'display_name' => $role->display_name.' (copy)',
                'description' => $role->description,
            ]);
            $copy->permissions()->sync($role->isSuperAdmin() ? Permission::pluck('id') : $role->permissions()->pluck('permissions.id'));

            return $copy;
        });
        ActivityLog::record('role_create', "Duplicated role {$role->display_name} as {$copy->display_name}", $copy);

        return redirect()->route('roles.index')->with('success', 'Role duplicated. Rename it and adjust its permissions.');
    }

    public function permissions(): JsonResponse
    {
        return response()->json($this->permissionGroups());
    }

    public function list(): JsonResponse
    {
        return response()->json(Role::select('id', 'name', 'display_name', 'is_system')->orderBy('display_name')->get());
    }

    /** @return list<array{group: string, label: string, permissions: list<array{id: int, name: string, display_name: string, description: ?string}>}> */
    private function permissionGroups(): array
    {
        $order = array_values(array_unique(array_map(fn (PermissionEnum $p) => $p->group(), PermissionEnum::cases())));
        $enumOrder = array_flip(PermissionEnum::values());

        return Permission::all()
            ->sortBy(fn (Permission $p) => $enumOrder[$p->name] ?? PHP_INT_MAX)
            ->groupBy('group')
            ->sortBy(fn ($items, $group) => array_search($group, $order, true) === false ? PHP_INT_MAX : array_search($group, $order, true))
            ->map(fn ($items, $group) => [
                'group' => $group,
                'label' => PermissionEnum::groupLabel($group),
                'permissions' => $items->map(fn (Permission $p) => $p->only(['id', 'name', 'display_name', 'description']))->values()->all(),
            ])->values()->all();
    }

    private function validated(Request $request, ?Role $role = null): array
    {
        $request->merge(['name' => str($request->input('name') ?: $request->input('display_name'))->slug('_')->toString()]);

        return $request->validate([
            'name' => ['required', 'string', 'max:64', 'alpha_dash', Rule::unique('roles', 'name')->ignore($role?->id)],
            'display_name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => ['present', 'array'],
            'permissions.*' => ['integer', 'exists:permissions,id'],
        ]);
    }
}
