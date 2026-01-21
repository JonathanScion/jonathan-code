import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertTriangle,
  Flame,
  Droplets,
  TreePine,
  Building2,
  Mountain,
  Waves,
  Snowflake,
  Leaf,
  Lightbulb,
  Target,
  TrendingUp,
} from 'lucide-react';
import { aiApi, type AIAnalysisResult, type AnalysisType } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface AIAnalysisPanelProps {
  imageId: string;
  existingAnalysis?: AIAnalysisResult;
  onAnalysisComplete?: (result: AIAnalysisResult) => void;
}

export function AIAnalysisPanel({
  imageId,
  existingAnalysis,
  onAnalysisComplete,
}: AIAnalysisPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<AnalysisType>('general');
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(existingAnalysis || null);

  const analyzeMutation = useMutation({
    mutationFn: () => aiApi.analyzeImage(imageId, selectedType),
    onSuccess: (result) => {
      setAnalysis(result);
      onAnalysisComplete?.(result);
    },
  });

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical':
      case 'extreme':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
      case 'moderate':
        return 'bg-yellow-500 text-dark';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-200 text-dark';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLandUseIcon = (type: string) => {
    switch (type) {
      case 'urban':
        return <Building2 className="w-4 h-4" />;
      case 'agricultural':
        return <Leaf className="w-4 h-4" />;
      case 'forest':
        return <TreePine className="w-4 h-4" />;
      case 'water':
        return <Waves className="w-4 h-4" />;
      case 'barren':
        return <Mountain className="w-4 h-4" />;
      case 'wetland':
        return <Droplets className="w-4 h-4" />;
      case 'snow':
        return <Snowflake className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getDisasterIcon = (type?: string) => {
    switch (type) {
      case 'fire':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'flood':
        return <Droplets className="w-5 h-5 text-blue-500" />;
      case 'storm':
        return <AlertTriangle className="w-5 h-5 text-purple-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <button
            className="flex items-center w-full text-left"
            onClick={() => setExpanded(!expanded)}
          >
            <Brain className="w-5 h-5 mr-2 text-purple-500" />
            <span>AI Analysis</span>
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
              {/* Analysis Type Selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Analysis Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as AnalysisType)}
                  className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                  disabled={analyzeMutation.isPending}
                >
                  <option value="general">General Analysis</option>
                  <option value="disaster">Disaster Detection</option>
                  <option value="landuse">Land Use Classification</option>
                </select>
              </div>

              {/* Analyze Button */}
              <Button
                onClick={() => analyzeMutation.mutate()}
                disabled={analyzeMutation.isPending}
                className="w-full"
              >
                {analyzeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Analyze Image
                  </>
                )}
              </Button>

              {/* Error Display */}
              {analyzeMutation.isError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">
                    Analysis failed: {(analyzeMutation.error as Error).message}
                  </p>
                </div>
              )}

              {/* Analysis Results */}
              {analysis && (
                <div className="space-y-4 border-t pt-4">
                  {/* Summary */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Summary</h4>
                      <Badge variant="outline" className={getConfidenceColor(analysis.confidence)}>
                        {analysis.confidence}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{analysis.summary}</p>
                  </div>

                  {/* Disaster-specific results */}
                  {analysis.analysisType === 'disaster' && analysis.disasterType && (
                    <div className="p-3 bg-gray-50 rounded-md space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 font-medium">
                          {getDisasterIcon(analysis.disasterType)}
                          {analysis.disasterType === 'none'
                            ? 'No Disaster Detected'
                            : `${analysis.disasterType.charAt(0).toUpperCase() + analysis.disasterType.slice(1)} Detected`}
                        </span>
                        {analysis.severity && analysis.severity !== 'none' && (
                          <Badge className={getSeverityColor(analysis.severity)}>
                            {analysis.severity.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      {analysis.affectedArea && (
                        <p className="text-sm text-gray-600">
                          Affected area: {analysis.affectedArea}
                        </p>
                      )}
                      {analysis.urgency && analysis.urgency !== 'none' && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-500">Urgency:</span>
                          <Badge className={getSeverityColor(analysis.urgency)}>
                            {analysis.urgency.toUpperCase()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Land use classification results */}
                  {analysis.analysisType === 'landuse' && analysis.classifications && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Land Classification
                      </h4>
                      {analysis.dominantType && (
                        <p className="text-sm text-gray-600">
                          Dominant type: <span className="font-medium">{analysis.dominantType}</span>
                        </p>
                      )}
                      <div className="space-y-2">
                        {analysis.classifications
                          .filter(c => c.percentage > 0)
                          .sort((a, b) => b.percentage - a.percentage)
                          .map((classification, idx) => (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                  {getLandUseIcon(classification.type)}
                                  {classification.type.charAt(0).toUpperCase() + classification.type.slice(1)}
                                </span>
                                <span className="text-gray-600">{classification.percentage}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${classification.percentage}%` }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Findings */}
                  {analysis.findings && analysis.findings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Target className="w-4 h-4" />
                        Key Findings
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {analysis.findings.map((finding, idx) => (
                          <div
                            key={idx}
                            className="p-2 bg-gray-50 rounded-md border-l-4 border-primary"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{finding.category}</span>
                              <div className="flex items-center gap-2">
                                {finding.severity && (
                                  <Badge className={getSeverityColor(finding.severity)} size="sm">
                                    {finding.severity}
                                  </Badge>
                                )}
                                <span className={`text-xs ${getConfidenceColor(finding.confidence)}`}>
                                  {finding.confidence}%
                                </span>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">{finding.description}</p>
                            {finding.location && (
                              <p className="text-xs text-gray-500 mt-1">Location: {finding.location}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {analysis.recommendations && analysis.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        Recommendations
                      </h4>
                      <ul className="space-y-1">
                        {analysis.recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Timestamp */}
                  <p className="text-xs text-gray-400 text-right">
                    Analyzed: {new Date(analysis.timestamp).toLocaleString()}
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
