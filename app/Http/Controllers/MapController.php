<?php

namespace App\Http\Controllers;

use App\Services\PortalService;
use Illuminate\Http\JsonResponse;

class MapController extends Controller
{
    public function heiMap(PortalService $portal): JsonResponse
    {
        $rows = $portal->fetchAllHEI();

        $heis = collect($rows)
            ->map(function ($item) {
                // NOTE: your sample:
                // xCoordinate: "6.0666"   (latitude-ish)
                // yCoordinate: "125.1267" (longitude-ish)
                $lat = isset($item['xCoordinate']) ? (float) $item['xCoordinate'] : null;
                $lng = isset($item['yCoordinate']) ? (float) $item['yCoordinate'] : null;

                return [
                    'instCode' => $item['instCode'] ?? null,
                    'instName' => $item['instName'] ?? null,
                    'province' => $item['province'] ?? null,
                    'municipalityCity' => $item['municipalityCity'] ?? null,
                    'status' => $item['status'] ?? null,
                    'ownershipSector' => $item['ownershipSector'] ?? null,
                    'ownershipHeiType' => $item['ownershipHei_type'] ?? null,
                    'lat' => $lat,
                    'lng' => $lng,
                ];
            })
            ->filter(fn ($h) => $h['lat'] !== null && $h['lng'] !== null)
            ->values()
            ->all();

        return response()->json([
            'heis' => $heis,
        ]);
    }
}
