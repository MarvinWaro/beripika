export type Classification = 'Unknown' | 'Board' | 'Non-Board';

export interface PortalProgram {
    id: number;
    program_name: string;
    major: string | null;
    program_type: Classification;
    program_status: string;
    permit_number: string | null;
    permit_pdf_url: string | null;
    institution: { institution_code: string; name: string; type: string };
}

export interface ProgramSnapshot {
    programs: PortalProgram[];
    last_fetched_at: string | null;
    stale: boolean;
    error: string | null;
}

export interface CatalogSyncRun {
    id: number;
    status: 'queued' | 'running' | 'completed' | 'partial' | 'failed';
    error: string | null;
    total: number;
    processed: number;
    created: number;
    failed_schools: { code: string; name: string; error: string }[];
    finished_at: string | null;
}
