import { Link } from '@inertiajs/react';
import {
    Building2,
    FileText,
    GraduationCap,
    LayoutGrid,
    ListChecks,
    MessageSquareWarning,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { usePermissions } from '@/hooks/use-permissions';
import { dashboard } from '@/routes';
import type { NavItem, Permission } from '@/types';

type GuardedNavItem = NavItem & { permission: Permission };

const navGroups: { title: string; items: GuardedNavItem[] }[] = [
    {
        title: 'Overview',
        items: [
            {
                title: 'Dashboard',
                href: dashboard(),
                icon: LayoutGrid,
                permission: 'view_dashboard',
            },
        ],
    },
    {
        title: 'Records',
        items: [
            {
                title: 'Institutions',
                href: '/institutions',
                icon: Building2,
                permission: 'view_institutions',
            },
            {
                title: 'Programs',
                href: '/programs',
                icon: FileText,
                permission: 'view_programs',
            },
            {
                title: 'Program Catalog',
                href: '/programs/catalog',
                icon: ListChecks,
                permission: 'view_programs',
            },
            {
                title: 'Graduates',
                href: '/graduates',
                icon: GraduationCap,
                permission: 'view_graduates',
            },
        ],
    },
    {
        title: 'Administration',
        items: [
            {
                title: 'Concerns',
                href: '/concerns',
                icon: MessageSquareWarning,
                permission: 'view_concerns',
            },
            // Users, Roles & Permissions and Activity Logs live under Settings (layouts/settings/layout.tsx).
        ],
    },
];

export function AppSidebar() {
    const { can } = usePermissions();
    const groups = navGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => can(item.permission)),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {groups.map((group) => (
                    <NavMain
                        key={group.title}
                        title={group.title}
                        items={group.items}
                    />
                ))}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
