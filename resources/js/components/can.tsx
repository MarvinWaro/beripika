import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import type { Permission } from '@/types';

type CanProps = {
    /** Render children when the user has this permission (or any of these). */
    permission: Permission | Permission[];
    /** With an array: require all permissions instead of any. */
    all?: boolean;
    fallback?: ReactNode;
    children: ReactNode;
};

export function Can({
    permission,
    all = false,
    fallback = null,
    children,
}: CanProps) {
    const { canAny, canAll } = usePermissions();
    const list = Array.isArray(permission) ? permission : [permission];
    const allowed = all ? canAll(...list) : canAny(...list);

    return <>{allowed ? children : fallback}</>;
}
