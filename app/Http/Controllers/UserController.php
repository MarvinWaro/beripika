<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Role;
use App\Models\User;
use App\Support\DefaultRoles;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    private const SORTABLE = ['name', 'email', 'created_at', 'last_login_at', 'is_active'];

    public function index(Request $request): Response
    {
        $this->authorize('viewAny', User::class);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:255'],
            'role' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'sort_by' => ['nullable', Rule::in(self::SORTABLE)],
            'sort_order' => ['nullable', Rule::in(['asc', 'desc'])],
        ]);
        $sortBy = $filters['sort_by'] ?? 'created_at';
        $sortOrder = $filters['sort_order'] ?? 'desc';

        $users = User::query()
            ->with('role:id,name,display_name')
            ->when($filters['search'] ?? null, fn ($q, $search) => $q->where(fn ($q) => $q
                ->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")))
            ->when($filters['role'] ?? null, fn ($q, $role) => $q->where('role_id', $role))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('is_active', $status === 'active'))
            ->orderBy($sortBy, $sortOrder)
            ->orderBy('id')
            ->paginate(10)
            ->withQueryString()
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_active' => $user->is_active,
                'role_id' => $user->role_id,
                'role' => $user->role?->only(['id', 'name', 'display_name']),
                'two_factor_enabled' => ! is_null($user->two_factor_confirmed_at),
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'created_at' => $user->created_at?->toIso8601String(),
                'updated_at' => $user->updated_at?->toIso8601String(),
            ]);

        return Inertia::render('users/index', [
            'users' => $users,
            'roles' => $this->assignableRoles($request->user()),
            'filters' => [
                'search' => $filters['search'] ?? null,
                'role' => $filters['role'] ?? null,
                'status' => $filters['status'] ?? null,
                'sort_by' => $sortBy,
                'sort_order' => $sortOrder,
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $this->authorize('create', User::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'role_id' => ['required', Rule::in($this->assignableRoles($request->user())->pluck('id'))],
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
        ]);

        // No password given: generate a strong temporary one and show it once.
        $generated = empty($validated['password']) ? Str::password(14, symbols: false) : null;

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'] ?? $generated,
            'role_id' => $validated['role_id'],
            'is_active' => true,
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        ActivityLog::record('user_create', "Created user {$user->email}", $user, ['role' => $user->role?->name]);

        return redirect()->back()->with('success', $generated
            ? "User created. Temporary password: {$generated} — share it securely and ask them to change it."
            : 'User created successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $this->authorize('update', $user);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => ['nullable', 'confirmed', Rules\Password::defaults()],
            'role_id' => ['required', Rule::in($this->assignableRoles($request->user())->pluck('id'))],
        ]);

        if ($request->user()->is($user) && (int) $validated['role_id'] !== (int) $user->role_id) {
            return redirect()->back()->with('error', 'You cannot change your own role.');
        }

        $before = ['name' => $user->name, 'email' => $user->email, 'role' => $user->role?->name];
        $user->fill([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'role_id' => $validated['role_id'],
        ]);
        if (! empty($validated['password'])) {
            $user->password = $validated['password'];
        }
        $passwordChanged = $user->isDirty('password');
        $user->save();
        $user->flushPermissionCache();

        ActivityLog::record('user_update', "Updated user {$user->email}", $user, [
            'before' => $before,
            'after' => ['name' => $user->name, 'email' => $user->email, 'role' => $user->role?->name],
            'password_changed' => $passwordChanged,
        ]);

        return redirect()->back()->with('success', 'User updated successfully.');
    }

    public function destroy(Request $request, User $user): RedirectResponse
    {
        $this->authorize('delete', $user);

        $email = $user->email;
        $user->delete();
        ActivityLog::record('user_delete', "Deleted user {$email}", properties: ['email' => $email]);

        return redirect()->back()->with('success', 'User deleted successfully.');
    }

    public function toggleActive(User $user): RedirectResponse
    {
        $this->authorize('toggleActive', $user);

        $user->update(['is_active' => ! $user->is_active]);
        $status = $user->is_active ? 'activated' : 'deactivated';
        ActivityLog::record('user_'.($user->is_active ? 'activate' : 'deactivate'), "User {$user->email} {$status}", $user);

        return redirect()->back()->with('success', "User {$status} successfully.");
    }

    /** Only super administrators can hand out the super administrator role. */
    private function assignableRoles(User $actor)
    {
        return Role::select('id', 'name', 'display_name', 'is_system')
            ->when(! $actor->isSuperAdmin(), fn ($q) => $q->where('name', '!=', DefaultRoles::SUPER_ADMIN))
            ->orderBy('display_name')
            ->get();
    }
}
