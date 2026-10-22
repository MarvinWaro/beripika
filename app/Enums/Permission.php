<?php

namespace App\Enums;

/**
 * Single source of truth for every permission in the system.
 *
 * Adding a case here + running `php artisan rbac:sync` makes it available in the
 * Roles & Permissions screen. Route middleware uses the value: ->can('view_graduates').
 */
enum Permission: string
{
    // Dashboard
    case VIEW_DASHBOARD = 'view_dashboard';

    // Institutions & programs (portal data)
    case VIEW_INSTITUTIONS = 'view_institutions';
    case VIEW_PROGRAMS = 'view_programs';
    case UPDATE_PROGRAM_CATALOG = 'update_program_catalog';

    // Graduates
    case VIEW_GRADUATES = 'view_graduates';
    case UPDATE_GRADUATES = 'update_graduates';
    case DELETE_GRADUATES = 'delete_graduates';

    // Imports
    case VIEW_IMPORTS = 'view_imports';
    case IMPORT_INSTITUTIONS = 'import_institutions';
    case IMPORT_GRADUATES = 'import_graduates';
    case CLEAR_DATA = 'clear_data';

    // Concerns (public submissions)
    case VIEW_CONCERNS = 'view_concerns';
    case UPDATE_CONCERNS = 'update_concerns';

    // Users
    case VIEW_USERS = 'view_users';
    case CREATE_USERS = 'create_users';
    case UPDATE_USERS = 'update_users';
    case DELETE_USERS = 'delete_users';
    case TOGGLE_USER_ACTIVE = 'toggle_user_active';

    // Roles & audit
    case MANAGE_ROLES = 'manage_roles';
    case VIEW_ACTIVITY_LOGS = 'view_activity_logs';

    public function group(): string
    {
        return match ($this) {
            self::VIEW_DASHBOARD => 'dashboard',
            self::VIEW_INSTITUTIONS => 'institutions',
            self::VIEW_PROGRAMS, self::UPDATE_PROGRAM_CATALOG => 'programs',
            self::VIEW_GRADUATES, self::UPDATE_GRADUATES, self::DELETE_GRADUATES => 'graduates',
            self::VIEW_IMPORTS, self::IMPORT_INSTITUTIONS, self::IMPORT_GRADUATES, self::CLEAR_DATA => 'imports',
            self::VIEW_CONCERNS, self::UPDATE_CONCERNS => 'concerns',
            self::VIEW_USERS, self::CREATE_USERS, self::UPDATE_USERS, self::DELETE_USERS, self::TOGGLE_USER_ACTIVE => 'users',
            self::MANAGE_ROLES => 'roles',
            self::VIEW_ACTIVITY_LOGS => 'logs',
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::VIEW_DASHBOARD => 'View dashboard',
            self::VIEW_INSTITUTIONS => 'View institutions',
            self::VIEW_PROGRAMS => 'View programs',
            self::UPDATE_PROGRAM_CATALOG => 'Manage program catalog',
            self::VIEW_GRADUATES => 'View graduates',
            self::UPDATE_GRADUATES => 'Edit graduates',
            self::DELETE_GRADUATES => 'Delete graduates',
            self::VIEW_IMPORTS => 'Open import tools',
            self::IMPORT_INSTITUTIONS => 'Import institutions',
            self::IMPORT_GRADUATES => 'Import graduates',
            self::CLEAR_DATA => 'Clear imported data',
            self::VIEW_CONCERNS => 'View concerns',
            self::UPDATE_CONCERNS => 'Update concern status',
            self::VIEW_USERS => 'View users',
            self::CREATE_USERS => 'Create users',
            self::UPDATE_USERS => 'Edit users',
            self::DELETE_USERS => 'Delete users',
            self::TOGGLE_USER_ACTIVE => 'Activate / deactivate users',
            self::MANAGE_ROLES => 'Manage roles & permissions',
            self::VIEW_ACTIVITY_LOGS => 'View activity logs',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::VIEW_DASHBOARD => 'Access the dashboard, statistics and graduate quick search.',
            self::VIEW_INSTITUTIONS => 'Browse HEIs from the CHED portal and their programs.',
            self::VIEW_PROGRAMS => 'Browse programs, permits and the program catalog.',
            self::UPDATE_PROGRAM_CATALOG => 'Run the portal catalog sync and set Board / Non-Board classification.',
            self::VIEW_GRADUATES => 'Search and view graduate records.',
            self::UPDATE_GRADUATES => 'Correct graduate details.',
            self::DELETE_GRADUATES => 'Remove individual graduate records.',
            self::VIEW_IMPORTS => 'Open the import page and import history.',
            self::IMPORT_INSTITUTIONS => 'Upload the institutions & programs workbook.',
            self::IMPORT_GRADUATES => 'Upload SOAIS masterlists and follow import progress.',
            self::CLEAR_DATA => 'Delete all institutions/programs or all graduates. Destructive.',
            self::VIEW_CONCERNS => 'Read concerns submitted from the public page.',
            self::UPDATE_CONCERNS => 'Mark concerns as in progress, resolved or dismissed.',
            self::VIEW_USERS => 'See the list of user accounts.',
            self::CREATE_USERS => 'Create new user accounts.',
            self::UPDATE_USERS => 'Edit name, email, password and role of users.',
            self::DELETE_USERS => 'Delete user accounts.',
            self::TOGGLE_USER_ACTIVE => 'Enable or disable sign-in for a user.',
            self::MANAGE_ROLES => 'Create roles and choose what each role can do.',
            self::VIEW_ACTIVITY_LOGS => 'Read the audit trail of changes and sign-ins.',
        };
    }

    /** Human label for a permission group (module). */
    public static function groupLabel(string $group): string
    {
        return match ($group) {
            'dashboard' => 'Dashboard',
            'institutions' => 'Institutions',
            'programs' => 'Programs',
            'graduates' => 'Graduates',
            'imports' => 'Imports',
            'concerns' => 'Concerns',
            'users' => 'Users',
            'roles' => 'Roles',
            'logs' => 'Activity logs',
            default => ucfirst($group),
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(fn (self $p) => $p->value, self::cases());
    }
}
