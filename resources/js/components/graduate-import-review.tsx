import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import axios from 'axios';
import { useEffect, useState } from 'react';

interface ReviewPage {
    data: {
        id: number;
        row_number: number;
        severity: string;
        message: string;
    }[];
    current_page: number;
    last_page: number;
    total: number;
}

export default function GraduateImportReview({
    runId,
    open,
    onOpenChange,
}: {
    runId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<ReviewPage | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        if (!open) return;
        const controller = new AbortController();
        setLoading(true);
        setError(false);
        axios
            .get<ReviewPage>(`/import/graduates/runs/${runId}/review`, {
                params: { page },
                signal: controller.signal,
            })
            .then(({ data }) => {
                if (!controller.signal.aborted) setResult(data);
            })
            .catch(() => {
                if (!controller.signal.aborted) setError(true);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [runId, open, page, retry]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-xl">
                <SheetHeader className="pr-12">
                    <SheetTitle>Import review · #{runId}</SheetTitle>
                    <SheetDescription>
                        Review notes keep the student's Excel information. Row
                        errors mean that row was not imported.
                    </SheetDescription>
                </SheetHeader>
                <div
                    className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
                    aria-busy={loading}
                >
                    {loading ? (
                        <p role="status">Loading review notes…</p>
                    ) : error ? (
                        <div role="alert" className="space-y-3">
                            <p>Could not load the review notes.</p>
                            <Button
                                variant="outline"
                                onClick={() => setRetry((value) => value + 1)}
                            >
                                Try again
                            </Button>
                        </div>
                    ) : result?.data.length ? (
                        <ul className="space-y-3">
                            {result.data.map((issue) => (
                                <li
                                    key={issue.id}
                                    className="rounded-lg border p-4"
                                >
                                    <p className="mb-2 text-sm font-semibold">
                                        Excel row {issue.row_number} ·{' '}
                                        {issue.severity === 'error'
                                            ? 'Row not imported'
                                            : 'Review note'}
                                    </p>
                                    <p className="text-sm break-words text-muted-foreground">
                                        {issue.message}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No review notes for this import.</p>
                    )}
                </div>
                <div className="space-y-3 border-t p-4">
                    <nav
                        aria-label="Review note pages"
                        className="flex items-center justify-between gap-2"
                    >
                        <Button
                            variant="outline"
                            disabled={loading || page <= 1}
                            onClick={() => setPage((value) => value - 1)}
                        >
                            Previous
                        </Button>
                        <span className="text-sm">
                            {page} / {result?.last_page ?? 1}
                        </span>
                        <Button
                            variant="outline"
                            disabled={
                                loading || !result || page >= result.last_page
                            }
                            onClick={() => setPage((value) => value + 1)}
                        >
                            Next
                        </Button>
                    </nav>
                    <a
                        className="text-sm underline underline-offset-4"
                        href={`/import/graduates/runs/${runId}/issues`}
                    >
                        Export review as CSV (optional)
                    </a>
                </div>
            </SheetContent>
        </Sheet>
    );
}
