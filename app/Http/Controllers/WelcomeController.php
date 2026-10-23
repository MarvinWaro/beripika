<?php

namespace App\Http\Controllers;

use App\Models\Graduate;
use App\Models\Institution;
use App\Models\Program;
use App\Services\PortalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;

class WelcomeController extends Controller
{
    /**
     * Landing page
     */
    public function index()
    {
        return Inertia::render('welcome');
    }

    /**
     * GET /api/institutions-list
     * ✅ FIX: Returns a simple list of HEIs for the "Submit Concern" dropdown.
     */
    public function getInstitutionsList(PortalService $portal)
    {
        try {
            // Fetch all HEIs from the portal service
            $hei = $portal->fetchAllHEI();

            // Transform into a simple list { code, name }
            $list = collect($hei)->map(function ($row) {
                $code = (string) ($row['instCode'] ?? '');
                $name = (string) ($row['instName'] ?? '');

                // Skip invalid entries
                if ($code === '' || $name === '') {
                    return null;
                }

                return [
                    'code' => $code,
                    'name' => $name,
                ];
            })
                ->filter() // Remove nulls
                ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE) // Alphabetical sort
                ->values() // Re-index array
                ->all();

            return response()->json($list);

        } catch (\Throwable $e) {
            // Log error but return empty array to prevent frontend crash
            Log::error('Failed to fetch institutions list: '.$e->getMessage());

            return response()->json([], 200);
        }
    }

    /**
     * POST /api/search-institution
     *
     * Returns institutions WITHOUT programs initially.
     */
    public function searchInstitution(Request $request, PortalService $portal)
    {
        try {
            $search = trim((string) $request->input('search', ''));

            if ($search === '') {
                return response()->json(['institutions' => []]);
            }

            $hei = $portal->fetchAllHEI();

            $q = mb_strtolower($search);
            $collection = collect($hei)->filter(function ($row) use ($q) {
                $code = mb_strtolower((string) ($row['instCode'] ?? ''));
                $name = mb_strtolower((string) ($row['instName'] ?? ''));

                return str_contains($code, $q) || str_contains($name, $q);
            })->values();

            if ($collection->isEmpty()) {
                return response()->json(['institutions' => []]);
            }

            $result = $collection->map(function ($row, $index) {
                $instCode = (string) ($row['instCode'] ?? '');
                $instName = (string) ($row['instName'] ?? '');

                if ($instCode === '' || $instName === '') {
                    return null;
                }

                $sector = strtoupper(trim((string) ($row['ownershipSector'] ?? '')));
                $heiType = strtoupper(trim((string) ($row['ownershipHei_type'] ?? '')));
                $isPublic = $sector === 'PUBLIC'
                    || in_array($heiType, ['SUC', 'LUC', 'STATE', 'PUBLIC'], true);

                return [
                    'id' => $index + 1,
                    'code' => $instCode,
                    'name' => $instName,
                    'type' => $isPublic ? 'public' : 'private',
                    'programs' => [], // Loaded lazily
                ];
            })->filter()->values()->all();

            return response()->json(['institutions' => $result]);

        } catch (\Throwable $e) {
            Log::error('Institution search error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'error' => true,
                'message' => 'An unexpected error occurred while searching institutions.',
            ], 500);
        }
    }

    /**
     * GET /api/institution/{instCode}/programs
     *
     * Lazy load programs when user clicks on an institution.
     */
    public function getInstitutionPrograms(string $instCode, PortalService $portal)
    {
        try {
            // 1. Fetch programs from portal API
            $records = $portal->fetchProgramRecords($instCode);

            // 2. Get local institution data (for graduates count)
            $localInstitution = Institution::with('programs')
                ->where('institution_code', $instCode)
                ->first();

            $localPrograms = $localInstitution ? $localInstitution->programs : collect();

            // 2b. Precompute graduates count
            $graduatesCounts = collect();
            if ($localPrograms->isNotEmpty()) {
                $programIds = $localPrograms->pluck('id')->filter()->all();

                if (! empty($programIds)) {
                    $graduatesCounts = Graduate::whereIn('program_id', $programIds)
                        ->selectRaw('program_id, COUNT(*) as aggregate')
                        ->groupBy('program_id')
                        ->pluck('aggregate', 'program_id');
                }
            }

            // 3. Determine if public/private
            $heiArray = $portal->fetchAllHEI();
            $hei = collect($heiArray)->firstWhere('instCode', $instCode) ?? [];
            $sector = strtoupper(trim((string) ($hei['ownershipSector'] ?? '')));
            $heiType = strtoupper(trim((string) ($hei['ownershipHei_type'] ?? '')));
            $isPublic = $sector === 'PUBLIC'
                || in_array($heiType, ['SUC', 'LUC', 'STATE', 'PUBLIC'], true);

            // 4. Map programs from portal
            $portalPrograms = collect($records)
                ->map(function ($r) {
                    $programName = trim((string) ($r['programName'] ?? ''));
                    $majorName = trim((string) ($r['majorName'] ?? ''));
                    $permit4th = trim((string) ($r['permit_4thyr'] ?? ''));
                    $filename = trim((string) ($r['filename'] ?? ''));

                    // ✅ Extract status from API
                    $status = $this->extractStatus($r);

                    return [
                        'program_name' => $programName,
                        'major' => $majorName !== '' ? $majorName : null,
                        'permit_number' => $permit4th !== '' ? $permit4th : null,
                        'filename' => $filename !== '' ? $filename : null,
                        'status' => $status,
                    ];
                })
                ->filter(fn ($p) => $p['program_name'] !== '')
                // ✅ FILTER: Only show programs with permit numbers (remove "CHECK WITH CHED")
                ->filter(fn ($p) => ! empty($p['permit_number']))
                ->unique(fn ($p) => $p['program_name'].'|'.($p['major'] ?? ''))
                ->values();

            // 5. Match with local programs
            $programsPayload = [];

            foreach ($portalPrograms as $p) {
                $matchingLocal = $localPrograms->first(function ($lp) use ($p) {
                    $lpName = strtoupper(trim((string) $lp->program_name));
                    $lpMajor = strtoupper(trim((string) ($lp->major ?? '')));
                    $pName = strtoupper(trim((string) $p['program_name']));
                    $pMajor = strtoupper(trim((string) ($p['major'] ?? '')));

                    return $lpName === $pName && $lpMajor === $pMajor;
                });

                $localId = $matchingLocal?->id;
                $hasPermitNumber = ! empty($p['permit_number']);
                $graduatesCount = ($matchingLocal && $localId) ? (int) ($graduatesCounts[$localId] ?? 0) : null;

                $permitPdfUrl = $portal->buildPermitUrl($p['filename'] ?? '') ?? null;

                // Debug logging for troubleshooting
                if ($hasPermitNumber && ! empty($p['filename'])) {
                    Log::debug('Building permit URL', [
                        'program' => $p['program_name'],
                        'permit' => $p['permit_number'],
                        'filename' => $p['filename'],
                        'url' => $permitPdfUrl,
                    ]);
                }

                $programsPayload[] = [
                    'id' => $localId,
                    'name' => $p['program_name'],
                    'major' => $p['major'],
                    'copNumber' => ($isPublic && $hasPermitNumber) ? $p['permit_number'] : null,
                    'grNumber' => (! $isPublic && $hasPermitNumber) ? $p['permit_number'] : null,
                    'graduates_count' => $graduatesCount,
                    'permitPdfUrl' => $permitPdfUrl,
                    'status' => $p['status'],
                ];
            }

            return response()->json(['programs' => $programsPayload])
                ->header('Cache-Control', 'no-cache, must-revalidate')
                ->header('X-Programs-Count', count($programsPayload));

        } catch (\Throwable $e) {
            Log::error('Get institution programs error', [
                'instCode' => $instCode,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => true,
                'message' => 'Unable to load programs for this institution.',
            ], 500);
        }
    }

    /**
     * ✅ Extract actual status from API record
     * The portal's Status column shows the REAL status, not the program_status field
     */
    protected function extractStatus(array $record): string
    {
        // Priority 1: Check "Status" field (this is what the portal displays)
        $status = trim((string) ($record['Status'] ?? ''));
        if ($status !== '') {
            return $status;
        }

        // Priority 2: Check "status" field (lowercase variant)
        $status = trim((string) ($record['status'] ?? ''));
        if ($status !== '') {
            return $status;
        }

        // Priority 3: Check "remarks" or "Remarks" fields
        $remarks = trim((string) ($record['remarks'] ?? $record['Remarks'] ?? ''));
        if ($remarks !== '' && strtolower($remarks) !== 'active') {
            return $remarks;
        }

        // Priority 4: Check special permit indicators
        $permit4th = trim((string) ($record['permit_4thyr'] ?? ''));
        $specialPermit = trim((string) ($record['special_permit'] ?? ''));

        if (stripos($specialPermit, 'withdrawn') !== false) {
            return 'Withdrawn Application';
        }
        if (stripos($specialPermit, 'disapprove') !== false) {
            return 'Disapproved';
        }
        if (stripos($permit4th, 'voluntary') !== false) {
            return 'Voluntary Phase Out';
        }
        if (stripos($permit4th, 'gradual') !== false) {
            return 'Gradual Phased Out';
        }

        // Priority 5: Check program_status as LAST resort
        $programStatus = trim((string) ($record['program_status'] ?? ''));
        if ($programStatus !== '' && strtolower($programStatus) !== 'active') {
            return $programStatus;
        }

        // Default: Active if has permit, Unknown if no permit
        return $permit4th !== '' ? 'Active' : 'Unknown';
    }

    /**
     * GET /api/program/{programId}
     *
     * Get full program details with graduates list.
     */
    public function getProgram(Request $request, $programId, PortalService $portal)
    {
        try {
            $program = Program::with('institution')->findOrFail($programId);

            $type = strtolower(trim($program->institution->type ?? ''));
            $isPublic = in_array($type, ['sucs', 'lucs', 'suc', 'luc', 'state', 'public']);

            $hasPermitNumber = ! empty($program->permit_number);

            // ✅ Fetch actual filename from portal API for correct PDF URL
            $permitPdfUrl = null;
            if ($hasPermitNumber && $program->institution) {
                $instCode = $program->institution->institution_code;
                $portalRecords = $portal->fetchProgramRecords($instCode);

                // Find matching program in portal records
                $matchingRecord = collect($portalRecords)->first(function ($r) use ($program) {
                    $portalProgramName = strtoupper(trim((string) ($r['programName'] ?? '')));
                    $portalMajorName = strtoupper(trim((string) ($r['majorName'] ?? '')));
                    $localProgramName = strtoupper(trim((string) $program->program_name));
                    $localMajorName = strtoupper(trim((string) ($program->major ?? '')));

                    return $portalProgramName === $localProgramName && $portalMajorName === $localMajorName;
                });

                // Use filename from portal if found, otherwise fallback to permit_number
                if ($matchingRecord && ! empty($matchingRecord['filename'])) {
                    $permitPdfUrl = $portal->buildPermitUrl($matchingRecord['filename']);
                } elseif ($hasPermitNumber) {
                    // Fallback: try using permit_number (might work for some portals)
                    $permitPdfUrl = $portal->buildPermitUrl($program->permit_number);
                }
            }

            // Public endpoint: expose only the count, never personal data of graduates.
            $graduatesCount = Graduate::where('program_id', $programId)->count();

            return response()->json([
                'program' => [
                    'id' => $program->id,
                    'name' => $program->program_name,
                    'major' => $program->major,
                    'copNumber' => ($isPublic && $hasPermitNumber) ? $program->permit_number : null,
                    'grNumber' => (! $isPublic && $hasPermitNumber) ? $program->permit_number : null,
                    'program_type' => $program->program_type,
                    'permitPdfUrl' => $permitPdfUrl,
                    'institution' => [
                        'code' => $program->institution->institution_code,
                        'name' => $program->institution->name,
                        'type' => $isPublic ? 'public' : 'private',
                    ],
                    'graduates' => [],
                    'graduates_count' => $graduatesCount,
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Get program error', [
                'programId' => $programId,
                'message' => $e->getMessage(),
            ]);

            return response()->json([
                'error' => true,
                'message' => 'An unexpected error occurred while loading the program.',
            ], 500);
        }
    }

    /**
     * POST /api/search-student
     *
     * Placeholder: Add your student search logic here if needed.
     */
    public function searchStudent(Request $request)
    {
        try {
            return response()->json([
                'students' => [],
                'message' => 'Student search not yet implemented',
            ]);
        } catch (\Throwable $e) {
            Log::error('Search student error', ['message' => $e->getMessage()]);

            return response()->json(['error' => true, 'message' => 'Error searching students.'], 500);
        }
    }
}
