import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Loader2, GraduationCap, User, Building2, Calendar, FileText } from 'lucide-react';
import { debounce } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SearchResult {
    id: number;
    name: string;
    so_number: string | null;
    program: string;
    institution: string;
    year_graduated: string;
}

interface GraduateDetails {
    id: number;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    extension_name: string | null;
    full_name: string;
    sex: string | null;
    date_of_birth: string | null;
    so_number: string | null;
    student_id_number: string | null;
    hei_uii: string | null;
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

export default function GraduateSearch() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [selectedGraduate, setSelectedGraduate] = useState<GraduateDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Debounced search function
    const searchGraduates = useCallback(
        debounce(async (searchQuery: string) => {
            if (searchQuery.length < 2) {
                setResults([]);
                setShowResults(false);
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(
                    `/dashboard/search?q=${encodeURIComponent(searchQuery)}`,
                    {
                        headers: { Accept: 'application/json' },
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                    setShowResults(true);
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        }, 300),
        []
    );

    useEffect(() => {
        searchGraduates(query);
    }, [query, searchGraduates]);

    // Fetch full graduate details
    const handleViewDetails = async (graduateId: number) => {
        setShowResults(false);
        setLoadingDetails(true);
        setShowModal(true);
        setSelectedGraduate(null);

        try {
            const response = await fetch(`/dashboard/graduate/${graduateId}`, {
                headers: { Accept: 'application/json' },
            });

            if (response.ok) {
                const data = await response.json();
                setSelectedGraduate(data);
            }
        } catch (error) {
            console.error('Failed to fetch graduate details:', error);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setSelectedGraduate(null);
    };

    const getInstitutionTypeBadge = (type: string | null) => {
        if (!type) return null;
        const colors = type === 'SUC'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
            : type === 'LUC'
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
              : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        return <Badge className={colors} variant="outline">{type}</Badge>;
    };

    const getInstitutionSectorBadge = (sector: string | null) => {
        if (!sector) return null;
        const colors = sector === 'PUBLIC'
            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        return <Badge className={colors} variant="outline">{sector}</Badge>;
    };

    return (
        <>
            <div className="relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <Input
                        type="text"
                        placeholder="Search graduates by name, SO number, or program..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => query.length >= 2 && setShowResults(true)}
                        onBlur={() => setTimeout(() => setShowResults(false), 200)}
                        className="pl-10 h-11"
                    />
                    {loading && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" />
                    )}
                </div>

                {/* Search Results Dropdown */}
                {showResults && results.length > 0 && (
                    <Card className="absolute top-full mt-2 w-full z-50 shadow-lg">
                        <CardContent className="p-2">
                            <div className="max-h-[400px] overflow-y-auto space-y-1">
                                {results.map((result) => (
                                    <div
                                        key={result.id}
                                        onClick={() => handleViewDetails(result.id)}
                                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{result.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {result.program}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {result.institution}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {result.so_number && (
                                                    <Badge variant="outline" className="text-xs">
                                                        {result.so_number}
                                                    </Badge>
                                                )}
                                                {result.year_graduated && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {result.year_graduated}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {showResults && query.length >= 2 && results.length === 0 && !loading && (
                    <Card className="absolute top-full mt-2 w-full z-50 shadow-lg">
                        <CardContent className="p-4 text-center text-sm text-muted-foreground">
                            No graduates found matching "{query}"
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Graduate Details Modal */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <GraduationCap className="h-5 w-5" />
                            Graduate Details
                        </DialogTitle>
                        <DialogDescription>
                            Complete information for the selected graduate
                        </DialogDescription>
                    </DialogHeader>

                    {loadingDetails ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : selectedGraduate ? (
                        <div className="space-y-6">
                            {/* Personal Information */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <User className="h-4 w-4" />
                                    Personal Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground">Full Name</p>
                                        <p className="font-medium text-lg">{selectedGraduate.full_name}</p>
                                    </div>
                                    {selectedGraduate.sex && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Sex</p>
                                            <p className="font-medium">{selectedGraduate.sex}</p>
                                        </div>
                                    )}
                                    {selectedGraduate.date_of_birth && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Date of Birth</p>
                                            <p className="font-medium">{selectedGraduate.date_of_birth}</p>
                                        </div>
                                    )}
                                    {selectedGraduate.student_id_number && (
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground">Student ID</p>
                                            <p className="font-medium font-mono text-sm">
                                                {selectedGraduate.student_id_number}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Institution Information */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <Building2 className="h-4 w-4" />
                                    Institution Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground">Institution Name</p>
                                        <p className="font-medium text-base">{selectedGraduate.institution_name}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Institution Code (HEI UII)</p>
                                        <p className="font-medium font-mono text-sm text-blue-600 dark:text-blue-400">
                                            {selectedGraduate.institution_code}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Institution Type</p>
                                        <div className="mt-1 flex gap-2">
                                            {getInstitutionSectorBadge(selectedGraduate.institution_sector)}
                                            {getInstitutionTypeBadge(selectedGraduate.institution_type)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Academic Information */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <FileText className="h-4 w-4" />
                                    Academic Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                    <div className="col-span-2">
                                        <p className="text-xs text-muted-foreground">Program</p>
                                        <p className="font-medium">{selectedGraduate.program_name}</p>
                                    </div>
                                    {selectedGraduate.major && (
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground">Major</p>
                                            <p className="font-medium">{selectedGraduate.major}</p>
                                        </div>
                                    )}
                                    {selectedGraduate.program_type && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Program Type</p>
                                            <Badge
                                                variant="outline"
                                                className={
                                                    selectedGraduate.program_type === 'Board'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300'
                                                        : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300'
                                                }
                                            >
                                                {selectedGraduate.program_type}
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Graduation Information */}
                            <div className="space-y-3">
                                <h3 className="font-semibold text-sm flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                    <Calendar className="h-4 w-4" />
                                    Graduation Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                                    {selectedGraduate.so_number && (
                                        <div className="col-span-2">
                                            <p className="text-xs text-muted-foreground">Special Order (SO) Number</p>
                                            <p className="font-medium font-mono text-base text-blue-600 dark:text-blue-400">
                                                {selectedGraduate.so_number}
                                            </p>
                                        </div>
                                    )}
                                    {selectedGraduate.date_graduated && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Date Graduated</p>
                                            <p className="font-medium">{selectedGraduate.date_graduated}</p>
                                        </div>
                                    )}
                                    {selectedGraduate.academic_year && (
                                        <div>
                                            <p className="text-xs text-muted-foreground">Academic Year</p>
                                            <p className="font-medium">{selectedGraduate.academic_year}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Record Metadata */}
                            {(selectedGraduate.created_at || selectedGraduate.updated_at) && (
                                <div className="pt-4 border-t">
                                    <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                                        {selectedGraduate.created_at && (
                                            <div>
                                                <p>Record Created</p>
                                                <p className="font-mono">{selectedGraduate.created_at}</p>
                                            </div>
                                        )}
                                        {selectedGraduate.updated_at && (
                                            <div>
                                                <p>Last Updated</p>
                                                <p className="font-mono">{selectedGraduate.updated_at}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Close Button */}
                            <div className="flex justify-end pt-4">
                                <Button onClick={handleCloseModal} variant="outline">
                                    Close
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            Failed to load graduate details
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
