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
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
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
import PermitDialog from '@/components/welcome/permit-dialog';
import { useProgramRefresh } from '@/hooks/use-program-refresh';
import {
    filterPrograms,
    permitColors,
    permitLabels,
    permitState,
} from '@/lib/programs';
import { cn } from '@/lib/utils';
import type { PortalProgram, ProgramSnapshot } from '@/types/programs';
import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    FileText,
    FileWarning,
    RefreshCw,
    Search,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface Props extends ProgramSnapshot {
    hei: { instCode: string; instName: string }[];
    selectedInstCode: string | null;
    schools_error: string | null;
}

function Filter({
    id,
    label,
    value,
    options,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <label
                htmlFor={id}
                className="text-xs font-medium text-muted-foreground"
            >
                {label}
            </label>
            <Select value={value} onValueChange={onChange}>
                <SelectTrigger id={id} className="h-10">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

export default function ProgramIndex(props: Props) {
    return (
        <>
            <Head title="Programs" />
            <ProgramBrowser key={props.selectedInstCode ?? 'none'} {...props} />
        </>
    );
}

function ProgramBrowser({
    programs,
    last_fetched_at,
    stale,
    error,
    hei,
    selectedInstCode,
    schools_error,
}: Props) {
    const initial = useMemo(
        () => ({ programs, last_fetched_at, stale, error }),
        [programs, last_fetched_at, stale, error],
    );
    const { snapshot, refreshing, refresh } = useProgramRefresh(
        selectedInstCode,
        initial,
    );
    const [search, setSearch] = useState('');
    const [classification, setClassification] = useState('all');
    const [status, setStatus] = useState('all');
    const [permit, setPermit] = useState('all');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [selecting, setSelecting] = useState(false);
    const [selectedPermit, setSelectedPermit] = useState<PortalProgram | null>(
        null,
    );
    const school = hei.find((item) => item.instCode === selectedInstCode);
    const filtered = useMemo(
        () =>
            filterPrograms(
                snapshot.programs,
                search,
                classification,
                status,
                permit,
            ),
        [snapshot.programs, search, classification, status, permit],
    );
    const pages = Math.max(1, Math.ceil(filtered.length / 10));
    useEffect(() => {
        setPage((previous) => Math.min(previous, pages));
    }, [pages]);
    const activePage = Math.min(page, pages);
    const start = (activePage - 1) * 10;
    const statusOptions = [
        ...new Set(
            snapshot.programs.map((item) => item.program_status.toLowerCase()),
        ),
    ].sort();
    const changeFilter =
        (setter: (value: string) => void) => (value: string) => {
            setter(value);
            setPage(1);
        };
    const publicSchool = selectedPermit?.institution.type === 'public';

    return (
        <div className="flex flex-1 flex-col gap-4 p-4">
            <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <CardTitle>Programs</CardTitle>
                        <CardDescription>
                            {school?.instName ??
                                'Choose an institution to browse programs'}
                        </CardDescription>
                        <p className="text-xs text-muted-foreground">
                            {snapshot.programs.length} programs · Last fetched:{' '}
                            {snapshot.last_fetched_at
                                ? new Date(
                                      snapshot.last_fetched_at,
                                  ).toLocaleString()
                                : 'Not yet available'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Checks for updates every 5 minutes while this page
                            is visible.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        disabled={!selectedInstCode || refreshing || selecting}
                        onClick={() => void refresh()}
                        className="shrink-0 gap-2"
                    >
                        <RefreshCw
                            className={cn(
                                'h-4 w-4',
                                refreshing && 'animate-spin',
                            )}
                        />
                        {refreshing ? 'Refreshing…' : 'Refresh from portal'}
                    </Button>
                </CardHeader>
                <CardContent
                    className="space-y-5"
                    aria-busy={refreshing || selecting}
                >
                    {(snapshot.error || schools_error) && (
                        <Alert role="status">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {snapshot.error ?? schools_error}{' '}
                                {snapshot.last_fetched_at
                                    ? 'Showing previously fetched data.'
                                    : 'Portal data is currently unavailable.'}
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
                        <Popover open={open} onOpenChange={setOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={open}
                                    aria-label="Choose institution"
                                    disabled={selecting}
                                    className="h-10 w-full justify-between"
                                >
                                    <span className="truncate">
                                        {selecting
                                            ? 'Loading institution…'
                                            : school
                                              ? school.instCode +
                                                ' — ' +
                                                school.instName
                                              : 'Choose an institution…'}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
                                align="start"
                            >
                                <Command>
                                    <CommandInput placeholder="Search institutions…" />
                                    <CommandList>
                                        <CommandEmpty>
                                            No institution found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                            {hei.map((item, index) => (
                                                <CommandItem
                                                    key={item.instCode + index}
                                                    value={
                                                        item.instCode +
                                                        ' ' +
                                                        item.instName
                                                    }
                                                    onSelect={() => {
                                                        setOpen(false);
                                                        router.get(
                                                            '/programs',
                                                            {
                                                                instCode:
                                                                    item.instCode,
                                                            },
                                                            {
                                                                preserveScroll: true,
                                                                onStart: () =>
                                                                    setSelecting(
                                                                        true,
                                                                    ),
                                                                onFinish: () =>
                                                                    setSelecting(
                                                                        false,
                                                                    ),
                                                            },
                                                        );
                                                    }}
                                                    className="gap-2 py-3"
                                                >
                                                    <Check
                                                        className={cn(
                                                            'h-4 w-4 shrink-0',
                                                            selectedInstCode !==
                                                                item.instCode &&
                                                                'opacity-0',
                                                        )}
                                                    />
                                                    <span>
                                                        {item.instCode} —{' '}
                                                        {item.instName}
                                                    </span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <div className="relative">
                            <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                aria-label="Search programs, majors or permit numbers"
                                placeholder="Search program, major or permit…"
                                value={search}
                                onChange={(event) =>
                                    changeFilter(setSearch)(event.target.value)
                                }
                                className="h-10 pl-10"
                            />
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Filter
                            id="classification"
                            label="Classification"
                            value={classification}
                            onChange={changeFilter(setClassification)}
                            options={[
                                { value: 'all', label: 'All classifications' },
                                { value: 'Unknown', label: 'Unclassified' },
                                { value: 'Board', label: 'Board' },
                                { value: 'Non-Board', label: 'Non-Board' },
                            ]}
                        />
                        <Filter
                            id="program-status"
                            label="Program status"
                            value={status}
                            onChange={changeFilter(setStatus)}
                            options={[
                                { value: 'all', label: 'All statuses' },
                                ...[
                                    ...new Set([
                                        ...statusOptions,
                                        ...(status !== 'all' ? [status] : []),
                                    ]),
                                ].map((value) => ({
                                    value,
                                    label:
                                        value.charAt(0).toUpperCase() +
                                        value.slice(1),
                                })),
                            ]}
                        />
                        <Filter
                            id="permit-information"
                            label="Permit information"
                            value={permit}
                            onChange={changeFilter(setPermit)}
                            options={[
                                {
                                    value: 'all',
                                    label: 'All permit information',
                                },
                                ...Object.entries(permitLabels).map(
                                    ([value, label]) => ({ value, label }),
                                ),
                            ]}
                        />
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Program / Major</TableHead>
                                    <TableHead>Classification</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Permit information</TableHead>
                                    <TableHead>
                                        <span className="sr-only">Actions</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered
                                    .slice(start, start + 10)
                                    .map((program) => {
                                        const state = permitState(program);
                                        const Icon =
                                            state === 'document'
                                                ? FileText
                                                : state === 'number'
                                                  ? FileWarning
                                                  : AlertCircle;
                                        return (
                                            <TableRow key={program.id}>
                                                <TableCell className="max-w-md py-4 whitespace-normal">
                                                    <p className="font-medium">
                                                        {program.program_name}
                                                    </p>
                                                    {program.major && (
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            {program.major}
                                                        </p>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {program.program_type ===
                                                        'Unknown'
                                                            ? 'Unclassified'
                                                            : program.program_type}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            program.program_status.toLowerCase() ===
                                                            'active'
                                                                ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                                : ''
                                                        }
                                                    >
                                                        {program.program_status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'gap-1.5 whitespace-normal',
                                                            permitColors[state],
                                                        )}
                                                    >
                                                        <Icon className="h-3.5 w-3.5 shrink-0" />
                                                        {permitLabels[state]}
                                                    </Badge>
                                                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                                                        {program.permit_number ??
                                                            'Permit number not recorded'}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setSelectedPermit(
                                                                program,
                                                            )
                                                        }
                                                        aria-label={
                                                            'View permit for ' +
                                                            program.program_name
                                                        }
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                        View Permit
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                {filtered.length === 0 && (
                                    <TableRow>
                                        <TableCell
                                            colSpan={5}
                                            className="h-32 text-center text-muted-foreground"
                                        >
                                            {snapshot.error &&
                                            !snapshot.last_fetched_at
                                                ? 'Programs are unavailable. Try Refresh from portal.'
                                                : !selectedInstCode
                                                  ? 'Choose an institution to view its programs.'
                                                  : snapshot.programs.length ===
                                                      0
                                                    ? 'The portal returned no programs for this institution.'
                                                    : 'No programs match these filters.'}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p
                            className="text-sm text-muted-foreground"
                            aria-live="polite"
                        >
                            Showing {filtered.length ? start + 1 : 0}–
                            {Math.min(start + 10, filtered.length)} of{' '}
                            {filtered.length} programs
                        </p>
                        <nav
                            aria-label="Program pagination"
                            className="flex items-center gap-2"
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={activePage === 1}
                                onClick={() => setPage(activePage - 1)}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </Button>
                            <span className="text-sm">
                                Page {activePage} of {pages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={activePage === pages}
                                onClick={() => setPage(activePage + 1)}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </nav>
                    </div>
                </CardContent>
            </Card>
            <PermitDialog
                open={selectedPermit !== null}
                onOpenChange={(value) => {
                    if (!value) setSelectedPermit(null);
                }}
                program={
                    selectedPermit
                        ? {
                              id: selectedPermit.id,
                              name: selectedPermit.program_name,
                              major: selectedPermit.major,
                              copNumber: publicSchool
                                  ? selectedPermit.permit_number
                                  : null,
                              grNumber: publicSchool
                                  ? null
                                  : selectedPermit.permit_number,
                              permitPdfUrl: selectedPermit.permit_pdf_url,
                              institution: {
                                  code: selectedPermit.institution
                                      .institution_code,
                                  name: selectedPermit.institution.name,
                                  type: selectedPermit.institution.type,
                              },
                          }
                        : null
                }
            />
        </div>
    );
}

ProgramIndex.layout = {
    breadcrumbs: [
                { title: 'Dashboard', href: '/dashboard' },
                { title: 'Programs', href: '/programs' },
            ],
};
