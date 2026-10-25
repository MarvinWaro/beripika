import { Head, router } from '@inertiajs/react';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Search, Edit2, Trash2, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import EditGraduateDialog, {
    GraduateForEdit,
} from '@/components/graduates/edit-dialog';
import FilterCombobox, {
    type FilterOption,
} from '@/components/graduates/filter-combobox';

interface Institution {
    institution_code: string;
    name: string;
    type: string;
}

interface Program {
    program_name: string;
    major: string | null;
    program_type: string;
    permit_number: string;
    institution: Institution;
}

interface Graduate {
    id: number;
    student_id_number: string | null;
    date_of_birth: string | null;
    last_name: string;
    first_name: string;
    middle_name: string | null;
    extension_name: string | null;
    sex: string | null;
    year_graduated: string;
    academic_year: string | null;
    hei_uii: string | null;
    program: Program;
    so_number: string | null;
}

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
    hei?: string | null;
    program?: string | null;
    year?: number | null;
    sex?: 'MALE' | 'FEMALE' | null;
}

interface FilterOptions {
    institutions: FilterOption[];
    programs: string[];
    years: number[];
}

interface Props {
    graduates: Pagination<Graduate>;
    filters: Filters;
    filterOptions: FilterOptions;
}

/** Select components need a non-empty value for "no filter". */
const ALL = 'all';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Dashboard',
        href: dashboard().url,
    },
    {
        title: 'Graduates',
        href: '/graduates',
    },
];

export default function GraduateIndex({
    graduates,
    filters,
    filterOptions,
}: Props) {
    const [items, setItems] = useState<Graduate[]>(graduates.data);
    const [total, setTotal] = useState<number>(
        graduates.total ?? graduates.data.length,
    );
    const [search, setSearch] = useState(filters.q ?? '');

    const { can } = usePermissions();
    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState<GraduateForEdit | null>(null);

    // track which delete popover is open
    const [deleteOpenId, setDeleteOpenId] = useState<number | null>(null);

    // Sync local items when Inertia sends new page of graduates
    useEffect(() => {
        setItems(graduates.data);
        setTotal(graduates.total ?? graduates.data.length);
    }, [graduates.data, graduates.total]);

    const getProgramTypeColor = (type: string) => {
        switch (type) {
            case 'Board':
                return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-950';
            case 'Non-Board':
                return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-800';
            default:
                return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-800';
        }
    };

    const getSexColor = (sex: string | null) => {
        switch (sex?.toUpperCase()) {
            case 'MALE':
                return 'bg-blue-50 text-blue-700 hover:bg-blue-50 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-950';
            case 'FEMALE':
                return 'bg-pink-50 text-pink-700 hover:bg-pink-50 dark:bg-pink-950 dark:text-pink-300 dark:hover:bg-pink-950';
            default:
                return 'bg-gray-100 text-gray-800 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-800';
        }
    };

    const openEditDialog = (graduate: Graduate) => {
        // cast Graduate -> GraduateForEdit (they have the same shape)
        setEditing(graduate as GraduateForEdit);
        setEditOpen(true);
    };

    const handleGraduateUpdated = (
        id: number,
        updated: {
            last_name: string;
            first_name: string;
            middle_name: string | null;
            extension_name: string | null;
            sex: string | null;
            year_graduated: string;
            academic_year: string | null;
            so_number: string | null;
            program_name: string;
            major: string | null;
        },
    ) => {
        setItems((prev) =>
            prev.map((g) =>
                g.id === id
                    ? {
                          ...g,
                          last_name: updated.last_name,
                          first_name: updated.first_name,
                          middle_name: updated.middle_name,
                          extension_name: updated.extension_name,
                          sex: updated.sex,
                          year_graduated: updated.year_graduated,
                          academic_year: updated.academic_year,
                          so_number: updated.so_number,
                          program: {
                              ...g.program,
                              program_name: updated.program_name,
                              major: updated.major,
                          },
                      }
                    : g,
            ),
        );
    };

    const handleDelete = async (id: number) => {
        // close popover first
        setDeleteOpenId(null);

        try {
            await axios.delete(`/graduates/${id}`);
            setItems((prev) => prev.filter((g) => g.id !== id));
            setTotal((prev) => (prev > 0 ? prev - 1 : 0));
            toast.success('Graduate removed successfully.');
        } catch (error: unknown) {
            console.error(error);
            const msg =
                (axios.isAxiosError<{ message?: string }>(error)
                    ? error.response?.data.message
                    : null) ?? 'Failed to remove graduate.';
            toast.error(msg);
        }
    };

    const hasFilters = Boolean(
        filters.hei || filters.program || filters.year || filters.sex,
    );

    // Search and filters travel together; any change starts again at page 1.
    const applyFilters = (changes: Partial<Filters> = {}) => {
        const next: Filters = {
            q: search.trim() || null,
            hei: filters.hei,
            program: filters.program,
            year: filters.year,
            sex: filters.sex,
            ...changes,
        };

        router.get(
            '/graduates',
            Object.fromEntries(
                Object.entries(next).filter(
                    ([, value]) => value !== null && value !== undefined,
                ),
            ),
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
            },
        );
    };

    const onSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters();
    };

    return (
        <>
            <Head title="Graduates" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>All Graduates</CardTitle>
                        <CardDescription aria-live="polite">
                            {filters.q ? (
                                <>
                                    Showing {items.length} of {total} graduate
                                    {total !== 1 ? 's' : ''} matching "
                                    {filters.q}"
                                    {hasFilters && ' and the selected filters'}
                                </>
                            ) : hasFilters ? (
                                <>
                                    Showing {items.length} of {total} graduate
                                    {total !== 1 ? 's' : ''} matching the
                                    selected filters
                                </>
                            ) : (
                                <>
                                    Total of {total} graduate
                                    {total !== 1 ? 's' : ''} registered
                                </>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {/* Search + filters (server-side). Filters apply on change; text applies on Search/Enter. */}
                        <form
                            role="search"
                            onSubmit={onSearchSubmit}
                            className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center"
                        >
                            <div className="relative min-w-0 flex-1">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="text"
                                    aria-label="Search graduates"
                                    placeholder="Search by name, SO number, program, institution, or year..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:flex-nowrap">
                                <FilterCombobox
                                    label="Institution"
                                    allLabel="All institutions"
                                    searchPlaceholder="Search institutions…"
                                    emptyText="No institution found."
                                    options={filterOptions.institutions}
                                    value={filters.hei ?? null}
                                    // A program list belongs to one institution, so reset it.
                                    onChange={(hei) =>
                                        applyFilters({ hei, program: null })
                                    }
                                    className="col-span-2 sm:w-60"
                                />
                                <FilterCombobox
                                    label="Program"
                                    allLabel="All programs"
                                    searchPlaceholder="Search programs…"
                                    emptyText="No program found."
                                    options={filterOptions.programs.map(
                                        (program) => ({
                                            value: program,
                                            label: program,
                                        }),
                                    )}
                                    value={filters.program ?? null}
                                    onChange={(program) =>
                                        applyFilters({ program })
                                    }
                                    className="col-span-2 sm:w-60"
                                />
                                <Select
                                    value={
                                        filters.year ? String(filters.year) : ALL
                                    }
                                    onValueChange={(value) =>
                                        applyFilters({
                                            year:
                                                value === ALL
                                                    ? null
                                                    : Number(value),
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        aria-label="Year graduated"
                                        className="h-10 sm:w-36"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>
                                            All years
                                        </SelectItem>
                                        {filterOptions.years.map((year) => (
                                            <SelectItem
                                                key={year}
                                                value={String(year)}
                                            >
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select
                                    value={filters.sex ?? ALL}
                                    onValueChange={(value) =>
                                        applyFilters({
                                            sex:
                                                value === ALL
                                                    ? null
                                                    : (value as Filters['sex']),
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        aria-label="Sex"
                                        className="h-10 sm:w-32"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>All sexes</SelectItem>
                                        <SelectItem value="MALE">Male</SelectItem>
                                        <SelectItem value="FEMALE">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button type="submit" className="h-10">
                                    <Search className="h-4 w-4" />
                                    Search
                                </Button>
                                {hasFilters && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        className="h-10"
                                        onClick={() =>
                                            applyFilters({
                                                hei: null,
                                                program: null,
                                                year: null,
                                                sex: null,
                                            })
                                        }
                                    >
                                        <X className="h-4 w-4" />
                                        Clear filters
                                    </Button>
                                )}
                            </div>
                        </form>

                        {/* Table */}
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>SO Number</TableHead>
                                        <TableHead>Last Name</TableHead>
                                        <TableHead>First Name</TableHead>
                                        <TableHead>Middle Name</TableHead>
                                        <TableHead>Ext</TableHead>
                                        <TableHead>Sex</TableHead>
                                        <TableHead>Institution</TableHead>
                                        <TableHead>Institution Code</TableHead>
                                        <TableHead>Program</TableHead>
                                        <TableHead>Major</TableHead>
                                        <TableHead>Program Type</TableHead>
                                        <TableHead>Date Graduated</TableHead>
                                        <TableHead>Academic Year</TableHead>
                                        <TableHead className="text-right">
                                            Actions
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {items.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={14}
                                                className="text-center py-8 text-muted-foreground"
                                            >
                                                {filters.q || hasFilters
                                                    ? 'No graduates match your search or filters.'
                                                    : 'No graduates available.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        items.map((graduate) => (
                                            <TableRow
                                                key={graduate.id}
                                                className="hover:bg-muted/50"
                                            >
                                                <TableCell className="text-sm">
                                                    {graduate.so_number ? (
                                                        <span className="font-medium text-blue-600">
                                                            {
                                                                graduate.so_number
                                                            }
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            -
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {graduate.last_name}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {graduate.first_name}
                                                </TableCell>
                                                <TableCell className="font-medium">
                                                    {graduate.middle_name}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {graduate.extension_name ||
                                                        '-'}
                                                </TableCell>
                                                <TableCell>
                                                    {graduate.sex ? (
                                                        <Badge
                                                            variant="outline"
                                                            className={getSexColor(
                                                                graduate.sex,
                                                            )}
                                                        >
                                                            {graduate.sex}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            -
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {
                                                        graduate.program
                                                            .institution.name
                                                    }
                                                </TableCell>
                                                <TableCell className="font-mono text-sm text-muted-foreground">
                                                    {
                                                        graduate.program
                                                            .institution
                                                            .institution_code
                                                    }
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {graduate.program
                                                        .program_name ?? '-'}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {graduate.program.major ||
                                                        '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={getProgramTypeColor(
                                                            graduate.program
                                                                .program_type,
                                                        )}
                                                    >
                                                        {
                                                            graduate.program
                                                                .program_type
                                                        }
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant="outline"
                                                        className="bg-orange-50 text-orange-800 hover:bg-orange-50 dark:bg-orange-950 dark:text-orange-300 dark:hover:bg-orange-950"
                                                    >
                                                        {
                                                            graduate.year_graduated
                                                        }
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {graduate.academic_year ||
                                                        '-'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {can('update_graduates') && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="flex items-center gap-1"
                                                            onClick={() =>
                                                                openEditDialog(
                                                                    graduate,
                                                                )
                                                            }
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                            <span className="hidden md:inline">
                                                                Edit
                                                            </span>
                                                        </Button>
                                                        )}

                                                        {/* Delete popover (controlled) */}
                                                        {can('delete_graduates') && (
                                                        <Popover
                                                            open={
                                                                deleteOpenId ===
                                                                graduate.id
                                                            }
                                                            onOpenChange={(
                                                                open,
                                                            ) =>
                                                                setDeleteOpenId(
                                                                    open
                                                                        ? graduate.id
                                                                        : null,
                                                                )
                                                            }
                                                        >
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="flex items-center gap-1 text-red-600 hover:text-red-700"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                    <span className="hidden md:inline">
                                                                        Remove
                                                                    </span>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent
                                                                className="w-72 border border-red-100 shadow-lg dark:border-red-900"
                                                                align="end"
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <div className="mt-0.5">
                                                                        <AlertTriangle className="h-5 w-5 text-red-500" />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <p className="text-sm font-semibold">
                                                                            Delete
                                                                            graduate
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground">
                                                                            Delete{' '}
                                                                            <span className="font-medium">
                                                                                {
                                                                                    graduate.first_name
                                                                                }{' '}
                                                                                {
                                                                                    graduate.last_name
                                                                                }
                                                                            </span>
                                                                            ? This
                                                                            action
                                                                            cannot
                                                                            be
                                                                            undone.
                                                                        </p>
                                                                        <div className="flex justify-end gap-2 pt-2">
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-7 px-3 text-xs"
                                                                                onClick={() =>
                                                                                    setDeleteOpenId(
                                                                                        null,
                                                                                    )
                                                                                }
                                                                            >
                                                                                Cancel
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-7 px-3 text-xs bg-red-600 hover:bg-red-700"
                                                                                onClick={() =>
                                                                                    handleDelete(
                                                                                        graduate.id,
                                                                                    )
                                                                                }
                                                                            >
                                                                                Delete
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {graduates.links && graduates.links.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {graduates.links.map((link, idx) => {
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
                                                    {},
                                                    {
                                                        preserveScroll: true,
                                                        preserveState: true,
                                                    },
                                                );
                                            }}
                                        >
                                            {label}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Edit dialog component */}
            <EditGraduateDialog
                open={editOpen}
                onOpenChange={(open) => {
                    setEditOpen(open);
                    if (!open) setEditing(null);
                }}
                graduate={editing}
                onUpdated={handleGraduateUpdated}
            />
        </>
    );
}

GraduateIndex.layout = {
    breadcrumbs: breadcrumbs,
};
