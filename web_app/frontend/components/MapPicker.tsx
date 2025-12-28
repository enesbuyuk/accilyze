'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons missing in Leaflet with Next.js/Webpack
const iconRetinaUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png';
const iconUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png';
const shadowUrl = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapPickerProps {
    onLocationSelect: (data: any) => void;
    setLoading?: (loading: boolean) => void;
}

function LocationMarker({ onLocationSelect, setLoading }: MapPickerProps) {
    const [position, setPosition] = useState<L.LatLng | null>(null);

    const map = useMapEvents({
        click(e) {
            setPosition(e.latlng);
            fetchRoadData(e.latlng.lat, e.latlng.lng);
        },
    });

    const fetchRoadData = async (lat: number, lon: number) => {
        if (setLoading) setLoading(true);

        // List of Overpass API instances to try
        const servers = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
        ];

        // Overpass API Query
        const query = `
            [out:json][timeout:5];
            way(around:10,${lat},${lon})[highway];
            out geom;
        `;

        // Helper to finish loading
        const finish = () => {
            if (setLoading) setLoading(false);
        };

        for (const server of servers) {
            try {
                const url = `${server}?data=${encodeURIComponent(query)}`;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s client timeout

                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const text = await response.text();
                // Check for error messages specifically returned by Overpass even with 200 OK
                if (text.includes("runtime error") || text.includes("busy")) {
                    throw new Error("Overpass busy");
                }

                const data = JSON.parse(text);

                if (data.elements && data.elements.length > 0) {
                    const way = data.elements[0];
                    processWayData(way, lat, lon);
                    finish();
                    return; // Success, stop trying servers
                } else {
                    // No data found is a valid result, don't try other servers unless we suspect lag
                    console.log("No road data found at this location.");
                    finish();
                    return;
                }
            } catch (error) {
                console.warn(`Failed to fetch from ${server}:`, error);
                // Continue to next server
            }
        }

        console.error("All Overpass API servers failed or timed out.");
        finish();
        alert("Could not fetch road data. Map servers are busy. Please try again or fill manually.");
    };

    const processWayData = (way: any, clickLat: number, clickLon: number) => {
        const tags = way.tags || {};

        // Extract basic fields
        // Extract basic fields
        let speedLimit = 50;
        if (tags.maxspeed) {
            // Handle "50 mph" or "30" or "TR:50"
            const match = tags.maxspeed.match(/(\d+)/);
            if (match) {
                speedLimit = parseInt(match[0]);
                // If mph, convert to km/h (approx) if needed, but assuming input is km/h or generic for now
                if (tags.maxspeed.includes('mph')) speedLimit = Math.round(speedLimit * 1.609);
            } else if (tags.maxspeed === 'walk') {
                speedLimit = 5;
            }
        } else {
            // Fallback defaults based on road type
            switch (tags.highway) {
                case 'motorway': speedLimit = 120; break;
                case 'trunk': speedLimit = 110; break;
                case 'primary': speedLimit = 90; break;
                case 'secondary': speedLimit = 70; break;
                case 'tertiary': speedLimit = 50; break;
                case 'residential': speedLimit = 30; break;
                case 'living_street': speedLimit = 20; break;
                default: speedLimit = 50;
            }
        }

        const lanes = parseInt(tags.lanes) || 2;
        const roadTypeRaw = tags.highway; // 'residential', 'primary', etc.
        const isLit = tags.lit === 'yes';

        // Map road type
        let roadType = 'urban';
        const ruralTypes = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary'];
        if (ruralTypes.includes(roadTypeRaw)) roadType = 'rural';

        // Calculate Curvature
        const curvature = calculateCurvature(way.geometry, clickLat, clickLon);

        // Prepare data object
        const extractedData = {
            speed_limit: speedLimit,
            num_lanes: lanes,
            road_type: roadType,
            lighting: isLit ? 'day' : 'night', // Simple heuristic, user can adjust
            curvature: parseFloat(curvature.toFixed(4)),
        };

        onLocationSelect(extractedData);
    };

    const calculateCurvature = (geometry: { lat: number, lon: number }[], lat: number, lon: number): number => {
        if (!geometry || geometry.length < 3) return 0.0;

        // Find closest point in geometry to the click
        let closestIdx = 0;
        let minDist = Infinity;

        for (let i = 0; i < geometry.length; i++) {
            const d = Math.sqrt(Math.pow(geometry[i].lat - lat, 2) + Math.pow(geometry[i].lon - lon, 2));
            if (d < minDist) {
                minDist = d;
                closestIdx = i;
            }
        }

        // Get 3 points (p1, p2, p3) centered on closestIdx
        // Handle edge cases (start/end of array) by shifting window
        let p1, p2, p3;
        if (closestIdx === 0) {
            p1 = geometry[0]; p2 = geometry[1]; p3 = geometry[2];
        } else if (closestIdx === geometry.length - 1) {
            p1 = geometry[geometry.length - 3]; p2 = geometry[geometry.length - 2]; p3 = geometry[geometry.length - 1];
        } else {
            p1 = geometry[closestIdx - 1]; p2 = geometry[closestIdx]; p3 = geometry[closestIdx + 1];
        }

        // Convert to meters (approx for localized area)
        const latToM = 110574;
        const lonToM = 111320 * Math.cos(lat * (Math.PI / 180));

        const x1 = p1.lon * lonToM; const y1 = p1.lat * latToM;
        const x2 = p2.lon * lonToM; const y2 = p2.lat * latToM;
        const x3 = p3.lon * lonToM; const y3 = p3.lat * latToM;

        // Radius calculation using Menger curvature formula or circumradius
        // Area of triangle
        const area = 0.5 * Math.abs(x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

        // Side lengths
        const len1 = Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2));
        const len2 = Math.sqrt(Math.pow(x2 - x3, 2) + Math.pow(y2 - y3, 2));
        const len3 = Math.sqrt(Math.pow(x3 - x1, 2) + Math.pow(y3 - y1, 2));

        if (area === 0) return 0.0; // Collinear

        const R = (len1 * len2 * len3) / (4 * area);

        // Curvature = 1/R
        // R is in meters. If R=100m, C=0.01. If R=500m (straight-ish), C=0.002.
        // Limits: Max reasonable curvature for calculation purposes ~ 0.2 (R=5m)

        return 1 / R;
    };

    return position === null ? null : (
        <Marker position={position}>
            <Popup>Selected Location</Popup>
        </Marker>
    );
}

export default function MapPicker({ onLocationSelect }: MapPickerProps) {
    const [loading, setLoading] = useState(false);

    // Default center (e.g., Istanbul or specialized location)
    const center = { lat: 41.0082, lng: 28.9784 };

    return (
        <div className="h-full w-full rounded-2xl overflow-hidden border border-white/10 z-0 relative">
            <MapContainer center={center} zoom={13} scrollWheelZoom={true} className="h-full w-full">
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationMarker onLocationSelect={onLocationSelect} setLoading={setLoading} />
            </MapContainer>

            {loading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex flex-col items-center justify-center text-white">
                    <Loader2 className="w-10 h-10 animate-spin text-rose-500 mb-2" />
                    <p className="font-semibold text-rose-100">Analyzing Road...</p>
                </div>
            )}
        </div>
    );
}
