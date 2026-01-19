import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Satellite,
  Layers,
  Flame,
  Cloud,
  Calendar,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Thermometer,
  Droplets,
  Wind,
  Sun,
} from 'lucide-react';
import { nasaApi, type GIBSLayer, type ImageEnrichment, type BoundingBox } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface NasaLayersPanelProps {
  imageId: string;
  centerPoint?: { lat: number; lon: number };
  bounds?: BoundingBox;
  capturedAt?: string;
  enrichment?: ImageEnrichment;
  onLayerToggle?: (layerId: string, enabled: boolean, date?: string) => void;
  enabledLayers?: string[];
}

export function NasaLayersPanel({
  imageId,
  centerPoint,
  bounds,
  capturedAt,
  enrichment,
  onLayerToggle,
  enabledLayers = [],
}: NasaLayersPanelProps) {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    coverage: false,
    layers: true,
    enrichment: true,
    weather: false,
    schedule: false,
  });
  const [selectedDate, setSelectedDate] = useState<string>(
    capturedAt?.split('T')[0] || new Date().toISOString().split('T')[0]
  );

  // Fetch GIBS layers
  const { data: gibsLayers } = useQuery({
    queryKey: ['gibs-layers'],
    queryFn: () => nasaApi.getGibsLayers(),
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch NASA coverage
  const { data: coverage, isLoading: coverageLoading } = useQuery({
    queryKey: ['nasa-coverage', bounds],
    queryFn: () => {
      if (!bounds) return null;
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return nasaApi.searchCoverage(
        bounds,
        oneYearAgo.toISOString(),
        new Date().toISOString(),
        undefined,
        1,
        10
      );
    },
    enabled: !!bounds,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Fetch weather data
  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['nasa-weather', centerPoint?.lat, centerPoint?.lon],
    queryFn: () => {
      if (!centerPoint) return null;
      return nasaApi.getWeather(centerPoint.lat, centerPoint.lon);
    },
    enabled: !!centerPoint,
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });

  // Fetch satellite passes
  const { data: passes, isLoading: passesLoading } = useQuery({
    queryKey: ['satellite-passes', centerPoint?.lat, centerPoint?.lon],
    queryFn: () => {
      if (!centerPoint) return null;
      return nasaApi.getSatellitePasses(centerPoint.lat, centerPoint.lon, 0, undefined, 5);
    },
    enabled: !!centerPoint,
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
  });

  // Enrich image mutation
  const enrichMutation = useMutation({
    mutationFn: () => nasaApi.enrichImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image', imageId] });
    },
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleLayerToggle = (layerId: string) => {
    const isEnabled = enabledLayers.includes(layerId);
    onLayerToggle?.(layerId, !isEnabled, selectedDate);
  };

  const getFireRiskColor = (level: string) => {
    switch (level) {
      case 'extreme': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'moderate': return 'bg-yellow-500 text-dark';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-200 text-dark';
    }
  };

  const formatPassTime = (isoTime: string) => {
    const date = new Date(isoTime);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) return 'In progress';
    if (diffHours < 1) {
      const mins = Math.round(diffMs / (1000 * 60));
      return `In ${mins}m`;
    }
    if (diffHours < 24) {
      return `In ${Math.floor(diffHours)}h ${Math.round((diffHours % 1) * 60)}m`;
    }
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center">
            <Satellite className="w-5 h-5 mr-2 text-primary" />
            NASA Layers
          </span>
          {!enrichment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => enrichMutation.mutate()}
              disabled={enrichMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 ${enrichMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* NASA Coverage Section */}
        <div className="border-b border-gray-200 pb-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => toggleSection('coverage')}
          >
            <span className="font-medium flex items-center">
              <Layers className="w-4 h-4 mr-2" />
              NASA Coverage
              {coverage && (
                <Badge variant="secondary" className="ml-2">
                  {coverage.total} found
                </Badge>
              )}
            </span>
            {expandedSections.coverage ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence>
            {expandedSections.coverage && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2 max-h-40 overflow-y-auto">
                  {coverageLoading ? (
                    <p className="text-sm text-gray-500">Loading coverage...</p>
                  ) : coverage?.granules.length ? (
                    coverage.granules.map(granule => (
                      <div
                        key={granule.id}
                        className="text-sm p-2 bg-gray-50 rounded flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{granule.satellite}</div>
                          <div className="text-gray-500 text-xs">
                            {new Date(granule.startDate).toLocaleDateString()}
                          </div>
                        </div>
                        {granule.browseUrl && (
                          <a
                            href={granule.browseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary text-xs hover:underline"
                          >
                            Preview
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No NASA imagery found for this location</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Overlay Layers Section */}
        <div className="border-b border-gray-200 pb-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => toggleSection('layers')}
          >
            <span className="font-medium flex items-center">
              <Layers className="w-4 h-4 mr-2" />
              Overlay Layers
            </span>
            {expandedSections.layers ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence>
            {expandedSections.layers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2">
                  <div className="flex items-center space-x-2 mb-3">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="text-sm border rounded px-2 py-1"
                    />
                  </div>
                  {gibsLayers?.map(layer => (
                    <label
                      key={layer.id}
                      className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={enabledLayers.includes(layer.id)}
                        onChange={() => handleLayerToggle(layer.id)}
                        className="rounded text-primary"
                      />
                      <span className="flex items-center gap-1">
                        {layer.name}
                        {(layer as any).requiresNasaMode && (
                          <span className="text-[10px] px-1 py-0.5 bg-blue-100 text-blue-700 rounded" title="Requires NASA Mode">
                            NASA
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Auto-Enrichment Section */}
        <div className="border-b border-gray-200 pb-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => toggleSection('enrichment')}
          >
            <span className="font-medium flex items-center">
              <AlertTriangle className="w-4 h-4 mr-2" />
              Auto-Enrichment
            </span>
            {expandedSections.enrichment ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence>
            {expandedSections.enrichment && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  {enrichment ? (
                    <>
                      {/* Fire Risk */}
                      <div className="flex items-center justify-between">
                        <span className="flex items-center text-sm">
                          <Flame className="w-4 h-4 mr-2 text-orange-500" />
                          Fire Risk
                        </span>
                        <Badge className={getFireRiskColor(enrichment.fireRisk.level)}>
                          {enrichment.fireRisk.level.toUpperCase()}
                        </Badge>
                      </div>
                      {enrichment.fireRisk.nearbyFires > 0 && (
                        <p className="text-xs text-gray-500 ml-6">
                          {enrichment.fireRisk.nearbyFires} fires within 50km
                          {enrichment.fireRisk.nearestKm && ` (nearest: ${enrichment.fireRisk.nearestKm}km)`}
                        </p>
                      )}

                      {/* NDVI */}
                      {enrichment.ndvi?.available && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center text-sm">
                            <Cloud className="w-4 h-4 mr-2 text-green-500" />
                            NDVI Layer
                          </span>
                          <Badge variant="success">Available</Badge>
                        </div>
                      )}

                      {/* NASA Coverage */}
                      {enrichment.nasaCoverage && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center text-sm">
                            <Satellite className="w-4 h-4 mr-2 text-blue-500" />
                            NASA Imagery
                          </span>
                          <Badge variant="secondary">
                            {enrichment.nasaCoverage.total} scenes
                          </Badge>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm text-gray-500 mb-2">No enrichment data yet</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => enrichMutation.mutate()}
                        disabled={enrichMutation.isPending || !centerPoint}
                      >
                        {enrichMutation.isPending ? 'Enriching...' : 'Enrich Now'}
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Weather Section */}
        <div className="border-b border-gray-200 pb-3">
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => toggleSection('weather')}
          >
            <span className="font-medium flex items-center">
              <Sun className="w-4 h-4 mr-2" />
              Weather Data
            </span>
            {expandedSections.weather ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence>
            {expandedSections.weather && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3">
                  {weatherLoading ? (
                    <p className="text-sm text-gray-500">Loading weather...</p>
                  ) : weather?.current ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center space-x-2">
                        <Thermometer className="w-4 h-4 text-red-500" />
                        <div className="text-sm">
                          <div className="text-gray-500">Temperature</div>
                          <div className="font-medium">{weather.current.temperature}°C</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        <div className="text-sm">
                          <div className="text-gray-500">Humidity</div>
                          <div className="font-medium">{weather.current.humidity}%</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Cloud className="w-4 h-4 text-gray-500" />
                        <div className="text-sm">
                          <div className="text-gray-500">Precipitation</div>
                          <div className="font-medium">{weather.current.precipitation}mm</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Wind className="w-4 h-4 text-cyan-500" />
                        <div className="text-sm">
                          <div className="text-gray-500">Wind</div>
                          <div className="font-medium">{weather.current.windSpeed} m/s</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No weather data available</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Satellite Schedule Section */}
        <div>
          <button
            className="flex items-center justify-between w-full text-left"
            onClick={() => toggleSection('schedule')}
          >
            <span className="font-medium flex items-center">
              <Satellite className="w-4 h-4 mr-2" />
              Satellite Schedule
            </span>
            {expandedSections.schedule ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <AnimatePresence>
            {expandedSections.schedule && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2 max-h-40 overflow-y-auto">
                  {passesLoading ? (
                    <p className="text-sm text-gray-500">Loading passes...</p>
                  ) : passes?.passes.length ? (
                    passes.passes.slice(0, 5).map((pass, idx) => (
                      <div
                        key={idx}
                        className="text-sm p-2 bg-gray-50 rounded flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{pass.satellite}</div>
                          <div className="text-gray-500 text-xs">
                            Max elevation: {pass.maxElevation}°
                          </div>
                        </div>
                        <Badge variant="outline">
                          {formatPassTime(pass.startTime)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">
                      {centerPoint
                        ? 'No upcoming passes found'
                        : 'Location required for pass predictions'}
                    </p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}
