import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import ChartDataTable from '@/components/dashboard/chart-data-table';
import { formatNumber, type SexPoint } from '@/components/dashboard/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';

// Fixed slots: a series keeps its colour whichever filter is applied.
const config = {
    female: { label: 'Female', color: 'var(--chart-1)' },
    male: { label: 'Male', color: 'var(--chart-2)' },
    notRecorded: { label: 'Not recorded', color: 'var(--chart-4)' },
} satisfies ChartConfig;

/** Part-to-whole per period: female / male / not recorded, stacked. */
export default function SexTrendChart({
    data,
    year,
    animated,
    className,
}: {
    data: SexPoint[];
    year: number | null;
    animated: boolean;
    className?: string;
}) {
    const hasNotRecorded = data.some((row) => row.notRecorded > 0);
    const series = (
        hasNotRecorded
            ? (['female', 'male', 'notRecorded'] as const)
            : (['female', 'male'] as const)
    ) satisfies ReadonlyArray<keyof typeof config>;

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Sex breakdown</CardTitle>
                <CardDescription>
                    {year
                        ? `Female and male graduates per month - ${year}`
                        : 'Female and male graduates per graduation year'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer
                    config={config}
                    className="aspect-auto h-72 w-full"
                    role="img"
                    aria-label="Sex breakdown per period. Exact values are in the chart data table."
                >
                    <BarChart
                        data={data}
                        margin={{ left: 0, right: 12, top: 12 }}
                        accessibilityLayer
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                        />
                        <YAxis
                            allowDecimals={false}
                            width={48}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value: number) =>
                                formatNumber(value)
                            }
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent />}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        {series.map((key, index) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId="sex"
                                fill={`var(--color-${key})`}
                                // 2px surface gap between stacked segments.
                                stroke="var(--card)"
                                strokeWidth={2}
                                radius={
                                    index === series.length - 1
                                        ? [4, 4, 0, 0]
                                        : 0
                                }
                                maxBarSize={48}
                                isAnimationActive={animated}
                            />
                        ))}
                    </BarChart>
                </ChartContainer>
                <ChartDataTable
                    caption="Sex breakdown per period"
                    rows={data}
                    columns={[
                        { key: 'label', label: year ? 'Month' : 'Year' },
                        { key: 'female', label: 'Female' },
                        { key: 'male', label: 'Male' },
                        { key: 'notRecorded', label: 'Not recorded' },
                    ]}
                />
            </CardContent>
        </Card>
    );
}
