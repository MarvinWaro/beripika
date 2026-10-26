/** Props of the dashboard page, mirrored from App\Services\DashboardAnalytics. */

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
    /** What the breakdown groups by, e.g. "Institution" or "Program". */
    dimension: string;
    /** null when the check cannot be measured yet. */
    count: number | null;
    /** Largest groups first, capped server-side. */
    breakdown: Point[];
    /** Groups left out of the breakdown. */
    more: number;
}

export interface DashboardFilters {
    year: number | null;
    institution: string | null;
}

export interface DashboardOptions {
    years: number[];
    institutions: { code: string; name: string }[];
}

export const formatNumber = (value: number) => value.toLocaleString();

export const percent = (part: number, whole: number) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : '0%';
