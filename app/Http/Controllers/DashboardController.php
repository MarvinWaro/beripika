<?php

namespace App\Http\Controllers;

use App\Enums\Permission;
use App\Models\Graduate;
use App\Services\DashboardAnalytics;
use App\Services\GraduateLookupLog;
use App\Services\PortalService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index(Request $request, PortalService $portalService, DashboardAnalytics $analytics)
    {
        if (! $request->user()->hasPermission(Permission::VIEW_DASHBOARD)) {
            $fallback = collect([
                'view_institutions' => 'institutions.index',
                'view_programs' => 'programs.index',
                'view_graduates' => 'graduates.index',
                'view_imports' => 'import.index',
                'view_concerns' => 'concerns.index',
                'view_users' => 'users.index',
                'manage_roles' => 'roles.index',
                'view_activity_logs' => 'logs.index',
            ])->first(fn ($route, $permission) => $request->user()->hasPermission($permission));

            return $fallback
                ? redirect()->route($fallback)
                : redirect()->route('profile.edit')->with('error', 'Your account has no access yet. Ask an administrator to assign a role.');
        }

        $filters = $request->validate([
            'year' => ['nullable', 'integer', 'between:1000,9999'],
            'institution' => ['nullable', 'string', 'max:100', Rule::exists('graduates', 'hei_uii')],
        ]);
        $year = isset($filters['year']) ? (int) $filters['year'] : null;
        $institution = $filters['institution'] ?? null;
        $snapshot = $portalService->schoolSnapshot();

        return Inertia::render('dashboard', $analytics->summarize($year, $institution, $snapshot['data']) + [
            'filters' => ['year' => $year, 'institution' => $institution],
            'portal' => [
                'count' => $snapshot['last_fetched_at'] ? count($snapshot['data']) : null,
                'stale' => $snapshot['stale'],
                'lastFetchedAt' => $snapshot['last_fetched_at'],
            ],
        ]);
    }

    /**
     * Search for graduates (AJAX endpoint for dashboard search)
     */
    public function searchGraduates(Request $request, PortalService $portalService, GraduateLookupLog $lookups)
    {
        $query = trim((string) $request->input('q', ''));

        if (strlen($query) < 2) {
            return response()->json([]);
        }

        // Get all institutions from Portal API for name lookup
        $institutions = collect($portalService->fetchAllHEI())
            ->keyBy('instCode');

        $results = Graduate::query()
            ->where(function ($q) use ($query) {
                $q->where('first_name', 'like', "%{$query}%")
                    ->orWhere('last_name', 'like', "%{$query}%")
                    ->orWhere('so_number', 'like', "%{$query}%")
                    ->orWhere('program_name', 'like', "%{$query}%");
            })
            ->limit(10)
            ->get()
            ->map(function ($grad) use ($institutions) {
                $institutionData = $institutions->get($grad->hei_uii);

                return [
                    'id' => $grad->id,
                    'name' => $grad->first_name.' '.$grad->last_name,
                    'so_number' => $grad->so_number,
                    'program' => $grad->program_name,
                    'institution' => $institutionData['instName'] ?? 'Unknown Institution',
                    'year_graduated' => $grad->date_graduated,
                ];
            });

        $lookups->quickSearch($request->user(), $query, $results->count());

        return response()->json($results);
    }

    /**
     * Get full graduate details (AJAX endpoint)
     */
    public function getGraduateDetails(Request $request, int $id, PortalService $portalService, GraduateLookupLog $lookups)
    {
        $graduate = Graduate::with(['program'])
            ->findOrFail($id);
        $lookups->view($request->user(), $graduate);

        // Get all institutions from Portal API for name lookup
        $institutions = collect($portalService->fetchAllHEI())
            ->keyBy('instCode');

        $institutionData = $institutions->get($graduate->hei_uii);

        return response()->json([
            'id' => $graduate->id,
            'first_name' => $graduate->first_name,
            'last_name' => $graduate->last_name,
            'middle_name' => $graduate->middle_name,
            'extension_name' => $graduate->extension_name,
            'full_name' => trim($graduate->first_name.' '.
                               ($graduate->middle_name ? $graduate->middle_name.' ' : '').
                               $graduate->last_name.
                               ($graduate->extension_name ? ' '.$graduate->extension_name : '')),
            'sex' => $graduate->sex,
            'date_of_birth' => $graduate->date_of_birth,
            'so_number' => $graduate->so_number,
            'student_id_number' => $graduate->student_id_number,
            'hei_uii' => $graduate->hei_uii,
            'institution_name' => $institutionData['instName'] ?? 'Unknown Institution',
            'institution_code' => $graduate->hei_uii,
            'institution_sector' => $institutionData['ownershipSector'] ?? null,
            'institution_type' => $institutionData['ownershipHei_type'] ?? null,
            'program_name' => $graduate->program?->program_name ?? $graduate->program_name ?? 'N/A',
            'program_type' => $graduate->program?->program_type,
            'major' => $graduate->major ?? $graduate->program?->major,
            'date_graduated' => $graduate->date_graduated,
            'academic_year' => $graduate->academic_year,
            'created_at' => $graduate->created_at?->format('Y-m-d H:i:s'),
            'updated_at' => $graduate->updated_at?->format('Y-m-d H:i:s'),
        ]);
    }
}
