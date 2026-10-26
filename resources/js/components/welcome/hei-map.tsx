// resources/js/components/welcome/hei-map.tsx
//
// Interactive HEI map (MapLibre GL + OpenFreeMap vector tiles).
// - Light / dark basemap follows the app theme (or the user's pick)
// - Optional 3D terrain + hillshade (AWS Open Terrain Tiles, no API key)
// - Clustered markers coloured by province, CHED Regional Office pin
// Free services: https://openfreemap.org  ·  https://registry.opendata.aws/terrain-tiles/

import type { FeatureCollection, Point } from 'geojson';
import { setWorkerUrl } from 'maplibre-gl';
import type { GeoJSONSource, LngLatBoundsLike } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Mountain } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import MapGL, {
    FullscreenControl,
    Layer,
    Marker,
    NavigationControl,
    Popup,
    ScaleControl,
    Source,
} from 'react-map-gl/maplibre';
import type {
    LayerProps,
    MapLayerMouseEvent,
    MapRef,
} from 'react-map-gl/maplibre';
import { cn } from '@/lib/utils';

setWorkerUrl(workerUrl);

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

interface HeiMapProps {
    center: { lat: number; lng: number } | null;
    zoom: number;
    heis: HeiLocation[];
    isLoading?: boolean;
    error?: string | null;
    onHeiClick?: (instCode: string) => void;
    focusLocation?: { lat: number; lng: number } | null;
    fitLocations?: { lat: number; lng: number }[] | null;
}

/** CHED Regional Office XII (Koronadal) — reference point for distances. */
const CHED_OFFICE = { lat: 6.4522717, lng: 124.8781319 };

const BASEMAPS = {
    streets: {
        label: 'Streets',
        url: 'https://tiles.openfreemap.org/styles/liberty',
    },
    light: {
        label: 'Light',
        url: 'https://tiles.openfreemap.org/styles/positron',
    },
    dark: { label: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark' },
} as const;
type BasemapKey = keyof typeof BASEMAPS;

const TERRAIN_TILES =
    'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

const PROVINCE_CONFIG = {
    cotabato: { label: 'Cotabato', color: '#22c55e' },
    sultan_kudarat: { label: 'Sultan Kudarat', color: '#a855f7' },
    south_cotabato: { label: 'South Cotabato', color: '#1e40af' },
    sarangani: { label: 'Sarangani', color: '#ef4444' },
    others: { label: 'Other provinces / cities', color: '#9ca3af' },
} as const;
type ProvinceKey = keyof typeof PROVINCE_CONFIG;

/** Province decides only the marker colour. General Santos counts as South Cotabato. */
function getProvinceKey(hei: HeiLocation): ProvinceKey {
    const p = (hei.province ?? '').toUpperCase().trim();
    const city = (hei.municipalityCity ?? '').toUpperCase().trim();

    if (p.includes('COTABATO') && !p.includes('SOUTH')) return 'cotabato';
    if (p.includes('SOUTH COTABATO') || city.includes('GENERAL SANTOS'))
        return 'south_cotabato';
    if (p.includes('SULTAN KUDARAT')) return 'sultan_kudarat';
    if (p.includes('SARANGANI')) return 'sarangani';

    return 'others';
}

/** Haversine distance in kilometres. */
function computeDistanceKm(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Tracks the `dark` class on <html> so the basemap follows the theme toggle. */
function useIsDark(): boolean {
    const [dark, setDark] = useState(
        () =>
            typeof document !== 'undefined' &&
            document.documentElement.classList.contains('dark'),
    );

    useEffect(() => {
        const el = document.documentElement;
        const observer = new MutationObserver(() =>
            setDark(el.classList.contains('dark')),
        );
        observer.observe(el, { attributes: true, attributeFilter: ['class'] });

        return () => observer.disconnect();
    }, []);

    return dark;
}

const clusterLayer: LayerProps = {
    id: 'hei-clusters',
    type: 'circle',
    source: 'heis',
    filter: ['has', 'point_count'],
    paint: {
        'circle-color': '#0f62fe',
        'circle-opacity': 0.9,
        'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 25, 26],
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff',
    },
};

const clusterCountLayer: LayerProps = {
    id: 'hei-cluster-count',
    type: 'symbol',
    source: 'heis',
    filter: ['has', 'point_count'],
    layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Noto Sans Bold'],
        'text-size': 13,
        'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
};

const pointLayer: LayerProps = {
    id: 'hei-points',
    type: 'circle',
    source: 'heis',
    filter: ['!', ['has', 'point_count']],
    paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 6, 13, 9],
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
    },
};

const hillshadeLayer: LayerProps = {
    id: 'terrain-hillshade',
    type: 'hillshade',
    source: 'terrain-dem',
    paint: {
        'hillshade-exaggeration': 0.35,
        'hillshade-shadow-color': '#3d3d3d',
    },
};

export default function HeiMap({
    center,
    zoom,
    heis,
    isLoading = false,
    error,
    onHeiClick,
    focusLocation = null,
    fitLocations = null,
}: HeiMapProps) {
    const mapRef = useRef<MapRef>(null);
    const isDark = useIsDark();
    const [chosenBasemap, setChosenBasemap] = useState<BasemapKey | null>(null);
    const basemap: BasemapKey = chosenBasemap ?? (isDark ? 'dark' : 'streets');
    const [terrain, setTerrain] = useState(false);
    const [legendVisible, setLegendVisible] = useState(true);
    const [selected, setSelected] = useState<number | 'ched' | null>(null);
    const [cursor, setCursor] = useState<string>('');

    const geojson = useMemo<FeatureCollection<Point>>(
        () => ({
            type: 'FeatureCollection',
            features: heis
                .map((hei, index) => ({ hei, index }))
                .filter(
                    ({ hei }) =>
                        Number.isFinite(hei.latitude) &&
                        Number.isFinite(hei.longitude),
                )
                .map(({ hei, index }) => ({
                    type: 'Feature' as const,
                    geometry: {
                        type: 'Point' as const,
                        coordinates: [hei.longitude, hei.latitude],
                    },
                    properties: {
                        index,
                        code: hei.instCode,
                        color: PROVINCE_CONFIG[getProvinceKey(hei)].color,
                    },
                })),
        }),
        [heis],
    );

    // Fly to a single result, or fit several.
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (fitLocations && fitLocations.length > 1) {
            const lngs = fitLocations.map((l) => l.lng);
            const lats = fitLocations.map((l) => l.lat);
            const bounds: LngLatBoundsLike = [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
            ];
            map.fitBounds(bounds, { padding: 60, duration: 1500, maxZoom: 13 });
        } else if (focusLocation) {
            map.flyTo({
                center: [focusLocation.lng, focusLocation.lat],
                zoom: 14,
                duration: 1500,
            });
        }
    }, [focusLocation, fitLocations]);

    // Tilt the camera when terrain is switched on.
    useEffect(() => {
        mapRef.current?.easeTo({ pitch: terrain ? 55 : 0, duration: 800 });
    }, [terrain]);

    const handleClick = async (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        if (!feature) {
            setSelected(null);

            return;
        }

        if (feature.layer.id === 'hei-clusters') {
            const source = mapRef.current?.getSource('heis') as
                | GeoJSONSource
                | undefined;
            const clusterId = feature.properties?.cluster_id as number;
            const nextZoom = await source?.getClusterExpansionZoom(clusterId);
            const [lng, lat] = (feature.geometry as Point).coordinates;
            mapRef.current?.easeTo({
                center: [lng, lat],
                zoom: (nextZoom ?? 10) + 0.5,
                duration: 600,
            });

            return;
        }

        const index = feature.properties?.index as number;
        setSelected(index);
        if (onHeiClick && heis[index]) onHeiClick(heis[index].instCode);
    };

    const selectedHei = typeof selected === 'number' ? heis[selected] : null;
    const distanceKm = selectedHei
        ? computeDistanceKm(
              CHED_OFFICE.lat,
              CHED_OFFICE.lng,
              selectedHei.latitude,
              selectedHei.longitude,
          )
        : null;

    return (
        <div className="relative h-[380px] overflow-hidden sm:h-[460px] lg:h-[560px]">
            <MapGL
                ref={mapRef}
                initialViewState={{
                    longitude: center?.lng ?? 124.5,
                    latitude: center?.lat ?? 6.5,
                    zoom: zoom || 8,
                }}
                mapStyle={BASEMAPS[basemap].url}
                style={{ width: '100%', height: '100%' }}
                interactiveLayerIds={['hei-clusters', 'hei-points']}
                onClick={handleClick}
                onMouseEnter={() => setCursor('pointer')}
                onMouseLeave={() => setCursor('')}
                cursor={cursor}
                terrain={
                    terrain
                        ? { source: 'terrain-dem', exaggeration: 1.4 }
                        : undefined
                }
                maxPitch={70}
                attributionControl={{ compact: true }}
                cooperativeGestures={false}
            >
                <NavigationControl position="top-right" visualizePitch />
                <FullscreenControl position="top-right" />
                <ScaleControl position="bottom-right" unit="metric" />

                <Source
                    id="terrain-dem"
                    type="raster-dem"
                    tiles={[TERRAIN_TILES]}
                    tileSize={256}
                    maxzoom={15}
                    encoding="terrarium"
                    attribution="Terrain: Mapzen / AWS Open Data"
                >
                    {terrain && <Layer {...hillshadeLayer} />}
                </Source>

                <Source
                    id="heis"
                    type="geojson"
                    data={geojson}
                    cluster
                    clusterMaxZoom={12}
                    clusterRadius={45}
                >
                    <Layer {...clusterLayer} />
                    <Layer {...clusterCountLayer} />
                    <Layer {...pointLayer} />
                </Source>

                <Marker
                    longitude={CHED_OFFICE.lng}
                    latitude={CHED_OFFICE.lat}
                    anchor="bottom"
                    onClick={(e) => {
                        e.originalEvent.stopPropagation();
                        setSelected('ched');
                    }}
                >
                    <div
                        className="hei-marker cursor-pointer"
                        title="CHED Regional Office XII"
                    >
                        <div className="hei-pin hei-pin-ched" />
                    </div>
                </Marker>

                {selected === 'ched' && (
                    <Popup
                        longitude={CHED_OFFICE.lng}
                        latitude={CHED_OFFICE.lat}
                        anchor="bottom"
                        offset={30}
                        onClose={() => setSelected(null)}
                        closeOnClick={false}
                    >
                        <div className="space-y-1 pr-4">
                            <p className="text-sm font-semibold">
                                CHED Regional Office XII
                            </p>
                            <p className="text-xs text-gray-600">
                                Reference point for distance to HEIs.
                            </p>
                            <p className="num text-xs text-gray-500">
                                {CHED_OFFICE.lat.toFixed(5)},{' '}
                                {CHED_OFFICE.lng.toFixed(5)}
                            </p>
                        </div>
                    </Popup>
                )}

                {selectedHei && (
                    <Popup
                        longitude={selectedHei.longitude}
                        latitude={selectedHei.latitude}
                        anchor="bottom"
                        offset={12}
                        onClose={() => setSelected(null)}
                        closeOnClick={false}
                        maxWidth="280px"
                    >
                        <div className="space-y-1 pr-4">
                            <p className="text-sm leading-snug font-semibold">
                                {selectedHei.instName}
                            </p>
                            <p className="text-xs text-gray-600">
                                Code:{' '}
                                <span className="num">
                                    {selectedHei.instCode}
                                </span>
                            </p>
                            {selectedHei.municipalityCity && (
                                <p className="text-xs text-gray-600">
                                    {selectedHei.municipalityCity}
                                    {selectedHei.province
                                        ? `, ${selectedHei.province}`
                                        : ''}
                                </p>
                            )}
                            {distanceKm !== null &&
                                Number.isFinite(distanceKm) && (
                                    <p className="text-xs text-gray-600">
                                        Distance from CHED XII RO:{' '}
                                        <span className="font-semibold">
                                            {distanceKm.toFixed(1)} km
                                        </span>
                                    </p>
                                )}
                            {selectedHei.ownershipSector && (
                                <p className="text-xs text-gray-600">
                                    Sector: {selectedHei.ownershipSector}
                                    {selectedHei.ownershipHei_type
                                        ? ` (${selectedHei.ownershipHei_type})`
                                        : ''}
                                </p>
                            )}
                            {onHeiClick && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        onHeiClick(selectedHei.instCode)
                                    }
                                    className="mt-2 inline-flex items-center rounded-(--radius-button) bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                >
                                    Search this HEI
                                </button>
                            )}
                        </div>
                    </Popup>
                )}
            </MapGL>

            {/* Basemap + terrain switcher (top-left) */}
            <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-2">
                <div
                    role="radiogroup"
                    aria-label="Map style"
                    className="flex rounded-(--radius-button) bg-white/95 p-1 text-xs font-medium shadow-md ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/95 dark:ring-white/10"
                >
                    {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
                        <button
                            key={key}
                            type="button"
                            role="radio"
                            aria-checked={basemap === key}
                            onClick={() => setChosenBasemap(key)}
                            className={cn(
                                'rounded-(--radius-button) px-3 py-1.5 transition-colors',
                                basemap === key
                                    ? 'bg-primary text-white'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
                            )}
                        >
                            {BASEMAPS[key].label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    aria-pressed={terrain}
                    onClick={() => setTerrain((on) => !on)}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-(--radius-button) px-3 py-2 text-xs font-medium shadow-md ring-1 ring-black/5 backdrop-blur transition-colors dark:ring-white/10',
                        terrain
                            ? 'bg-primary text-white'
                            : 'bg-white/95 text-gray-700 hover:bg-white dark:bg-gray-900/95 dark:text-gray-200',
                    )}
                >
                    <Mountain className="size-3.5" />
                    3D terrain
                </button>
            </div>

            {/* Legend (bottom-left) */}
            <div className="absolute bottom-4 left-4 z-20">
                {legendVisible ? (
                    <div className="w-60 rounded-(--radius-card) bg-white/95 p-4 text-[11px] shadow-lg ring-1 ring-black/5 backdrop-blur dark:bg-gray-900/95 dark:ring-white/10">
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
                            ).map((key) => (
                                <li
                                    key={key}
                                    className="flex items-center gap-2"
                                >
                                    <span
                                        className="inline-block size-2.5 rounded-full ring-2 ring-white dark:ring-gray-900"
                                        style={{
                                            backgroundColor:
                                                PROVINCE_CONFIG[key].color,
                                        }}
                                    />
                                    <span>{PROVINCE_CONFIG[key].label}</span>
                                </li>
                            ))}
                            <li className="flex items-center gap-2">
                                <span className="inline-block size-2.5 rounded-full bg-amber-500" />
                                <span>CHED Regional Office XII</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <span className="inline-grid size-4 place-items-center rounded-full bg-[#0f62fe] text-[8px] font-bold text-white">
                                    3
                                </span>
                                <span>
                                    Group of nearby HEIs — click to zoom
                                </span>
                            </li>
                        </ul>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setLegendVisible(true)}
                        className="inline-flex items-center rounded-(--radius-button) bg-white/95 px-3 py-1.5 text-[11px] font-medium text-gray-700 shadow-md hover:bg-white dark:bg-gray-900/95 dark:text-gray-200"
                    >
                        Show legend
                    </button>
                )}
            </div>

            {isLoading && (
                <div className="pointer-events-none absolute top-16 right-14 z-30 rounded-(--radius-button) bg-white/95 px-3 py-1 text-xs font-medium text-gray-700 shadow dark:bg-gray-900/95 dark:text-gray-200">
                    Loading HEI locations…
                </div>
            )}

            {error && (
                <div className="absolute top-16 left-1/2 z-30 w-[260px] -translate-x-1/2 rounded-(--radius-card) bg-red-50 px-3 py-2 text-xs text-red-700 shadow dark:bg-red-900/80 dark:text-red-200">
                    {error}
                </div>
            )}

            {!isLoading && !error && heis.length === 0 && (
                <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
                    <div className="rounded-full bg-white/90 p-4 shadow-md dark:bg-gray-900/80">
                        <MapPin className="size-10 text-primary" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            HEI Map
                        </p>
                        <p className="max-w-xs text-xs text-gray-600 dark:text-gray-400">
                            No HEI coordinates available yet. Markers appear
                            once the portal returns locations.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
