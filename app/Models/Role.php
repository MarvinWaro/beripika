<?php

namespace App\Models;

use App\Support\DefaultRoles;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $name
 * @property string $display_name
 * @property string|null $description
 * @property bool $is_system
 */
class Role extends Model
{
    protected $fillable = ['name', 'display_name', 'description', 'is_system'];

    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }

    public function permissions(): BelongsToMany
    {
        return $this->belongsToMany(Permission::class);
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function isSuperAdmin(): bool
    {
        return $this->name === DefaultRoles::SUPER_ADMIN;
    }

    public function hasPermission(string $permission): bool
    {
        return $this->isSuperAdmin() || $this->permissions->contains('name', $permission);
    }
}
