<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::VIEW_USERS);
    }

    public function view(User $user, User $model): bool
    {
        return $user->hasPermission(Permission::VIEW_USERS);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission(Permission::CREATE_USERS);
    }

    public function update(User $user, User $model): bool
    {
        return $user->hasPermission(Permission::UPDATE_USERS) && $this->canTouch($user, $model);
    }

    public function delete(User $user, User $model): bool
    {
        return $user->id !== $model->id
            && $user->hasPermission(Permission::DELETE_USERS)
            && $this->canTouch($user, $model);
    }

    public function toggleActive(User $user, User $model): bool
    {
        return $user->id !== $model->id
            && $user->hasPermission(Permission::TOGGLE_USER_ACTIVE)
            && $this->canTouch($user, $model);
    }

    /** Only a super administrator may change another super administrator's account. */
    private function canTouch(User $user, User $model): bool
    {
        return ! $model->role?->isSuperAdmin() || $user->isSuperAdmin();
    }
}
