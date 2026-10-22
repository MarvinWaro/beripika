import { Head, router } from '@inertiajs/react';
import { dashboard } from '@/routes';
import { type BreadcrumbItem } from '@/types';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ActivityLogItem {
    id: number;
    user_name: string | null;
    user_email: string | null;
    action: string;
    summary: string;
    created_at: string;
    properties: Record<string, unknown> | null;
}

interface Pagination<T> {
    data: T[];
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
}

interface Props {
    logs: Pagination<ActivityLogItem>;
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Dashboard', href: dashboard().url },
    { title: 'Logs', href: '/logs' },
];

export default function LogsIndex({ logs }: Props) {
    const formatAction = (action: string) => {
        switch (action) {
            case 'graduates_import':
                return 'Imported graduates';
            case 'graduate_update':
                return 'Updated graduate';
            case 'graduate_delete':
                return 'Deleted graduate';
            default:
                return action;
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'graduates_import':
                return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
            case 'graduate_update':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
            case 'graduate_delete':
                return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
            default:
                return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
        }
    };

    return (
        <>
            <Head title="Activity Logs" />

            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-xl p-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Activity Logs</CardTitle>
                        <CardDescription>
                            See who imported, edited, or deleted graduates and when the changes were made.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-48">Date &amp; Time</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead className="w-40">Action</TableHead>
                                        <TableHead>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.data.length === 0 ? (
                                        <TableRow>
                                            <TableCell
                                                colSpan={4}
                                                className="py-8 text-center text-muted-foreground"
                                            >
                                                No activity yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        logs.data.map((log) => (
                                            <TableRow key={log.id} className="hover:bg-muted/50">
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {log.created_at}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">
                                                            {log.user_name ?? 'System'}
                                                        </span>
                                                        {log.user_email && (
                                                            <span className="text-xs text-muted-foreground">
                                                                {log.user_email}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        className={getActionColor(log.action)}
                                                    >
                                                        {formatAction(log.action)}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {log.summary}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {logs.links && logs.links.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {logs.links.map((link, idx) => {
                                    const label = link.label
                                        .replace('&laquo;', '«')
                                        .replace('&raquo;', '»');

                                    return (
                                        <Button
                                            key={idx}
                                            variant={link.active ? 'default' : 'outline'}
                                            size="sm"
                                            disabled={!link.url}
                                            onClick={() => {
                                                if (!link.url) return;
                                                router.get(link.url, {}, {
                                                    preserveScroll: true,
                                                    preserveState: true,
                                                });
                                            }}
                                        >
                                            {label}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

LogsIndex.layout = {
    breadcrumbs: breadcrumbs,
};
