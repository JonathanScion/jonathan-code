import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  Flame,
  Droplets,
  Mountain,
  Wind,
  RefreshCw,
  ExternalLink,
  Filter,
  MapPin,
  X,
  ImageIcon,
} from 'lucide-react';
import { disastersApi, type HazardPoint } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

type HazardFilter = 'all' | 'earthquake' | 'fire' | 'flood' | 'cyclone' | 'volcano';

const HAZARD_COLORS: Record<string, string> = {
  earthquake: '#8B5CF6',
  fire: '#EF4444',
  flood: '#3B82F6',
  cyclone: '#EC4899',
  volcano: '#F97316',
  wildfire: '#EF4444',
  other: '#6B7280',
};

const SEVERITY_SIZES: Record<string, number> = {
  extreme: 16,
  high: 12,
  moderate: 8,
  low: 6,
};

// Helper to calculate distance between two points (in km)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function DisasterDashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const imageMarkerRef = useRef<L.Marker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const [filter, setFilter] = useState<HazardFilter>('all');
  const [selectedHazard, setSelectedHazard] = useState<HazardPoint | null>(null);

  // Read location filter from URL params
  const locationFilter = {
    lat: searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null,
    lon: searchParams.get('lon') ? parseFloat(searchParams.get('lon')!) : null,
    radius: searchParams.get('radius') ? parseFloat(searchParams.get('radius')!) : 100, // default 100km
    imageId: searchParams.get('imageId') || null,
    imageName: searchParams.get('imageName') || null,
  };
  const hasLocationFilter = locationFilter.lat !== null && locationFilter.lon !== null;

  const clearLocationFilter = () => {
    navigate('/disasters');
  };

  // Fetch disaster summary
  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } = useQuery({
    queryKey: ['disaster-summary'],
    queryFn: () => disastersApi.getSummary(),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Fetch all hazards for map
  const { data: hazards, isLoading: hazardsLoading, refetch: refetchHazards } = useQuery({
    queryKey: ['all-hazards'],
    queryFn: () => disastersApi.getAllHazards(2.5, 7),
    refetchInterval: 5 * 60 * 1000,
  });

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // If location filter, center on that; otherwise show world
    const initialCenter: [number, number] = hasLocationFilter
      ? [locationFilter.lat!, locationFilter.lon!]
      : [20, 0];
    const initialZoom = hasLocationFilter ? 7 : 2;

    mapRef.current = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 2,
      maxZoom: 12,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map view and add image marker when location filter changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear previous image marker and radius circle
    if (imageMarkerRef.current) {
      imageMarkerRef.current.remove();
      imageMarkerRef.current = null;
    }
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }

    if (hasLocationFilter) {
      // Center map on location
      mapRef.current.setView([locationFilter.lat!, locationFilter.lon!], 7);

      // Add marker for image location
      const imageIcon = L.divIcon({
        className: 'custom-image-marker',
        html: `<div style="background: #10B981; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
            <circle cx="9" cy="9" r="2"/>
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
          </svg>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      imageMarkerRef.current = L.marker([locationFilter.lat!, locationFilter.lon!], { icon: imageIcon })
        .addTo(mapRef.current)
        .bindPopup(`<div class="p-2">
          <p class="font-semibold text-sm">${locationFilter.imageName || 'Image Location'}</p>
          <p class="text-xs text-gray-500">${locationFilter.lat!.toFixed(4)}, ${locationFilter.lon!.toFixed(4)}</p>
          <p class="text-xs text-gray-500">Showing disasters within ${locationFilter.radius}km</p>
        </div>`);

      // Add radius circle
      radiusCircleRef.current = L.circle([locationFilter.lat!, locationFilter.lon!], {
        radius: locationFilter.radius * 1000, // Convert km to meters
        color: '#10B981',
        fillColor: '#10B981',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5',
      }).addTo(mapRef.current);
    }
  }, [hasLocationFilter, locationFilter.lat, locationFilter.lon, locationFilter.radius, locationFilter.imageName]);

  // Update markers when hazards or filter changes
  useEffect(() => {
    if (!mapRef.current || !hazards) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter hazards by type
    let filteredHazards = filter === 'all'
      ? hazards
      : hazards.filter(h => h.type === filter || (filter === 'fire' && h.type === 'wildfire'));

    // Filter by location if location filter is active
    if (hasLocationFilter) {
      filteredHazards = filteredHazards.filter(h => {
        const distance = getDistanceKm(locationFilter.lat!, locationFilter.lon!, h.latitude, h.longitude);
        return distance <= locationFilter.radius;
      });
    }

    // Add new markers
    filteredHazards.forEach(hazard => {
      const color = HAZARD_COLORS[hazard.type] || HAZARD_COLORS.other;
      const size = SEVERITY_SIZES[hazard.severity] || 6;

      const marker = L.circleMarker([hazard.latitude, hazard.longitude], {
        radius: size,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
      });

      marker.bindPopup(`
        <div class="p-2">
          <h3 class="font-semibold text-sm">${hazard.title}</h3>
          <p class="text-xs text-gray-600 mt-1">
            ${hazard.type.charAt(0).toUpperCase() + hazard.type.slice(1)} - ${hazard.severity}
          </p>
          <p class="text-xs text-gray-500">
            ${new Date(hazard.timestamp).toLocaleString()}
          </p>
          ${hazard.details.magnitude ? `<p class="text-xs mt-1">Magnitude: ${hazard.details.magnitude}</p>` : ''}
          ${hazard.details.url ? `<a href="${hazard.details.url}" target="_blank" class="text-xs text-blue-500 hover:underline mt-2 block">More info</a>` : ''}
        </div>
      `);

      marker.on('click', () => setSelectedHazard(hazard));
      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });
  }, [hazards, filter, hasLocationFilter, locationFilter.lat, locationFilter.lon, locationFilter.radius]);

  const handleRefresh = () => {
    refetchSummary();
    refetchHazards();
  };

  const getHazardIcon = (type: string) => {
    switch (type) {
      case 'earthquake':
        return <Mountain className="w-4 h-4" />;
      case 'fire':
      case 'wildfire':
        return <Flame className="w-4 h-4" />;
      case 'flood':
        return <Droplets className="w-4 h-4" />;
      case 'cyclone':
        return <Wind className="w-4 h-4" />;
      case 'volcano':
        return <Mountain className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      extreme: 'bg-red-600 text-white',
      high: 'bg-orange-500 text-white',
      moderate: 'bg-yellow-500 text-dark',
      low: 'bg-green-500 text-white',
    };
    return colors[severity] || 'bg-gray-500 text-white';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-dark">Global Disaster Monitor</h1>
            <p className="text-dark-light">Real-time hazard tracking from multiple sources</p>
          </div>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className={`w-4 h-4 mr-2 ${summaryLoading || hazardsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600">Earthquakes</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {summary?.counts.earthquakes ?? '-'}
                  </p>
                </div>
                <Mountain className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Active Fires</p>
                  <p className="text-2xl font-bold text-red-700">
                    {summary?.counts.fires ?? '-'}
                  </p>
                </div>
                <Flame className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Floods</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {summary?.counts.floods ?? '-'}
                  </p>
                </div>
                <Droplets className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-pink-50 border-pink-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-pink-600">Cyclones</p>
                  <p className="text-2xl font-bold text-pink-700">
                    {summary?.counts.cyclones ?? '-'}
                  </p>
                </div>
                <Wind className="w-8 h-8 text-pink-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-orange-50 border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600">Volcanoes</p>
                  <p className="text-2xl font-bold text-orange-700">
                    {summary?.counts.volcanoes ?? '-'}
                  </p>
                </div>
                <Mountain className="w-8 h-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Location Filter Banner */}
        {hasLocationFilter && (
          <div className="flex items-center justify-between gap-4 mb-6 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-full">
                <ImageIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-800">
                  Filtering disasters near: {locationFilter.imageName || 'Image'}
                </p>
                <p className="text-sm text-green-600">
                  Showing hazards within {locationFilter.radius}km of {locationFilter.lat!.toFixed(4)}, {locationFilter.lon!.toFixed(4)}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={clearLocationFilter}>
              <X className="w-4 h-4 mr-1" />
              Clear Filter
            </Button>
          </div>
        )}

        {/* Alert Level Indicators */}
        {summary && (summary.alerts.red > 0 || summary.alerts.orange > 0) && (
          <div className="flex gap-4 mb-6">
            {summary.alerts.red > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-300 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span className="font-medium text-red-700">{summary.alerts.red} Red Alerts</span>
              </div>
            )}
            {summary.alerts.orange > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 border border-orange-300 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-orange-700">{summary.alerts.orange} Orange Alerts</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Hazard Map</span>
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as HazardFilter)}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="all">All Hazards</option>
                      <option value="earthquake">Earthquakes</option>
                      <option value="fire">Fires</option>
                      <option value="flood">Floods</option>
                      <option value="cyclone">Cyclones</option>
                      <option value="volcano">Volcanoes</option>
                    </select>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  ref={containerRef}
                  className="h-[500px] rounded-lg overflow-hidden"
                />
                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs">
                  {Object.entries(HAZARD_COLORS).filter(([key]) => key !== 'other' && key !== 'wildfire').map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="capitalize">{type}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - height matches map card (500px map + ~116px header/legend/padding) */}
          <div className="flex flex-col gap-6 lg:h-[616px]">
            {/* Recent Significant Events */}
            <Card className="flex flex-col flex-grow min-h-0 overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Significant Events
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow min-h-0 overflow-hidden">
                <div className="space-y-3 h-full overflow-y-auto">
                  {summary?.recentSignificant.length ? (
                    summary.recentSignificant.map((hazard) => (
                      <div
                        key={hazard.id}
                        className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedHazard(hazard);
                          mapRef.current?.setView([hazard.latitude, hazard.longitude], 6);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="p-1.5 rounded-full"
                              style={{ backgroundColor: HAZARD_COLORS[hazard.type] + '20' }}
                            >
                              {getHazardIcon(hazard.type)}
                            </div>
                            <div>
                              <p className="font-medium text-sm line-clamp-1">{hazard.title}</p>
                              <p className="text-xs text-gray-500">
                                {new Date(hazard.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Badge className={getSeverityBadge(hazard.severity)} size="sm">
                            {hazard.severity}
                          </Badge>
                        </div>
                        {hazard.details.magnitude && (
                          <p className="text-xs text-gray-600 mt-1 ml-9">
                            Magnitude: {hazard.details.magnitude}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No significant events in the past 7 days
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Selected Hazard Details */}
            {selectedHazard && (
              <Card className="flex-shrink-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getHazardIcon(selectedHazard.type)}
                    Selected Event
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <h3 className="font-semibold">{selectedHazard.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={getSeverityBadge(selectedHazard.severity)}
                      >
                        {selectedHazard.severity.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-500 capitalize">
                        {selectedHazard.type}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span>
                          {selectedHazard.latitude.toFixed(4)}, {selectedHazard.longitude.toFixed(4)}
                        </span>
                      </div>
                      <p className="text-gray-600">
                        {new Date(selectedHazard.timestamp).toLocaleString()}
                      </p>
                      {selectedHazard.details.magnitude && (
                        <p>Magnitude: <span className="font-medium">{selectedHazard.details.magnitude}</span></p>
                      )}
                      {selectedHazard.details.depth && (
                        <p>Depth: <span className="font-medium">{selectedHazard.details.depth} km</span></p>
                      )}
                      {selectedHazard.details.country && (
                        <p>Country: <span className="font-medium">{selectedHazard.details.country}</span></p>
                      )}
                    </div>
                    {selectedHazard.details.url && (
                      <a
                        href={selectedHazard.details.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        View Details
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Data Sources */}
            <Card className="flex-shrink-0">
              <CardHeader>
                <CardTitle className="text-sm">Data Sources</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-gray-600 space-y-1">
                  <li>Earthquakes: USGS Earthquake Hazards Program</li>
                  <li>Fires: NASA FIRMS (VIIRS/MODIS)</li>
                  <li>Floods/Cyclones: GDACS</li>
                  <li className="text-gray-400">Updated every 5 minutes</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
