import GraduateImportProgress from '@/components/graduate-import-progress';
import GraduateImportReview from '@/components/graduate-import-review';
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
import { usePermissions } from '@/hooks/use-permissions';
import axios from 'axios';
import { AlertCircle, Loader2, RefreshCw, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface ImportRun {
    id: number;
    filename: string;
    status: string;
    phase: 'reading' | 'writing';
    total_rows: number;
    total_chunks: number;
    completed_chunks: number;
    counts: Record<
        'created' | 'updated' | 'unchanged' | 'skipped' | 'invalid',
        number
    >;
    error: string | null;
    issues: number;
    created_at: string;
    finished_at: string | null;
    failed_chunks: { start_row: number; end_row: number; error: string }[];
}
interface History {
    runs: {
        data: ImportRun[];
        current_page: number;
        last_page: number;
        total: number;
    };
    active_id: number | null;
    worker_last_seen: string | null;
}
const statusLabel = (run: ImportRun) => {
    if (run.status === 'queued') return 'Starting import';
    if (run.status === 'processing') return 'Importing';
    if (run.status === 'completed_with_issues')
        return run.counts.invalid > 0
            ? 'Imported · review skipped rows'
            : 'Imported · review notes';
    return run.status === 'completed' ? 'Imported' : 'Needs attention';
};
const message = (error: unknown) =>
    axios.isAxiosError<{ message?: string }>(error)
        ? (error.response?.data.message ??
          'Could not contact the server. Please try again.')
        : 'Something went wrong. Please try again.';

export default function GraduateImport() {
    const { can } = usePermissions();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadPercent, setUploadPercent] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historyError, setHistoryError] = useState<string | null>(null);
    const [history, setHistory] = useState<History | null>(null);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<number | null>(null);
    const [revision, setRevision] = useState(0);
    const [reviewOpen, setReviewOpen] = useState(false);
    const [processingError, setProcessingError] = useState<{
        id: number;
        message: string;
    } | null>(null);
    const [online, setOnline] = useState(
        () => typeof navigator === 'undefined' || navigator.onLine,
    );
    const [visible, setVisible] = useState(
        () =>
            typeof document === 'undefined' ||
            document.visibilityState === 'visible',
    );
    const [historyLoading, setHistoryLoading] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const lastLifecycleRefresh = useRef(0);
    const canImport = can('import_graduates');

    useEffect(() => {
        const refreshAfterLifecycleChange = () => {
            const now = Date.now();
            if (now - lastLifecycleRefresh.current < 500) return;
            lastLifecycleRefresh.current = now;
            setRevision((value) => value + 1);
        };
        const updateConnection = () => {
            const connected = navigator.onLine;
            setOnline(connected);
            if (connected && document.visibilityState === 'visible')
                refreshAfterLifecycleChange();
        };
        const updateVisibility = () => {
            const isVisible = document.visibilityState === 'visible';
            setVisible(isVisible);
            if (isVisible && navigator.onLine) refreshAfterLifecycleChange();
        };
        const updateFocus = () => {
            if (document.visibilityState === 'visible' && navigator.onLine)
                refreshAfterLifecycleChange();
        };
        window.addEventListener('online', updateConnection);
        window.addEventListener('offline', updateConnection);
        window.addEventListener('focus', updateFocus);
        document.addEventListener('visibilitychange', updateVisibility);
        return () => {
            window.removeEventListener('online', updateConnection);
            window.removeEventListener('offline', updateConnection);
            window.removeEventListener('focus', updateFocus);
            document.removeEventListener('visibilitychange', updateVisibility);
        };
    }, []);

    useEffect(() => {
        if (!canImport) return;
        const controller = new AbortController();
        const load = async () => {
            if (!online || !visible) return;
            setHistoryLoading(true);
            try {
                const { data } = await axios.get<History>(
                    '/import/graduates/runs',
                    { params: { page }, signal: controller.signal },
                );
                if (!controller.signal.aborted) {
                    setHistory(data);
                    setHistoryError(null);
                }
            } catch {
                if (!controller.signal.aborted)
                    setHistoryError(
                        'Could not load import progress. Refresh when connected.',
                    );
            } finally {
                if (!controller.signal.aborted) setHistoryLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [canImport, online, page, revision, visible]);

    const activeId = history?.active_id;
    useEffect(() => {
        if (!canImport || !activeId || !online || !visible) return;
        let stopped = false;
        let timer: ReturnType<typeof setTimeout>;
        const process = async () => {
            if (stopped) return;
            let delay = 1000;
            if (document.visibilityState === 'visible' && navigator.onLine) {
                try {
                    // Do not abort an in-flight mutation on navigation. Its committed work remains recoverable.
                    const { data } = await axios.post<{ run: ImportRun }>(
                        `/import/graduates/runs/${activeId}/process`,
                    );
                    if (stopped) return;
                    setProcessingError(null);
                    setHistoryError(null);
                    setHistory((old) =>
                        old
                            ? {
                                  ...old,
                                  active_id: ['queued', 'processing'].includes(
                                      data.run.status,
                                  )
                                      ? activeId
                                      : null,
                                  runs: {
                                      ...old.runs,
                                      data: old.runs.data.map((item) =>
                                          item.id === activeId
                                              ? data.run
                                              : item,
                                      ),
                                  },
                              }
                            : old,
                    );
                    if (!['queued', 'processing'].includes(data.run.status)) {
                        setRevision((value) => value + 1);
                        return;
                    }
                } catch {
                    if (stopped) return;
                    setProcessingError({
                        id: activeId,
                        message:
                            'Processing was interrupted. Saved progress is safe; reconnect and keep this page open to resume.',
                    });
                    delay = 5000;
                }
            }
            if (!stopped) timer = setTimeout(() => void process(), delay);
        };
        void process();
        return () => {
            stopped = true;
            clearTimeout(timer);
        };
    }, [canImport, activeId, online, visible]);

    const run =
        history?.runs.data.find((item) => item.id === selected) ??
        history?.runs.data[0];
    const active = history?.active_id != null;
    const runProcessingError =
        processingError?.id === run?.id &&
        run &&
        ['queued', 'processing'].includes(run.status)
            ? processingError?.message
            : null;

    const upload = async () => {
        if (!file || uploading) return;
        if (file.size > 32 * 1024 * 1024) {
            setError('The maximum file size is 32 MB.');
            return;
        }
        setUploading(true);
        setUploadPercent(0);
        setError(null);
        const data = new FormData();
        data.append('file', file);
        try {
            const response = await axios.post<{ run: ImportRun }>(
                '/import/graduates',
                data,
                {
                    onUploadProgress: (event) =>
                        setUploadPercent(
                            Math.min(
                                100,
                                Math.round(
                                    (100 * event.loaded) /
                                        (event.total || file.size),
                                ),
                            ),
                        ),
                },
            );
            setSelected(response.data.run.id);
            setPage(1);
            setHistory((old) => ({
                runs: {
                    data: [response.data.run, ...(old?.runs.data ?? [])],
                    current_page: 1,
                    last_page: old?.runs.last_page ?? 1,
                    total: (old?.runs.total ?? 0) + 1,
                },
                active_id: response.data.run.id,
                worker_last_seen: old?.worker_last_seen ?? null,
            }));
            setRevision((v) => v + 1);
            setFile(null);
            if (input.current) input.current.value = '';
            toast.success('File uploaded. Importing your students…');
        } catch (err) {
            setError(message(err));
        } finally {
            setUploading(false);
        }
    };

    const retry = async () => {
        if (!run || busy) return;
        setBusy(true);
        setError(null);
        try {
            await axios.post(`/import/graduates/runs/${run.id}/retry`);
            setRevision((v) => v + 1);
            toast.success('Resuming your import.');
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };

    const clear = async () => {
        if (
            !window.confirm(
                'Permanently delete all graduate records? This cannot be undone.',
            )
        )
            return;
        setBusy(true);
        setError(null);
        try {
            const { data } = await axios.post<{ message: string }>(
                '/import/graduates/clear',
            );
            toast.success(data.message);
        } catch (err) {
            setError(message(err));
        } finally {
            setBusy(false);
        }
    };

    if (!canImport)
        return (
            <Alert>
                <AlertDescription>
                    You do not have permission to upload or view graduate
                    imports.
                </AlertDescription>
            </Alert>
        );

    return (
        <div className="space-y-5">
            <Card>
                <CardHeader>
                    <CardTitle>Import graduates</CardTitle>
                    <CardDescription>
                        Upload the SOAIS masterlist. Existing HEI + SO records
                        are updated; students absent from the file are retained.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="min-w-0 flex-1 space-y-2">
                            <label
                                htmlFor="graduates-file"
                                className="text-sm font-medium"
                            >
                                SOAIS workbook (.xlsx or .xls, up to 32 MB)
                            </label>
                            <input
                                ref={input}
                                id="graduates-file"
                                type="file"
                                accept=".xlsx,.xls"
                                disabled={uploading || active}
                                onChange={(event) => {
                                    setFile(event.target.files?.[0] ?? null);
                                    setError(null);
                                }}
                                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground"
                            />
                        </div>
                        <Button
                            onClick={() => void upload()}
                            disabled={!file || uploading || active}
                        >
                            {uploading && online ? (
                                <Loader2
                                    aria-hidden="true"
                                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                                />
                            ) : (
                                <Upload
                                    aria-hidden="true"
                                    className="h-4 w-4"
                                />
                            )}
                            {uploading ? 'Uploading…' : 'Upload Excel'}
                        </Button>
                    </div>
                    {uploading && (
                        <div aria-live="polite">
                            <p className="text-sm">
                                Uploading file: {uploadPercent}%
                            </p>
                            <progress
                                aria-label="File upload progress"
                                value={uploadPercent}
                                max={100}
                                className="w-full accent-blue-600"
                            />
                        </div>
                    )}
                    {(error || historyError || runProcessingError) && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                                {error || historyError || runProcessingError}
                            </AlertDescription>
                        </Alert>
                    )}
                    {active && (
                        <p
                            role="status"
                            className="text-sm text-muted-foreground"
                        >
                            Importing your file. Keep this page open for
                            automatic processing. If you leave, reopen it to
                            resume, or let the scheduled worker continue.
                        </p>
                    )}
                    {!file && !active && (
                        <p className="text-sm text-muted-foreground">
                            Choose an Excel file, then click Upload Excel.
                        </p>
                    )}
                    {!history && (
                        <p className="text-sm text-muted-foreground">
                            Import history is loading. You can still select and
                            upload a file; the server checks for active imports.
                        </p>
                    )}
                    {run && (
                        <section
                            aria-label="Import progress"
                            className="space-y-3 rounded-lg border bg-muted/20 p-4"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="min-w-0 font-medium break-all">
                                    #{run.id} · {run.filename}
                                </p>
                                <Badge
                                    variant="secondary"
                                    className="capitalize"
                                >
                                    {statusLabel(run)}
                                </Badge>
                            </div>
                            <GraduateImportProgress
                                run={run}
                                interrupted={
                                    !online ||
                                    Boolean(runProcessingError) ||
                                    Boolean(historyError)
                                }
                            />
                            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                                {Object.entries(run.counts).map(
                                    ([key, value]) => (
                                        <div key={key}>
                                            <dt className="text-xs text-muted-foreground capitalize">
                                                {key === 'invalid'
                                                    ? 'Row errors'
                                                    : key}
                                            </dt>
                                            <dd className="text-lg font-semibold">
                                                {value.toLocaleString()}
                                            </dd>
                                        </div>
                                    ),
                                )}
                            </dl>
                            {run.finished_at &&
                                run.issues > 0 &&
                                run.counts.invalid === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        Your student records were imported. The
                                        review notes below do not mean the
                                        upload failed.
                                    </p>
                                )}
                            {run.error && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    {run.error}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {run.status === 'failed' && (
                                    <Button
                                        variant="outline"
                                        onClick={() => void retry()}
                                        disabled={busy || active}
                                    >
                                        {busy && (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        )}
                                        Retry failed work
                                    </Button>
                                )}
                                {run.issues > 0 && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setReviewOpen(true)}
                                    >
                                        View review notes (
                                        {run.issues.toLocaleString()})
                                    </Button>
                                )}
                            </div>
                            {run.failed_chunks.length > 0 && (
                                <details>
                                    <summary className="cursor-pointer text-sm">
                                        Failed chunks
                                    </summary>
                                    {run.failed_chunks.map((chunk) => (
                                        <p
                                            className="mt-2 text-sm"
                                            key={chunk.start_row}
                                        >
                                            Rows {chunk.start_row}–
                                            {chunk.end_row}: {chunk.error}
                                        </p>
                                    ))}
                                </details>
                            )}
                        </section>
                    )}
                    <details className="text-sm">
                        <summary className="cursor-pointer font-medium">
                            SOAIS template and import rules
                        </summary>
                        <p className="mt-3 text-muted-foreground">
                            Headers occupy rows 1–3. Required: D HEI UII, E SO
                            number, F/G names, K program, P graduation date.
                            Optional: H middle name, I extension, J sex, L
                            PSCED, M major, R ending academic year. Dates may be
                            Excel dates or YYYY/MM/DD. Other columns are not
                            imported.
                        </p>
                        <p className="mt-2 text-muted-foreground">
                            Conflicting duplicate SO records are reported for
                            review. Missing local program matches retain the
                            Excel program information. Official workbooks may
                            include reference tabs; the importer selects the tab
                            named SO Masterlist. Files are stored privately and
                            removed 30 days after completed processing.
                        </p>
                    </details>
                    <p className="text-xs text-muted-foreground">
                        Worker last seen:{' '}
                        {history?.worker_last_seen
                            ? new Date(
                                  history.worker_last_seen,
                              ).toLocaleString()
                            : 'Not observed yet. Check the scheduled worker if processing does not begin.'}
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex-row items-center justify-between gap-3">
                    <CardTitle>Import history</CardTitle>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={historyLoading || !online}
                        onClick={() => setRevision((value) => value + 1)}
                    >
                        <RefreshCw
                            aria-hidden="true"
                            className={`h-4 w-4 ${historyLoading ? 'animate-spin motion-reduce:animate-none' : ''}`}
                        />
                        {historyLoading ? 'Refreshing' : 'Refresh history'}
                    </Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {!history ? (
                        <p role="status">Loading imports…</p>
                    ) : history.runs.data.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No imports yet.
                        </p>
                    ) : (
                        history.runs.data.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setSelected(item.id)}
                                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-left hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                                aria-pressed={run?.id === item.id}
                            >
                                <span className="min-w-0 text-sm break-all">
                                    #{item.id} · {item.filename}
                                    <span className="mt-1 block text-xs text-muted-foreground">
                                        {new Date(
                                            item.created_at,
                                        ).toLocaleString()}
                                    </span>
                                </span>
                                <Badge variant="outline" className="capitalize">
                                    {statusLabel(item)}
                                </Badge>
                            </button>
                        ))
                    )}
                    <nav
                        aria-label="Import history pages"
                        className="flex items-center justify-between"
                    >
                        <Button
                            variant="outline"
                            disabled={page <= 1}
                            onClick={() => {
                                setPage((v) => v - 1);
                                setSelected(null);
                            }}
                        >
                            Previous
                        </Button>
                        <span className="text-sm">
                            Page {page} of {history?.runs.last_page ?? 1}
                        </span>
                        <Button
                            variant="outline"
                            disabled={
                                !history || page >= history.runs.last_page
                            }
                            onClick={() => {
                                setPage((v) => v + 1);
                                setSelected(null);
                            }}
                        >
                            Next
                        </Button>
                    </nav>
                    {can('clear_data') && (
                        <div className="border-t pt-4">
                            <Button
                                variant="destructive"
                                disabled={
                                    busy || active || uploading || !history
                                }
                                onClick={() => void clear()}
                            >
                                Clear all graduates
                            </Button>
                            <p className="mt-2 text-xs text-muted-foreground">
                                Permanently deletes graduate records.
                                Unavailable during an import.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
            {run && (
                <GraduateImportReview
                    key={run.id}
                    runId={run.id}
                    open={reviewOpen}
                    onOpenChange={setReviewOpen}
                />
            )}
        </div>
    );
}
