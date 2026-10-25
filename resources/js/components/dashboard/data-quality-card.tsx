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
                        : `${issues} ${issues === 1 ? 'check needs' : 'checks need'} attention in the selected scope.`}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="divide-y">
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
                                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                            >
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
                            </li>
                        );
                    })}
                </ul>
            </CardContent>
        </Card>
    );
}
