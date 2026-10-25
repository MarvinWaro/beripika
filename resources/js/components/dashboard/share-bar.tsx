import type { ReactNode } from 'react';
import {
    formatNumber,
    percent,
    type Point,
} from '@/components/dashboard/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

/**
 * Part-to-whole as one 100% stacked bar plus a labelled legend (label, count, share),
 * so identity never depends on colour alone. Colours are fixed per category.
 */
export default function ShareBar({
    title,
    description,
    data,
    colors,
    footer,
    className,
}: {
    title: string;
    description: string;
    data: Point[];
    colors: Record<string, string>;
    footer?: ReactNode;
    className?: string;
}) {
    const total = data.reduce((sum, row) => sum + row.count, 0);

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {total > 0 ? (
                    <>
                        <div
                            role="img"
                            aria-label={`${title}: ${data
                                .map(
                                    (row) =>
                                        `${row.label} ${percent(row.count, total)}`,
                                )
                                .join(', ')}`}
                            className="flex h-4 w-full gap-0.5 overflow-hidden rounded"
                        >
                            {data.map((row) => (
                                <div
                                    key={row.label}
                                    title={`${row.label}: ${formatNumber(row.count)} (${percent(row.count, total)})`}
                                    className="h-full first:rounded-l last:rounded-r"
                                    style={{
                                        width: `${(row.count / total) * 100}%`,
                                        minWidth: 4,
                                        background: colors[row.label],
                                    }}
                                />
                            ))}
                        </div>
                        <ul className="space-y-2 text-sm">
                            {data.map((row) => (
                                <li
                                    key={row.label}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="size-2.5 shrink-0 rounded-[2px]"
                                        style={{
                                            background: colors[row.label],
                                        }}
                                    />
                                    <span className="min-w-0 break-words">
                                        {row.label}
                                    </span>
                                    <span className="ml-auto font-medium tabular-nums">
                                        {formatNumber(row.count)}{' '}
                                        <span className="font-normal text-muted-foreground">
                                            ({percent(row.count, total)})
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        No records in this selection.
                    </p>
                )}
                {footer}
            </CardContent>
        </Card>
    );
}
