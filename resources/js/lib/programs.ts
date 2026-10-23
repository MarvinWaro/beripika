import type { PortalProgram } from '@/types/programs';

export function permitState(
    program: Pick<PortalProgram, 'permit_pdf_url' | 'permit_number'>,
) {
    return program.permit_pdf_url
        ? 'document'
        : program.permit_number
          ? 'number'
          : 'missing';
}

export const permitLabels = {
    document: 'Document linked',
    number: 'Number recorded · No document',
    missing: 'Check with CHED',
};

export const permitColors = {
    document:
        'border-green-200 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300',
    number: 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    missing:
        'border-red-200 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export function filterPrograms(
    programs: PortalProgram[],
    search: string,
    classification: string,
    status: string,
    permit: string,
) {
    const query = search.trim().toLowerCase();
    return programs.filter(
        (program) =>
            [
                program.program_name,
                program.major ?? '',
                program.permit_number ?? '',
            ].some((value) => value.toLowerCase().includes(query)) &&
            (classification === 'all' ||
                program.program_type === classification) &&
            (status === 'all' ||
                program.program_status.toLowerCase() === status) &&
            (permit === 'all' || permitState(program) === permit),
    );
}
