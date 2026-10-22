import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';
import { Info, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner'; // Import toast from sonner

interface SchoolOption {
    code: string;
    name: string;
}

export default function Concerns() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [schools, setSchools] = useState<SchoolOption[]>([]);
    const [isSchoolsLoading, setIsSchoolsLoading] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        school: '',
        program: '',
        concern: '',
    });

    useEffect(() => {
        if (isOpen && schools.length === 0) {
            setIsSchoolsLoading(true);
            axios
                .get('/api/institutions-list')
                .then((response) => {
                    setSchools(response.data || []);
                })
                .catch((error) => {
                    console.error('Failed to load schools', error);
                })
                .finally(() => {
                    setIsSchoolsLoading(false);
                });
        }
    }, [isOpen]);

    const handleOpen = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsOpen(true);
    };

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSchoolChange = (value: string) => {
        setFormData({ ...formData, school: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await axios.post('/api/concerns', formData);

            // ✅ Success Toast
            toast.success('Concern Submitted', {
                description:
                    'Thank you. Your concern has been logged successfully.',
            });

            setFormData({ school: '', program: '', concern: '' });
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            // Error Toast
            toast.error('Submission Failed', {
                description: 'Something went wrong. Please try again.',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/30 dark:bg-amber-900/10">
                <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
                    <div className="text-sm">
                        <h4 className="font-semibold text-amber-900 dark:text-amber-400">
                            Important Notice
                        </h4>
                        <div className="mt-1 flex flex-col gap-1 leading-6 text-amber-800 dark:text-amber-500">
                            <p>
                                For permit corrections, discrepancies, and/or
                                other concerns, please notify us here:{' '}
                                <span className="font-semibold">
                                    <a
                                        href="#"
                                        onClick={handleOpen}
                                        className="text-blue-600 underline transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                    >
                                        Programs and Permits Concerns
                                    </a>
                                </span>
                                .
                            </p>

                            <p className="text-red-600">
                                Only programs with Government Recognition (GR)
                                or a Certificate of Program Compliance (COPC)
                                are displayed.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Submit a Concern</DialogTitle>
                        <DialogDescription>
                            Please provide details about the school program or
                            permit issue.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="school">School / HEI Name</Label>
                            <Select
                                onValueChange={handleSchoolChange}
                                value={formData.school}
                                required
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue
                                        placeholder={
                                            isSchoolsLoading
                                                ? 'Loading schools...'
                                                : 'Select a school'
                                        }
                                    />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {schools.length > 0 ? (
                                        schools.map((school, keyIndex) => (
                                            <SelectItem
                                                key={`${school.code}-${keyIndex}`}
                                                value={school.name}
                                            >
                                                {school.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-center text-sm text-muted-foreground">
                                            {isSchoolsLoading
                                                ? 'Loading...'
                                                : 'No schools found'}
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="program">Program Name</Label>
                            <Input
                                id="program"
                                name="program"
                                placeholder="e.g. BS Civil Engineering"
                                value={formData.program}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="concern">Concern Details</Label>
                            <Textarea
                                id="concern"
                                name="concern"
                                placeholder="Describe the discrepancy or issue..."
                                value={formData.concern}
                                onChange={handleChange}
                                required
                                className="min-h-[100px]"
                            />
                        </div>

                        <DialogFooter className="mt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsOpen(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Submit Concern
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
