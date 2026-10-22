import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

interface ChartDataPoint {
    year: string;
    count: number;
}

interface GraduatesChartProps {
    data: ChartDataPoint[];
}

export default function GraduatesChart({ data }: GraduatesChartProps) {
    const chartData = useMemo(() => {
        return data.map(item => ({
            year: item.year,
            graduates: item.count,
        }));
    }, [data]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Graduates Over Time</CardTitle>
                <CardDescription>
                    Total graduates per year
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="colorGraduates" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                            dataKey="year"
                            className="text-xs"
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            className="text-xs"
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="graduates"
                            stroke="#3b82f6"
                            fill="url(#colorGraduates)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
