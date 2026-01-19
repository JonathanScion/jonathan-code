import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';
import { disastersApi, nasaApi, type HazardPoint, type DisasterSummary, type BoundingBox } from '@/lib/api';
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

export function DisasterDashboardPage() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const [filter, setFilter] = useState<HazardFilter>('all');
  const [selectedHazard, setSelectedHazard] = useState<HazardPoint | null>(null);

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

    mapRef.current = L.map(containerRef.current, {
      center: [20, 0],
      zoom: 2,
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

  // Update markers when hazards or filter changes
  useEffect(() => {
    if (!mapRef.current || !hazards) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter hazards
    const filteredHazards = filter === 'all'
      ? hazards
      : hazards.filter(h => h.type === filter || (filter === 'fire' && h.type === 'wildfire'));

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
  }, [hazards, filter]);

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

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Recent Significant Events */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Significant Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
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
              <Card>
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
            <Card>
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
