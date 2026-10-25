import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import ChartDataTable from '@/components/dashboard/chart-data-table';
import { formatNumber, type Point } from '@/components/dashboard/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';

const config = {
    count: { label: 'Graduates', color: 'var(--chart-1)' },
} satisfies ChartConfig;

/** Graduates over time: years, or months when a year is selected. */
export default function TrendChart({
    data,
    undated,
    year,
    animated,
    className,
}: {
    data: Point[];
    undated: number;
    year: number | null;
    animated: boolean;
    className?: string;
}) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>Graduates over time</CardTitle>
                <CardDescription>
                    {year
                        ? `Monthly graduate records - ${year}`
                        : 'Graduate records by graduation year'}{' '}
                    - not upload date
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer
                    config={config}
                    className="aspect-auto h-72 w-full"
                    role="img"
                    aria-label="Graduates over time. Exact values are in the chart data table."
                >
                    <AreaChart
                        data={data}
                        margin={{ left: 0, right: 12, top: 12 }}
                        accessibilityLayer
                    >
                        <defs>
                            <linearGradient
                                id="trend-fill"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="var(--color-count)"
                                    stopOpacity={0.3}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="var(--color-count)"
                                    stopOpacity={0.02}
                                />
                            </linearGradient>
                        </defs>
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
                            cursor={{ strokeWidth: 1 }}
                            content={<ChartTooltipContent indicator="line" />}
                        />
                        <Area
                            dataKey="count"
                            type="monotone"
                            stroke="var(--color-count)"
                            strokeWidth={2}
                            fill="url(#trend-fill)"
                            activeDot={{ r: 5 }}
                            isAnimationActive={animated}
                        />
                    </AreaChart>
                </ChartContainer>
                {undated > 0 && (
                    <p className="mt-3 text-sm text-muted-foreground">
                        {formatNumber(undated)} records without a usable{' '}
                        {year ? 'graduation date' : 'graduation year'} are
                        included in totals but excluded from this chart.
                    </p>
                )}
                <ChartDataTable
                    caption="Graduates over time"
                    rows={data}
                    columns={[
                        { key: 'label', label: year ? 'Month' : 'Year' },
                        { key: 'count', label: 'Graduates' },
                    ]}
                />
            </CardContent>
        </Card>
    );
}
