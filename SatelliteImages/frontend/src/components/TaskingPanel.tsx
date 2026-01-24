import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Satellite,
  Cloud,
  Clock,
  Star,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  Calendar,
  Sun,
  CloudRain,
} from 'lucide-react';
import { taskingApi, type TaskingCriteria } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface TaskingPanelProps {
  imageId: string;
  centerPoint?: { lat: number; lon: number };
}


export function TaskingPanel({ imageId, centerPoint }: TaskingPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [criteria, setCriteria] = useState<TaskingCriteria>({
    maxCloudCoverage: 20,
    minElevation: 30,
    urgency: 'medium',
    sensorType: 'any',
  });

  // Fetch tasking recommendations
  const {
    data: recommendation,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['tasking', imageId, criteria],
    queryFn: () => taskingApi.getRecommendationsForImage(imageId, criteria),
    enabled: !!centerPoint && expanded,
    staleTime: 1000 * 60 * 5,
  });

  const formatTime = (isoTime: string) => {
    const date = new Date(isoTime);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 0) return 'Now';
    if (diffHours < 1) {
      const mins = Math.round(diffMs / (1000 * 60));
      return `${mins}m`;
    }
    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ${Math.round((diffHours % 1) * 60)}m`;
    }
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
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
            <Satellite className="w-5 h-5 mr-2 text-purple-500" />
            <span>Collection Recommendations</span>
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
              {/* Criteria Controls */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <label className="text-xs text-gray-500">Max Cloud %</label>
                  <input
                    type="number"
                    value={criteria.maxCloudCoverage}
                    onChange={(e) =>
                      setCriteria({ ...criteria, maxCloudCoverage: parseInt(e.target.value) })
                    }
                    className="w-full border rounded px-2 py-1 text-sm"
                    min={0}
                    max={100}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Urgency</label>
                  <select
                    value={criteria.urgency}
                    onChange={(e) =>
                      setCriteria({ ...criteria, urgency: e.target.value as any })
                    }
                    className="w-full border rounded px-2 py-1 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="w-full"
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Get Recommendations
              </Button>

              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : error ? (
                <p className="text-sm text-red-500 text-center py-4">
                  Failed to load recommendations
                </p>
              ) : recommendation ? (
                <>
                  {/* Priority Summary */}
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">Priority Assessment</span>
                      <Badge
                        className={`${
                          recommendation.priorities.urgencyScore >= 80
                            ? 'bg-red-500'
                            : recommendation.priorities.urgencyScore >= 60
                            ? 'bg-orange-500'
                            : recommendation.priorities.urgencyScore >= 40
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        } text-white`}
                      >
                        Score: {recommendation.priorities.urgencyScore}
                      </Badge>
                    </div>
                    <p className="text-sm text-purple-700">
                      {recommendation.priorities.recommendedAction}
                    </p>
                    <div className="mt-2 space-y-1">
                      {recommendation.priorities.factors.map((factor, idx) => (
                        <div key={idx} className="text-xs text-purple-600 flex items-center">
                          <Star className="w-3 h-3 mr-1" />
                          {factor}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Next Best Window */}
                  {recommendation.nextBestWindow && (
                    <div className="p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm text-green-700">
                          Best Collection Window
                        </span>
                        <Badge className="bg-green-500 text-white">
                          Score: {recommendation.nextBestWindow.score}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <Satellite className="w-4 h-4 text-green-600" />
                          <span className="font-medium">
                            {recommendation.nextBestWindow.satellite}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-green-600" />
                          <span>{formatTime(recommendation.nextBestWindow.startTime)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Cloud className="w-4 h-4 text-green-600" />
                          <span>{recommendation.nextBestWindow.cloudCoverage}% clouds</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4 text-green-600" />
                          <span>{recommendation.nextBestWindow.maxElevation}° elevation</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Cloud Forecast */}
                  <div className="space-y-2">
                    <span className="font-medium text-sm flex items-center gap-2">
                      <CloudRain className="w-4 h-4 text-blue-500" />
                      7-Day Cloud Forecast
                    </span>
                    <div className="flex gap-1">
                      {recommendation.cloudForecast.slice(0, 7).map((day, idx) => (
                        <div
                          key={idx}
                          className={`flex-1 text-center p-1 rounded text-xs ${
                            day.expectedCoverage <= 20
                              ? 'bg-green-100 text-green-700'
                              : day.expectedCoverage <= 50
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                          title={`${day.date}: ${day.expectedCoverage}% clouds`}
                        >
                          <div className="font-medium">
                            {new Date(day.date).toLocaleDateString([], { weekday: 'narrow' })}
                          </div>
                          <div>{day.expectedCoverage}%</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Collection Windows */}
                  <div className="space-y-2">
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-500" />
                      Collection Windows
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {recommendation.optimalWindows.slice(0, 5).map((window, idx) => (
                        <div
                          key={idx}
                          className={`p-2 rounded text-sm border ${
                            window.recommended
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{window.satellite}</span>
                              {window.recommended && (
                                <Star className="w-3 h-3 text-green-500" />
                              )}
                            </div>
                            <Badge
                              className={
                                window.score >= 70
                                  ? 'bg-green-500 text-white'
                                  : window.score >= 50
                                  ? 'bg-yellow-500 text-dark'
                                  : 'bg-gray-500 text-white'
                              }
                            >
                              {window.score}
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatTime(window.startTime)} • {window.cloudCoverage}% clouds •{' '}
                            {window.maxElevation}° elev
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Satellite Schedule */}
                  <div className="space-y-2">
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Satellite className="w-4 h-4 text-purple-500" />
                      Satellite Schedule
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {recommendation.satelliteSchedule.slice(0, 4).map((sat, idx) => (
                        <div key={idx} className="p-2 bg-gray-50 rounded">
                          <div className="font-medium truncate">{sat.satellite}</div>
                          <div className="text-gray-500">{sat.frequency}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  Click "Get Recommendations" to analyze collection options
                </p>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
