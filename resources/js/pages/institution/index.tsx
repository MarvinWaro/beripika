import ViewGraduatesDialog from '@/components/admin-institution/view-graduates-dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    AlertCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FileText,
    FileWarning,
    GraduationCap,
    Search,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
// Import the PermitDialog from the welcome components
import PermitDialog from '@/components/welcome/permit-dialog';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

interface Program {
    id: number;
    program_name: string;
    major: string | null;
    program_type: string | null;
    permit_number: string | null;
    // New field for the PDF
    permitPdfUrl?: string | null;
}

interface Institution {
    id: number;
    institution_code: string;
    name: string;
    province: string | null;
    region: 'REGION XII' | 'BARMM';
    ownership_sector: string | null;
    ownership_type: string | null;
    x_coordinate: string | null;
    y_coordinate: string | null;
    programs: Program[];
}

interface Props {
    institutions: Institution[];
    error?: string | null;
}

// Interface expected by PermitDialog (matching the welcome page component)
interface PermitDialogProgram {
    id: number | null;
    name: string;
    major: string | null;
    copNumber: string | null;
    grNumber: string | null;
    institution?: {
        code: string;
        name: string;
        type: string;
    };
    permitPdfUrl?: string | null;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Institutions', href: '/institutions' },
];

const INSTITUTIONS_PER_PAGE = 10;

type RegionFilter = 'all' | 'REGION XII' | 'BARMM';
type OwnershipFilter = 'all' | 'PUBLIC' | 'PRIVATE';

const normalizeOwnership = (value: string | null) =>
    value?.trim().toUpperCase() || null;

const permitStates = {
    document: {
        label: 'Document linked',
        icon: FileText,
        outline:
            'border-green-300 hover:border-green-500 focus-within:border-green-500 dark:border-green-700 dark:hover:border-green-500 dark:focus-within:border-green-500',
        badge: 'border-green-200 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300',
    },
    number: {
        label: 'Number recorded · No document',
        icon: FileWarning,
        outline:
            'border-purple-300 hover:border-purple-500 focus-within:border-purple-500 dark:border-purple-700 dark:hover:border-purple-500 dark:focus-within:border-purple-500',
        badge: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    },
    missing: {
        label: 'Check with CHED',
        icon: AlertCircle,
        outline:
            'border-red-300 hover:border-red-500 focus-within:border-red-500 dark:border-red-700 dark:hover:border-red-500 dark:focus-within:border-red-500',
        badge: 'border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
    },
} as const;

type PermitState = keyof typeof permitStates;

function getPermitState(program: Program): PermitState {
    if (program.permitPdfUrl) return 'document';
    return program.permit_number ? 'number' : 'missing';
}

function PermitStatusBadge({ state }: { state: PermitState }) {
    const { label, icon: Icon, badge } = permitStates[state];

    return (
        <Badge
            variant="outline"
            className={`max-w-full gap-1.5 whitespace-normal ${badge}`}
        >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {label}
        </Badge>
    );
}

const PERMIT_STATE_ORDER: PermitState[] = ['document', 'number', 'missing'];

/** Legend chips that double as a single-select filter; clicking the active chip clears it. */
function PermitFilterChips({
    programs,
    active,
    onChange,
}: {
    programs: Program[];
    active: PermitState | null;
    onChange: (state: PermitState | null) => void;
}) {
    const counts: Record<PermitState, number> = {
        document: 0,
        number: 0,
        missing: 0,
    };
    programs.forEach((program) => counts[getPermitState(program)]++);

    return (
        <div
            role="group"
            aria-label="Filter programs by permit information"
            className="mb-4 flex flex-wrap items-center gap-2"
        >
            <span className="text-xs text-muted-foreground">
                Permit information:
            </span>
            {PERMIT_STATE_ORDER.map((state) => {
                const { label, icon: Icon, badge } = permitStates[state];
                const selected = active === state;

                return (
                    <button
                        key={state}
                        type="button"
                        aria-pressed={selected}
                        disabled={counts[state] === 0}
                        onClick={() => onChange(selected ? null : state)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:cursor-not-allowed disabled:opacity-40',
                            badge,
                            selected &&
                                'ring-2 ring-current ring-offset-1 ring-offset-background',
                            active &&
                                !selected &&
                                'opacity-50 hover:opacity-100',
                        )}
                    >
                        <Icon
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {label}
                        <span className="tabular-nums">({counts[state]})</span>
                    </button>
                );
            })}
            {active && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onChange(null)}
                >
                    Show all ({programs.length})
                </Button>
            )}
        </div>
    );
}

export default function InstitutionIndex({ institutions, error }: Props) {
    const { can } = usePermissions();
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
    const [ownershipFilter, setOwnershipFilter] =
        useState<OwnershipFilter>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    // Scoped to one institution so expanding another school always starts unfiltered.
    const [permitFilter, setPermitFilter] = useState<{
        instCode: string;
        state: PermitState;
    } | null>(null);
    const [loadedPrograms, setLoadedPrograms] = useState<
        Record<string, Program[]>
    >({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [loadError, setLoadError] = useState<Record<string, string | null>>(
        {},
    );

    // Graduates Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState<{
        name: string;
        instCode: string;
        instName: string;
        major: string | null;
    } | null>(null);

    // Permit Dialog state
    const [permitDialogOpen, setPermitDialogOpen] = useState(false);
    const [permitDialogProgram, setPermitDialogProgram] =
        useState<PermitDialogProgram | null>(null);

    const controllersRef = useRef<Record<string, AbortController>>({});

    useEffect(() => {
        if (error)
            toast.error('Failed to load institutions', { description: error });
    }, [error]);

    useEffect(() => {
        const controllers = controllersRef.current;

        return () => {
            Object.values(controllers).forEach((controller) =>
                controller.abort(),
            );
        };
    }, []);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        return institutions.filter((institution) => {
            const matchesSearch =
                query === '' ||
                institution.name.toLowerCase().includes(query) ||
                institution.institution_code.toLowerCase().includes(query);
            const matchesRegion =
                regionFilter === 'all' || institution.region === regionFilter;
            const matchesOwnership =
                ownershipFilter === 'all' ||
                normalizeOwnership(institution.ownership_sector) ===
                    ownershipFilter;

            return matchesSearch && matchesRegion && matchesOwnership;
        });
    }, [institutions, ownershipFilter, regionFilter, search]);

    const regionCounts = useMemo(
        () => ({
            all: institutions.length,
            'REGION XII': institutions.filter(
                (institution) => institution.region === 'REGION XII',
            ).length,
            BARMM: institutions.filter(
                (institution) => institution.region === 'BARMM',
            ).length,
        }),
        [institutions],
    );

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / INSTITUTIONS_PER_PAGE),
    );
    const activePage = Math.min(currentPage, totalPages);
    const pageStart = (activePage - 1) * INSTITUTIONS_PER_PAGE;
    const paginatedInstitutions = filtered.slice(
        pageStart,
        pageStart + INSTITUTIONS_PER_PAGE,
    );

    const getProgramTypeColor = (type: string | null) => {
        switch (type) {
            case 'Board':
                return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300';
            case 'Non-Board':
                return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300';
            default:
                return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300';
        }
    };

    const getOwnershipSectorBadge = (sector: string | null) => {
        const normalizedSector = normalizeOwnership(sector);
        if (!normalizedSector) return null;
        const colors =
            normalizedSector === 'PUBLIC'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        return (
            <Badge className={colors} variant="outline">
                {normalizedSector}
            </Badge>
        );
    };

    const getOwnershipTypeBadge = (type: string | null) => {
        const normalizedType = normalizeOwnership(type);
        if (!normalizedType) return null;
        const colors =
            normalizedType === 'SUC'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
                : normalizedType === 'LUC'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        return (
            <Badge className={colors} variant="outline">
                {normalizedType}
            </Badge>
        );
    };

    const fmt = (v: string | number | null | undefined) =>
        v === null || v === undefined || String(v).trim() === ''
            ? '-'
            : String(v);

    async function loadPrograms(instCode: string) {
        if (loadedPrograms[instCode] || loading[instCode]) return;

        if (controllersRef.current[instCode]) {
            controllersRef.current[instCode].abort();
        }

        const controller = new AbortController();
        controllersRef.current[instCode] = controller;
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        try {
            setLoading((s) => ({ ...s, [instCode]: true }));
            setLoadError((s) => ({ ...s, [instCode]: null }));

            const res = await fetch(
                `/institutions/${encodeURIComponent(instCode)}/programs`,
                {
                    headers: { Accept: 'application/json' },
                    signal: controller.signal,
                },
            );

            clearTimeout(timeoutId);

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                throw new Error(text || `Request failed (${res.status})`);
            }

            const json = await res.json().catch(() => ({ data: [] }));
            const items: Program[] = json?.data ?? [];
            setLoadedPrograms((s) => ({ ...s, [instCode]: items }));
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') return;
            console.error(error);
            setLoadError((s) => ({
                ...s,
                [instCode]: 'Unable to load programs.',
            }));
            setLoadedPrograms((s) => ({ ...s, [instCode]: [] }));
            toast.error('Unable to load programs', {
                description: 'Please try again.',
            });
        } finally {
            setLoading((s) => ({ ...s, [instCode]: false }));
        }
    }

    function openProgramDetails(inst: Institution, prog: Program) {
        if (!can('view_graduates')) {
            toast.info('Your role cannot view graduate lists.');

            return;
        }
        setSelectedProgram({
            name: prog.program_name,
            major: prog.major ?? null,
            instCode: inst.institution_code,
            instName: inst.name,
        });
        setDialogOpen(true);
    }

    const openPermitView = (inst: Institution, prog: Program) => {
        const isPublic = inst.ownership_sector === 'PUBLIC';

        // Map Admin Program to PermitDialog Program format
        const dialogData: PermitDialogProgram = {
            id: prog.id,
            name: prog.program_name,
            major: prog.major,
            copNumber: isPublic ? prog.permit_number : null,
            grNumber: !isPublic ? prog.permit_number : null,
            institution: {
                code: inst.institution_code,
                name: inst.name,
                type: inst.ownership_sector === 'PUBLIC' ? 'public' : 'private',
            },
            permitPdfUrl: prog.permitPdfUrl,
        };

        setPermitDialogProgram(dialogData);
        setPermitDialogOpen(true);
    };

    const onRowToggle = (row: Institution) => {
        const newId = expandedId === row.id ? null : row.id;
        setExpandedId(newId);
        if (newId === row.id) {
            void loadPrograms(row.institution_code);
        }
    };

    return (
        <>
            <Head title="Institutions" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>All Institutions</CardTitle>
                        <CardDescription>
                            Total of {institutions.length} institution
                            {institutions.length !== 1 ? 's' : ''} registered
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <div className="mb-6 space-y-4">
                            <Tabs
                                value={regionFilter}
                                onValueChange={(value) => {
                                    setRegionFilter(value as RegionFilter);
                                    setCurrentPage(1);
                                    setExpandedId(null);
                                }}
                            >
                                <TabsList className="h-auto w-full justify-start overflow-x-auto sm:w-fit">
                                    <TabsTrigger value="all">
                                        All ({regionCounts.all})
                                    </TabsTrigger>
                                    <TabsTrigger value="REGION XII">
                                        Region XII ({regionCounts['REGION XII']}
                                        )
                                    </TabsTrigger>
                                    <TabsTrigger value="BARMM">
                                        BARMM ({regionCounts.BARMM})
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>

                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                                <div className="relative">
                                    <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                                    <Input
                                        type="search"
                                        placeholder="Search by institution code or name..."
                                        value={search}
                                        onChange={(event) => {
                                            setSearch(event.target.value);
                                            setCurrentPage(1);
                                            setExpandedId(null);
                                        }}
                                        className="h-10 pl-10"
                                    />
                                </div>

                                <Select
                                    value={ownershipFilter}
                                    onValueChange={(value) => {
                                        setOwnershipFilter(
                                            value as OwnershipFilter,
                                        );
                                        setCurrentPage(1);
                                        setExpandedId(null);
                                    }}
                                >
                                    <SelectTrigger className="h-10 w-full">
                                        <SelectValue placeholder="All ownership" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            All ownership
                                        </SelectItem>
                                        <SelectItem value="PUBLIC">
                                            Public
                                        </SelectItem>
                                        <SelectItem value="PRIVATE">
                                            Private
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="h-12">
                                            Institution Code
                                        </TableHead>
                                        <TableHead className="h-12">
                                            Institution Name
                                        </TableHead>
                                        <TableHead className="h-12">
                                            Ownership
                                        </TableHead>
                                        <TableHead className="h-12">
                                            Coordinates
                                        </TableHead>
                                        <TableHead className="h-12 w-12 text-right"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={5}
                                                className="h-32 text-center text-gray-500 dark:text-gray-400"
                                            >
                                                {search
                                                    ? 'No institutions found'
                                                    : 'No institutions available'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paginatedInstitutions.map((row) => {
                                            const instCode =
                                                row.institution_code;
                                            const progs =
                                                loadedPrograms[instCode];
                                            const isLoading =
                                                loading[instCode] === true;
                                            const errText =
                                                loadError[instCode] || null;
                                            const isExpanded =
                                                expandedId === row.id;
                                            const activePermit =
                                                permitFilter?.instCode ===
                                                instCode
                                                    ? permitFilter.state
                                                    : null;
                                            const visiblePrograms =
                                                progs && activePermit
                                                    ? progs.filter(
                                                          (program) =>
                                                              getPermitState(
                                                                  program,
                                                              ) ===
                                                              activePermit,
                                                      )
                                                    : progs;
                                            const ownershipSector =
                                                normalizeOwnership(
                                                    row.ownership_sector,
                                                );
                                            const ownershipType =
                                                normalizeOwnership(
                                                    row.ownership_type,
                                                );
                                            const hasDistinctOwnershipType =
                                                ownershipType !== null &&
                                                ownershipType !==
                                                    ownershipSector;

                                            return (
                                                <React.Fragment key={row.id}>
                                                    <TableRow
                                                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                                        onClick={() =>
                                                            onRowToggle(row)
                                                        }
                                                    >
                                                        <TableCell className="py-4 font-mono font-medium text-blue-600 dark:text-blue-400">
                                                            {
                                                                row.institution_code
                                                            }
                                                        </TableCell>
                                                        <TableCell className="py-4 font-medium">
                                                            {row.name}
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {getOwnershipSectorBadge(
                                                                    ownershipSector,
                                                                )}
                                                                {hasDistinctOwnershipType &&
                                                                    getOwnershipTypeBadge(
                                                                        ownershipType,
                                                                    )}
                                                                {!ownershipSector &&
                                                                    !ownershipType && (
                                                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                                                            -
                                                                        </span>
                                                                    )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-4 font-mono text-sm text-gray-600 dark:text-gray-400">
                                                            {row.x_coordinate &&
                                                            row.y_coordinate
                                                                ? `${parseFloat(row.x_coordinate).toFixed(2)}, ${parseFloat(row.y_coordinate).toFixed(2)}`
                                                                : '-'}
                                                        </TableCell>
                                                        <TableCell className="py-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={(
                                                                    e,
                                                                ) => {
                                                                    e.stopPropagation();
                                                                    onRowToggle(
                                                                        row,
                                                                    );
                                                                }}
                                                                aria-label={
                                                                    isExpanded
                                                                        ? 'Collapse programs list'
                                                                        : 'Expand programs list'
                                                                }
                                                                aria-expanded={
                                                                    isExpanded
                                                                }
                                                                className="inline-flex items-center justify-center rounded p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                            >
                                                                <ChevronDown
                                                                    className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                                />
                                                            </button>
                                                        </TableCell>
                                                    </TableRow>

                                                    {isExpanded && (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={5}
                                                                className="bg-gray-50 p-6 dark:bg-gray-900"
                                                            >
                                                                {isLoading ? (
                                                                    <div
                                                                        className="space-y-4"
                                                                        aria-busy="true"
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <Skeleton className="h-4 w-4 rounded-full" />
                                                                            <Skeleton className="h-4 w-40" />
                                                                        </div>
                                                                        <Skeleton className="h-10 w-full" />
                                                                        <Skeleton className="h-10 w-full" />
                                                                    </div>
                                                                ) : errText ? (
                                                                    <p className="text-sm text-red-600 dark:text-red-400">
                                                                        {
                                                                            errText
                                                                        }
                                                                    </p>
                                                                ) : !progs ||
                                                                  progs.length ===
                                                                      0 ? (
                                                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                        No
                                                                        programs
                                                                        available
                                                                    </p>
                                                                ) : (
                                                                    <>
                                                                        <h4 className="mb-3 flex items-center gap-2 font-semibold">
                                                                            <GraduationCap className="h-4 w-4" />
                                                                            Programs
                                                                            Offered
                                                                        </h4>
                                                                        <PermitFilterChips
                                                                            programs={
                                                                                progs
                                                                            }
                                                                            active={
                                                                                activePermit
                                                                            }
                                                                            onChange={(
                                                                                state,
                                                                            ) =>
                                                                                setPermitFilter(
                                                                                    state
                                                                                        ? {
                                                                                              instCode,
                                                                                              state,
                                                                                          }
                                                                                        : null,
                                                                                )
                                                                            }
                                                                        />
                                                                        <div className="space-y-2">
                                                                            {(
                                                                                visiblePrograms ??
                                                                                progs
                                                                            ).map(
                                                                                (
                                                                                    program,
                                                                                ) => (
                                                                                    <div
                                                                                        key={
                                                                                            program.id
                                                                                        }
                                                                                        onClick={() =>
                                                                                            openProgramDetails(
                                                                                                row,
                                                                                                program,
                                                                                            )
                                                                                        }
                                                                                        className={`group cursor-pointer rounded-md border bg-white p-4 whitespace-normal shadow-sm transition-colors hover:shadow-md dark:bg-gray-800 ${permitStates[getPermitState(program)].outline}`}
                                                                                    >
                                                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                                                            <div className="min-w-0 flex-1">
                                                                                                <button
                                                                                                    type="button"
                                                                                                    className="rounded-sm text-left text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current dark:text-gray-100"
                                                                                                    aria-label={`View graduates for ${program.program_name}${program.major ? ` — ${program.major}` : ''}`}
                                                                                                    onClick={(
                                                                                                        event,
                                                                                                    ) => {
                                                                                                        event.stopPropagation();
                                                                                                        openProgramDetails(
                                                                                                            row,
                                                                                                            program,
                                                                                                        );
                                                                                                    }}
                                                                                                >
                                                                                                    {
                                                                                                        program.program_name
                                                                                                    }
                                                                                                    <ExternalLink className="ml-2 inline-block h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                                                                                                </button>
                                                                                                <div className="mt-2">
                                                                                                    <PermitStatusBadge
                                                                                                        state={getPermitState(
                                                                                                            program,
                                                                                                        )}
                                                                                                    />
                                                                                                </div>
                                                                                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                                                                                    <p>
                                                                                                        {program.permit_number ? (
                                                                                                            <>
                                                                                                                Permit:{' '}
                                                                                                                <span className="font-mono text-gray-700 dark:text-gray-300">
                                                                                                                    {fmt(
                                                                                                                        program.permit_number,
                                                                                                                    )}
                                                                                                                </span>
                                                                                                            </>
                                                                                                        ) : (
                                                                                                            'Permit number not recorded'
                                                                                                        )}
                                                                                                    </p>
                                                                                                    {program.major && (
                                                                                                        <p>
                                                                                                            Major:{' '}
                                                                                                            <span className="text-gray-700 dark:text-gray-300">
                                                                                                                {
                                                                                                                    program.major
                                                                                                                }
                                                                                                            </span>
                                                                                                        </p>
                                                                                                    )}
                                                                                                </div>
                                                                                            </div>
                                                                                            <div className="flex shrink-0 flex-wrap items-center gap-3">
                                                                                                {program.program_type && (
                                                                                                    <Badge
                                                                                                        className={`w-fit whitespace-nowrap ${getProgramTypeColor(program.program_type)}`}
                                                                                                    >
                                                                                                        {
                                                                                                            program.program_type
                                                                                                        }
                                                                                                    </Badge>
                                                                                                )}

                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="h-8 gap-1.5 bg-white text-xs hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700"
                                                                                                    onClick={(
                                                                                                        e,
                                                                                                    ) => {
                                                                                                        e.stopPropagation();
                                                                                                        openPermitView(
                                                                                                            row,
                                                                                                            program,
                                                                                                        );
                                                                                                    }}
                                                                                                >
                                                                                                    <FileText className="h-3.5 w-3.5" />
                                                                                                    View
                                                                                                    Permit
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {filtered.length > 0 && (
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Showing {pageStart + 1}–
                                    {Math.min(
                                        pageStart + INSTITUTIONS_PER_PAGE,
                                        filtered.length,
                                    )}{' '}
                                    of {filtered.length} institutions
                                </p>

                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={activePage === 1}
                                        onClick={() => {
                                            setCurrentPage((page) =>
                                                Math.max(1, page - 1),
                                            );
                                            setExpandedId(null);
                                        }}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </Button>
                                    <span className="min-w-24 text-center text-sm text-gray-600 dark:text-gray-400">
                                        Page {activePage} of {totalPages}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={activePage === totalPages}
                                        onClick={() => {
                                            setCurrentPage((page) =>
                                                Math.min(totalPages, page + 1),
                                            );
                                            setExpandedId(null);
                                        }}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Graduates Dialog Component */}
            <ViewGraduatesDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                programName={selectedProgram?.name || null}
                institutionName={selectedProgram?.instName || null}
                institutionCode={selectedProgram?.instCode || null}
                major={selectedProgram?.major ?? null}
                key={`${selectedProgram?.instCode}-${selectedProgram?.name}-${selectedProgram?.major}-${dialogOpen}`}
            />

            {/* Permit Viewer Dialog (Reused from landing page) */}
            <PermitDialog
                open={permitDialogOpen}
                program={permitDialogProgram}
                onOpenChange={(open) => {
                    setPermitDialogOpen(open);
                    if (!open) setPermitDialogProgram(null);
                }}
            />
        </>
    );
}

InstitutionIndex.layout = {
    breadcrumbs: breadcrumbs,
};
