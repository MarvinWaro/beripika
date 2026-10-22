// resources/js/components/graduates/edit-dialog.tsx
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

interface Institution {
    institution_code: string;
    name: string;
    type: string;
}

interface Program {
    program_name: string;
    major: string | null;
    program_type: string;
    permit_number: string;
    institution: Institution;
}

export interface GraduateForEdit {
    id: number;
    student_id_number: string | null;
    date_of_birth: string | null;
    last_name: string;
    first_name: string;
    middle_name: string | null;
    extension_name: string | null;
    sex: string | null;
    year_graduated: string;
    academic_year: string | null;
    hei_uii: string | null;
    program: Program;
    so_number: string | null;
}

interface EditGraduateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    graduate: GraduateForEdit | null;
    onUpdated: (
        id: number,
        updated: {
            last_name: string;
            first_name: string;
            middle_name: string | null;
            extension_name: string | null;
            sex: string | null;
            year_graduated: string;
            academic_year: string | null;
            so_number: string | null;
            program_name: string;
            major: string | null;
        },
    ) => void;
}

interface EditFormState {
    last_name: string;
    first_name: string;
    middle_name: string;
    extension_name: string;
    sex: string;
    date_graduated: string;
    academic_year: string;
    so_number: string;
    program_name: string;
    major: string;
}

export default function EditGraduateDialog({
    open,
    onOpenChange,
    graduate,
    onUpdated,
}: EditGraduateDialogProps) {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState<EditFormState>({
        last_name: '',
        first_name: '',
        middle_name: '',
        extension_name: '',
        sex: '',
        date_graduated: '',
        academic_year: '',
        so_number: '',
        program_name: '',
        major: '',
    });

    // Sync form when dialog opens or graduate changes
    useEffect(() => {
        if (graduate && open) {
            setForm({
                last_name: graduate.last_name,
                first_name: graduate.first_name,
                middle_name: graduate.middle_name ?? '',
                extension_name: graduate.extension_name ?? '',
                sex: graduate.sex ?? '',
                date_graduated: graduate.year_graduated ?? '',
                academic_year: graduate.academic_year ?? '',
                so_number: graduate.so_number ?? '',
                program_name: graduate.program.program_name,
                major: graduate.program.major ?? '',
            });
        }
    }, [graduate, open]);

    const handleChange = (field: keyof EditFormState, value: string) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSave = async () => {
        if (!graduate) return;

        setLoading(true);
        try {
            const payload = {
                ...form,
                sex: form.sex || null,
            };

            await axios.put(`/graduates/${graduate.id}`, payload);

            onUpdated(graduate.id, {
                last_name: form.last_name,
                first_name: form.first_name,
                middle_name: form.middle_name || null,
                extension_name: form.extension_name || null,
                sex: form.sex || null,
                year_graduated: form.date_graduated || graduate.year_graduated,
                academic_year: form.academic_year || null,
                so_number: form.so_number || null,
                program_name: form.program_name,
                major: form.major || null,
            });

            toast.success('Graduate updated successfully.');
            onOpenChange(false);
        } catch (error: unknown) {
            console.error(error);
            const msg =
                (axios.isAxiosError<{ message?: string }>(error)
                    ? error.response?.data.message
                    : null) ?? 'Failed to update graduate.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // If no graduate is selected, don't render the dialog content
    if (!graduate) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit Graduate</DialogTitle>
                    <DialogDescription>
                        Update basic information for this graduate. Changes are saved immediately to
                        the database.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 mt-2">
                    {/* Names */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-foreground">Last Name</label>
                            <Input
                                value={form.last_name}
                                onChange={(e) => handleChange('last_name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-foreground">First Name</label>
                            <Input
                                value={form.first_name}
                                onChange={(e) => handleChange('first_name', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Middle / Ext / Sex */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-foreground">Middle Name</label>
                            <Input
                                value={form.middle_name}
                                onChange={(e) => handleChange('middle_name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-foreground">Extension</label>
                            <Input
                                value={form.extension_name}
                                onChange={(e) => handleChange('extension_name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-foreground">Sex</label>
                            <Select
                                value={form.sex || ''}
                                onValueChange={(value) => handleChange('sex', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select sex" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MALE">MALE</SelectItem>
                                    <SelectItem value="FEMALE">FEMALE</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-foreground">Date Graduated</label>
                            <Input
                                type="date"
                                value={form.date_graduated}
                                onChange={(e) => handleChange('date_graduated', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-foreground">Academic Year</label>
                            <Input
                                placeholder="e.g. 2023-2024"
                                value={form.academic_year}
                                onChange={(e) => handleChange('academic_year', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* SO number – full width */}
                    <div>
                        <label className="text-xs font-medium text-foreground">SO Number</label>
                        <Input
                            value={form.so_number}
                            onChange={(e) => handleChange('so_number', e.target.value)}
                        />
                    </div>

                    {/* Program – full width */}
                    <div>
                        <label className="text-xs font-medium text-foreground">Program</label>
                        <Input
                            value={form.program_name}
                            onChange={(e) => handleChange('program_name', e.target.value)}
                        />
                    </div>

                    {/* Major – full width */}
                    <div>
                        <label className="text-xs font-medium text-foreground">Major</label>
                        <Input
                            value={form.major}
                            onChange={(e) => handleChange('major', e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
