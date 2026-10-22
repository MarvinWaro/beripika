<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property int $id
 * @property string $name
 * @property string $display_name
 * @property string|null $description
 * @property string $group
 */
class Permission extends Model
{
    protected $fillable = ['name', 'display_name', 'description', 'group'];

    public function roles(): BelongsToMany
    {
        return $this->belongsToMany(Role::class);
    }
}
