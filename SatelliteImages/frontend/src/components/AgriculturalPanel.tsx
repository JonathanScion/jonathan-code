import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Leaf,
  Droplets,
  Thermometer,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { agricultureApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface AgriculturalPanelProps {
  imageId: string;
  centerPoint?: { lat: number; lon: number };
  ndviValue?: number;
}

const HEALTH_COLORS: Record<string, string> = {
  excellent: 'bg-green-500 text-white',
  good: 'bg-green-400 text-white',
  fair: 'bg-yellow-500 text-dark',
  poor: 'bg-orange-500 text-white',
  critical: 'bg-red-500 text-white',
};

const DROUGHT_COLORS: Record<string, string> = {
  none: 'bg-green-500 text-white',
  abnormally_dry: 'bg-yellow-400 text-dark',
  moderate: 'bg-orange-400 text-white',
  severe: 'bg-orange-600 text-white',
  extreme: 'bg-red-500 text-white',
  exceptional: 'bg-red-700 text-white',
};

const YIELD_COLORS: Record<string, string> = {
  low: 'bg-green-500 text-white',
  moderate: 'bg-yellow-500 text-dark',
  high: 'bg-orange-500 text-white',
  critical: 'bg-red-500 text-white',
};

export function AgriculturalPanel({ imageId, centerPoint, ndviValue }: AgriculturalPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedCrop, setSelectedCrop] = useState<string>('generic');

  // Fetch crop types
  const { data: cropTypes } = useQuery({
    queryKey: ['crop-types'],
    queryFn: () => agricultureApi.getCropTypes(),
    staleTime: 1000 * 60 * 60,
  });

  // Fetch agricultural analysis
  const {
    data: analysis,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['agriculture', imageId, selectedCrop, ndviValue],
    queryFn: () => agricultureApi.analyzeImage(imageId, selectedCrop, ndviValue),
    enabled: !!centerPoint && expanded,
    staleTime: 1000 * 60 * 5,
  });

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!centerPoint) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <button
            className="flex items-center w-full text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <Leaf className="w-5 h-5 mr-2 text-green-500" />
            <span>Agricultural Intelligence</span>
            {expanded ? (
              <ChevronDown className="w-4 h-4 ml-auto" />
            ) : (
              <ChevronRight className="w-4 h-4 ml-auto" />
            )}
          </button>
        </CardTitle>
      </CardHeader>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <CardContent className="space-y-4">
              {/* Crop Type Selection */}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Crop Type:</label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="text-sm border rounded px-2 py-1 flex-1"
                >
                  {cropTypes?.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {crop.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : error ? (
                <p className="text-sm text-red-500 text-center py-4">
                  Failed to load agricultural analysis
                </p>
              ) : analysis ? (
                <>
                  {/* Crop Health Score */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <Leaf className="w-4 h-4 text-green-500" />
                        Crop Health
                      </span>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(analysis.cropHealth.trend)}
                        <Badge className={HEALTH_COLORS[analysis.cropHealth.category]}>
                          {analysis.cropHealth.category.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {analysis.cropHealth.overall}
                        </div>
                        <div className="text-xs text-gray-500">Overall</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-lg font-semibold">
                          {analysis.cropHealth.ndviScore}
                        </div>
                        <div className="text-xs text-gray-500">NDVI</div>
                      </div>
                      <div className="text-center p-2 bg-white rounded">
                        <div className="text-lg font-semibold">
                          {analysis.cropHealth.moistureScore}
                        </div>
                        <div className="text-xs text-gray-500">Moisture</div>
                      </div>
                    </div>
                  </div>

                  {/* Drought Index */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <Droplets className="w-4 h-4 text-blue-500" />
                        Drought Index
                      </span>
                      <Badge className={DROUGHT_COLORS[analysis.droughtIndex.level]}>
                        {analysis.droughtIndex.level.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Soil Moisture:</span>
                        <span className="ml-1 font-medium capitalize">
                          {analysis.droughtIndex.soilMoistureEstimate.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Days w/o Rain:</span>
                        <span className="ml-1 font-medium">
                          {analysis.droughtIndex.daysWithoutRain}
                        </span>
                      </div>
                      {analysis.droughtIndex.precipitationDeficit > 0 && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Precip Deficit:</span>
                          <span className="ml-1 font-medium text-orange-600">
                            -{analysis.droughtIndex.precipitationDeficit}mm
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Yield Prediction */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                        Yield Prediction
                      </span>
                      <Badge className={YIELD_COLORS[analysis.yieldPrediction.riskLevel]}>
                        {analysis.yieldPrediction.riskLevel.toUpperCase()} RISK
                      </Badge>
                    </div>
                    <div className="mb-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Estimated Yield</span>
                        <span className="font-semibold">
                          {analysis.yieldPrediction.estimatedYieldPercent}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            analysis.yieldPrediction.estimatedYieldPercent >= 80
                              ? 'bg-green-500'
                              : analysis.yieldPrediction.estimatedYieldPercent >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(100, analysis.yieldPrediction.estimatedYieldPercent)}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      {analysis.yieldPrediction.factors.map((factor, idx) => (
                        <div key={idx} className="flex items-center text-xs">
                          <span
                            className={`w-2 h-2 rounded-full mr-2 ${
                              factor.impact === 'positive'
                                ? 'bg-green-500'
                                : factor.impact === 'negative'
                                ? 'bg-red-500'
                                : 'bg-gray-400'
                            }`}
                          />
                          <span className="text-gray-600">{factor.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weather Summary */}
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium flex items-center gap-2 mb-2">
                      <Thermometer className="w-4 h-4 text-red-500" />
                      Weather Summary (30 days)
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Avg Temp:</span>
                        <span className="ml-1 font-medium">{analysis.weatherSummary.avgTemp}°C</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Precip:</span>
                        <span className="ml-1 font-medium">{analysis.weatherSummary.totalPrecip}mm</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Humidity:</span>
                        <span className="ml-1 font-medium">{analysis.weatherSummary.avgHumidity}%</span>
                      </div>
                      <div>
                        <span className="text-gray-500">GDD:</span>
                        <span className="ml-1 font-medium">{analysis.weatherSummary.growingDegreeDays}</span>
                      </div>
                    </div>
                  </div>

                  {/* Alerts */}
                  {analysis.alerts.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Alerts
                      </span>
                      {analysis.alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded text-sm ${
                            alert.severity === 'high'
                              ? 'bg-red-100 text-red-700'
                              : alert.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {alert.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recommendations */}
                  {analysis.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-medium text-sm">Recommendations</span>
                      <ul className="space-y-1">
                        {analysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  Click refresh to load agricultural analysis
                </p>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
