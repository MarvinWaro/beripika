import { Head, Link, router } from '@inertiajs/react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import DataQualityCard from '@/components/dashboard/data-quality-card';
import FilterBar from '@/components/dashboard/filter-bar';
import GraduateSearch from '@/components/dashboard/graduate-search';
import KpiRow from '@/components/dashboard/kpi-row';
import OperationsPanel from '@/components/dashboard/operations-panel';
import RankingChart from '@/components/dashboard/ranking-chart';
import SexTrendChart from '@/components/dashboard/sex-trend-chart';
import ShareBar from '@/components/dashboard/share-bar';
import TrendChart from '@/components/dashboard/trend-chart';
import {
    formatNumber,
    type DashboardChartData,
    type DashboardFilters,
    type DashboardOperations,
    type DashboardOptions,
    type DashboardStats,
    type QualityCheck,
} from '@/components/dashboard/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';

interface DashboardProps {
    stats: DashboardStats;
    chartData: DashboardChartData;
    quality: QualityCheck[];
    operations: DashboardOperations;
    options: DashboardOptions;
    filters: DashboardFilters;
    portal: {
        count: number | null;
        stale: boolean;
        lastFetchedAt: string | null;
    };
    hasRecords: boolean;
}

// Colour follows the category, never its rank or the active filter.
const sectorColors: Record<string, string> = {
    SUC: 'var(--chart-1)',
    LUC: 'var(--chart-2)',
    Private: 'var(--chart-3)',
    Other: 'var(--chart-4)',
    'Not in portal': 'var(--muted-foreground)',
};
const programTypeColors: Record<string, string> = {
    Board: 'var(--chart-1)',
    'Non-Board': 'var(--chart-2)',
    Unclassified: 'var(--chart-4)',
};

export default function Dashboard({
    stats,
    chartData,
    quality,
    operations,
    options,
    filters,
    portal,
    hasRecords,
}: DashboardProps) {
    const { can } = usePermissions();
    const [loading, setLoading] = useState(false);
    const [animated, setAnimated] = useState(false);
    const pending = useRef(filters);
    const visitId = useRef(0);
    const cancel = useRef<(() => void) | null>(null);
    useEffect(() => {
        pending.current = filters;
    }, [filters]);
    useEffect(() => {
        const media = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setAnimated(!media.matches);
        update();
        media.addEventListener('change', update);
        return () => {
            media.removeEventListener('change', update);
            cancel.current?.();
        };
    }, []);
    function change(changes: Partial<DashboardFilters>) {
        const next = { ...pending.current, ...changes };
        const id = ++visitId.current;
        cancel.current?.();
        pending.current = next;
        setLoading(true);
        router.get(
            dashboard().url,
            {
                ...(next.year ? { year: next.year } : {}),
                ...(next.institution ? { institution: next.institution } : {}),
            },
            {
                preserveState: true,
                preserveScroll: true,
                onCancelToken: (token) => {
                    cancel.current = () => token.cancel();
                },
                onFinish: () => {
                    if (id === visitId.current) {
                        setLoading(false);
                        pending.current = next;
                    }
                },
            },
        );
    }

    const hasOperations = Object.values(operations).some(
        (section) => section !== null,
    );
    const allUnclassified =
        chartData.programTypes.length === 1 &&
        chartData.programTypes[0].label === 'Unclassified';

    return (
        <>
            <Head title="Graduate analytics" />
            <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-6 p-4 md:p-6">
                <header>
                    <p className="mb-1 text-xs font-semibold tracking-widest text-blue-600 uppercase dark:text-blue-400">
                        CHED - Graduate registry
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Graduate analytics
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Consolidated figures first, then the breakdown by time,
                        sex, school profile, program and institution.
                    </p>
                </header>
                <FilterBar
                    filters={filters}
                    options={options}
                    loading={loading}
                    onChange={change}
                />
                <div role="status" className="sr-only">
                    {loading
                        ? 'Updating dashboard analytics...'
                        : formatNumber(stats.graduates) +
                          ' graduate records in this selection.'}
                </div>
                {loading && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 motion-safe:animate-spin" />
                        Updating analytics...
                    </p>
                )}
                {portal.stale && (
                    <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        {portal.count === null
                            ? 'Portal directory unavailable. Graduate analytics remain available; schools without a directory name use their HEI code.'
                            : 'Using the last available portal directory. Graduate analytics use the current saved records.'}
                    </p>
                )}
                <section
                    aria-label="Graduate analytics"
                    aria-busy={loading}
                    className={cn(
                        'space-y-6 transition-opacity',
                        loading && 'opacity-60',
                    )}
                >
                    <KpiRow stats={stats} portalCount={portal.count} />
                    {!stats.graduates ? (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <GraduationCap className="mx-auto mb-3 size-8 text-muted-foreground" />
                                <h2 className="font-semibold">
                                    {hasRecords
                                        ? 'No matching graduate records'
                                        : 'No graduate records yet'}
                                </h2>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {hasRecords
                                        ? 'Try another institution or graduation year, or reset the filters.'
                                        : 'Analytics will appear after graduate records are imported.'}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-12">
                            <TrendChart
                                data={chartData.trend}
                                undated={chartData.undated}
                                year={filters.year}
                                animated={animated}
                                className="min-w-0 lg:col-span-2 xl:col-span-8"
                            />
                            <div className="grid min-w-0 gap-6 lg:col-span-2 lg:grid-cols-2 xl:col-span-4 xl:grid-cols-1">
                                <ShareBar
                                    title="School sector"
                                    description="Graduates by type of institution (CHED portal)"
                                    data={chartData.sectors}
                                    colors={sectorColors}
                                    className="min-w-0"
                                />
                                <ShareBar
                                    title="Board vs Non-Board"
                                    description="Graduates by program classification (Program Catalog)"
                                    data={chartData.programTypes}
                                    colors={programTypeColors}
                                    className="min-w-0"
                                    footer={
                                        allUnclassified &&
                                        can('view_programs') && (
                                            <p className="text-xs text-muted-foreground">
                                                No programs are classified yet.{' '}
                                                <Link
                                                    href="/programs/catalog"
                                                    className="font-medium text-foreground underline underline-offset-4"
                                                >
                                                    Classify them in the Program
                                                    Catalog
                                                </Link>
                                                .
                                            </p>
                                        )
                                    }
                                />
                            </div>
                            <SexTrendChart
                                data={chartData.sexTrend}
                                year={filters.year}
                                animated={animated}
                                className="min-w-0 lg:col-span-2 xl:col-span-7"
                            />
                            <RankingChart
                                title="Graduates by province"
                                description="Province of the institution (CHED portal)"
                                data={chartData.provinces}
                                animated={animated}
                                className="min-w-0 lg:col-span-2 xl:col-span-5"
                            />
                            <RankingChart
                                title="Top programs"
                                description="Top ten by graduate records in the selected scope"
                                data={chartData.topPrograms}
                                animated={animated}
                                className="min-w-0 xl:col-span-6"
                            />
                            <RankingChart
                                title="Top institutions"
                                description="Top ten by graduate records in the selected scope"
                                data={chartData.topInstitutions}
                                animated={animated}
                                className="min-w-0 xl:col-span-6"
                            />
                        </div>
                    )}
                    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-12">
                        {stats.graduates > 0 && (
                            <DataQualityCard
                                checks={quality}
                                total={stats.graduates}
                                className={cn(
                                    'min-w-0',
                                    hasOperations
                                        ? 'xl:col-span-5'
                                        : 'lg:col-span-2 xl:col-span-12',
                                )}
                            />
                        )}
                        {hasOperations && (
                            <OperationsPanel
                                operations={operations}
                                animated={animated}
                                className={cn(
                                    'min-w-0',
                                    stats.graduates > 0
                                        ? 'xl:col-span-7'
                                        : 'lg:col-span-2 xl:col-span-12',
                                )}
                            />
                        )}
                    </div>
                </section>
                {can('view_graduates') && (
                    <Card className="border-blue-200 dark:border-blue-900">
                        <CardHeader>
                            <CardTitle>Quick graduate search</CardTitle>
                            <CardDescription>
                                Search across all records by name, SO number, or
                                program. Dashboard filters do not limit this
                                search.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <GraduateSearch />
                        </CardContent>
                    </Card>
                )}
                <p className="text-xs text-muted-foreground">
                    Counts describe imported graduate records, not enrollment,
                    graduation rates, or institutional performance.
                </p>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard().url }],
};
