<?php

namespace App\Services;

use App\Models\ProgramCatalog;

class ProgramPresenter
{
    public function __construct(private PortalService $portal) {}

    public function map(array $records, string $code, ?array $school): array
    {
        $catalog = ProgramCatalog::pluck('program_type', 'normalized_name');

        return collect($records)->map(function ($row, $index) use ($catalog, $code, $school) {
            $name = trim($row['programName']);
            $permit = trim($row['permit_4thyr'] ?? '') ?: null;
            $pdf = $this->portal->buildPermitUrl($row['filename'] ?? null);

            return [
                'id' => $index + 1,
                'program_name' => $name,
                'major' => trim($row['majorName'] ?? '') ?: null,
                'program_type' => $catalog->get(ProgramCatalog::normalizeName($name), 'Unknown'),
                'program_status' => trim($row['program_status'] ?? '') ?: 'Unknown',
                'permit_number' => $permit,
                'permit_pdf_url' => $pdf,
                'badge_priority' => $pdf ? 1 : ($permit ? 2 : 3),
                'institution' => [
                    'institution_code' => $code,
                    'name' => $school['instName'] ?? $code,
                    'type' => strtolower(trim($school['ownershipSector'] ?? $school['instOwnership'] ?? '')),
                ],
            ];
        })->unique(fn ($row) => $row['program_name'].'|'.$row['major'])
            ->sortBy([['badge_priority', 'asc'], ['program_name', 'asc']])->values()->all();
    }
}
