<?php

namespace App\Support;

use App\Enums\Permission as P;

/**
 * Roles created by the seeder. Only `super_admin` is locked (is_system); the others are
 * starting points that administrators can edit from the Roles screen.
 */
final class DefaultRoles
{
    public const SUPER_ADMIN = 'super_admin';

    /** @return array<string, array{display_name: string, description: string, is_system: bool, permissions: list<P>}> */
    public static function all(): array
    {
        return [
            self::SUPER_ADMIN => [
                'display_name' => 'Super Administrator',
                'description' => 'Unrestricted access, including role management. Cannot be edited or deleted.',
                'is_system' => true,
                'permissions' => P::cases(),
            ],
            'admin' => [
                'display_name' => 'Administrator',
                'description' => 'Manages records, imports, users and concerns.',
                'is_system' => false,
                // Clearing all imported data is destructive, so it stays with the super administrator.
                'permissions' => array_values(array_filter(P::cases(), fn (P $p) => ! in_array($p, [P::MANAGE_ROLES, P::CLEAR_DATA], true))),
            ],
            'staff' => [
                'display_name' => 'CHED Staff',
                'description' => 'Maintains graduate records and runs imports.',
                'is_system' => false,
                'permissions' => [
                    P::VIEW_DASHBOARD, P::VIEW_INSTITUTIONS, P::VIEW_PROGRAMS, P::UPDATE_PROGRAM_CATALOG,
                    P::VIEW_GRADUATES, P::UPDATE_GRADUATES,
                    P::VIEW_IMPORTS, P::IMPORT_INSTITUTIONS, P::IMPORT_GRADUATES,
                    P::VIEW_CONCERNS, P::UPDATE_CONCERNS,
                ],
            ],
            'verifier' => [
                'display_name' => 'External Verifier',
                'description' => 'Partner agency (e.g. PRC) that verifies graduates, programs and permits. Read-only.',
                'is_system' => false,
                'permissions' => [P::VIEW_DASHBOARD, P::VIEW_INSTITUTIONS, P::VIEW_PROGRAMS, P::VIEW_GRADUATES],
            ],
            'viewer' => [
                'display_name' => 'Viewer',
                'description' => 'Read-only access to the dashboard, institutions and programs.',
                'is_system' => false,
                'permissions' => [P::VIEW_DASHBOARD, P::VIEW_INSTITUTIONS, P::VIEW_PROGRAMS],
            ],
        ];
    }
}
