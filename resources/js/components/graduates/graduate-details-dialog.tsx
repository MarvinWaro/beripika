import {
    Building2,
    Calendar,
    FileText,
    GraduationCap,
    Loader2,
    User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface GraduateDetails {
    id: number;
    full_name: string;
    sex: string | null;
    date_of_birth: string | null;
    so_number: string | null;
    student_id_number: string | null;
    institution_name: string;
    institution_code: string;
    institution_sector: string | null;
    institution_type: string | null;
    program_name: string;
    program_type: string | null;
    major: string | null;
    date_graduated: string | null;
    academic_year: string | null;
    created_at: string | null;
    updated_at: string | null;
}

function InstitutionTypeBadge({ type }: { type: string | null }) {
    if (!type) return null;
    const colors =
        type === 'SUC'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
            : type === 'LUC'
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    return (
        <Badge className={colors} variant="outline">
            {type}
        </Badge>
    );
}

function InstitutionSectorBadge({ sector }: { sector: string | null }) {
    if (!sector) return null;
    const colors =
        sector === 'PUBLIC'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    return (
        <Badge className={colors} variant="outline">
            {sector}
        </Badge>
    );
}

/**
 * Full record of one graduate, loaded on open. Opening is recorded by GraduateLookupLog
 * for read-only users (e.g. PRC).
 */
export default function GraduateDetailsDialog({
    graduateId,
    onClose,
}: {
    graduateId: number | null;
    onClose: () => void;
}) {
    const [graduate, setGraduate] = useState<GraduateDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (graduateId === null) return;
        const controller = new AbortController();
        setGraduate(null);
        setFailed(false);
        setLoading(true);
        fetch(`/dashboard/graduate/${graduateId}`, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((response) => {
                if (!response.ok) throw new Error(String(response.status));
                return response.json() as Promise<GraduateDetails>;
            })
            .then(setGraduate)
            .catch(() => {
                if (!controller.signal.aborted) setFailed(true);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [graduateId]);

    return (
        <Dialog
            open={graduateId !== null}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <GraduationCap className="h-5 w-5" />
                        Graduate Details
                    </DialogTitle>
                    <DialogDescription>
                        Complete information for the selected graduate
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400 motion-reduce:animate-none" />
                    </div>
                ) : graduate ? (
                    <div className="space-y-6">
                        <section className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <User className="h-4 w-4" />
                                Personal Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                                <div className="col-span-2">
                                    <p className="text-xs text-muted-foreground">
                                        Full Name
                                    </p>
                                    <p className="text-lg font-medium">
                                        {graduate.full_name}
                                    </p>
                                </div>
                                {graduate.sex && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Sex
                                        </p>
                                        <p className="font-medium">
                                            {graduate.sex}
                                        </p>
                                    </div>
                                )}
                                {graduate.date_of_birth && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Date of Birth
                                        </p>
                                        <p className="font-medium">
                                            {graduate.date_of_birth}
                                        </p>
                                    </div>
                                )}
                                {graduate.student_id_number && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground">
                                            Student ID
                                        </p>
                                        <p className="font-mono text-sm font-medium">
                                            {graduate.student_id_number}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <Building2 className="h-4 w-4" />
                                Institution Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                                <div className="col-span-2">
                                    <p className="text-xs text-muted-foreground">
                                        Institution Name
                                    </p>
                                    <p className="text-base font-medium">
                                        {graduate.institution_name}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Institution Code (HEI UII)
                                    </p>
                                    <p className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                                        {graduate.institution_code}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">
                                        Institution Type
                                    </p>
                                    <div className="mt-1 flex gap-2">
                                        <InstitutionSectorBadge
                                            sector={graduate.institution_sector}
                                        />
                                        <InstitutionTypeBadge
                                            type={graduate.institution_type}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <FileText className="h-4 w-4" />
                                Academic Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                                <div className="col-span-2">
                                    <p className="text-xs text-muted-foreground">
                                        Program
                                    </p>
                                    <p className="font-medium">
                                        {graduate.program_name}
                                    </p>
                                </div>
                                {graduate.major && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground">
                                            Major
                                        </p>
                                        <p className="font-medium">
                                            {graduate.major}
                                        </p>
                                    </div>
                                )}
                                {graduate.program_type && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Program Type
                                        </p>
                                        <Badge
                                            variant="outline"
                                            className={
                                                graduate.program_type ===
                                                'Board'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                                    : 'border-gray-200 bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                            }
                                        >
                                            {graduate.program_type}
                                        </Badge>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="space-y-3">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <Calendar className="h-4 w-4" />
                                Graduation Information
                            </h3>
                            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                                {graduate.so_number && (
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground">
                                            Special Order (SO) Number
                                        </p>
                                        <p className="font-mono text-base font-medium text-blue-600 dark:text-blue-400">
                                            {graduate.so_number}
                                        </p>
                                    </div>
                                )}
                                {graduate.date_graduated && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Date Graduated
                                        </p>
                                        <p className="font-medium">
                                            {graduate.date_graduated}
                                        </p>
                                    </div>
                                )}
                                {graduate.academic_year && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            Academic Year
                                        </p>
                                        <p className="font-medium">
                                            {graduate.academic_year}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </section>

                        {(graduate.created_at || graduate.updated_at) && (
                            <div className="border-t pt-4">
                                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                    {graduate.created_at && (
                                        <div>
                                            <p>Record Created</p>
                                            <p className="font-mono">
                                                {graduate.created_at}
                                            </p>
                                        </div>
                                    )}
                                    {graduate.updated_at && (
                                        <div>
                                            <p>Last Updated</p>
                                            <p className="font-mono">
                                                {graduate.updated_at}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end pt-4">
                            <Button onClick={onClose} variant="outline">
                                Close
                            </Button>
                        </div>
                    </div>
                ) : (
                    failed && (
                        <div className="py-12 text-center text-muted-foreground">
                            Failed to load graduate details
                        </div>
                    )
                )}
            </DialogContent>
        </Dialog>
    );
}
