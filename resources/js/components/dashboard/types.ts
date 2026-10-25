/** Props of the dashboard page, mirrored from App\Services\DashboardAnalytics and DashboardOperations. */

export type Point = { label: string; count: number };

export type SexPoint = {
    label: string;
    female: number;
    male: number;
    notRecorded: number;
};

export interface DashboardStats {
    graduates: number;
    institutions: number;
    programs: number;
    female: number;
    male: number;
    notRecorded: number;
    change: { label: string; current: number; previous: number } | null;
}

export interface DashboardChartData {
    trend: Point[];
    undated: number;
    sex: Point[];
    sexTrend: SexPoint[];
    topPrograms: Point[];
    topInstitutions: Point[];
    sectors: Point[];
    provinces: Point[];
    programTypes: Point[];
}

export interface QualityCheck {
    key: string;
    label: string;
    count: number | null;
}

export interface DashboardFilters {
    year: number | null;
    institution: string | null;
}

export interface DashboardOptions {
    years: number[];
    institutions: { code: string; name: string }[];
}

export interface ImportSummary {
    id: number;
    filename: string;
    status: string;
    created_at: string;
    counts: Record<
        'created' | 'updated' | 'unchanged' | 'skipped' | 'invalid',
        number
    >;
}

export interface DashboardOperations {
    concerns: { status: string; label: string; count: number }[] | null;
    imports: ImportSummary[] | null;
    lookups: { label: string; views: number; searches: number }[] | null;
}

export const formatNumber = (value: number) => value.toLocaleString();

export const percent = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%';
