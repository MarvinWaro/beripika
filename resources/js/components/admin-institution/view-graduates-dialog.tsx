import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GraduateLite {
    id: number;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    so_number: string | null;
    year_graduated: string | null;
}
interface Results {
    data: GraduateLite[];
    current_page: number;
    last_page: number;
    total: number;
    from: number | null;
    to: number | null;
    years: number[];
}
interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    programName: string | null;
    institutionName: string | null;
    institutionCode: string | null;
    major: string | null;
}

export default function ViewGraduatesDialog({
    open,
    onOpenChange,
    programName,
    institutionName,
    institutionCode,
    major,
}: Props) {
    const [year, setYear] = useState('');
    const [page, setPage] = useState(1);
    const [results, setResults] = useState<Results | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [revision, setRevision] = useState(0);

    useEffect(() => {
        if (!open || !institutionCode || !programName) return;
        const controller = new AbortController();
        setLoading(true);
        setError(null);
        axios
            .get<Results>(
                `/institutions/${institutionCode}/programs/graduates`,
                {
                    params: {
                        program_name: programName,
                        major: major ?? '',
                        year: year || undefined,
                        page,
                    },
                    signal: controller.signal,
                },
            )
            .then(({ data }) => {
                if (!controller.signal.aborted) setResults(data);
            })
            .catch(() => {
                if (!controller.signal.aborted)
                    setError(
                        'Could not load student records. Please try again.',
                    );
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [open, institutionCode, programName, major, year, page, revision]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{programName}</DialogTitle>
                    <DialogDescription>
                        {institutionName} ({institutionCode})
                        {major ? ' · ' + major : ''}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm">
                        Graduation year
                        <select
                            aria-label="Graduation year"
                            className="rounded-md border bg-background p-2"
                            value={year}
                            disabled={loading}
                            onChange={(event) => {
                                setYear(event.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All years</option>
                            {results?.years.map((value) => (
                                <option key={value} value={value}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span className="text-sm text-muted-foreground">
                        {results?.total ?? 0} graduates
                    </span>
                </div>
                {error && (
                    <Alert variant="destructive">
                        <AlertDescription>
                            {error}{' '}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRevision((v) => v + 1)}
                            >
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                <div
                    className="min-h-40 overflow-auto rounded-md border"
                    aria-busy={loading}
                >
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Student name</TableHead>
                                <TableHead>SO number</TableHead>
                                <TableHead>Graduation date</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="py-10 text-center"
                                    >
                                        <Loader2
                                            aria-label="Loading graduates"
                                            className="mx-auto h-5 w-5 animate-spin"
                                        />
                                    </TableCell>
                                </TableRow>
                            ) : results?.data.length ? (
                                results.data.map((graduate) => (
                                    <TableRow key={graduate.id}>
                                        <TableCell className="whitespace-normal">
                                            {graduate.last_name},{' '}
                                            {graduate.first_name}
                                            <span className="block text-xs text-muted-foreground">
                                                {graduate.middle_name}
                                            </span>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {graduate.so_number ?? '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">
                                                {graduate.year_graduated ?? '—'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={3}
                                        className="py-10 text-center text-muted-foreground"
                                    >
                                        {error
                                            ? 'Student records unavailable.'
                                            : 'No graduates match this program, major and year.'}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span>
                        Showing {results?.from ?? 0}–{results?.to ?? 0} of{' '}
                        {results?.total ?? 0}
                    </span>
                    <nav
                        aria-label="Graduate pages"
                        className="flex items-center gap-2"
                    >
                        <Button
                            variant="outline"
                            disabled={
                                loading || (results?.current_page ?? 1) <= 1
                            }
                            onClick={() =>
                                setPage((results?.current_page ?? 1) - 1)
                            }
                        >
                            Previous
                        </Button>
                        <span>
                            {results?.current_page ?? 1} /{' '}
                            {results?.last_page ?? 1}
                        </span>
                        <Button
                            variant="outline"
                            disabled={
                                loading ||
                                !results ||
                                results.current_page >= results.last_page
                            }
                            onClick={() =>
                                setPage((results?.current_page ?? 1) + 1)
                            }
                        >
                            Next
                        </Button>
                    </nav>
                </div>
            </DialogContent>
        </Dialog>
    );
}
