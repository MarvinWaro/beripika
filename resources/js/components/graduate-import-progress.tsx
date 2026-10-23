import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ProgressRun {
    status: string;
    phase: 'reading' | 'writing';
    total_rows: number;
    total_chunks: number;
    completed_chunks: number;
}

export default function GraduateImportProgress({
    run,
    interrupted = false,
}: {
    run: ProgressRun;
    interrupted?: boolean;
}) {
    const complete = ['completed', 'completed_with_issues'].includes(
        run.status,
    );
    const failed = run.status === 'failed';
    const paused = !complete && !failed && interrupted;
    const preparing = run.total_chunks === 0;
    const running = !complete && !failed && !paused;
    const progress = complete
        ? 100
        : Math.min(
              99,
              Math.max(
                  0,
                  Math.floor(
                      (run.phase === 'writing' ? 50 : 0) +
                          (50 * run.completed_chunks) /
                              Math.max(1, run.total_chunks),
                  ),
              ),
          );
    const label = complete
        ? 'Import finished'
        : failed
          ? 'Processing stopped. Review the error and retry.'
          : paused
            ? 'Connection interrupted. Reconnect to resume progress updates.'
            : preparing
              ? 'Preparing your spreadsheet…'
              : run.phase === 'reading'
                ? 'Validating rows'
                : 'Saving student records';

    return (
        <div className="space-y-2">
            <p
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-sm"
            >
                {complete ? (
                    <CheckCircle2
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-green-700 dark:text-green-400"
                    />
                ) : running ? (
                    <Loader2
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 animate-spin text-blue-700 motion-reduce:animate-none dark:text-blue-400"
                    />
                ) : (
                    <AlertCircle
                        aria-hidden="true"
                        className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400"
                    />
                )}
                {label}
            </p>
            {preparing && !complete ? (
                <div
                    role="progressbar"
                    aria-label="Spreadsheet preparation"
                    aria-valuetext={label}
                    className="h-2 overflow-hidden rounded-full bg-muted"
                >
                    <div
                        className={`h-full w-1/3 rounded-full bg-blue-600 dark:bg-blue-400 ${running ? 'animate-pulse motion-reduce:animate-none' : ''}`}
                    />
                </div>
            ) : (
                <>
                    <div
                        role="progressbar"
                        aria-label="Import processing progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress}
                        className="h-2 overflow-hidden rounded-full bg-muted"
                    >
                        <div
                            style={{ width: `${progress}%` }}
                            className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${complete ? 'bg-green-600 dark:bg-green-400' : 'bg-blue-600 dark:bg-blue-400'}`}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {progress}% processed
                        {!complete &&
                            ' · Based on validation and saving work, not remaining time.'}
                    </p>
                </>
            )}
            {run.total_rows > 0 && (
                <p className="text-xs text-muted-foreground">
                    {run.total_rows.toLocaleString()} worksheet rows
                </p>
            )}
        </div>
    );
}
