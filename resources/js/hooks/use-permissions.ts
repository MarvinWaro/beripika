import { usePage } from '@inertiajs/react';
import type { Permission, SharedData } from '@/types';

/**
 * Permission checks for the signed-in user (mirrors the backend Gate).
 * UI checks only hide controls — the server always enforces access.
 */
export function usePermissions() {
    const { auth } = usePage<SharedData>().props;
    const permissions: Permission[] = auth.user?.permissions ?? [];

    const can = (permission: Permission): boolean =>
        permissions.includes(permission);
    const canAny = (...perms: Permission[]): boolean =>
        perms.some((p) => permissions.includes(p));
    const canAll = (...perms: Permission[]): boolean =>
        perms.every((p) => permissions.includes(p));
    const hasRole = (role: string): boolean => auth.user?.role?.name === role;

    return {
        permissions,
        can,
        canAny,
        canAll,
        hasRole,
        role: auth.user?.role ?? null,
        isSuperAdmin: auth.user?.is_super_admin ?? false,
        isActive: () => auth.user?.is_active ?? false,
    };
}
