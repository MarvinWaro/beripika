// resources/js/components/welcome/institution-results-list.tsx

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ChevronDown } from 'lucide-react';

interface Program {
    id: number | null;
    name: string;
    major: string | null;
    copNumber: string | null;
    grNumber: string | null;
    graduates_count?: number;
    permitPdfUrl?: string | null;
}

interface Institution {
    id: number | null;
    code: string;
    name: string;
    type: 'public' | 'private';
    programs: Program[];
}

interface InstitutionResultsListProps {
    institutions: Institution[];
    expandedInstitutionCode: string | null;
    onToggleInstitution: (institution: Institution) => void;
    programsLoading: Record<string, boolean>;
    programsError: Record<string, string | null>;
    onProgramClick: (program: Program) => void;
    loadingProgramId?: number | null;
}

export default function InstitutionResultsList({
    institutions,
    expandedInstitutionCode,
    onToggleInstitution,
    programsLoading,
}: InstitutionResultsListProps) {
    return (
        <div className="mx-auto max-w-full">
            <div className="flex flex-col gap-2">
                {institutions.map((institution, keyIndex) => {
                    const isSelected = expandedInstitutionCode === institution.code;
                    const isLoadingPrograms = programsLoading[institution.code] === true;

                    // UPDATED LOGIC:
                    // Removed the "programs loaded" count check.
                    // The helper text now ONLY appears if we are currently loading.
                    let helperText: string | null = null;
                    if (isLoadingPrograms) {
                        helperText = 'Loading programs...';
                    }

                    return (
                        <Card
                            key={`${institution.code}-${keyIndex}`}
                            className={`py-0 group border border-dashed shadow-sm transition-all hover:shadow-md ${
                                isSelected
                                    ? 'border-emerald-300 bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/40'
                                    : 'bg-white/95 border-gray-200 dark:bg-gray-900/90 dark:border-gray-700'
                            }`}
                        >
                            <CardContent className="px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() => onToggleInstitution(institution)}
                                    className="flex w-full items-center justify-between gap-3 text-left"
                                    aria-pressed={isSelected}
                                >
                                    <div className="flex flex-1 items-start gap-3">
                                        <div className="mt-0.5 rounded-lg bg-blue-100 p-2.5 transition-colors group-hover:bg-blue-200 dark:bg-blue-900/40 dark:group-hover:bg-blue-900/60">
                                            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h3
                                                className={`text-sm font-semibold leading-snug break-words ${
                                                    isSelected
                                                        ? 'text-gray-900 dark:text-emerald-50'
                                                        : 'text-gray-900 dark:text-white'
                                                }`}
                                            >
                                                {institution.name}
                                            </h3>

                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                                                    UII:{' '}
                                                    <span className="ml-1 font-mono">
                                                        {institution.code}
                                                    </span>
                                                </span>

                                                <Badge
                                                    variant={
                                                        institution.type === 'public'
                                                            ? 'default'
                                                            : 'secondary'
                                                    }
                                                    className="px-2 py-0.5 text-[11px] font-medium dark:bg-gray-800 dark:text-gray-100"
                                                >
                                                    {institution.type === 'public'
                                                        ? 'Public Institution'
                                                        : 'Private Institution'}
                                                </Badge>
                                            </div>

                                            {/* Helper text section: Only rendered if loading */}
                                            {helperText && (
                                                <div className={`mt-1 flex items-center gap-1 text-[11px] ${
                                                    isSelected ? 'text-gray-700 dark:text-emerald-200/80' : 'text-gray-500 dark:text-gray-400'
                                                }`}>
                                                    <svg
                                                        className="h-3 w-3 flex-shrink-0 animate-spin"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                                        />
                                                    </svg>
                                                    <span>{helperText}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <ChevronDown
                                        className={`h-4 w-4 flex-shrink-0 transition-transform ${
                                            isSelected ? 'rotate-180 text-gray-600 dark:text-emerald-200' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500'
                                        }`}
                                    />
                                </button>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
