import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Ship,
  Plane,
  RefreshCw,
  Filter,
  Layers,
  Info,
  Navigation,
  Anchor,
  ChevronDown,
  ChevronRight,
  MapPin,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { maritimeApi, type Vessel, type Aircraft, type BoundingBox } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

const VESSEL_TYPE_COLORS: Record<string, string> = {
  Cargo: '#3B82F6',
  Tanker: '#8B5CF6',
  Passenger: '#10B981',
  Fishing: '#F59E0B',
  Military: '#EF4444',
  Tug: '#6366F1',
  'Pleasure Craft': '#EC4899',
  'Search and Rescue': '#F97316',
  Unknown: '#6B7280',
};

export function MaritimeDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const vesselMarkersRef = useRef<L.LayerGroup | null>(null);
  const aircraftMarkersRef = useRef<L.LayerGroup | null>(null);
  const imageMarkerRef = useRef<L.Marker | null>(null);

  // Get query params for image context
  const imageId = searchParams.get('imageId');
  const imageName = searchParams.get('imageName');
  const imageLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
  const imageLon = searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null;
  const capturedAt = searchParams.get('capturedAt');

  // Calculate initial bounds based on query params or default
  const getInitialBounds = (): BoundingBox => {
    if (imageLat !== null && imageLon !== null) {
      // Create bounds around the image location (roughly 2 degrees each direction)
      return {
        north: imageLat + 2,
        south: imageLat - 2,
        east: imageLon + 3,
        west: imageLon - 3,
      };
    }
    return {
      north: 52,
      south: 48,
      east: 5,
      west: -5,
    };
  };

  const [bounds, setBounds] = useState<BoundingBox>(getInitialBounds);

  const [showVessels, setShowVessels] = useState(true);
  const [showAircraft, setShowAircraft] = useState(true);
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<Aircraft | null>(null);
  const [vesselFilter, setVesselFilter] = useState<string>('all');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Fetch vessel data
  const {
    data: vesselData,
    isLoading: vesselsLoading,
    refetch: refetchVessels,
  } = useQuery({
    queryKey: ['vessels', bounds],
    queryFn: () => maritimeApi.getVessels(bounds),
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 2, // Auto-refresh every 2 minutes
  });

  // Fetch aircraft data
  const {
    data: aircraftData,
    isLoading: aircraftLoading,
    refetch: refetchAircraft,
  } = useQuery({
    queryKey: ['aircraft', bounds],
    queryFn: () => maritimeApi.getAircraft(bounds),
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 60, // Auto-refresh every minute
  });

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Set initial view based on image location or default
    const initialCenter: [number, number] = imageLat !== null && imageLon !== null
      ? [imageLat, imageLon]
      : [50, 0];
    const initialZoom = imageLat !== null && imageLon !== null ? 8 : 5;

    mapRef.current = L.map(containerRef.current).setView(initialCenter, initialZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapRef.current);

    // Create layer groups
    vesselMarkersRef.current = L.layerGroup().addTo(mapRef.current);
    aircraftMarkersRef.current = L.layerGroup().addTo(mapRef.current);

    // Add marker for image location if provided
    if (imageLat !== null && imageLon !== null) {
      const imageIcon = L.divIcon({
        className: 'image-location-marker',
        html: `<div style="
          width: 24px;
          height: 24px;
          background: #EF4444;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      imageMarkerRef.current = L.marker([imageLat, imageLon], { icon: imageIcon })
        .addTo(mapRef.current)
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold">Image Location</h3>
            <p class="text-sm text-gray-600">${imageName || 'Satellite Image'}</p>
            <div class="text-xs mt-1">
              <div>Lat: ${imageLat.toFixed(4)}</div>
              <div>Lon: ${imageLon.toFixed(4)}</div>
              ${capturedAt ? `<div>Captured: ${new Date(capturedAt).toLocaleDateString()}</div>` : ''}
            </div>
          </div>
        `);
    }

    // Update bounds on map move
    mapRef.current.on('moveend', () => {
      if (!mapRef.current) return;
      const mapBounds = mapRef.current.getBounds();
      setBounds({
        north: mapBounds.getNorth(),
        south: mapBounds.getSouth(),
        east: mapBounds.getEast(),
        west: mapBounds.getWest(),
      });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update vessel markers
  useEffect(() => {
    if (!vesselMarkersRef.current || !vesselData) return;

    vesselMarkersRef.current.clearLayers();

    if (!showVessels) return;

    const filteredVessels =
      vesselFilter === 'all'
        ? vesselData.data
        : vesselData.data.filter((v) => v.type === vesselFilter);

    filteredVessels.forEach((vessel) => {
      const color = VESSEL_TYPE_COLORS[vessel.type] || VESSEL_TYPE_COLORS.Unknown;

      // Create ship icon
      const icon = L.divIcon({
        className: 'vessel-marker',
        html: `<div style="
          width: 12px;
          height: 12px;
          background: ${color};
          border: 2px solid white;
          border-radius: 2px;
          transform: rotate(${vessel.heading || vessel.course}deg);
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });

      const marker = L.marker([vessel.position.lat, vessel.position.lon], { icon });

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold">${vessel.name}</h3>
          <p class="text-sm text-gray-600">${vessel.type}</p>
          <div class="text-xs mt-1">
            <div>MMSI: ${vessel.mmsi}</div>
            <div>Speed: ${vessel.speed} kn</div>
            <div>Course: ${vessel.course}°</div>
            ${vessel.destination ? `<div>Dest: ${vessel.destination}</div>` : ''}
          </div>
        </div>
      `);

      marker.on('click', () => setSelectedVessel(vessel));

      vesselMarkersRef.current?.addLayer(marker);
    });
  }, [vesselData, showVessels, vesselFilter]);

  // Update aircraft markers
  useEffect(() => {
    if (!aircraftMarkersRef.current || !aircraftData) return;

    aircraftMarkersRef.current.clearLayers();

    if (!showAircraft) return;

    aircraftData.data.forEach((aircraft) => {
      // Create plane icon
      const icon = L.divIcon({
        className: 'aircraft-marker',
        html: `<div style="
          width: 16px;
          height: 16px;
          transform: rotate(${aircraft.heading}deg);
        ">
          <svg viewBox="0 0 24 24" fill="#3B82F6" stroke="white" stroke-width="1">
            <path d="M12 2L4 12l8 2 8-2L12 2zM12 14v8"/>
          </svg>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      const marker = L.marker([aircraft.position.lat, aircraft.position.lon], { icon });

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-bold">${aircraft.callsign || aircraft.icao24}</h3>
          <p class="text-sm text-gray-600">${aircraft.originCountry}</p>
          <div class="text-xs mt-1">
            <div>Alt: ${Math.round(aircraft.position.altitude)}m</div>
            <div>Speed: ${Math.round(aircraft.velocity)} m/s</div>
            <div>Heading: ${Math.round(aircraft.heading)}°</div>
            ${aircraft.onGround ? '<div class="text-orange-500">On Ground</div>' : ''}
          </div>
        </div>
      `);

      marker.on('click', () => setSelectedAircraft(aircraft));

      aircraftMarkersRef.current?.addLayer(marker);
    });
  }, [aircraftData, showAircraft]);

  const handleRefresh = () => {
    refetchVessels();
    refetchAircraft();
  };

  const vesselTypes = vesselData
    ? [...new Set(vesselData.data.map((v) => v.type))].sort()
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen">
        {/* Sidebar */}
        <div
          className={`bg-white border-r transition-all duration-300 ${
            sidebarExpanded ? 'w-80' : 'w-12'
          }`}
        >
          <div className="p-4 border-b flex items-center justify-between">
            {sidebarExpanded && (
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Ship className="w-5 h-5 text-blue-500" />
                Maritime Tracking
              </h1>
            )}
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {sidebarExpanded ? (
                <ChevronRight className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </button>
          </div>

          {sidebarExpanded && (
            <div className="p-4 space-y-4 overflow-y-auto h-[calc(100vh-80px)]">
              {/* Image Context Banner */}
              {imageId && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 relative">
                  <button
                    onClick={() => setSearchParams({})}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-600"
                    title="Clear image filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="flex items-start gap-2">
                    <ImageIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <div className="font-medium text-red-800">Viewing assets near image</div>
                      <div className="text-red-600 truncate max-w-[180px]">{imageName || 'Satellite Image'}</div>
                      {capturedAt && (
                        <div className="text-xs text-red-500 mt-1">
                          Captured: {new Date(capturedAt).toLocaleDateString()}
                        </div>
                      )}
                      <Link
                        to={`/images/${imageId}`}
                        className="text-xs text-red-600 hover:text-red-800 underline mt-1 inline-block"
                      >
                        Back to image
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="space-y-3">
                <Button onClick={handleRefresh} variant="outline" className="w-full">
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${
                      vesselsLoading || aircraftLoading ? 'animate-spin' : ''
                    }`}
                  />
                  Refresh Data
                </Button>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showVessels}
                      onChange={(e) => setShowVessels(e.target.checked)}
                      className="rounded"
                    />
                    <Ship className="w-4 h-4 text-blue-500" />
                    Ships
                  </label>
                  <Badge variant="secondary">{vesselData?.total || 0}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showAircraft}
                      onChange={(e) => setShowAircraft(e.target.checked)}
                      className="rounded"
                    />
                    <Plane className="w-4 h-4 text-sky-500" />
                    Aircraft
                  </label>
                  <Badge variant="secondary">{aircraftData?.total || 0}</Badge>
                </div>
              </div>

              {/* Vessel Filter */}
              {showVessels && (
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter by Type
                  </label>
                  <select
                    value={vesselFilter}
                    onChange={(e) => setVesselFilter(e.target.value)}
                    className="w-full border rounded px-2 py-1 text-sm"
                  >
                    <option value="all">All Types</option>
                    {vesselTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Legend */}
              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    Legend
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2">
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {Object.entries(VESSEL_TYPE_COLORS)
                      .slice(0, 8)
                      .map(([type, color]) => (
                        <div key={type} className="flex items-center gap-1">
                          <div
                            className="w-3 h-3 rounded-sm"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate">{type}</span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Selected Vessel Details */}
              {selectedVessel && (
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Anchor className="w-4 h-4 text-blue-500" />
                      {selectedVessel.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <Badge
                        style={{
                          backgroundColor:
                            VESSEL_TYPE_COLORS[selectedVessel.type] || '#6B7280',
                          color: 'white',
                        }}
                      >
                        {selectedVessel.type}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">MMSI</span>
                      <span>{selectedVessel.mmsi}</span>
                    </div>
                    {selectedVessel.callsign && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Callsign</span>
                        <span>{selectedVessel.callsign}</span>
                      </div>
                    )}
                    {selectedVessel.flag && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Flag</span>
                        <span>{selectedVessel.flag}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Speed</span>
                      <span>{selectedVessel.speed} kn</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Course</span>
                      <span>{selectedVessel.course}°</span>
                    </div>
                    {selectedVessel.destination && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Destination</span>
                        <span className="truncate max-w-[120px]">
                          {selectedVessel.destination}
                        </span>
                      </div>
                    )}
                    {selectedVessel.length && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Size</span>
                        <span>
                          {selectedVessel.length}m × {selectedVessel.width}m
                        </span>
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-2">
                      Last update: {new Date(selectedVessel.lastUpdate).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Selected Aircraft Details */}
              {selectedAircraft && (
                <Card>
                  <CardHeader className="py-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-sky-500" />
                      {selectedAircraft.callsign || selectedAircraft.icao24}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">ICAO24</span>
                      <span>{selectedAircraft.icao24}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Origin</span>
                      <span>{selectedAircraft.originCountry}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Altitude</span>
                      <span>{Math.round(selectedAircraft.position.altitude)}m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Speed</span>
                      <span>{Math.round(selectedAircraft.velocity)} m/s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Heading</span>
                      <span>{Math.round(selectedAircraft.heading)}°</span>
                    </div>
                    {selectedAircraft.squawk && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Squawk</span>
                        <span>{selectedAircraft.squawk}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <Badge variant={selectedAircraft.onGround ? 'warning' : 'success'}>
                        {selectedAircraft.onGround ? 'On Ground' : 'In Flight'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Data Source Info */}
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Aircraft data from OpenSky Network. Vessel data simulated for demo.
              </div>
            </div>
          )}
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={containerRef} className="w-full h-full" />

          {/* Stats Overlay */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 z-[1000]">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Ship className="w-4 h-4 text-blue-500" />
                <span className="font-medium">{vesselData?.total || 0}</span>
                <span className="text-gray-500">vessels</span>
              </div>
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-sky-500" />
                <span className="font-medium">{aircraftData?.total || 0}</span>
                <span className="text-gray-500">aircraft</span>
              </div>
            </div>
          </div>

          {/* Loading Indicator */}
          {(vesselsLoading || aircraftLoading) && (
            <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-2 z-[1000]">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
