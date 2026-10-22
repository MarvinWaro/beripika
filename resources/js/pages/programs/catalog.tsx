import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/hooks/use-permissions';
import type { CatalogSyncRun, Classification } from '@/types/programs';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    RefreshCw,
    Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface CatalogItem {
    id: number;
    program_name: string;
    program_type: Classification;
}
interface Props {
    programs: {
        data: CatalogItem[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    filters: { q: string; type: string; per_page: number };
    counts: Record<'all' | Classification, number>;
    sync_run: CatalogSyncRun | null;
}
const classifications: Classification[] = ['Unknown', 'Board', 'Non-Board'];
const label = (value: string) => (value === 'Unknown' ? 'Unclassified' : value);
const active = (run: CatalogSyncRun | null) =>
    !!run && ['queued', 'running'].includes(run.status);

export default function ProgramCatalogIndex({
    programs,
    filters,
    counts,
    sync_run,
}: Props) {
    const { can } = usePermissions();
    const canEdit = can('update_program_catalog');
    const [search, setSearch] = useState(filters.q);
    const [saving, setSaving] = useState<Record<number, Classification>>({});
    const savingRef = useRef(new Set<number>());
    const [run, setRun] = useState(sync_run);
    const [starting, setStarting] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);
    const [navigating, setNavigating] = useState(false);

    useEffect(() => {
        setRun(sync_run);
    }, [sync_run]);
    useEffect(() => {
        setSearch(filters.q);
    }, [filters.q]);
    const runId = run?.id;
    const running = active(run);

    useEffect(() => {
        if (!canEdit || !runId || !running) return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        const poll = async () => {
            if (controller.signal.aborted) return;
            if (document.visibilityState !== 'visible' || !navigator.onLine) {
                timer = setTimeout(() => void poll(), 2000);
                return;
            }
            try {
                const response = await axios.get<CatalogSyncRun>(
                    '/programs/catalog/sync/' + runId,
                    { signal: controller.signal },
                );
                if (controller.signal.aborted) return;
                setRun(response.data);
                setSyncError(null);
                if (!active(response.data)) {
                    router.reload({ only: ['programs', 'counts', 'sync_run'] });
                    return;
                }
            } catch {
                if (controller.signal.aborted) return;
                setSyncError(
                    'Could not check sync progress. Retrying when connected.',
                );
            }
            timer = setTimeout(() => void poll(), 2000);
        };
        timer = setTimeout(() => void poll(), 2000);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [canEdit, runId, running]);

    const navigate = (overrides: Record<string, string | number> = {}) => {
        router.get(
            '/programs/catalog',
            {
                q: search,
                type: filters.type,
                per_page: filters.per_page,
                ...overrides,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onStart: () => setNavigating(true),
                onFinish: () => setNavigating(false),
            },
        );
    };

    const save = async (program: CatalogItem, value: Classification) => {
        if (savingRef.current.has(program.id) || program.program_type === value)
            return;
        savingRef.current.add(program.id);
        setSaving((previous) => ({ ...previous, [program.id]: value }));
        try {
            await axios.patch('/programs/catalog/' + program.id, {
                program_type: value,
            });
            toast.success('Classification saved');
            await new Promise<void>((resolve) =>
                router.reload({
                    only: ['programs', 'counts'],
                    onFinish: () => resolve(),
                }),
            );
        } catch {
            toast.error(
                'Classification was not saved. Your previous value is unchanged.',
            );
        } finally {
            savingRef.current.delete(program.id);
            setSaving((previous) => {
                const next = { ...previous };
                delete next[program.id];
                return next;
            });
        }
    };

    const startSync = async (retry = false) => {
        if (starting) return;
        setStarting(true);
        setSyncError(null);
        try {
            const response = await axios.post<CatalogSyncRun>(
                '/programs/catalog/sync',
                retry && run ? { retry_run_id: run.id } : {},
            );
            setRun(response.data);
            toast.success(
                retry
                    ? 'Failed schools queued for retry'
                    : 'Catalog sync queued',
            );
        } catch (error: unknown) {
            const message = axios.isAxiosError<{ message?: string }>(error)
                ? error.response?.data.message
                : null;
            setSyncError(message ?? 'Could not start sync. Please try again.');
        } finally {
            setStarting(false);
        }
    };

    return (
        <>
            <Head title="Program Catalog" />
            <div className="flex flex-1 flex-col gap-4 p-4">
                <Card>
                    <CardHeader className="gap-4 sm:flex-row sm:justify-between">
                        <div className="space-y-1">
                            <CardTitle>Program Catalog</CardTitle>
                            <CardDescription>
                                Unique program names from the portal.
                                Classifications are managed here.
                            </CardDescription>
                        </div>
                        {canEdit && (
                            <Button
                                variant="outline"
                                disabled={starting || running}
                                onClick={() => void startSync()}
                                className="shrink-0 gap-2"
                            >
                                <RefreshCw
                                    className={
                                        starting || running
                                            ? 'h-4 w-4 animate-spin'
                                            : 'h-4 w-4'
                                    }
                                />
                                {running
                                    ? 'Sync in progress'
                                    : 'Sync catalog from portal'}
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="space-y-5">
                        {syncError && (
                            <Alert role="status">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{syncError}</AlertDescription>
                            </Alert>
                        )}
                        {canEdit && run && (
                            <section
                                className="space-y-3 rounded-lg border bg-muted/30 p-4"
                                aria-label="Catalog synchronization"
                            >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-medium">
                                        Sync #{run.id} ·{' '}
                                        <span className="capitalize">
                                            {run.status}
                                        </span>
                                    </p>
                                    {['failed', 'partial'].includes(
                                        run.status,
                                    ) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={starting}
                                            onClick={() => void startSync(true)}
                                        >
                                            Retry failed schools
                                        </Button>
                                    )}
                                </div>
                                <progress
                                    value={run.processed}
                                    max={Math.max(1, run.total)}
                                    className="h-2 w-full accent-blue-600"
                                    aria-label="Schools processed"
                                />
                                <p
                                    className="text-sm text-muted-foreground"
                                    aria-live="polite"
                                >
                                    {run.processed} of {run.total} schools
                                    processed · {run.created} program names
                                    added · {run.failed_schools.length} failed
                                </p>
                                {run.status === 'queued' && (
                                    <p className="text-xs text-muted-foreground">
                                        Waiting to start. You can leave this
                                        page and return to check progress.
                                    </p>
                                )}
                                {run.error && (
                                    <p className="text-sm text-destructive">
                                        {run.error}
                                    </p>
                                )}
                                {run.finished_at && (
                                    <p className="text-xs text-muted-foreground">
                                        Finished{' '}
                                        {new Date(
                                            run.finished_at,
                                        ).toLocaleString()}
                                    </p>
                                )}
                                {run.failed_schools.length > 0 && (
                                    <details>
                                        <summary className="cursor-pointer text-sm font-medium">
                                            Failed schools
                                        </summary>
                                        <ul className="mt-2 space-y-2 text-sm">
                                            {run.failed_schools.map(
                                                (school) => (
                                                    <li key={school.code}>
                                                        <span className="font-medium">
                                                            {school.name} (
                                                            {school.code})
                                                        </span>
                                                        <p className="text-muted-foreground">
                                                            {school.error}
                                                        </p>
                                                    </li>
                                                ),
                                            )}
                                        </ul>
                                    </details>
                                )}
                            </section>
                        )}
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                navigate({ page: 1 });
                            }}
                            className="flex gap-2"
                        >
                            <div className="relative flex-1">
                                <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search program names…"
                                    aria-label="Search catalog"
                                    className="h-10 pl-10"
                                />
                            </div>
                            <Button
                                type="submit"
                                variant="outline"
                                disabled={navigating}
                            >
                                Search
                            </Button>
                        </form>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div
                                className="flex flex-wrap gap-2"
                                role="group"
                                aria-label="Filter classification"
                            >
                                {['all', ...classifications].map((value) => (
                                    <Button
                                        key={value}
                                        variant={
                                            (filters.type || 'all') === value
                                                ? 'default'
                                                : 'outline'
                                        }
                                        size="sm"
                                        aria-pressed={
                                            (filters.type || 'all') === value
                                        }
                                        disabled={navigating}
                                        onClick={() =>
                                            navigate({
                                                type:
                                                    value === 'all'
                                                        ? ''
                                                        : value,
                                                page: 1,
                                            })
                                        }
                                    >
                                        {value === 'all' ? 'All' : label(value)}{' '}
                                        ({counts[value as keyof typeof counts]})
                                    </Button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2">
                                <label
                                    htmlFor="catalog-page-size"
                                    className="text-sm text-muted-foreground"
                                >
                                    Rows per page
                                </label>
                                <Select
                                    value={String(filters.per_page)}
                                    onValueChange={(value) =>
                                        navigate({
                                            per_page: Number(value),
                                            page: 1,
                                        })
                                    }
                                    disabled={navigating}
                                >
                                    <SelectTrigger
                                        id="catalog-page-size"
                                        className="w-20"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {[10, 25, 50].map((value) => (
                                            <SelectItem
                                                key={value}
                                                value={String(value)}
                                            >
                                                {value}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Program name</TableHead>
                                        <TableHead>Classification</TableHead>
                                        {canEdit && (
                                            <TableHead>
                                                Change classification
                                            </TableHead>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {programs.data.map((program) => (
                                        <TableRow key={program.id}>
                                            <TableCell className="max-w-xl py-4 font-medium whitespace-normal">
                                                {program.program_name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">
                                                    {label(
                                                        program.program_type,
                                                    )}
                                                </Badge>
                                            </TableCell>
                                            {canEdit && (
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Select
                                                            value={
                                                                saving[
                                                                    program.id
                                                                ] ??
                                                                program.program_type
                                                            }
                                                            disabled={
                                                                !!saving[
                                                                    program.id
                                                                ]
                                                            }
                                                            onValueChange={(
                                                                value,
                                                            ) =>
                                                                void save(
                                                                    program,
                                                                    value as Classification,
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger
                                                                className="w-40"
                                                                aria-label={
                                                                    'Classification for ' +
                                                                    program.program_name
                                                                }
                                                            >
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {classifications.map(
                                                                    (value) => (
                                                                        <SelectItem
                                                                            key={
                                                                                value
                                                                            }
                                                                            value={
                                                                                value
                                                                            }
                                                                        >
                                                                            {label(
                                                                                value,
                                                                            )}
                                                                        </SelectItem>
                                                                    ),
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        {saving[program.id] && (
                                                            <span
                                                                role="status"
                                                                className="flex items-center gap-1 text-xs text-muted-foreground"
                                                            >
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                                Saving…
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                    {programs.data.length === 0 && (
                                        <TableRow>
                                            <TableCell
                                                colSpan={canEdit ? 3 : 2}
                                                className="h-32 text-center text-muted-foreground"
                                            >
                                                {filters.q || filters.type
                                                    ? 'No programs match your filters.'
                                                    : 'No catalog entries yet. Sync from the portal to add program names.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm text-muted-foreground">
                                Showing {programs.from ?? 0}–{programs.to ?? 0}{' '}
                                of {programs.total} programs
                            </p>
                            <nav
                                className="flex items-center gap-2"
                                aria-label="Catalog pagination"
                            >
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        navigating || programs.current_page <= 1
                                    }
                                    onClick={() =>
                                        navigate({
                                            page: programs.current_page - 1,
                                        })
                                    }
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Previous
                                </Button>
                                <span className="text-sm">
                                    Page {programs.current_page} of{' '}
                                    {programs.last_page}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        navigating ||
                                        programs.current_page >=
                                            programs.last_page
                                    }
                                    onClick={() =>
                                        navigate({
                                            page: programs.current_page + 1,
                                        })
                                    }
                                >
                                    Next
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </nav>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ProgramCatalogIndex.layout = {
    breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Program Catalog', href: '/programs/catalog' },
            ],
};
