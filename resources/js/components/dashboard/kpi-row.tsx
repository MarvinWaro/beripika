import {
    ArrowDownRight,
    ArrowUpRight,
    BookOpen,
    Building2,
    GraduationCap,
    Landmark,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    formatNumber,
    percent,
    type DashboardStats,
} from '@/components/dashboard/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function Tile({
    title,
    value,
    icon: Icon,
    children,
}: {
    title: string;
    value: string;
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <Card className="min-w-0 gap-3 border-t-2 border-t-blue-500">
            <CardHeader className="flex-row items-center justify-between pb-0">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon
                    className="size-5 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                />
            </CardHeader>
            <CardContent>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                    {value}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                    {children}
                </div>
            </CardContent>
        </Card>
    );
}

/** Year-over-year delta in text tokens; the arrow carries direction, never colour alone. */
function Change({ change }: { change: DashboardStats['change'] }) {
    if (!change) return <>In the selected scope</>;
    const [current, previous] = change.label.split(' vs ');
    if (change.previous === 0) {
        return (
            <>
                {current}: {formatNumber(change.current)} · no records in{' '}
                {previous}
            </>
        );
    }
    const delta = ((change.current - change.previous) / change.previous) * 100;
    const Arrow = delta >= 0 ? ArrowUpRight : ArrowDownRight;

    return (
        <span className="inline-flex items-center gap-1">
            <Arrow className="size-3.5 text-foreground" aria-hidden="true" />
            <span className="font-medium text-foreground">
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(1)}%
            </span>
            <span>
                {change.label} ({formatNumber(change.current)} vs{' '}
                {formatNumber(change.previous)})
            </span>
        </span>
    );
}

export default function KpiRow({
    stats,
    portalCount,
}: {
    stats: DashboardStats;
    portalCount: number | null;
}) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Tile
                title="Graduate records"
                value={formatNumber(stats.graduates)}
                icon={GraduationCap}
            >
                <Change change={stats.change} />
            </Tile>
            <Tile
                title="Female graduates"
                value={percent(stats.female, stats.graduates)}
                icon={Users}
            >
                {formatNumber(stats.female)} female · {formatNumber(stats.male)}{' '}
                male
                {stats.notRecorded > 0 &&
                    ` · ${formatNumber(stats.notRecorded)} not recorded`}
            </Tile>
            <Tile
                title="Institutions represented"
                value={formatNumber(stats.institutions)}
                icon={Building2}
            >
                With graduate records in this scope
            </Tile>
            <Tile
                title="Programs represented"
                value={formatNumber(stats.programs)}
                icon={BookOpen}
            >
                Distinct normalized program names
            </Tile>
            <Tile
                title="Portal institutions"
                value={portalCount === null ? '-' : formatNumber(portalCount)}
                icon={Landmark}
            >
                {portalCount === null
                    ? 'Directory currently unavailable'
                    : 'Overall directory - independent of filters'}
            </Tile>
        </div>
    );
}
