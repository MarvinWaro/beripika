<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;

class ConcernPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::VIEW_CONCERNS);
    }

    public function update(User $user): bool
    {
        return $user->hasPermission(Permission::UPDATE_CONCERNS);
    }
}
