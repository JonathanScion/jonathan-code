import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Satellite,
  Cloud,
  Flame,
  Rocket,
  Mountain,
  ChevronDown,
  ChevronRight,
  FileText,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { fusionApi, type TimelineEntry, type TimelineSource, type IntelligenceReport } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface FusionTimelineProps {
  imageId: string;
  centerPoint?: { lat: number; lon: number };
  capturedAt?: string;
  onReportGenerated?: (report: IntelligenceReport) => void;
}

const SOURCE_ICONS: Record<TimelineSource, React.ReactNode> = {
  satellite: <Satellite className="w-4 h-4" />,
  weather: <Cloud className="w-4 h-4" />,
  fire: <Flame className="w-4 h-4" />,
  pass: <Rocket className="w-4 h-4" />,
  earthquake: <Mountain className="w-4 h-4" />,
};

const SOURCE_COLORS: Record<TimelineSource, string> = {
  satellite: 'bg-blue-100 text-blue-700 border-blue-200',
  weather: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  fire: 'bg-red-100 text-red-700 border-red-200',
  pass: 'bg-purple-100 text-purple-700 border-purple-200',
  earthquake: 'bg-orange-100 text-orange-700 border-orange-200',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-dark',
  low: 'bg-green-500 text-white',
};

export function FusionTimeline({
  imageId,
  centerPoint,
  capturedAt,
  onReportGenerated,
}: FusionTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [enabledSources, setEnabledSources] = useState<Set<TimelineSource>>(
    new Set(['satellite', 'weather', 'fire', 'pass', 'earthquake'])
  );
  const [showReport, setShowReport] = useState(false);

  // Fetch timeline
  const {
    data: timeline,
    isLoading: timelineLoading,
    error: timelineError,
  } = useQuery({
    queryKey: ['fusion-timeline', centerPoint?.lat, centerPoint?.lon, capturedAt],
    queryFn: () => {
      if (!centerPoint) throw new Error('No location');
      const endDate = capturedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
      const startDate = new Date(new Date(endDate).getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      return fusionApi.getTimeline(centerPoint.lat, centerPoint.lon, startDate, endDate);
    },
    enabled: !!centerPoint,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch intelligence report
  const {
    data: report,
    isLoading: reportLoading,
    refetch: fetchReport,
    isFetched: reportFetched,
  } = useQuery({
    queryKey: ['intel-report', imageId],
    queryFn: () => fusionApi.getReportForImage(imageId),
    enabled: false,
  });

  const handleGenerateReport = async () => {
    const result = await fetchReport();
    if (result.data) {
      setShowReport(true);
      onReportGenerated?.(result.data);
    }
  };

  const toggleSource = (source: TimelineSource) => {
    setEnabledSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(source)) {
        newSet.delete(source);
      } else {
        newSet.add(source);
      }
      return newSet;
    });
  };

  const filteredEntries = timeline?.entries.filter((e) => enabledSources.has(e.source)) || [];

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-100 border-red-500 text-red-700';
      case 'high':
        return 'bg-orange-100 border-orange-500 text-orange-700';
      case 'moderate':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      default:
        return 'bg-green-100 border-green-500 text-green-700';
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
            <Clock className="w-5 h-5 mr-2 text-indigo-500" />
            <span>Multi-Sensor Timeline</span>
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
              {/* Source Filters */}
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SOURCE_ICONS) as TimelineSource[]).map((source) => (
                  <button
                    key={source}
                    onClick={() => toggleSource(source)}
                    className={`flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors ${
                      enabledSources.has(source)
                        ? SOURCE_COLORS[source]
                        : 'bg-gray-100 text-gray-500 border-gray-200'
                    }`}
                  >
                    {SOURCE_ICONS[source]}
                    <span className="capitalize">{source}</span>
                  </button>
                ))}
              </div>

              {/* Timeline */}
              {timelineLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : timelineError ? (
                <p className="text-sm text-red-500 text-center py-4">
                  Failed to load timeline data
                </p>
              ) : filteredEntries.length > 0 ? (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                  {/* Timeline entries */}
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {filteredEntries.slice(0, 20).map((entry) => (
                      <div key={entry.id} className="relative flex items-start gap-3 pl-10">
                        {/* Dot */}
                        <div
                          className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white ${
                            entry.severity === 'critical' || entry.severity === 'high'
                              ? 'bg-red-500'
                              : 'bg-primary'
                          }`}
                        />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`p-1 rounded ${SOURCE_COLORS[entry.source]}`}>
                              {SOURCE_ICONS[entry.source]}
                            </span>
                            <span className="font-medium text-sm truncate">{entry.title}</span>
                            {entry.severity && (
                              <Badge className={SEVERITY_COLORS[entry.severity]} size="sm">
                                {entry.severity}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{entry.description}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredEntries.length > 20 && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      +{filteredEntries.length - 20} more events
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No events found for this location
                </p>
              )}

              {/* Generate Report Button */}
              <Button
                onClick={handleGenerateReport}
                disabled={reportLoading}
                className="w-full"
                variant="outline"
              >
                {reportLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Generate Intelligence Report
                  </>
                )}
              </Button>

              {/* Intelligence Report */}
              {showReport && report && (
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Intelligence Report
                    </h4>
                    <Badge className={getRiskColor(report.riskLevel)}>
                      {report.riskLevel.toUpperCase()} RISK
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600">{report.summary}</p>

                  {/* Sections */}
                  <div className="space-y-3">
                    {report.sections.map((section, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                        <h5 className="font-medium text-sm">{section.title}</h5>
                        <p className="text-sm text-gray-600 mt-1">{section.content}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recommendations */}
                  {report.recommendations.length > 0 && (
                    <div>
                      <h5 className="font-medium text-sm flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-500" />
                        Recommendations
                      </h5>
                      <ul className="space-y-1">
                        {report.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-gray-400">
                    Generated: {new Date(report.generatedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
