import GraduateSearch from '@/components/dashboard/graduate-search';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { dashboard } from '@/routes';
import { Head, router } from '@inertiajs/react';
import {
    BookOpen,
    Building2,
    Check,
    ChevronsUpDown,
    GraduationCap,
    Landmark,
    Loader2,
    RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

type Point = { label: string; count: number };
interface DashboardProps {
    stats: { graduates: number; institutions: number; programs: number };
    chartData: {
        trend: Point[];
        sex: Point[];
        topPrograms: Point[];
        topInstitutions: Point[];
        undated: number;
    };
    options: {
        years: number[];
        institutions: { code: string; name: string }[];
    };
    filters: { year: number | null; institution: string | null };
    portal: {
        count: number | null;
        stale: boolean;
        lastFetchedAt: string | null;
    };
    hasRecords: boolean;
}
const colors = ['#2563eb', '#8b5cf6', '#94a3b8'];
const tooltipStyle = {
    background: 'var(--popover)',
    color: 'var(--popover-foreground)',
    border: '1px solid var(--border)',
    borderRadius: 8,
};
const number = (value: number) => value.toLocaleString();
function DataTable({ data }: { data: Point[] }) {
    return (
        <details className="mt-4 text-sm">
            <summary className="w-fit cursor-pointer rounded text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
                View chart data
            </summary>
            <table className="mt-3 w-full text-left">
                <caption className="sr-only">Chart values</caption>
                <thead>
                    <tr className="border-b">
                        <th className="py-2">Category</th>
                        <th className="text-right">Graduates</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((row) => (
                        <tr key={row.label} className="border-b">
                            <th
                                scope="row"
                                className="py-2 pr-4 font-normal break-words"
                            >
                                {row.label}
                            </th>
                            <td className="text-right tabular-nums">
                                {number(row.count)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </details>
    );
}
function Ranking({
    title,
    data,
    animated,
}: {
    title: string;
    data: Point[];
    animated: boolean;
}) {
    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>
                    Top ten by graduate records in the selected scope
                </CardDescription>
            </CardHeader>
            <CardContent>
                {data.length ? (
                    <div
                        style={{ height: Math.max(180, data.length * 42) }}
                        role="img"
                        aria-label={
                            title +
                            '. Exact values are available in the chart data table.'
                        }
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ left: 0, right: 30 }}
                                accessibilityLayer
                            >
                                <CartesianGrid
                                    horizontal={false}
                                    stroke="var(--border)"
                                    strokeDasharray="3 3"
                                />
                                <XAxis
                                    type="number"
                                    allowDecimals={false}
                                    tick={{
                                        fill: 'var(--muted-foreground)',
                                        fontSize: 11,
                                    }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="label"
                                    width={135}
                                    tick={{
                                        fill: 'var(--muted-foreground)',
                                        fontSize: 10,
                                    }}
                                    tickFormatter={(value: string) =>
                                        value.length > 19
                                            ? value.slice(0, 18) + '...'
                                            : value
                                    }
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={tooltipStyle}
                                    wrapperStyle={{
                                        maxWidth: 'min(360px, 80vw)',
                                        whiteSpace: 'normal',
                                    }}
                                    cursor={{ fill: 'var(--muted)' }}
                                />
                                <Bar
                                    dataKey="count"
                                    name="Graduates"
                                    fill="#2563eb"
                                    radius={[0, 4, 4, 0]}
                                    maxBarSize={22}
                                    isAnimationActive={animated}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <p className="py-16 text-center text-muted-foreground">
                        No recorded categories in this selection.
                    </p>
                )}
                <DataTable data={data} />
            </CardContent>
        </Card>
    );
}
export default function Dashboard({
    stats,
    chartData,
    options,
    filters,
    portal,
    hasRecords,
}: DashboardProps) {
    const { can } = usePermissions();
    const [pickerOpen, setPickerOpen] = useState(false);
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
    function change(next: typeof filters) {
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
    const institution = options.institutions.find(
        (item) => item.code === filters.institution,
    );
    const cards = [
        {
            title: 'Graduate records',
            value: stats.graduates,
            description: 'In the selected scope',
            icon: GraduationCap,
        },
        {
            title: 'Institutions represented',
            value: stats.institutions,
            description: 'With graduate records in this scope',
            icon: Building2,
        },
        {
            title: 'Programs represented',
            value: stats.programs,
            description: 'Distinct normalized program names',
            icon: BookOpen,
        },
        {
            title: 'Portal institutions',
            value: portal.count,
            description:
                portal.count === null
                    ? 'Directory currently unavailable'
                    : 'Overall directory - independent of filters',
            icon: Landmark,
        },
    ];
    return (
        <>
            <Head title="Graduate analytics" />
            <div className="mx-auto flex w-full max-w-[1500px] min-w-0 flex-col gap-6 p-4 md:p-6">
                <header>
                    <p className="mb-1 text-xs font-semibold tracking-widest text-blue-600 uppercase dark:text-blue-400">
                        CHED - Graduate registry
                    </p>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                        Graduate analytics
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Explore recorded graduates across institutions,
                        programs, and graduation years.
                    </p>
                </header>
                <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
                    <div className="min-w-0 flex-1 basis-64">
                        <label
                            className="mb-2 block text-sm font-medium"
                            id="institution-label"
                        >
                            Institution
                        </label>
                        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-labelledby="institution-label"
                                    aria-expanded={pickerOpen}
                                    className="w-full justify-between"
                                >
                                    <span className="truncate">
                                        {institution?.name ??
                                            'All institutions'}
                                    </span>
                                    <ChevronsUpDown className="ml-2 size-4 shrink-0" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
                                align="start"
                            >
                                <Command>
                                    <CommandInput placeholder="Search school name or HEI code..." />
                                    <CommandList>
                                        <CommandEmpty>
                                            No institutions found.
                                        </CommandEmpty>
                                        {[
                                            {
                                                code: '',
                                                name: 'All institutions',
                                            },
                                            ...options.institutions,
                                        ].map((item, keyIndex) => (
                                            <CommandItem
                                                key={`${item.code}-${keyIndex}`}
                                                value={
                                                    item.name + ' ' + item.code
                                                }
                                                onSelect={() => {
                                                    setPickerOpen(false);
                                                    change({
                                                        ...pending.current,
                                                        institution:
                                                            item.code || null,
                                                    });
                                                }}
                                            >
                                                <Check
                                                    className={
                                                        filters.institution ===
                                                        (item.code || null)
                                                            ? 'size-4 shrink-0'
                                                            : 'size-4 shrink-0 opacity-0'
                                                    }
                                                />
                                                <span className="break-words">
                                                    {item.name}
                                                    {item.code && (
                                                        <span className="ml-2 text-muted-foreground">
                                                            {item.code}
                                                        </span>
                                                    )}
                                                </span>
                                            </CommandItem>
                                        ))}
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div>
                        <label
                            htmlFor="graduation-year"
                            className="mb-2 block text-sm font-medium"
                        >
                            Graduation year
                        </label>
                        <select
                            id="graduation-year"
                            value={filters.year ?? ''}
                            onChange={(event) =>
                                change({
                                    ...pending.current,
                                    year: event.target.value
                                        ? Number(event.target.value)
                                        : null,
                                })
                            }
                            className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
                        >
                            <option value="">All years</option>
                            {options.years.map((year) => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button
                        variant="ghost"
                        onClick={() =>
                            change({ year: null, institution: null })
                        }
                        disabled={
                            !filters.year && !filters.institution && !loading
                        }
                    >
                        <RotateCcw className="size-4" />
                        Reset filters
                    </Button>
                </div>
                <div role="status" className="sr-only">
                    {loading
                        ? 'Updating dashboard analytics...'
                        : number(stats.graduates) +
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
                    className="space-y-6"
                >
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {cards.map(
                            ({ title, value, description, icon: Icon }) => (
                                <Card
                                    key={title}
                                    className="gap-3 border-t-2 border-t-blue-500"
                                >
                                    <CardHeader className="flex-row items-center justify-between pb-0">
                                        <CardTitle className="text-sm font-medium">
                                            {title}
                                        </CardTitle>
                                        <Icon className="size-5 text-blue-600 dark:text-blue-400" />
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-3xl font-semibold tracking-tight tabular-nums">
                                            {value === null
                                                ? '-'
                                                : number(value)}
                                        </p>
                                        <p className="mt-2 text-xs text-muted-foreground">
                                            {description}
                                        </p>
                                    </CardContent>
                                </Card>
                            ),
                        )}
                    </div>
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
                        <>
                            <div className="grid gap-6 lg:grid-cols-3">
                                <Card className="min-w-0 lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle>Graduation trends</CardTitle>
                                        <CardDescription>
                                            {filters.year
                                                ? 'Monthly graduate records - ' +
                                                  filters.year
                                                : 'Graduate records by graduation year'}{' '}
                                            - not upload date
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div
                                            className="h-72"
                                            role="img"
                                            aria-label="Graduation trend. Exact values are in the chart data table."
                                        >
                                            <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                            >
                                                <LineChart
                                                    data={chartData.trend}
                                                    margin={{
                                                        left: 0,
                                                        right: 15,
                                                        top: 15,
                                                    }}
                                                    accessibilityLayer
                                                >
                                                    <CartesianGrid
                                                        stroke="var(--border)"
                                                        strokeDasharray="3 3"
                                                        vertical={false}
                                                    />
                                                    <XAxis
                                                        dataKey="label"
                                                        tick={{
                                                            fill: 'var(--muted-foreground)',
                                                            fontSize: 12,
                                                        }}
                                                    />
                                                    <YAxis
                                                        allowDecimals={false}
                                                        width={45}
                                                        tick={{
                                                            fill: 'var(--muted-foreground)',
                                                            fontSize: 12,
                                                        }}
                                                    />
                                                    <Tooltip
                                                        contentStyle={
                                                            tooltipStyle
                                                        }
                                                    />
                                                    <Line
                                                        type="linear"
                                                        dataKey="count"
                                                        name="Graduates"
                                                        stroke="#2563eb"
                                                        strokeWidth={3}
                                                        dot={{ r: 4 }}
                                                        isAnimationActive={
                                                            animated
                                                        }
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                        {chartData.undated > 0 && (
                                            <p className="mt-3 text-sm text-muted-foreground">
                                                {number(chartData.undated)}{' '}
                                                records without a usable{' '}
                                                {filters.year
                                                    ? 'graduation date'
                                                    : 'graduation year'}{' '}
                                                are included in totals but
                                                excluded from this chart.
                                            </p>
                                        )}
                                        <DataTable data={chartData.trend} />
                                    </CardContent>
                                </Card>
                                <Card className="min-w-0">
                                    <CardHeader>
                                        <CardTitle>Sex distribution</CardTitle>
                                        <CardDescription>
                                            As recorded in graduate records
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div
                                            className="h-56"
                                            role="img"
                                            aria-label="Sex distribution. Counts and percentages follow."
                                        >
                                            <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                            >
                                                <PieChart>
                                                    <Pie
                                                        data={chartData.sex}
                                                        dataKey="count"
                                                        nameKey="label"
                                                        innerRadius="60%"
                                                        outerRadius="85%"
                                                        paddingAngle={2}
                                                        isAnimationActive={
                                                            animated
                                                        }
                                                    >
                                                        {chartData.sex.map(
                                                            (row, index) => (
                                                                <Cell
                                                                    key={
                                                                        row.label
                                                                    }
                                                                    fill={
                                                                        colors[
                                                                            index
                                                                        ]
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={
                                                            tooltipStyle
                                                        }
                                                    />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <ul className="space-y-3">
                                            {chartData.sex.map((row, index) => (
                                                <li
                                                    key={row.label}
                                                    className="flex items-center gap-2 text-sm"
                                                >
                                                    <span
                                                        className="size-2.5 rounded-full"
                                                        style={{
                                                            background:
                                                                colors[index],
                                                        }}
                                                    />
                                                    <span>{row.label}</span>
                                                    <span className="ml-auto font-medium tabular-nums">
                                                        {number(row.count)}{' '}
                                                        <span className="font-normal text-muted-foreground">
                                                            (
                                                            {(
                                                                (row.count /
                                                                    stats.graduates) *
                                                                100
                                                            ).toFixed(1)}
                                                            %)
                                                        </span>
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                        <DataTable data={chartData.sex} />
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="grid gap-6 xl:grid-cols-2">
                                <Ranking
                                    title="Top programs"
                                    data={chartData.topPrograms}
                                    animated={animated}
                                />
                                <Ranking
                                    title="Top institutions"
                                    data={chartData.topInstitutions}
                                    animated={animated}
                                />
                            </div>
                        </>
                    )}
                </section>
                {can('view_graduates') && (
                <Card className="border-blue-200 dark:border-blue-900">
                    <CardHeader>
                        <CardTitle>Quick graduate search</CardTitle>
                        <CardDescription>
                            Search across all records by name, SO number, or
                            program. Dashboard filters do not limit this search.
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
