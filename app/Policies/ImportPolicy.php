<?php

namespace App\Policies;

use App\Enums\Permission;
use App\Models\User;

class ImportPolicy
{
    /**
     * Determine if the user can view import tools.
     */
    public function viewAny(User $user): bool
    {
        return $user->hasPermission(Permission::VIEW_IMPORTS);
    }

    /**
     * Determine if the user can import institutions.
     */
    public function importInstitutions(User $user): bool
    {
        return $user->hasPermission(Permission::IMPORT_INSTITUTIONS);
    }

    /**
     * Determine if the user can import graduates.
     */
    public function importGraduates(User $user): bool
    {
        return $user->hasPermission(Permission::IMPORT_GRADUATES);
    }

    /**
     * Determine if the user can clear data.
     */
    public function clearData(User $user): bool
    {
        return $user->hasPermission(Permission::CLEAR_DATA);
    }
}
