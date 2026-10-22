<?php

namespace App\Http\Controllers;

use App\Models\Graduate;
use App\Services\GraduateData;
use App\Services\PortalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class InstitutionController extends Controller
{
    public function index(PortalService $portal)
    {
        $error = null;
        try {
            $hei = $portal->fetchAllHEI();
        } catch (\Throwable $e) {
            report($e);
            $hei = [];
            $error = 'Unable to fetch institutions right now.';
        }

        $institutions = collect($hei)->values()->map(function ($row, $i) {
            $province = trim((string) ($row['province'] ?? ''));
            $normalizedProvince = strtoupper($province);
            $region = in_array($normalizedProvince, ['MAGUINDANAO', 'LANAO DEL SUR'], true)
                ? 'BARMM'
                : 'REGION XII';

            return [
                'id' => $i + 1,
                'institution_code' => $row['instCode'],
                'name' => $row['instName'],
                'province' => $province ?: null,
                'region' => $region,
                'x_coordinate' => $row['xCoordinate'] ?? null,
                'y_coordinate' => $row['yCoordinate'] ?? null,
                'ownership_sector' => $row['ownershipSector'] ?? null,
                'ownership_type' => $row['ownershipHei_type'] ?? null,
                'programs' => [],
            ];
        });

        return Inertia::render('institution/index', [
            'institutions' => $institutions,
            'error' => $error,
        ]);
    }

    public function programs(string $instCode, PortalService $portal): JsonResponse
    {
        $v = Validator::make(
            ['instCode' => $instCode],
            ['instCode' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9\-]+$/']]
        );

        if ($v->fails()) {
            return response()->json(['data' => []], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        try {
            $records = $portal->fetchProgramRecords($instCode);

            $programs = collect($records)
                ->map(function ($r, $i) use ($portal) {
                    // Extract filename to build the secure PDF URL
                    $filename = trim((string) ($r['filename'] ?? ''));

                    return [
                        'id' => $i + 1,
                        'program_name' => trim((string) ($r['programName'] ?? '')),
                        'major' => trim((string) ($r['majorName'] ?? '')) ?: null,
                        'program_type' => null, // You might want to map this if available in $r
                        'permit_number' => trim((string) ($r['permit_4thyr'] ?? '')) ?: null,
                        // Generate the proxy URL for the PDF
                        'permitPdfUrl' => $portal->buildPermitUrl($filename) ?? null,
                    ];
                })
                ->filter(fn ($p) => $p['program_name'] !== '')
                ->unique(fn ($p) => $p['program_name'].'|'.($p['major'] ?? ''))
                ->values()
                ->all();

            return response()->json(['data' => $programs], Response::HTTP_OK);
        } catch (\Throwable $e) {
            Log::error('Failed to fetch programs: '.$e->getMessage());

            return response()->json(['data' => []], Response::HTTP_SERVICE_UNAVAILABLE);
        }
    }

    /**
     * Fetch graduates for a specific program modal
     */
    public function programGraduates(Request $request, string $instCode): JsonResponse
    {
        $validated = $request->validate([
            'program_name' => ['required', 'string', 'max:1000'],
            'major' => ['nullable', 'string', 'max:1000'],
            'year' => ['nullable', 'integer', 'between:1900,2200'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);
        $query = Graduate::where('hei_uii', $instCode)
            ->where('program_key', GraduateData::nameKey($validated['program_name']))
            ->where('major_key', GraduateData::nameKey($validated['major'] ?? null));
        $years = (clone $query)->whereNotNull('graduation_year')->distinct()->orderByDesc('graduation_year')->pluck('graduation_year');
        if (! empty($validated['year'])) {
            $query->where('graduation_year', $validated['year']);
        }
        $page = min((int) ($validated['page'] ?? 1), max(1, (int) ceil((clone $query)->count() / 25)));
        $graduates = $query->orderBy('last_name')->orderBy('first_name')->orderBy('id')
            ->paginate(25, ['id', 'first_name', 'last_name', 'middle_name', 'so_number', 'date_graduated'], 'page', $page)
            ->through(fn ($grad) => [
                'id' => $grad->id, 'first_name' => $grad->first_name, 'last_name' => $grad->last_name,
                'middle_name' => $grad->middle_name, 'so_number' => $grad->so_number, 'year_graduated' => $grad->date_graduated,
            ]);

        return response()->json(array_merge($graduates->toArray(), ['years' => $years]));
    }
}
