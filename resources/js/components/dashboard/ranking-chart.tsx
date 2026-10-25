import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
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

const ROW_HEIGHT = 36;
const LABEL_LENGTH = 26;

/** Magnitude ranking in one hue (horizontal bars, long names on the axis). */
export default function RankingChart({
    title,
    description,
    data,
    animated,
    className,
}: {
    title: string;
    description: string;
    data: Point[];
    animated: boolean;
    className?: string;
}) {
    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {data.length ? (
                    <ChartContainer
                        config={config}
                        className="aspect-auto w-full"
                        style={{
                            height: Math.max(180, data.length * ROW_HEIGHT),
                        }}
                        role="img"
                        aria-label={`${title}. Exact values are in the chart data table.`}
                    >
                        <BarChart
                            data={data}
                            layout="vertical"
                            margin={{ left: 0, right: 16 }}
                            accessibilityLayer
                        >
                            <CartesianGrid
                                horizontal={false}
                                strokeDasharray="3 3"
                            />
                            <XAxis
                                type="number"
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value: number) =>
                                    formatNumber(value)
                                }
                            />
                            <YAxis
                                type="category"
                                dataKey="label"
                                width={170}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value: string) =>
                                    value.length > LABEL_LENGTH
                                        ? value.slice(0, LABEL_LENGTH - 1) + '…'
                                        : value
                                }
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent indicator="line" />
                                }
                            />
                            <Bar
                                dataKey="count"
                                fill="var(--color-count)"
                                radius={[0, 4, 4, 0]}
                                maxBarSize={22}
                                isAnimationActive={animated}
                            />
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <p className="py-16 text-center text-muted-foreground">
                        No recorded categories in this selection.
                    </p>
                )}
                <ChartDataTable
                    caption={title}
                    rows={data}
                    columns={[
                        { key: 'label', label: 'Category' },
                        { key: 'count', label: 'Graduates' },
                    ]}
                />
            </CardContent>
        </Card>
    );
}
