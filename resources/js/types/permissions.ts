/**
 * Mirrors App\Enums\Permission (PHP). Keep both lists in sync.
 */
export const PERMISSIONS = [
    'view_dashboard',
    'view_institutions',
    'view_programs',
    'update_program_catalog',
    'view_graduates',
    'update_graduates',
    'delete_graduates',
    'view_imports',
    'import_institutions',
    'import_graduates',
    'clear_data',
    'view_concerns',
    'update_concerns',
    'view_users',
    'create_users',
    'update_users',
    'delete_users',
    'toggle_user_active',
    'manage_roles',
    'view_activity_logs',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type RoleSummary = {
    id: number;
    name: string;
    display_name: string;
};
