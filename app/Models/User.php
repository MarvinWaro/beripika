<?php

namespace App\Models;

use App\Enums\Permission as PermissionEnum;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property int|null $role_id
 * @property bool $is_active
 * @property Carbon|null $last_login_at
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Role|null $role
 */
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    protected $fillable = ['name', 'email', 'password', 'role_id', 'is_active', 'last_login_at'];

    protected $hidden = ['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'];

    /** Per-request memo of permission names. */
    private ?array $permissionCache = null;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function isActive(): bool
    {
        return (bool) $this->is_active;
    }

    public function isSuperAdmin(): bool
    {
        return $this->isActive() && (bool) $this->role?->isSuperAdmin();
    }

    /**
     * Permission names granted through the user's role (all of them for super admins).
     *
     * @return list<string>
     */
    public function permissionNames(): array
    {
        if ($this->permissionCache !== null) {
            return $this->permissionCache;
        }
        if (! $this->isActive() || ! $this->role) {
            return $this->permissionCache = [];
        }
        if ($this->role->isSuperAdmin()) {
            return $this->permissionCache = PermissionEnum::values();
        }

        return $this->permissionCache = $this->role->permissions->pluck('name')->values()->all();
    }

    public function hasPermission(PermissionEnum|string $permission): bool
    {
        $name = $permission instanceof PermissionEnum ? $permission->value : $permission;

        return in_array($name, $this->permissionNames(), true);
    }

    public function hasAnyPermission(PermissionEnum|string ...$permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }

    /** Clear the memo after the role or its permissions change. */
    public function flushPermissionCache(): void
    {
        $this->permissionCache = null;
        $this->unsetRelation('role');
    }
}
