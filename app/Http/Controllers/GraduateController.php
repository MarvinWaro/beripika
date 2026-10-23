<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\GraduateImport;
use App\Models\ProgramCatalog;
use App\Services\GraduateData;
use App\Services\PortalService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class GraduateController extends Controller
{
    /**
     * List graduates (Inertia page) with:
     *  - server-side search (q)
     *  - pagination (25 per page)
     *  - HEI metadata from CHED portal (via PortalService)
     *  - program type from program_catalogs
     */
    public function index(Request $request, PortalService $portalService)
    {
        $this->authorize('viewAny', Graduate::class);

        $q = trim((string) $request->query('q', ''));

        // Get all HEIs from the Portal once (cached)
        $heiFromPortal = collect($portalService->fetchAllHEI())->keyBy('instCode');
        $catalogTypes = ProgramCatalog::pluck('program_type', 'normalized_name');
        $matchingHeis = $heiFromPortal->filter(fn ($hei) => str_contains(mb_strtolower($hei['instName']), mb_strtolower($q)))->keys()->all();

        $query = Graduate::with(['program.institution', 'institution']);

        if ($q !== '') {
            $query->where(function ($sub) use ($q, $matchingHeis) {
                $sub->where('last_name', 'like', "%{$q}%")
                    ->orWhere('first_name', 'like', "%{$q}%")
                    ->orWhere('middle_name', 'like', "%{$q}%")
                    ->orWhere('so_number', 'like', "%{$q}%")
                    ->orWhere('academic_year', 'like', "%{$q}%")
                    ->orWhere('hei_uii', 'like', "%{$q}%")
                    ->orWhere('graduates.program_name', 'like', "%{$q}%")
                    ->orWhere('graduates.major', 'like', "%{$q}%")
                    ->orWhere('psced_code', 'like', "%{$q}%")
                    ->orWhere('date_graduated', 'like', "%{$q}%")
                    ->orWhereIn('hei_uii', $matchingHeis);
            })
                ->orWhereHas('program', function ($sub) use ($q) {
                    $sub->where('program_name', 'like', "%{$q}%")
                        ->orWhere('major', 'like', "%{$q}%");
                })
                ->orWhereHas('program.institution', function ($sub) use ($q) {
                    $sub->where('name', 'like', "%{$q}%")
                        ->orWhere('institution_code', 'like', "%{$q}%");
                });
        }

        $graduates = $query
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->orderBy('id')
            ->paginate(25)
            ->withQueryString()
            ->through(function (Graduate $graduate) use ($heiFromPortal, $catalogTypes) {
                $portalHei = $graduate->hei_uii
                    ? $heiFromPortal->get($graduate->hei_uii)
                    : null;

                // Institution display data (prefer Portal)
                $institutionCode = $graduate->program?->institution?->institution_code
                    ?? $graduate->institution?->institution_code
                    ?? $graduate->hei_uii
                    ?? 'N/A';

                $institutionName = $portalHei['instName'] ?? (
                    $graduate->program?->institution?->name
                    ?? $graduate->institution?->name
                    ?? 'Unknown Institution'
                );

                $institutionType = $portalHei['instOwnership'] ?? (
                    $graduate->program?->institution?->type
                    ?? $graduate->institution?->type
                    ?? 'Unknown'
                );

                // Base program fields (from relation if present; otherwise from Excel)
                $programName = $graduate->program?->program_name ?? $graduate->program_name;
                $major = $graduate->program?->major ?? $graduate->major;

                // Look up program type from ProgramCatalog using normalized name
                $programType = 'Unknown';
                if ($programName) {
                    $normalized = ProgramCatalog::normalizeName($programName);
                    $programType = $catalogTypes->get($normalized, 'Unknown');
                }

                $programData = [
                    'program_name' => $programName,
                    'major' => $major,
                    'program_type' => $programType,
                    'permit_number' => $graduate->program?->permit_number,
                    'institution' => [
                        'institution_code' => $institutionCode,
                        'name' => $institutionName,
                        'type' => $institutionType,
                    ],
                ];

                return [
                    'id' => $graduate->id,
                    'student_id_number' => $graduate->student_id_number,
                    'date_of_birth' => $graduate->date_of_birth,
                    'last_name' => $graduate->last_name,
                    'first_name' => $graduate->first_name,
                    'middle_name' => $graduate->middle_name,
                    'extension_name' => $graduate->extension_name,
                    'sex' => $graduate->sex,
                    'year_graduated' => $graduate->date_graduated,
                    'academic_year' => $graduate->academic_year,
                    'hei_uii' => $graduate->hei_uii,
                    'program' => $programData,
                    'so_number' => $graduate->so_number,
                ];
            });

        return Inertia::render('graduates/index', [
            'graduates' => $graduates,
            'filters' => [
                'q' => $q !== '' ? $q : null,
            ],
        ]);
    }

    /**
     * Update a graduate (called by the edit dialog).
     * Returns JSON only.
     */
    public function update(Request $request, Graduate $graduate)
    {
        $this->authorize('update', $graduate);
        abort_if(GraduateImport::where('active_slot', 1)->exists(), 409, 'Wait for the active import before editing graduate records.');

        $validated = $request->validate([
            'last_name' => 'required|string|max:255',
            'first_name' => 'required|string|max:255',
            'middle_name' => 'nullable|string|max:255',
            'extension_name' => 'nullable|string|max:255',
            'sex' => 'nullable|in:MALE,FEMALE',
            'date_graduated' => 'nullable|string|max:30',
            'academic_year' => 'nullable|string|max:20',
            'so_number' => 'nullable|string|max:255',
            'program_name' => 'required|string|max:500',
            'major' => 'nullable|string|max:500',
        ]);

        $identity = GraduateData::identity($graduate->hei_uii, $validated['so_number'] ?? null);
        if ($identity && Graduate::where('identity_key', $identity)->where('id', '!=', $graduate->id)->exists()) {
            throw ValidationException::withMessages(['so_number' => 'This institution already has a student with this SO number.']);
        }

        // Snapshot BEFORE for logging
        $before = $graduate->only([
            'last_name',
            'first_name',
            'middle_name',
            'extension_name',
            'sex',
            'date_graduated',
            'academic_year',
            'so_number',
            'program_name',
            'major',
        ]);

        // --- Update main fields ---
        $graduate->last_name = $validated['last_name'];
        $graduate->first_name = $validated['first_name'];
        $graduate->middle_name = $validated['middle_name'] ?? null;
        $graduate->extension_name = $validated['extension_name'] ?? null;
        $graduate->sex = $validated['sex'] ?? null;
        if (! empty($validated['date_graduated'])) {
            try {
                $graduate->date_graduated = GraduateData::date($validated['date_graduated']);
            } catch (\RuntimeException) {
                throw ValidationException::withMessages(['date_graduated' => 'Use a valid date, e.g. 2024-06-15.']);
            }
        }
        $graduate->academic_year = $validated['academic_year'] ?? null;
        $graduate->so_number = $validated['so_number'] ?? null;

        // Excel-backed program fields (for reference / ProgramCatalog matching)
        $graduate->program_name = $validated['program_name'];
        $graduate->major = $validated['major'] ?? null;

        $graduate->save();

        // --- Log the edit ---
        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'graduate_update',
            'subject_type' => Graduate::class,
            'subject_id' => $graduate->id,
            'summary' => sprintf(
                'Updated graduate %s %s (SO: %s)',
                $graduate->first_name,
                $graduate->last_name,
                $graduate->so_number ?? 'N/A'
            ),
            'properties' => [
                'graduate_id' => $graduate->id,
                'so_number' => $graduate->so_number,
                'before' => $before,
                'after' => [
                    'last_name' => $graduate->last_name,
                    'first_name' => $graduate->first_name,
                    'middle_name' => $graduate->middle_name,
                    'extension_name' => $graduate->extension_name,
                    'sex' => $graduate->sex,
                    'date_graduated' => $graduate->date_graduated,
                    'academic_year' => $graduate->academic_year,
                    'so_number' => $graduate->so_number,
                    'program_name' => $graduate->program_name,
                    'major' => $graduate->major,
                ],
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Graduate updated successfully.',
        ]);
    }

    /**
     * Delete a graduate record.
     */
    public function destroy(Request $request, Graduate $graduate)
    {
        $this->authorize('delete', $graduate);
        abort_if(GraduateImport::where('active_slot', 1)->exists(), 409, 'Wait for the active import before deleting graduate records.');

        $id = $graduate->id;
        $soNumber = $graduate->so_number;
        $name = trim($graduate->first_name.' '.$graduate->last_name);

        $graduate->delete();

        ActivityLog::create([
            'user_id' => $request->user()?->id,
            'action' => 'graduate_delete',
            'subject_type' => Graduate::class,
            'subject_id' => $id,
            'summary' => sprintf(
                'Deleted graduate %s (SO: %s)',
                $name !== '' ? $name : "ID {$id}",
                $soNumber ?? 'N/A'
            ),
            'properties' => [
                'graduate_id' => $id,
                'so_number' => $soNumber,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Graduate removed successfully.',
        ]);
    }
}
