import { Link } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { usePermissions } from '@/hooks/use-permissions';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { NavItem, Permission } from '@/types';

type SettingsNavItem = NavItem & { permission?: Permission };

type SettingsNavGroup = {
    title: string;
    items: SettingsNavItem[];
    /** Table-heavy pages use the full content width instead of the narrow form column. */
    wide?: boolean;
};

const navGroups: SettingsNavGroup[] = [
    {
        title: 'Account',
        items: [
            { title: 'Profile', href: edit(), icon: null },
            { title: 'Security', href: editSecurity(), icon: null },
            { title: 'Appearance', href: editAppearance(), icon: null },
        ],
    },
    {
        title: 'Administration',
        wide: true,
        items: [
            {
                title: 'Import Graduates',
                href: '/import',
                icon: null,
                permission: 'view_imports',
            },
            {
                title: 'Users',
                href: '/users',
                icon: null,
                permission: 'view_users',
            },
            {
                title: 'Roles & Permissions',
                href: '/roles',
                icon: null,
                permission: 'manage_roles',
            },
            {
                title: 'Activity Logs',
                href: '/logs',
                icon: null,
                permission: 'view_activity_logs',
            },
        ],
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { can } = usePermissions();

    const groups = navGroups
        .map((group) => ({
            ...group,
            items: group.items.filter(
                (item) => !item.permission || can(item.permission),
            ),
        }))
        .filter((group) => group.items.length > 0);

    const isWide = groups.some(
        (group) =>
            group.wide &&
            group.items.some((item) => isCurrentOrParentUrl(item.href)),
    );

    return (
        <div className="px-4 py-6">
            <Heading
                title="Settings"
                description="Manage your account and, where permitted, users, roles and the audit trail"
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:w-48 lg:shrink-0">
                    <nav className="flex flex-col gap-6" aria-label="Settings">
                        {groups.map((group) => (
                            <div
                                key={group.title}
                                className="flex flex-col space-y-1"
                            >
                                <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                                    {group.title}
                                </p>
                                {group.items.map((item) => (
                                    <Button
                                        key={toUrl(item.href)}
                                        size="sm"
                                        variant="ghost"
                                        asChild
                                        className={cn('w-full justify-start', {
                                            'bg-muted': isCurrentOrParentUrl(
                                                item.href,
                                            ),
                                        })}
                                    >
                                        <Link href={item.href}>
                                            {item.icon && (
                                                <item.icon className="h-4 w-4" />
                                            )}
                                            {item.title}
                                        </Link>
                                    </Button>
                                ))}
                            </div>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div
                    className={cn('min-w-0 flex-1', !isWide && 'md:max-w-2xl')}
                >
                    <section className={cn(!isWide && 'max-w-xl space-y-12')}>
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
