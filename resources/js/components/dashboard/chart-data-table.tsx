import { formatNumber } from '@/components/dashboard/types';

interface Column {
    key: string;
    label: string;
}

/**
 * "View chart data" disclosure: the exact values behind a chart, for screen readers,
 * low-contrast series and anyone who prefers numbers.
 */
export default function ChartDataTable({
    rows,
    columns,
    caption,
}: {
    rows: Record<string, string | number>[];
    /** First column is the category; the rest are numeric series. */
    columns: Column[];
    caption: string;
}) {
    const [category, ...series] = columns;

    return (
        <details className="mt-4 text-sm">
            <summary className="w-fit cursor-pointer rounded text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
                View chart data
            </summary>
            <div className="mt-3 max-h-72 overflow-auto">
                <table className="w-full text-left">
                    <caption className="sr-only">{caption}</caption>
                    <thead>
                        <tr className="border-b">
                            <th className="py-2 pr-4">{category.label}</th>
                            {series.map((column) => (
                                <th key={column.key} className="text-right">
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr
                                key={String(row[category.key])}
                                className="border-b"
                            >
                                <th
                                    scope="row"
                                    className="py-2 pr-4 font-normal break-words"
                                >
                                    {row[category.key]}
                                </th>
                                {series.map((column) => (
                                    <td
                                        key={column.key}
                                        className="text-right tabular-nums"
                                    >
                                        {formatNumber(Number(row[column.key]))}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}
