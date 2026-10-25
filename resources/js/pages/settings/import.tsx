import { Head } from '@inertiajs/react';
import GraduatesImport from '@/components/graduate-import';

/**
 * SOAIS graduate masterlist import (Settings › Administration).
 * The institutions & programs import is hidden for now; its endpoints remain on the backend.
 */
export default function ImportGraduates() {
    return (
        <>
            <Head title="Import Graduates" />
            <GraduatesImport />
        </>
    );
}

ImportGraduates.layout = {
    breadcrumbs: [{ title: 'Import Graduates', href: '/import' }],
};
