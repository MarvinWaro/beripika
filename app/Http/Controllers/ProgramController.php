<?php

namespace App\Http\Controllers;

use App\Services\PortalService;
use App\Services\ProgramPresenter;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProgramController extends Controller
{
    public function index(Request $request, PortalService $portal, ProgramPresenter $presenter)
    {
        $validated = $request->validate(['instCode' => ['nullable', 'string', 'max:32', 'regex:/^[A-Za-z0-9\-]+$/']]);
        $schools = $portal->schoolSnapshot();
        $code = $validated['instCode'] ?? ($schools['data'][0]['instCode'] ?? null);
        $school = collect($schools['data'])->firstWhere('instCode', $code);
        $snapshot = $code ? $portal->programSnapshot($code) : ['data' => [], 'last_fetched_at' => null, 'stale' => false, 'error' => null];

        return Inertia::render('programs/index', [
            'programs' => $presenter->map($snapshot['data'], $code ?? '', $school),
            'hei' => $schools['data'],
            'selectedInstCode' => $code,
            'last_fetched_at' => $snapshot['last_fetched_at'],
            'stale' => $snapshot['stale'],
            'error' => $snapshot['error'],
            'schools_error' => $schools['error'],
        ]);
    }

    public function refresh(Request $request, PortalService $portal, ProgramPresenter $presenter)
    {
        $validated = $request->validate(['instCode' => ['required', 'string', 'max:32', 'regex:/^[A-Za-z0-9\-]+$/']]);
        $code = $validated['instCode'];
        $schools = $portal->schoolSnapshot();
        $school = collect($schools['data'])->firstWhere('instCode', $code);
        if (! $school) {
            return response()->json(['message' => 'Institution could not be verified. Reload the school list and try again.'], 422);
        }
        $snapshot = $portal->programSnapshot($code, true);

        return response()->json([
            'instCode' => $code,
            'programs' => $presenter->map($snapshot['data'], $code, $school),
            'last_fetched_at' => $snapshot['last_fetched_at'],
            'stale' => $snapshot['stale'],
            'error' => $snapshot['error'],
        ], $snapshot['error'] ? 503 : 200);
    }
}
