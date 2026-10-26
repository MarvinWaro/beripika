// resources/js/pages/welcome.tsx

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import InstitutionResultsList from '@/components/welcome/institution-results-list';
import ProgramsList from '@/components/welcome/programs-list';
import {
    CountUp,
    FloatingChips,
    Reveal,
    RevealHeadline,
    TopoBackground,
} from '@/components/welcome/landing-motion';
import SearchInstitutionCard from '@/components/welcome/search-institution-card';
import PermitDialog from '@/components/welcome/permit-dialog';
import Footer from '@/components/footer';
import Concerns from '@/components/welcome/concerns';
import { useAppearance } from '@/hooks/use-appearance';
import WelcomeNav from '@/components/welcome/welcome-nav';
import { Toaster } from '@/components/ui/sonner';
import axios from 'axios';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

// The map library is large, so it loads only when the welcome page renders.
const HeiMap = lazy(() => import('@/components/welcome/hei-map'));
import { toast } from 'sonner';

// --- Types ---
interface Graduate {
    id: number;
    name: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    extensionName: string | null;
    yearGraduated: string;
    studentId: string;
    eligibility: string;
    dateOfBirth: string | null;
    sex: string | null;
    soNumber: string | null;
    lrn: string | null;
    philsysId: string | null;
    program?: {
        id: number | null;
        name: string;
        major: string | null;
        copNumber: string | null;
        grNumber: string | null;
    };
    institution?: {
        code: string;
        name: string;
        type: string;
    };
}

interface Program {
    id: number | null;
    name: string;
    major: string | null;
    copNumber: string | null;
    grNumber: string | null;
    graduates_count?: number;
    graduates?: Graduate[];
    institution?: {
        code: string;
        name: string;
        type: string;
    };
    permitPdfUrl?: string | null;
}

interface Institution {
    id: number | null;
    code: string;
    name: string;
    type: 'public' | 'private';
    programs: Program[];
}

interface HeiLocation {
    instCode: string;
    instName: string;
    latitude: number;
    longitude: number;
    ownershipSector?: string | null;
    ownershipHei_type?: string | null;
    province?: string | null;
    municipalityCity?: string | null;
}

/** Portal values arrive untyped; only strings and numbers are meaningful text. */
const textOrNull = (value: unknown): string | null =>
    typeof value === 'string' || typeof value === 'number'
        ? String(value)
        : null;

export default function PRCCheckLanding() {
    // --- State ---
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [institutions, setInstitutions] = useState<Institution[]>([]);

    const [expandedInstitutionCode, setExpandedInstitutionCode] = useState<
        string | null
    >(null);
    const [institutionPrograms, setInstitutionPrograms] = useState<
        Record<string, Program[]>
    >({});
    const [institutionProgramsLoading, setInstitutionProgramsLoading] =
        useState<Record<string, boolean>>({});
    const [institutionProgramsError, setInstitutionProgramsError] = useState<
        Record<string, string | null>
    >({});

    const [selectedProgram, setSelectedProgram] = useState<Program | null>(
        null,
    );
    const [permitDialogOpen, setPermitDialogOpen] = useState(false);

    const [isSearching, setIsSearching] = useState(false);
    const [loadingProgramId, setLoadingProgramId] = useState<number | null>(
        null,
    );

    const [searchMessage, setSearchMessage] = useState<string | null>(null);
    const [searchMessageType, setSearchMessageType] = useState<
        'warning' | 'error' | null
    >(null);

    // Map State
    const [heiMapLoading, setHeiMapLoading] = useState(false);
    const [heiMapError, setHeiMapError] = useState<string | null>(null);
    const [heiMapCenter, setHeiMapCenter] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [heiMapZoom, setHeiMapZoom] = useState<number>(8);
    const [heiLocations, setHeiLocations] = useState<HeiLocation[]>([]);
    const [mapFocusLocation, setMapFocusLocation] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [mapFitLocations, setMapFitLocations] = useState<
        { lat: number; lng: number }[] | null
    >(null);

    const { appearance, updateAppearance } = useAppearance();

    // Auto-scroll refs
    const resultsRef = useRef<HTMLDivElement | null>(null);
    const searchRequest = useRef(0);
    const [shouldScrollToResults, setShouldScrollToResults] = useState(false);

    // --- Handlers --- bsdfbksd ksjbjh shlashdfzlh lshldkfhskdfkhsdlh lsfhskdhf sdhilsh df

    const resetAll = () => {
        searchRequest.current += 1;
        setIsSearching(false);
        setInstitutions([]);
        setExpandedInstitutionCode(null);
        setInstitutionPrograms({});
        setInstitutionProgramsLoading({});
        setInstitutionProgramsError({});
        setSelectedProgram(null);
        setPermitDialogOpen(false);
        setSearchMessage(null);
        setSearchMessageType(null);
        setMapFocusLocation(null);
        setMapFitLocations(null);
    };

    const handleSearchTermChange = (value: string) => {
        setSearchTerm(value);
        setSearchMessage(null);
        setSearchMessageType(null);
    };

    const scrollToResults = () => {
        if (typeof window === 'undefined' || !resultsRef.current) return;
        const rect = resultsRef.current.getBoundingClientRect();
        const offset = 96;
        const absoluteTop = window.scrollY + rect.top - offset;
        const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        window.scrollTo({
            top: absoluteTop,
            behavior: reduceMotion ? 'auto' : 'smooth',
        });
    };

    useEffect(() => {
        if (!shouldScrollToResults) return;
        if (!resultsRef.current) return;
        scrollToResults();
        setShouldScrollToResults(false);
    }, [shouldScrollToResults]);

    // --- API Calls ---

    const loadHeiMap = useCallback(async () => {
        setHeiMapLoading(true);
        setHeiMapError(null);
        try {
            const response = await axios.get('/hei-map');
            const data = response.data ?? {};
            const centerRaw = data.center ?? {};
            const center = {
                lat: Number(centerRaw.lat ?? 6.5),
                lng: Number(centerRaw.lng ?? 124.5),
            };
            const zoom = Number(data.zoom ?? 8);
            const heisRaw: Record<string, unknown>[] = Array.isArray(data.heis)
                ? data.heis
                : [];

            const normalized: HeiLocation[] = heisRaw
                .map((item) => {
                    const lat = Number(
                        item.latitude ?? item.lat ?? item.xCoordinate ?? NaN,
                    );
                    const lng = Number(
                        item.longitude ?? item.lng ?? item.yCoordinate ?? NaN,
                    );
                    if (!Number.isFinite(lat) || !Number.isFinite(lng))
                        return null;
                    return {
                        instCode: textOrNull(item.instCode) ?? '',
                        instName: textOrNull(item.instName) ?? 'Unknown HEI',
                        latitude: lat,
                        longitude: lng,
                        ownershipSector: textOrNull(
                            item.ownershipSector ?? item.instOwnership,
                        ),
                        ownershipHei_type: textOrNull(item.ownershipHei_type),
                        province: textOrNull(item.province),
                        municipalityCity: textOrNull(item.municipalityCity),
                    } as HeiLocation;
                })
                .filter(
                    (v): v is HeiLocation => v !== null && v.instCode !== '',
                );

            setHeiMapCenter(center);
            setHeiMapZoom(zoom);
            setHeiLocations(normalized);
        } catch (error) {
            console.error('Failed to load HEI map:', error);
            setHeiMapError('Unable to load HEI locations at the moment.');
        } finally {
            setHeiMapLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadHeiMap();
    }, [loadHeiMap]);

    const performInstitutionSearch = async (rawSearch: string) => {
        const requestId = ++searchRequest.current;
        setSearchMessage(null);
        setSearchMessageType(null);
        setSelectedProgram(null);
        setPermitDialogOpen(false);
        setExpandedInstitutionCode(null);

        const trimmed = rawSearch.trim();
        if (!trimmed) {
            setIsSearching(false);
            setInstitutions([]);
            setSearchMessage(
                'Please enter an institution code or name to search.',
            );
            setSearchMessageType('warning');
            return;
        }

        const isNumeric = /^\d+$/.test(trimmed);
        if (isNumeric && trimmed.length < 4) {
            setIsSearching(false);
            setInstitutions([]);
            setSearchMessage(
                'For institution codes, please enter at least 4 digits (e.g., 1201).',
            );
            setSearchMessageType('warning');
            return;
        }

        setIsSearching(true);
        try {
            const response = await axios.post('/api/search-institution', {
                search: trimmed,
            });
            if (requestId !== searchRequest.current) return;
            const result: Institution[] = response.data.institutions ?? [];

            setInstitutions(result);
            setInstitutionPrograms({});
            setInstitutionProgramsLoading({});
            setInstitutionProgramsError({});
            setExpandedInstitutionCode(null);

            if (result.length === 0) {
                setSearchMessage(
                    `No institution found for "${trimmed}". Please check the code or name.`,
                );
                setSearchMessageType('warning');
                setMapFocusLocation(null);
                setMapFitLocations(null);
            } else {
                setShouldScrollToResults(true);

                // Find coordinates for all matched institutions
                const matchedLocations = result
                    .map((inst) =>
                        heiLocations.find((h) => h.instCode === inst.code),
                    )
                    .filter(
                        (h): h is HeiLocation => h !== null && h !== undefined,
                    )
                    .map((h) => ({ lat: h.latitude, lng: h.longitude }));

                if (matchedLocations.length > 1) {
                    // Multiple results: fit map to show all of them
                    setMapFocusLocation(null);
                    setMapFitLocations(matchedLocations);
                } else if (matchedLocations.length === 1) {
                    // Single result: fly directly to it
                    setMapFitLocations(null);
                    setMapFocusLocation(matchedLocations[0]);
                }
            }
        } catch (error) {
            if (requestId !== searchRequest.current) return;
            console.error('Search failed:', error);
            setSearchMessage('Search failed. Please try again in a moment.');
            setSearchMessageType('error');
        } finally {
            if (requestId === searchRequest.current) setIsSearching(false);
        }
    };

    const handleInstitutionSearch = () => {
        void performInstitutionSearch(searchTerm);
    };

    const handleHeiMarkerClick = (instCode: string) => {
        setSearchTerm(instCode);
        void performInstitutionSearch(instCode);
    };

    const loadProgramsForInstitution = async (institution: Institution) => {
        const code = institution.code;
        if (institutionPrograms[code] || institutionProgramsLoading[code])
            return;

        try {
            setInstitutionProgramsLoading((s) => ({ ...s, [code]: true }));
            setInstitutionProgramsError((s) => ({ ...s, [code]: null }));

            const response = await axios.get(
                `/api/institution/${code}/programs`,
            );
            const programs: Program[] = response.data.programs ?? [];

            setInstitutionPrograms((s) => ({ ...s, [code]: programs }));
            setInstitutions((prev) =>
                prev.map((inst) =>
                    inst.code === code ? { ...inst, programs } : inst,
                ),
            );
        } catch (error) {
            console.error('Failed to load programs:', error);
            setInstitutionProgramsError((s) => ({
                ...s,
                [code]: 'Unable to load programs for this institution.',
            }));
        } finally {
            setInstitutionProgramsLoading((s) => ({ ...s, [code]: false }));
        }
    };

    const handleInstitutionToggle = (institution: Institution) => {
        const code = institution.code;
        const isSame = expandedInstitutionCode === code;
        const nextCode = isSame ? null : code;

        setExpandedInstitutionCode(nextCode);
        setSelectedProgram(null);
        setPermitDialogOpen(false);

        if (!isSame) {
            void loadProgramsForInstitution(institution);
            scrollToResults();

            // Focus map on the selected institution
            const matchedHei = heiLocations.find((h) => h.instCode === code);
            if (matchedHei) {
                setMapFitLocations(null);
                setMapFocusLocation({
                    lat: matchedHei.latitude,
                    lng: matchedHei.longitude,
                });
            }
        }
    };

    const handleProgramClick = async (program: Program) => {
        if (!program.id) {
            setSelectedProgram(program);
            setPermitDialogOpen(true);
            return;
        }

        setLoadingProgramId(program.id);
        try {
            const response = await axios.get(`/api/program/${program.id}`);
            setSelectedProgram(response.data.program);
            setPermitDialogOpen(true);
        } catch (error) {
            console.error('Failed to load program:', error);
            toast.error('Could not load program details. Please try again.');
        } finally {
            setLoadingProgramId(null);
        }
    };

    // --- Theme ---
    const toggleTheme = () => {
        switch (appearance) {
            case 'light':
                return updateAppearance('dark');
            case 'dark':
                return updateAppearance('system');
            case 'system':
                return updateAppearance('light');
            default:
                return updateAppearance('light');
        }
    };

    const getThemeIcon = () => {
        switch (appearance) {
            case 'light':
                return { icon: Sun, tooltip: 'Switch to Dark Mode' };
            case 'dark':
                return { icon: Moon, tooltip: 'Switch to System Mode' };
            case 'system':
                return { icon: Monitor, tooltip: 'Switch to Light Mode' };
            default:
                return { icon: Sun, tooltip: 'Toggle theme' };
        }
    };

    const { icon: ThemeIcon, tooltip } = getThemeIcon();

    // Derived State
    const selectedInstitution = expandedInstitutionCode
        ? (institutions.find((inst) => inst.code === expandedInstitutionCode) ??
          null)
        : null;

    const selectedPrograms = selectedInstitution
        ? (institutionPrograms[selectedInstitution.code] ??
          selectedInstitution.programs ??
          [])
        : [];

    const selectedProgramsLoading =
        selectedInstitution &&
        institutionProgramsLoading[selectedInstitution.code] === true;
    const selectedProgramsError =
        selectedInstitution &&
        (institutionProgramsError[selectedInstitution.code] ?? null);

    return (
        <div className="relative min-h-screen bg-background font-sans">
            <Toaster />

            <WelcomeNav
                ThemeIcon={ThemeIcon}
                tooltip={tooltip}
                onToggleTheme={toggleTheme}
            />

            {/* Hero: dark editorial band with the search card */}
            <section className="vt-brand-panel relative overflow-hidden border-b border-white/10 bg-gray-950 text-white">
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_srgb,var(--primary)_40%,transparent),transparent_55%)]"
                />
                <TopoBackground />
                <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8 lg:py-24">
                    <div className="lg:col-span-7">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gray-200">
                            <span className="size-1.5 rounded-full bg-success" />
                            Official CHED Region XII registry
                        </span>
                        <RevealHeadline
                            className="text-display mt-6 text-5xl sm:text-6xl lg:text-7xl"
                            lines={[
                                'Verify programs,',
                                'permits and',
                                'institutions.',
                            ]}
                        />
                        <p
                            className="landing-rise mt-6 max-w-xl text-lg leading-relaxed text-gray-400"
                            style={{ animationDelay: '480ms' }}
                        >
                            Check whether a higher education institution and its
                            programs hold a valid CHED permit or recognition,
                            straight from the CHED Regional Office XII portal.
                        </p>
                        <dl
                            className="landing-rise mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-white/10 pt-6 text-sm"
                            style={{ animationDelay: '600ms' }}
                        >
                            <div>
                                <dt className="text-gray-400">
                                    HEIs on the map
                                </dt>
                                <dd className="mt-1 text-2xl font-semibold">
                                    <CountUp
                                        value={
                                            heiLocations.length > 0
                                                ? heiLocations.length
                                                : null
                                        }
                                    />
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400">
                                    Provinces covered
                                </dt>
                                <dd className="mt-1 text-2xl font-semibold">
                                    <CountUp value={4} />
                                </dd>
                            </div>
                            <div>
                                <dt className="text-gray-400">Access</dt>
                                <dd className="mt-1 text-2xl font-semibold">
                                    Free
                                </dd>
                            </div>
                        </dl>
                    </div>

                    <div
                        className="landing-rise relative lg:col-span-5"
                        style={{ animationDelay: '250ms' }}
                    >
                        <FloatingChips />
                        <SearchInstitutionCard
                            searchTerm={searchTerm}
                            onSearchTermChange={handleSearchTermChange}
                            isSearching={isSearching}
                            onSearch={handleInstitutionSearch}
                            searchMessage={searchMessage}
                            searchMessageType={searchMessageType}
                            institutionsCount={institutions.length}
                            onClear={() => {
                                setSearchTerm('');
                                resetAll();
                            }}
                        />
                    </div>
                </div>
            </section>

            <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 lg:pt-20">
                {/* Important Notice (Concerns) stays at top as requested previously */}
                {/* <div className="mb-6">
                    <Concerns />
                </div> */}

                {/* HEI map */}
                <Reveal>
                    <section aria-labelledby="hei-map-title" className="mt-4">
                        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm font-semibold text-primary">
                                    Explore
                                </p>
                                <h2
                                    id="hei-map-title"
                                    className="text-display mt-1 scroll-mt-24 text-3xl sm:text-4xl"
                                >
                                    Institutions across Region XII
                                </h2>
                            </div>
                            <p className="max-w-md text-sm text-muted-foreground">
                                Select a marker to see an institution&apos;s
                                programs, permits and distance from the CHED
                                Regional Office.
                            </p>
                        </div>
                        <div className="overflow-hidden rounded-(--radius-hero) border bg-muted">
                            <Suspense
                                fallback={
                                    <div className="grid h-[380px] place-items-center text-sm text-muted-foreground sm:h-[460px] lg:h-[560px]">
                                        Loading map…
                                    </div>
                                }
                            >
                                <HeiMap
                                    center={heiMapCenter}
                                    zoom={heiMapZoom}
                                    heis={heiLocations}
                                    isLoading={heiMapLoading}
                                    error={heiMapError}
                                    onHeiClick={handleHeiMarkerClick}
                                    focusLocation={mapFocusLocation}
                                    fitLocations={mapFitLocations}
                                />
                            </Suspense>
                        </div>
                    </section>
                </Reveal>

                {/* Loading Skeleton */}
                {isSearching && institutions.length === 0 && (
                    <div className="mt-8">
                        <Card>
                            <CardContent className="p-6 sm:p-8">
                                <div className="mb-4 space-y-2">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-28" />
                                </div>
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div
                                            key={i}
                                            className="flex items-start gap-4 rounded-lg border bg-white/80 p-4 dark:border-gray-800 dark:bg-gray-900/80"
                                        >
                                            <Skeleton className="h-10 w-10 rounded-xl" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/2" />
                                                <div className="flex gap-2">
                                                    <Skeleton className="h-3 w-20" />
                                                    <Skeleton className="h-3 w-24" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Results Area */}
                {institutions.length > 0 && (
                    <div ref={resultsRef} className="mt-8">
                        <Card>
                            <CardContent className="p-6 sm:p-8">
                                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                            Search Results
                                        </h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {institutions.length} institution
                                            {institutions.length !== 1
                                                ? 's'
                                                : ''}{' '}
                                            found
                                        </p>
                                    </div>
                                </div>

                                {/* ✅ MOVED HERE: URGENT NOTICE (RED)
                                    Inside the card content, full width, below the results header.
                                */}

                                <div className="mb-6">
                                    <Concerns />
                                </div>
                                {/* <div className="mb-6">
                                    <Notice />
                                </div> */}

                                <div className="grid gap-6 lg:h-[460px] lg:grid-cols-12">
                                    {/* Left: Institution List */}
                                    <div className="min-w-0 lg:col-span-6 lg:h-full lg:overflow-x-hidden lg:overflow-y-auto lg:pr-2">
                                        <InstitutionResultsList
                                            institutions={institutions}
                                            expandedInstitutionCode={
                                                expandedInstitutionCode
                                            }
                                            onToggleInstitution={
                                                handleInstitutionToggle
                                            }
                                            programsLoading={
                                                institutionProgramsLoading
                                            }
                                            programsError={
                                                institutionProgramsError
                                            }
                                            onProgramClick={handleProgramClick}
                                            loadingProgramId={loadingProgramId}
                                        />
                                    </div>

                                    {/* Right: Programs Panel */}
                                    <div className="mt-4 min-w-0 lg:col-span-6 lg:mt-0 lg:h-full lg:overflow-x-hidden lg:overflow-y-auto lg:pl-2">
                                        {!selectedInstitution ? (
                                            <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-400">
                                                Select an institution on the
                                                left to view its programs and
                                                permits here.
                                            </div>
                                        ) : (
                                            <Card className="bg-muted/40">
                                                <CardContent className="p-5 sm:p-6">
                                                    <div className="mb-3">
                                                        <p className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                                                            Programs for
                                                        </p>
                                                        <h3 className="mt-1 text-sm leading-snug font-semibold text-gray-900 dark:text-white">
                                                            {
                                                                selectedInstitution.name
                                                            }
                                                        </h3>
                                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 font-medium dark:bg-gray-800">
                                                                UII:{' '}
                                                                <span className="ml-1 font-mono">
                                                                    {
                                                                        selectedInstitution.code
                                                                    }
                                                                </span>
                                                            </span>
                                                            <span className="inline-flex items-center rounded-md bg-gray-900 px-2 py-0.5 font-medium text-white dark:bg-gray-100 dark:text-gray-900">
                                                                {selectedInstitution.type ===
                                                                'public'
                                                                    ? 'Public Institution'
                                                                    : 'Private Institution'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="mb-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                                        <span className="font-semibold">
                                                            Available Programs
                                                        </span>
                                                        <span>
                                                            {selectedPrograms
                                                                ? selectedPrograms.length
                                                                : 0}{' '}
                                                            program
                                                            {selectedPrograms &&
                                                            selectedPrograms.length !==
                                                                1
                                                                ? 's'
                                                                : ''}
                                                        </span>
                                                    </div>

                                                    {selectedProgramsLoading ? (
                                                        <div className="space-y-3">
                                                            {[1, 2, 3].map(
                                                                (i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="rounded-lg border bg-white/80 p-4 dark:border-gray-700 dark:bg-gray-800/80"
                                                                    >
                                                                        <div className="flex items-start gap-4">
                                                                            <Skeleton className="h-10 w-10 rounded-xl" />
                                                                            <div className="flex-1 space-y-2">
                                                                                <Skeleton className="h-4 w-2/3" />
                                                                                <Skeleton className="h-3 w-1/3" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ),
                                                            )}
                                                        </div>
                                                    ) : selectedProgramsError ? (
                                                        <p className="text-sm text-red-600 dark:text-red-400">
                                                            {
                                                                selectedProgramsError
                                                            }
                                                        </p>
                                                    ) : !selectedPrograms ||
                                                      selectedPrograms.length ===
                                                          0 ? (
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            No programs
                                                            available for this
                                                            institution.
                                                        </p>
                                                    ) : (
                                                        <ProgramsList
                                                            programs={
                                                                selectedPrograms
                                                            }
                                                            onProgramClick={
                                                                handleProgramClick
                                                            }
                                                            loadingProgramId={
                                                                loadingProgramId
                                                            }
                                                            showHeader={false}
                                                        />
                                                    )}
                                                </CardContent>
                                            </Card>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </main>

            <div id="about">
                <Footer />
            </div>

            {/* Dialog handles the PDF and details */}
            <PermitDialog
                open={permitDialogOpen && !!selectedProgram}
                program={selectedProgram}
                onOpenChange={(open) => {
                    setPermitDialogOpen(open);
                    if (!open) setSelectedProgram(null);
                }}
            />
        </div>
    );
}
