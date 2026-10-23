import GraduatesImport from '@/components/graduate-import';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle,
    FileSpreadsheet,
    Trash2,
    Upload,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';

export default function ImportPage() {
    const { can } = usePermissions();

    return (
        <>
                <Head title="Import" />

                <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Import Data</h1>
                        <p className="text-sm text-muted-foreground">
                            Import institutions, programs, and graduates data
                            from Excel files
                        </p>
                    </div>

                    <Tabs defaultValue={can('import_institutions') ? 'institutions' : 'graduates'} className="w-full">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger
                                value="institutions"
                                className="flex items-center gap-2"
                                disabled={!can('import_institutions')}
                            >
                                <FileSpreadsheet className="h-4 w-4" />
                                Institutions &amp; Programs
                            </TabsTrigger>
                            <TabsTrigger
                                value="graduates"
                                className="flex items-center gap-2"
                                disabled={!can('import_graduates')}
                            >
                                <Users className="h-4 w-4" />
                                Graduates
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="institutions" className="mt-4">
                            <InstitutionsImport />
                        </TabsContent>

                        <TabsContent value="graduates" className="mt-4">
                            <GraduatesImport />
                        </TabsContent>
                    </Tabs>
                </div>
        </>
    );
}

function InstitutionsImport() {
    const { can } = usePermissions();
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        success: boolean;
        message: string;
        data?: { institutions?: number; programs?: number };
    } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showClearPopover, setShowClearPopover] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setResult(null);
            setError(null);
        }
    };

    const handleImport = async () => {
        if (!file) {
            setError('Please select a file first');
            return;
        }

        setLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(
                '/import/institutions',
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                },
            );

            if (response.data.success) {
                setResult(response.data);
                setFile(null);
                const input = document.getElementById(
                    'institutions-file-input',
                ) as HTMLInputElement;
                if (input) input.value = '';
                toast.success('Import successful!', {
                    description: response.data.message,
                });
            } else {
                setError(response.data.message);
                toast.error('Import failed', {
                    description: response.data.message,
                });
            }
        } catch (err: unknown) {
            console.error('Import error:', err);
            const errorMsg = axios.isAxiosError<{ message?: string }>(err)
                ? (err.response?.data.message ?? err.message)
                : 'Please try again.';
            setError('An error occurred during import: ' + errorMsg);
            toast.error('Import failed', {
                description: errorMsg,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleClearData = async () => {
        setShowClearPopover(false);
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const response = await axios.post('/import/institutions/clear');

            if (response.data.success) {
                setResult({ message: response.data.message, success: true });
                toast.success('Data cleared successfully!', {
                    description: response.data.message,
                });
            } else if (response.data.isEmpty) {
                toast.info('No data to clear', {
                    description:
                        'The database is already empty. No institutions or programs found.',
                });
            } else {
                setError(response.data.message);
                toast.error('Clear failed', {
                    description: response.data.message,
                });
            }
        } catch (err: unknown) {
            console.error('Clear error:', err);
            const errorMsg = axios.isAxiosError<{ message?: string }>(err)
                ? (err.response?.data.message ?? err.message)
                : 'Please try again.';

            if (
                axios.isAxiosError<{ isEmpty?: boolean }>(err) &&
                err.response?.data.isEmpty
            ) {
                toast.info('No data to clear', {
                    description:
                        'The database is already empty. No institutions or programs found.',
                });
            } else {
                setError('An error occurred: ' + errorMsg);
                toast.error('Clear failed', {
                    description: errorMsg,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Import Institutions &amp; Programs</CardTitle>
                <CardDescription>
                    Upload an Excel file containing institution codes, names,
                    and their programs
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <input
                            id="institutions-file-input"
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-950 dark:file:text-blue-300 dark:hover:file:bg-blue-900"
                        />
                    </div>
                    <Button
                        onClick={handleImport}
                        disabled={!file || loading}
                        className="flex items-center gap-2"
                    >
                        <Upload className="h-4 w-4" />
                        {loading ? 'Importing...' : 'Import'}
                    </Button>
                </div>

                {file && (
                    <div className="text-sm text-muted-foreground">
                        Selected:{' '}
                        <span className="font-medium">{file.name}</span>
                    </div>
                )}

                {result && result.success && (
                    <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800 dark:text-green-200">
                            {result.message}
                            {result.data && (
                                <div className="mt-2 font-medium">
                                    • Institutions: {result.data.institutions}
                                    <br />• Programs: {result.data.programs}
                                </div>
                            )}
                        </AlertDescription>
                    </Alert>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="border-t pt-4">
                    <h3 className="mb-3 text-sm font-medium">
                        Excel Format Requirements:
                    </h3>
                    <div className="rounded-lg bg-muted/50 p-4">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b">
                                    <th className="py-2 text-left">Column</th>
                                    <th className="py-2 text-left">Field</th>
                                    <th className="py-2 text-left">Required</th>
                                </tr>
                            </thead>
                            <tbody className="text-muted-foreground">
                                <tr>
                                    <td className="py-1">A</td>
                                    <td>Institution Code</td>
                                    <td>✓</td>
                                </tr>
                                <tr>
                                    <td className="py-1">B</td>
                                    <td>HEI (Institution Name)</td>
                                    <td>✓</td>
                                </tr>
                                <tr>
                                    <td className="py-1">C</td>
                                    <td>Programs</td>
                                    <td>✓</td>
                                </tr>
                                <tr>
                                    <td className="py-1">D</td>
                                    <td>Program Type (Board/Non-Board)</td>
                                    <td>-</td>
                                </tr>
                                <tr>
                                    <td className="py-1">E</td>
                                    <td>Major</td>
                                    <td>-</td>
                                </tr>
                                <tr>
                                    <td className="py-1">F</td>
                                    <td>Permit Number</td>
                                    <td>✓</td>
                                </tr>
                                <tr>
                                    <td className="py-1">G</td>
                                    <td>Type (Private/SUCs/LUCs)</td>
                                    <td>✓</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {can('clear_data') && (
                <div className="border-t pt-4">
                    <Popover
                        open={showClearPopover}
                        onOpenChange={setShowClearPopover}
                    >
                        <PopoverTrigger asChild>
                            <Button
                                variant="destructive"
                                disabled={loading}
                                className="flex items-center gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Clear All Institutions &amp; Programs
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <h4 className="text-sm font-semibold">
                                            Clear all institutions
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            Delete all institutions and
                                            programs? This action cannot be
                                            undone.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setShowClearPopover(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleClearData}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <p className="mt-2 text-xs text-muted-foreground">
                        Warning: This will permanently delete all institutions
                        and their programs
                    </p>
                </div>
                )}
            </CardContent>
        </Card>
    );
}

ImportPage.layout = {
    breadcrumbs: [{ title: 'Import', href: '/import' }],
};
