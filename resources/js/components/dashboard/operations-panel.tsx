import { Link } from '@inertiajs/react';
import { CheckCircle2, Clock, LoaderCircle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import ChartDataTable from '@/components/dashboard/chart-data-table';
import {
    formatNumber,
    type DashboardOperations,
} from '@/components/dashboard/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';

const concernIcons: Record<string, { icon: LucideIcon; className: string }> = {
    pending: { icon: Clock, className: 'text-amber-600 dark:text-amber-400' },
    in_progress: { icon: LoaderCircle, className: 'text-muted-foreground' },
    resolved: {
        icon: CheckCircle2,
        className: 'text-green-700 dark:text-green-400',
    },
    dismissed: { icon: XCircle, className: 'text-muted-foreground' },
};

const lookupConfig = {
    views: { label: 'Records opened', color: 'var(--chart-1)' },
    searches: { label: 'Searches', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const importStatus = (status: string) =>
    ({
        completed: 'Imported',
        completed_with_issues: 'Imported with notes',
        failed: 'Needs attention',
        queued: 'Starting',
        processing: 'Importing',
    })[status] ?? status;

function Section({
    title,
    href,
    linkLabel,
    children,
}: {
    title: string;
    href: string;
    linkLabel: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{title}</h3>
                <Link
                    href={href}
                    className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                >
                    {linkLabel}
                </Link>
            </div>
            {children}
        </section>
    );
}

/** Permission-scoped work queues: each section only arrives for roles that may open it. */
export default function OperationsPanel({
    operations,
    animated,
    className,
}: {
    operations: DashboardOperations;
    animated: boolean;
    className?: string;
}) {
    const { concerns, imports, lookups } = operations;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Operations</CardTitle>
                <CardDescription>
                    Work queues and activity across the registry - not affected
                    by the dashboard filters
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {concerns && (
                    <Section
                        title="Public concerns"
                        href="/concerns"
                        linkLabel="Open concerns"
                    >
                        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {concerns.map((item) => {
                                const { icon: Icon, className: tone } =
                                    concernIcons[item.status] ??
                                    concernIcons.in_progress;

                                return (
                                    <li
                                        key={item.status}
                                        className="rounded-lg border p-3"
                                    >
                                        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <Icon
                                                aria-hidden="true"
                                                className={`size-3.5 ${tone}`}
                                            />
                                            {item.label}
                                        </p>
                                        <p className="mt-1 text-2xl font-semibold tabular-nums">
                                            {formatNumber(item.count)}
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    </Section>
                )}
                {imports && (
                    <Section
                        title="Recent imports"
                        href="/import"
                        linkLabel="Import graduates"
                    >
                        {imports.length ? (
                            <ul className="divide-y rounded-lg border">
                                {imports.map((run) => (
                                    <li
                                        key={run.id}
                                        className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm"
                                    >
                                        <span className="min-w-0 flex-1 truncate font-medium">
                                            #{run.id} · {run.filename}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(
                                                run.created_at,
                                            ).toLocaleDateString()}{' '}
                                            · {importStatus(run.status)}
                                        </span>
                                        <span className="w-full text-xs text-muted-foreground tabular-nums">
                                            {formatNumber(run.counts.created)}{' '}
                                            created ·{' '}
                                            {formatNumber(run.counts.updated)}{' '}
                                            updated ·{' '}
                                            {formatNumber(run.counts.unchanged)}{' '}
                                            unchanged ·{' '}
                                            {formatNumber(run.counts.invalid)}{' '}
                                            not imported
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No imports yet.
                            </p>
                        )}
                    </Section>
                )}
                {lookups && (
                    <Section
                        title="PRC verification activity"
                        href="/logs"
                        linkLabel="Activity logs"
                    >
                        <ChartContainer
                            config={lookupConfig}
                            className="aspect-auto h-56 w-full"
                            role="img"
                            aria-label="Graduate lookups by read-only users per month. Exact values are in the chart data table."
                        >
                            <BarChart
                                data={lookups}
                                margin={{ left: 0, right: 12, top: 8 }}
                                accessibilityLayer
                            >
                                <CartesianGrid
                                    vertical={false}
                                    strokeDasharray="3 3"
                                />
                                <XAxis
                                    dataKey="label"
                                    tickLine={false}
                                    axisLine={false}
                                    tickMargin={8}
                                />
                                <YAxis
                                    allowDecimals={false}
                                    width={40}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <ChartTooltip
                                    cursor={false}
                                    content={<ChartTooltipContent />}
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                <Bar
                                    dataKey="views"
                                    fill="var(--color-views)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                    isAnimationActive={animated}
                                />
                                <Bar
                                    dataKey="searches"
                                    fill="var(--color-searches)"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={28}
                                    isAnimationActive={animated}
                                />
                            </BarChart>
                        </ChartContainer>
                        <ChartDataTable
                            caption="Graduate lookups per month"
                            rows={lookups}
                            columns={[
                                { key: 'label', label: 'Month' },
                                { key: 'views', label: 'Records opened' },
                                { key: 'searches', label: 'Searches' },
                            ]}
                        />
                    </Section>
                )}
            </CardContent>
        </Card>
    );
}
