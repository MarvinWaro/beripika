// resources/js/components/welcome/programs-list.tsx

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GraduationCap, Loader2, Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';

interface Program {
    id: number | null;
    name: string;
    major: string | null;
    copNumber: string | null;
    grNumber: string | null;
    graduates_count?: number;
    permitPdfUrl?: string | null;
    status?: string;
}

interface ProgramsListProps {
    programs: Program[];
    onProgramClick: (program: Program) => void;
    loadingProgramId?: number | null;
    showHeader?: boolean;
}

export default function ProgramsList({
    programs,
    onProgramClick,
    loadingProgramId = null,
    showHeader = true,
}: ProgramsListProps) {
    const [searchQuery, setSearchQuery] = useState('');

    // Helper: Determine badge style based on PDF availability
    const getPermitStyle = (hasPdf: boolean) => {
        if (hasPdf) {
            // Green: Has Permit + PDF
            return "border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300";
        }
        // Purple: Has Permit but No PDF
        return "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
    };

    // ✅ Helper: Get status badge color
    const getStatusColor = (status: string) => {
        const normalizedStatus = status.toLowerCase();

        if (normalizedStatus === 'active') {
            return 'border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300';
        }

        if (
            normalizedStatus.includes('phase') ||
            normalizedStatus.includes('phased out') ||
            normalizedStatus.includes('discontinue') ||
            normalizedStatus.includes('closed')
        ) {
            return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400';
        }

        if (
            normalizedStatus.includes('voluntary') ||
            normalizedStatus.includes('gradual')
        ) {
            return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-900/20 dark:text-orange-400';
        }

        if (normalizedStatus.includes('suspend')) {
            return 'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-400';
        }

        if (
            normalizedStatus.includes('withdraw') ||
            normalizedStatus.includes('disapprove')
        ) {
            return 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-400';
        }

        return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
    };

    // ✅ Sort Programs Function - Prioritize active programs
    const sortPrograms = (list: Program[]) => {
        return [...list].sort((a, b) => {
            const aHasPermit = !!(a.copNumber || a.grNumber);
            const aHasPdf = !!a.permitPdfUrl;
            const aStatus = (a.status || '').toLowerCase();

            const bHasPermit = !!(b.copNumber || b.grNumber);
            const bHasPdf = !!b.permitPdfUrl;
            const bStatus = (b.status || '').toLowerCase();

            // Check if status is inactive
            const isStatusInactive = (status: string) => {
                return (
                    status.includes('discontinue') ||
                    status.includes('phased out') ||
                    status.includes('phase out') ||
                    status.includes('voluntary') ||
                    status.includes('gradual')
                );
            };

            const aIsInactive = isStatusInactive(aStatus);
            const bIsInactive = isStatusInactive(bStatus);

            // Assign weights (Lower number = Higher priority)
            const getWeight = (hasPermit: boolean, hasPdf: boolean, isInactive: boolean) => {
                if (hasPermit && hasPdf && !isInactive) return 1; // Green + Active (Top)
                if (hasPermit && !hasPdf && !isInactive) return 2; // Purple + Active
                if (hasPermit && hasPdf && isInactive) return 3; // Green + Inactive (Bottom)
                if (hasPermit && !hasPdf && isInactive) return 4; // Purple + Inactive (Bottom)
                return 5; // No permit
            };

            const weightA = getWeight(aHasPermit, aHasPdf, aIsInactive);
            const weightB = getWeight(bHasPermit, bHasPdf, bIsInactive);

            if (weightA !== weightB) {
                return weightA - weightB;
            }

            return a.name.localeCompare(b.name);
        });
    };

    const filteredPrograms = useMemo(() => {
        if (!searchQuery.trim()) return programs;
        const query = searchQuery.toLowerCase().trim();
        return programs.filter((p) => {
            return (
                p.name.toLowerCase().includes(query) ||
                (p.major && p.major.toLowerCase().includes(query)) ||
                (p.copNumber && p.copNumber.toLowerCase().includes(query)) ||
                (p.grNumber && p.grNumber.toLowerCase().includes(query))
            );
        });
    }, [programs, searchQuery]);

    const sortedPrograms = sortPrograms(filteredPrograms);

    return (
        <>
            {showHeader && (
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-900 dark:text-white">
                        Available Programs
                    </h3>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {programs.length} {programs.length === 1 ? 'program' : 'programs'}
                    </span>
                </div>
            )}

            {/* Search programs */}
            {(programs.length > 3) && (
                <div className="mb-3 flex items-center gap-2">
                    {programs.length > 3 && (
                        <div className="relative flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search programs, GR or COP number..."
                                className="h-9 w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-purple-600 dark:focus:ring-purple-900/30"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {sortedPrograms.length === 0 && searchQuery.trim() !== '' && (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 py-8 dark:border-gray-700">
                    <Search className="mb-2 h-6 w-6 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        No programs match "<span className="font-medium">{searchQuery}</span>"
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {sortedPrograms.map((program, index) => {
                    const isLoading = loadingProgramId !== null && loadingProgramId === program.id;
                    const hasPdf = !!program.permitPdfUrl;
                    const hasAnyPermit = program.copNumber || program.grNumber;

                    // ✅ Check if program status is inactive
                    const programStatus = (program.status || '').toLowerCase();
                    const isInactive =
                        programStatus.includes('discontinue') ||
                        programStatus.includes('phased out') ||
                        programStatus.includes('phase out') ||
                        programStatus.includes('voluntary') ||
                        programStatus.includes('gradual');

                    // ✅ Card styling: Red background for inactive programs
                    const cardStyle = isInactive
                        ? "border-red-400 bg-red-100 opacity-80 dark:border-red-500/50 dark:bg-red-900/20"
                        : "border-gray-200 bg-white/95 dark:border-gray-700 dark:bg-gray-900/90";

                    return (
                        <Card
                            key={program.id ?? `${program.name}-${program.major ?? 'nomajor'}-${index}`}
                            className={`py-0 group border border-dashed shadow-sm transition-all hover:shadow-md ${cardStyle}`}
                        >
                            <CardContent className="px-4 py-3 sm:px-5 sm:py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex flex-1 items-start gap-3">
                                        <div className="rounded-lg bg-purple-100 p-2.5 transition-colors group-hover:bg-purple-200 dark:bg-purple-900/40 dark:group-hover:bg-purple-900/60">
                                            {isLoading ? (
                                                <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
                                            ) : (
                                                <GraduationCap className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h4 className="mb-1 break-words text-sm font-semibold leading-snug text-gray-900 dark:text-white">
                                                {program.name}
                                            </h4>

                                            {program.major && (
                                                <p className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                                                    <span className="font-medium">Major:</span> {program.major}
                                                </p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2">
                                                {/* Public (COP) */}
                                                {program.copNumber && (
                                                    <Badge
                                                        variant="outline"
                                                        className={`px-2 py-0.5 text-[11px] ${getPermitStyle(hasPdf)}`}
                                                    >
                                                        <span className="font-medium">No:</span>
                                                        <span className="ml-1 font-mono text-sm ">{program.copNumber}</span>
                                                    </Badge>
                                                )}

                                                {/* Private (GR) */}
                                                {program.grNumber && (
                                                    <Badge
                                                        variant="outline"
                                                        className={`px-2 py-0.5 text-[11px] ${getPermitStyle(hasPdf)}`}
                                                    >
                                                        <span className="font-medium">No:</span>
                                                        <span className="ml-1 font-mono text-sm">{program.grNumber}</span>
                                                    </Badge>
                                                )}

                                                {/* Status Badge */}
                                                {program.status && (
                                                    <Badge
                                                        variant="outline"
                                                        className={`px-2 py-0.5 text-sm ${getStatusColor(program.status)}`}
                                                    >
                                                        {program.status}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={isLoading || !hasPdf}
                                            onClick={() => !isLoading && hasPdf && onProgramClick(program)}
                                            className={`mt-0.5 h-8 px-3 text-xs ${!hasPdf ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                                            {isLoading ? 'Loading…' : (hasPdf ? 'View permit' : 'No PDF')}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </>
    );
}
