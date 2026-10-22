<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\Graduate;
use App\Models\User;

class GraduatePolicy
{
    /**
     * Determine if the user can view any graduates.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::VIEW_GRADUATES);
    }

    /**
     * Determine if the user can view the graduate.
     */
    public function view(User $user, Graduate $graduate): bool
    {
        return $user->hasPermission(Permission::VIEW_GRADUATES);
    }

    /**
     * Determine if the user can update the graduate.
     */
    public function update(User $user, Graduate $graduate): bool
    {
        return $user->hasPermission(Permission::UPDATE_GRADUATES);
    }

    /**
     * Determine if the user can delete the graduate.
     */
    public function delete(User $user, Graduate $graduate): bool
    {
        return $user->hasPermission(Permission::DELETE_GRADUATES);
    }
}
