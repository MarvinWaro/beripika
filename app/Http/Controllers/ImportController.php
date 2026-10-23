<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Graduate;
use App\Models\GraduateImport;
use App\Models\Institution;
use App\Models\Program;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ImportController extends Controller
{
    public function index()
    {
        Gate::authorize('viewImports');

        return Inertia::render('import/index');
    }

    /**
     * Import institutions & programs
     */
    public function importInstitutions(Request $request)
    {
        Gate::authorize('importInstitutions');

        $request->validate([
            'file' => 'required|mimes:xlsx,xls|max:10240',
        ]);

        try {
            DB::beginTransaction();

            $file = $request->file('file');
            $spreadsheet = IOFactory::load($file->getPathname());
            $worksheet = $spreadsheet->getActiveSheet();
            $rows = $worksheet->toArray();

            // Skip header row
            array_shift($rows);

            $importedInstitutions = 0;
            $importedPrograms = 0;
            $institutionCache = [];

            foreach ($rows as $row) {
                // Skip empty rows
                if (empty($row[0])) {
                    continue;
                }

                $institutionCode = $row[0]; // Column A: Institution Code
                $heiName = $row[1]; // Column B: HEI
                $programName = $row[2]; // Column C: Programs
                $programType = ! empty($row[3]) ? $row[3] : null; // Column D: Program Type
                $major = ! empty($row[4]) ? $row[4] : null; // Column E: Major
                $permitNumber = $row[5]; // Column F: Permit Number
                $type = $row[6]; // Column G: Type (Private/SUCs/LUCs)

                // Cache per institution code
                if (! isset($institutionCache[$institutionCode])) {
                    $institution = Institution::firstOrCreate(
                        ['institution_code' => $institutionCode],
                        [
                            'name' => $heiName,
                            'type' => $type,
                        ]
                    );

                    if ($institution->wasRecentlyCreated) {
                        $importedInstitutions++;
                    }

                    $institutionCache[$institutionCode] = $institution;
                } else {
                    /** @var Institution $institution */
                    $institution = $institutionCache[$institutionCode];
                }

                // Re-importing the same workbook updates rows instead of duplicating them.
                Program::updateOrCreate(
                    [
                        'institution_id' => $institution->id,
                        'program_name' => trim((string) $programName),
                        'major' => $major ? trim((string) $major) : null,
                    ],
                    [
                        'program_type' => $programType,
                        'permit_number' => trim((string) $permitNumber) ?: null,
                    ],
                );

                $importedPrograms++;
            }

            DB::commit();

            // Log who imported
            ActivityLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'institutions_import',
                'subject_type' => Institution::class,
                'subject_id' => null,
                'summary' => "Imported {$importedInstitutions} institutions and {$importedPrograms} programs from {$file->getClientOriginalName()}",
                'properties' => [
                    'file' => $file->getClientOriginalName(),
                    'institutions' => $importedInstitutions,
                    'programs' => $importedPrograms,
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => "Import successful! Imported {$importedInstitutions} institutions and {$importedPrograms} programs.",
                'data' => [
                    'institutions' => $importedInstitutions,
                    'programs' => $importedPrograms,
                ],
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Import institutions error: '.$e->getMessage());
            Log::error($e->getTraceAsString());

            return response()->json([
                'success' => false,
                'message' => 'Import failed: '.$e->getMessage(),
            ], 500);
        }
    }

    public function clearInstitutions(Request $request)
    {
        Gate::authorize('clearData');

        try {
            // Check if there are any records to clear
            $programCount = Program::count();
            $institutionCount = Institution::count();

            if ($institutionCount === 0 && $programCount === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No institutions or programs found in the database.',
                    'isEmpty' => true,
                ], 200);
            }

            // Clear programs first (foreign key constraint), then institutions
            Program::query()->delete();
            Institution::query()->delete();

            // Log the action
            ActivityLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'institutions_clear',
                'subject_type' => Institution::class,
                'subject_id' => null,
                'summary' => "Cleared {$institutionCount} institutions and {$programCount} programs",
                'properties' => [
                    'institutions' => $institutionCount,
                    'programs' => $programCount,
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => "Successfully cleared {$institutionCount} institution(s) and {$programCount} program(s).",
            ]);
        } catch (\Exception $e) {
            Log::error('Clear institutions error: '.$e->getMessage());
            Log::error($e->getTraceAsString());

            return response()->json([
                'success' => false,
                'message' => 'Failed to clear data: '.$e->getMessage(),
            ], 500);
        }
    }

    public function clearGraduates(Request $request)
    {
        Gate::authorize('clearData');

        return Cache::lock('graduates:mutation', 60)->block(3, fn () => $this->clearGraduateRecords($request));
    }

    private function clearGraduateRecords(Request $request)
    {
        abort_if(GraduateImport::where('active_slot', 1)->exists(), 409, 'Cannot clear students while a graduate import is active.');

        try {
            // Check if there are any graduates to clear
            $graduateCount = Graduate::count();

            if ($graduateCount === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'No graduates found in the database.',
                    'isEmpty' => true,
                ], 200);
            }

            // Clear graduates using delete() instead of truncate()
            Graduate::query()->delete();

            // Log the action
            ActivityLog::create([
                'user_id' => $request->user()?->id,
                'action' => 'graduates_clear',
                'subject_type' => Graduate::class,
                'subject_id' => null,
                'summary' => "Cleared {$graduateCount} graduate records",
                'properties' => [
                    'count' => $graduateCount,
                ],
            ]);

            return response()->json([
                'success' => true,
                'message' => "Successfully cleared {$graduateCount} graduate record(s) from the database.",
            ]);
        } catch (\Exception $e) {
            Log::error('Clear graduates error: '.$e->getMessage());
            Log::error($e->getTraceAsString());

            return response()->json([
                'success' => false,
                'message' => 'Failed to clear data: '.$e->getMessage(),
            ], 500);
        }
    }
}
