import { AlertTriangle, CheckCircle2, CircleDashed } from 'lucide-react';
import {
    formatNumber,
    percent,
    type QualityCheck,
} from '@/components/dashboard/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

const UNMEASURED: Record<string, string> = {
    hei: 'The CHED portal directory is unavailable right now.',
    catalog: 'Run the Program Catalog sync first.',
};

const plural = (word: string, count: number) =>
    `${word.toLowerCase()}${count === 1 ? '' : 's'}`;

/** Where a gap comes from: largest groups first, bar length relative to the largest. */
function Breakdown({ check }: { check: QualityCheck }) {
    const largest = check.breakdown[0]?.count ?? 0;

    return (
        <details className="group mt-3 text-sm">
            <summary className="w-fit cursor-pointer rounded text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
                Breakdown by {check.dimension.toLowerCase()} (
                {check.breakdown.length + check.more})
            </summary>
            <ol className="mt-3 space-y-2.5">
                {check.breakdown.map((row) => (
                    <li key={row.label}>
                        <div className="flex items-baseline justify-between gap-3">
                            <span
                                className="min-w-0 break-words"
                                title={row.label}
                            >
                                {row.label}
                            </span>
                            <span className="shrink-0 font-medium tabular-nums">
                                {formatNumber(row.count)}
                            </span>
                        </div>
                        <div
                            aria-hidden="true"
                            className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                        >
                            <div
                                className="h-full rounded-full"
                                style={{
                                    width: `${largest ? (row.count / largest) * 100 : 0}%`,
                                    background: 'var(--chart-1)',
                                }}
                            />
                        </div>
                    </li>
                ))}
            </ol>
            {check.more > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                    and {formatNumber(check.more)} more{' '}
                    {plural(check.dimension, check.more)}
                </p>
            )}
        </details>
    );
}

/** Masterlist gaps Records can fix; status always pairs an icon with text. */
export default function DataQualityCard({
    checks,
    total,
    className,
}: {
    checks: QualityCheck[];
    total: number;
    className?: string;
}) {
    const issues = checks.filter((check) => (check.count ?? 0) > 0).length;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Data quality</CardTitle>
                <CardDescription>
                    {issues === 0
                        ? 'No gaps found in the selected scope.'
                        : `${issues} ${issues === 1 ? 'check needs' : 'checks need'} attention in the selected scope. Open a breakdown to see where the gaps come from.`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {checks.map((check) => {
                        const measured = check.count !== null;
                        const clean = check.count === 0;
                        const Icon = !measured
                            ? CircleDashed
                            : clean
                              ? CheckCircle2
                              : AlertTriangle;

                        return (
                            <li
                                key={check.key}
                                className="min-w-0 rounded-lg border p-4"
                            >
                                <div className="flex items-start gap-3">
                                    <Icon
                                        aria-hidden="true"
                                        className={
                                            !measured
                                                ? 'mt-0.5 size-4 shrink-0 text-muted-foreground'
                                                : clean
                                                  ? 'mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400'
                                                  : 'mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400'
                                        }
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium">
                                            {check.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {!measured
                                                ? (UNMEASURED[check.key] ??
                                                  'Not measured yet.')
                                                : clean
                                                  ? 'OK - none found'
                                                  : `${percent(check.count ?? 0, total)} of graduate records`}
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold tabular-nums">
                                        {measured
                                            ? formatNumber(check.count ?? 0)
                                            : '-'}
                                    </span>
                                </div>
                                {check.breakdown.length > 0 && (
                                    <Breakdown check={check} />
                                )}
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
}
