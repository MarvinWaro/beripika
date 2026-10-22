// resources/js/components/welcome/leaflet.tsx

import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';

export interface HeiLocation {
    instCode: string;
    instName: string;
    latitude: number;
    longitude: number;
    ownershipSector?: string | null;
    ownershipHei_type?: string | null;
    province?: string | null;
    municipalityCity?: string | null;
}

interface WelcomeLeafletProps {
    center: { lat: number; lng: number } | null;
    zoom: number;
    heis: HeiLocation[];
    isLoading?: boolean;
    error?: string | null;
    onHeiClick?: (instCode: string) => void;
    focusLocation?: { lat: number; lng: number } | null;
    fitLocations?: { lat: number; lng: number }[] | null;
}

/**
 * Inner component that uses useMap() to fly/fit the map view.
 * - Single location: flies to it at zoom 14
 * - Multiple locations: fits bounds to show all of them
 * Must be rendered inside <MapContainer>.
 */
function MapFocusHandler({
    location,
    fitLocations,
}: {
    location: { lat: number; lng: number } | null;
    fitLocations: { lat: number; lng: number }[] | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (fitLocations && fitLocations.length > 1) {
            const bounds = L.latLngBounds(fitLocations.map((loc) => [loc.lat, loc.lng]));
            map.flyToBounds(bounds, { padding: [50, 50], duration: 1.5, maxZoom: 13 });
        } else if (location) {
            map.flyTo([location.lat, location.lng], 14, { duration: 1.5 });
        }
    }, [location, fitLocations, map]);

    return null;
}

/**
 * CHED Regional Office XII coordinates (Koronadal area)
 * x = latitude, y = longitude based on your previous mapping
 */
const CHED_OFFICE = {
    lat: 6.4522717,
    lng: 124.8781319,
};

/**
 * Province config so colors + legend come from one place.
 */
const PROVINCE_CONFIG = {
    cotabato: {
        label: 'Cotabato',
        legendColorClass: 'bg-emerald-500',
        pinClass: 'hei-pin-cotabato',
    },
    sultan_kudarat: {
        label: 'Sultan Kudarat',
        legendColorClass: 'bg-purple-500',
        pinClass: 'hei-pin-sultan-kudarat',
    },
    south_cotabato: {
        label: 'South Cotabato',
        legendColorClass: 'bg-blue-800',
        pinClass: 'hei-pin-south-cotabato',
    },
    sarangani: {
        label: 'Sarangani',
        legendColorClass: 'bg-red-500',
        pinClass: 'hei-pin-sarangani',
    },
    others: {
        label: 'Other provinces / cities',
        legendColorClass: 'bg-gray-400',
        pinClass: 'hei-pin-others',
    },
} as const;

type ProvinceKey = keyof typeof PROVINCE_CONFIG;

/**
 * Decide which province a HEI belongs to based on `province`
 * and sometimes `municipalityCity`. This only affects marker color.
 */
function getProvinceKey(hei: HeiLocation): ProvinceKey {
    const p = (hei.province ?? '').toUpperCase().trim();
    const city = (hei.municipalityCity ?? '').toUpperCase().trim();

    // Cotabato / North Cotabato
    if (p.includes('COTABATO') && !p.includes('SOUTH')) {
        return 'cotabato';
    }

    // South Cotabato (treat General Santos as South Cotabato color)
    if (p.includes('SOUTH COTABATO') || city.includes('GENERAL SANTOS')) {
        return 'south_cotabato';
    }

    // Sultan Kudarat
    if (p.includes('SULTAN KUDARAT')) {
        return 'sultan_kudarat';
    }

    // Sarangani
    if (p.includes('SARANGANI')) {
        return 'sarangani';
    }

    return 'others';
}

/**
 * Haversine distance in kilometers between two lat/lng points.
 */
function computeDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const R = 6371; // Earth radius in km
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export default function WelcomeLeaflet({
    center,
    zoom,
    heis,
    isLoading = false,
    error,
    onHeiClick,
    focusLocation = null,
    fitLocations = null,
}: WelcomeLeafletProps) {
    const mapCenter = useMemo(
        () => [center?.lat ?? 6.5, center?.lng ?? 124.5] as [number, number],
        [center],
    );

    const mapZoom = zoom || 8;

    // Build Leaflet divIcons once, one per province
    const provinceIcons = useMemo(() => {
        const createIcon = (key: ProvinceKey) =>
            L.divIcon({
                className: 'hei-marker', // base class for positioning
                html: `<div class="hei-pin ${PROVINCE_CONFIG[key].pinClass}"></div>`,
                iconSize: [22, 30],
                iconAnchor: [11, 30],
                popupAnchor: [0, -28],
            });

        return {
            cotabato: createIcon('cotabato'),
            sultan_kudarat: createIcon('sultan_kudarat'),
            south_cotabato: createIcon('south_cotabato'),
            sarangani: createIcon('sarangani'),
            others: createIcon('others'),
        };
    }, []);

    // Separate icon for CHED office
    const chedIcon = useMemo(
        () =>
            L.divIcon({
                className: 'hei-marker',
                html: '<div class="hei-pin hei-pin-ched"></div>',
                iconSize: [22, 30],
                iconAnchor: [11, 30],
                popupAnchor: [0, -28],
            }),
        [],
    );

    // Legend show/hide state
    const [legendVisible, setLegendVisible] = useState(true);

    return (
        <Card className="gap-0 rounded-none border-0 bg-transparent p-0 py-0 shadow-none">
            <CardContent className="p-0">
                {/* Stacking context */}
                <div className="relative h-[380px] overflow-hidden sm:h-[460px] lg:h-[560px]">
                    {/* Map at z-0 */}
                    <MapContainer
                        {...({
                            center: mapCenter,
                            zoom: mapZoom,
                            scrollWheelZoom: true,
                        } as any)}
                        className="z-0 h-full w-full"
                        style={{ zIndex: 0 }}
                    >
                        <TileLayer
                            {...({
                                attribution:
                                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                            } as any)}
                        />

                        <MapFocusHandler location={focusLocation} fitLocations={fitLocations} />

                        {/* CHED Regional Office marker */}
                        <Marker
                            position={[CHED_OFFICE.lat, CHED_OFFICE.lng]}
                            icon={chedIcon}
                        >
                            <Popup>
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold">
                                        CHED Regional Office XII
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        Reference point for distance to HEIs.
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Lat: {CHED_OFFICE.lat.toFixed(5)}, Lng:{' '}
                                        {CHED_OFFICE.lng.toFixed(5)}
                                    </p>
                                </div>
                            </Popup>
                        </Marker>

                        {/* HEI markers */}
                        {heis.map((hei, heiIndex) => {
                            const provinceKey = getProvinceKey(hei);
                            const icon = provinceIcons[provinceKey];

                            const distanceKm = computeDistanceKm(
                                CHED_OFFICE.lat,
                                CHED_OFFICE.lng,
                                hei.latitude,
                                hei.longitude,
                            );

                            return (
                                <Marker
                                    key={`${hei.instCode}-${heiIndex}`}
                                    position={[hei.latitude, hei.longitude]}
                                    icon={icon}
                                    eventHandlers={
                                        onHeiClick
                                            ? {
                                                  click: () =>
                                                      onHeiClick(hei.instCode),
                                              }
                                            : undefined
                                    }
                                >
                                    <Popup>
                                        <div className="space-y-1">
                                            <p className="text-sm font-semibold">
                                                {hei.instName}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                                Code:{' '}
                                                <span className="font-mono">
                                                    {hei.instCode}
                                                </span>
                                            </p>
                                            {hei.municipalityCity && (
                                                <p className="text-xs text-gray-600">
                                                    {hei.municipalityCity}
                                                    {hei.province
                                                        ? `, ${hei.province}`
                                                        : ''}
                                                </p>
                                            )}
                                            {/* Distance from CHED XII office */}
                                            {Number.isFinite(distanceKm) && (
                                                <p className="text-xs text-gray-600">
                                                    Distance from CHED XII RO:{' '}
                                                    <span className="font-semibold">
                                                        {distanceKm.toFixed(1)}{' '}
                                                        km
                                                    </span>
                                                </p>
                                            )}
                                            {hei.ownershipSector && (
                                                <p className="text-xs text-gray-600">
                                                    Sector:{' '}
                                                    {hei.ownershipSector}
                                                    {hei.ownershipHei_type
                                                        ? ` (${hei.ownershipHei_type})`
                                                        : ''}
                                                </p>
                                            )}

                                            {onHeiClick && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onHeiClick(
                                                            hei.instCode,
                                                        );
                                                    }}
                                                    className="mt-2 inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                                                >
                                                    Search this HEI
                                                </button>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MapContainer>

                    {/* subtle grid overlay (z-10) */}
                    <div className="pointer-events-none absolute inset-0 z-10 [background-image:radial-gradient(circle_at_1px_1px,#00000011_1px,transparent_0)] [background-size:22px_22px] opacity-20 dark:opacity-15" />

                    {/* Legend + toggle (z-20), bottom-left */}
                    <div className="absolute bottom-4 left-4 z-20 space-y-2">
                        {legendVisible && (
                            <div className="pointer-events-auto w-60 rounded-(--radius-card) bg-white/95 p-4 text-[11px] shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/95 dark:ring-white/10">
                                <div className="mb-2 flex items-center justify-between">
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                                        Legend (by Province)
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setLegendVisible(false)}
                                        className="text-[10px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                    >
                                        Hide
                                    </button>
                                </div>

                                <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                                    {(
                                        [
                                            'cotabato',
                                            'sultan_kudarat',
                                            'south_cotabato',
                                            'sarangani',
                                        ] as ProvinceKey[]
                                    ).map((key) => {
                                        const cfg = PROVINCE_CONFIG[key];
                                        return (
                                            <li
                                                key={key}
                                                className="flex items-center gap-2"
                                            >
                                                <span
                                                    className={`inline-block h-2 w-2 rounded-full ${cfg.legendColorClass}`}
                                                />
                                                <span>{cfg.label}</span>
                                            </li>
                                        );
                                    })}

                                    {/* CHED Regional Office XII entry */}
                                    <li className="flex items-center gap-2">
                                        <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                                        <span>CHED Regional Office XII</span>
                                    </li>
                                </ul>

                                <p className="mt-2 text-[10px] text-gray-500 dark:text-gray-500">
                                    Click a marker to view HEI details, permits,
                                    and distance from the CHED XII Regional
                                    Office.
                                </p>
                            </div>
                        )}

                        {!legendVisible && (
                            <button
                                type="button"
                                onClick={() => setLegendVisible(true)}
                                className="pointer-events-auto inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-gray-700 shadow-md hover:bg-white dark:bg-gray-900/90 dark:text-gray-200"
                            >
                                Show legend
                            </button>
                        )}
                    </div>

                    {/* Status badges (z-30) */}
                    {isLoading && (
                        <div className="pointer-events-none absolute top-4 right-4 z-30 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-gray-700 shadow dark:bg-gray-900/90 dark:text-gray-200">
                            Loading HEI locations…
                        </div>
                    )}

                    {error && (
                        <div className="pointer-events-auto absolute top-4 left-1/2 z-30 w-[260px] -translate-x-1/2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 shadow dark:bg-red-900/80 dark:text-red-200">
                            {error}
                        </div>
                    )}

                    {/* Empty-state message */}
                    {!isLoading && !error && heis.length === 0 && (
                        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 text-center">
                            <div className="rounded-full bg-white/90 p-4 shadow-md dark:bg-gray-900/80">
                                <MapPin className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    HEI Map
                                </p>
                                <p className="max-w-xs text-xs text-gray-600 dark:text-gray-400">
                                    No HEI coordinates available yet. Once the
                                    API returns locations, markers will appear
                                    here.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
