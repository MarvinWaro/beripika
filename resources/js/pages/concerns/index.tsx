import { Head, router } from '@inertiajs/react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Search,
    School,
    BookOpen,
    Calendar,
    MessageSquareWarning,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

// --- Interfaces ---

type ConcernStatus = 'pending' | 'in_progress' | 'resolved' | 'dismissed';

interface Concern {
    id: number;
    institution_code: string | null;
    school: string;
    program: string;
    concern: string;
    status: ConcernStatus;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
}

const STATUS_LABELS: Record<ConcernStatus, string> = {
    pending: 'Pending',
    in_progress: 'In progress',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
};

const STATUS_STYLES: Record<ConcernStatus, string> = {
    pending:
        'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
    resolved:
        'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
    dismissed: 'bg-muted text-muted-foreground',
};

interface Pagination<T> {
    data: T[];
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    total?: number;
}

interface Filters {
    q?: string | null;
    status?: ConcernStatus | null;
}

interface Props {
    concerns: Pagination<Concern>;
    filters: Filters;
    statusCounts: Partial<Record<ConcernStatus, number>>;
    statuses: ConcernStatus[];
}

export default function ConcernsIndex({
    concerns,
    filters,
    statusCounts,
    statuses,
}: Props) {
    const { can } = usePermissions();
    const canUpdate = can('update_concerns');
    const setStatus = (concern: Concern, status: ConcernStatus) =>
        router.patch(
            `/concerns/${concern.id}`,
            { status },
            { preserveScroll: true, preserveState: true },
        );
    const filterStatus = (status: ConcernStatus | null) =>
        router.get(
            '/concerns',
            { q: search || undefined, status: status ?? undefined },
            { preserveScroll: true, preserveState: true },
        );
    const [items, setItems] = useState<Concern[]>(concerns.data);
    const [total, setTotal] = useState<number>(
        concerns.total ?? concerns.data.length,
    );
    const [search, setSearch] = useState(filters.q ?? '');

    // Sync local items when Inertia sends new page
    useEffect(() => {
        setItems(concerns.data);
        setTotal(concerns.total ?? concerns.data.length);
    }, [concerns.data, concerns.total]);

    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            '/concerns',
            { q: search || undefined, status: filters.status ?? undefined },
            { preserveScroll: true, preserveState: true },
        );
    };

    const clearSearch = () => {
        setSearch('');
        router.get(
            '/concerns',
            { q: undefined, status: filters.status ?? undefined },
            { preserveScroll: true, preserveState: true },
        );
    };

    return (
        <>
            <Head title="Concerns" />

            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        Concerns &amp; Issues
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {filters.q ? (
                            <>
                                Showing {items.length} of {total} report
                                {total !== 1 ? 's' : ''} matching "{filters.q}"
                            </>
                        ) : (
                            <>
                                Total of {total} report
                                {total !== 1 ? 's' : ''} submitted
                            </>
                        )}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageSquareWarning className="h-5 w-5 text-amber-600" />
                            Reported Concerns
                        </CardTitle>
                        <CardDescription>
                            View and manage reported issues and concerns
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Search Bar */}
                        <form onSubmit={onSearchSubmit} className="mb-4">
                            <div className="relative">
                                <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search by school, program, or concern details..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pr-10 pl-10"
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={clearSearch}
                                        className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </form>

                        {/* Status filter */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant={
                                    !filters.status ? 'default' : 'outline'
                                }
                                onClick={() => filterStatus(null)}
                            >
                                All
                            </Button>
                            {statuses.map((status) => (
                                <Button
                                    key={status}
                                    size="sm"
                                    variant={
                                        filters.status === status
                                            ? 'default'
                                            : 'outline'
                                    }
                                    onClick={() => filterStatus(status)}
                                >
                                    {STATUS_LABELS[status]}
                                    <span className="ml-1 text-xs opacity-70">
                                        {statusCounts[status] ?? 0}
                                    </span>
                                </Button>
                            ))}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="min-w-[160px]">
                                            School / HEI
                                        </TableHead>
                                        <TableHead className="min-w-[140px]">
                                            Program
                                        </TableHead>
                                        <TableHead className="min-w-[200px]">
                                            Concern Details
                                        </TableHead>
                                        <TableHead className="min-w-[150px]">
                                            Date Submitted
                                        </TableHead>
                                        <TableHead className="min-w-[150px]">
                                            Status
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="py-8 text-center text-muted-foreground"
                                            >
                                                {filters.q
                                                    ? 'No concerns found for your search.'
                                                    : 'No concerns logged yet.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        items.map((item) => (
                                            <TableRow
                                                key={item.id}
                                                className="align-top hover:bg-muted/50"
                                            >
                                                <TableCell className="text-sm font-medium">
                                                    <div className="flex items-start gap-2">
                                                        <School className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                                                        {item.school}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="flex items-start gap-2">
                                                        <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-purple-600" />
                                                        {item.program}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm text-foreground">
                                                    <p className="leading-relaxed whitespace-pre-wrap">
                                                        {item.concern}
                                                    </p>
                                                </TableCell>
                                                <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        {item.created_at}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {canUpdate ? (
                                                        <Select
                                                            value={item.status}
                                                            onValueChange={(
                                                                value,
                                                            ) =>
                                                                setStatus(
                                                                    item,
                                                                    value as ConcernStatus,
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                className={cn(
                                                                    'h-8 w-36 border-0',
                                                                    STATUS_STYLES[
                                                                        item
                                                                            .status
                                                                    ],
                                                                )}
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {statuses.map(
                                                                    (
                                                                        status,
                                                                    ) => (
                                                                        <SelectItem
                                                                            key={
                                                                                status
                                                                            }
                                                                            value={
                                                                                status
                                                                            }
                                                                        >
                                                                            {
                                                                                STATUS_LABELS[
                                                                                    status
                                                                                ]
                                                                            }
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                    ) : (
                                                        <span
                                                            className={cn(
                                                                'rounded-md px-2 py-1 text-xs font-medium',
                                                                STATUS_STYLES[
                                                                    item.status
                                                                ],
                                                            )}
                                                        >
                                                            {
                                                                STATUS_LABELS[
                                                                    item.status
                                                                ]
                                                            }
                                                        </span>
                                                    )}
                                                    {item.resolved_by && (
                                                        <div className="mt-1 text-xs text-muted-foreground">
                                                            by{' '}
                                                            {item.resolved_by} ·{' '}
                                                            {item.resolved_at}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {concerns.links && concerns.links.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {concerns.links.map((link, idx) => {
                                    const label = link.label
                                        .replace('&laquo;', '«')
                                        .replace('&raquo;', '»');

                                    return (
                                        <Button
                                            key={idx}
                                            variant={
                                                link.active
                                                    ? 'default'
                                                    : 'outline'
                                            }
                                            size="sm"
                                            disabled={!link.url}
                                            onClick={() => {
                                                if (!link.url) return;
                                                router.get(
                                                    link.url,
                                                    {
                                                        q: search || undefined,
                                                        status:
                                                            filters.status ??
                                                            undefined,
                                                    },
                                                    {
                                                        preserveScroll: true,
                                                        preserveState: true,
                                                    },
                                                );
                                            }}
                                        >
                                            <span
                                                dangerouslySetInnerHTML={{
                                                    __html: label,
                                                }}
                                            />
                                        </Button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ConcernsIndex.layout = {
    breadcrumbs: [{ title: 'Concerns', href: '/concerns' }],
};
