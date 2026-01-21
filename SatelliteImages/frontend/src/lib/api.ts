import axios from 'axios';
import type {
  SatelliteImage,
  SearchFilters,
  SearchResult,
  UploadRequest,
  UploadResponse,
  Collection,
  UserStatistics,
  ImageComparison,
  ApiResponse,
  ExportRequest,
  ExportResponse,
  Annotation,
  ImagingRequest,
  CreateImagingRequestInput,
  UpdateImagingRequestInput,
  ImagingRequestFilters
} from '@shared/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Images
export const imagesApi = {
  search: async (filters: SearchFilters, page = 1, pageSize = 20): Promise<SearchResult> => {
    const { data } = await api.post<ApiResponse<SearchResult>>('/images/search', {
      filters,
      page,
      pageSize,
    });
    return data.data!;
  },

  getById: async (id: string): Promise<SatelliteImage> => {
    const { data } = await api.get<ApiResponse<SatelliteImage>>(`/images/${id}`);
    return data.data!;
  },

  requestUpload: async (request: UploadRequest): Promise<UploadResponse> => {
    const { data } = await api.post<ApiResponse<UploadResponse>>('/images/upload-url', request);
    return data.data!;
  },

  uploadFile: async (uploadUrl: string, file: File, onProgress?: (progress: number) => void) => {
    // Use multipart form data upload to local server
    const formData = new FormData();
    formData.append('file', file);

    // uploadUrl is relative (e.g., /api/images/{id}/upload) - use api instance
    await api.post(uploadUrl.replace('/api', ''), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
  },

  confirmUpload: async (imageId: string): Promise<SatelliteImage> => {
    const { data } = await api.post<ApiResponse<SatelliteImage>>(`/images/${imageId}/confirm`);
    return data.data!;
  },

  update: async (id: string, updates: Partial<SatelliteImage>): Promise<SatelliteImage> => {
    const { data } = await api.patch<ApiResponse<SatelliteImage>>(`/images/${id}`, updates);
    return data.data!;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/images/${id}`);
  },

  addAnnotation: async (imageId: string, annotation: Omit<Annotation, 'id' | 'createdAt'>): Promise<SatelliteImage> => {
    const { data } = await api.post<ApiResponse<SatelliteImage>>(
      `/images/${imageId}/annotations`,
      annotation
    );
    return data.data!;
  },

  deleteAnnotation: async (imageId: string, annotationId: string): Promise<SatelliteImage> => {
    const { data } = await api.delete<ApiResponse<SatelliteImage>>(
      `/images/${imageId}/annotations/${annotationId}`
    );
    return data.data!;
  },
};

// Collections
export const collectionsApi = {
  getAll: async (): Promise<Collection[]> => {
    const { data } = await api.get<ApiResponse<Collection[]>>('/collections');
    return data.data!;
  },

  getById: async (id: string): Promise<Collection> => {
    const { data } = await api.get<ApiResponse<Collection>>(`/collections/${id}`);
    return data.data!;
  },

  create: async (collection: Omit<Collection, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Collection> => {
    const { data } = await api.post<ApiResponse<Collection>>('/collections', collection);
    return data.data!;
  },

  update: async (id: string, updates: Partial<Collection>): Promise<Collection> => {
    const { data } = await api.patch<ApiResponse<Collection>>(`/collections/${id}`, updates);
    return data.data!;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/collections/${id}`);
  },

  addImages: async (id: string, imageIds: string[]): Promise<Collection> => {
    const { data } = await api.post<ApiResponse<Collection>>(`/collections/${id}/images`, {
      imageIds,
    });
    return data.data!;
  },

  removeImages: async (id: string, imageIds: string[]): Promise<Collection> => {
    const { data } = await api.delete<ApiResponse<Collection>>(`/collections/${id}/images`, {
      data: { imageIds },
    });
    return data.data!;
  },
};

// Analytics
export const analyticsApi = {
  getStatistics: async (): Promise<UserStatistics> => {
    const { data } = await api.get<ApiResponse<UserStatistics>>('/analytics/statistics');
    return data.data!;
  },
};

// Comparison
export const comparisonApi = {
  compare: async (imageId1: string, imageId2: string): Promise<ImageComparison> => {
    const { data } = await api.post<ApiResponse<ImageComparison>>('/comparison/compare', {
      imageId1,
      imageId2,
    });
    return data.data!;
  },
};

// Export
export const exportApi = {
  export: async (request: ExportRequest): Promise<ExportResponse> => {
    const { data} = await api.post<ApiResponse<ExportResponse>>('/export', request);
    return data.data!;
  },
};

// Imaging Requests
export const requestsApi = {
  list: async (filters?: ImagingRequestFilters): Promise<ImagingRequest[]> => {
    const params = new URLSearchParams();
    if (filters?.query) params.append('query', filters.query);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);

    const { data } = await api.get<ApiResponse<ImagingRequest[]>>(`/requests?${params.toString()}`);
    return data.data!;
  },

  getById: async (id: string): Promise<ImagingRequest> => {
    const { data } = await api.get<ApiResponse<ImagingRequest>>(`/requests/${id}`);
    return data.data!;
  },

  create: async (input: CreateImagingRequestInput): Promise<ImagingRequest> => {
    const { data } = await api.post<ApiResponse<ImagingRequest>>('/requests', input);
    return data.data!;
  },

  update: async (id: string, updates: UpdateImagingRequestInput): Promise<ImagingRequest> => {
    const { data } = await api.patch<ApiResponse<ImagingRequest>>(`/requests/${id}`, updates);
    return data.data!;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/requests/${id}`);
  },

  cancel: async (id: string, cancelReason?: string): Promise<ImagingRequest> => {
    const { data } = await api.post<ApiResponse<ImagingRequest>>(`/requests/${id}/cancel`, {
      cancelReason,
    });
    return data.data!;
  },
};

// NASA Integration APIs
export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface NasaGranule {
  id: string;
  title: string;
  collectionId: string;
  satellite: string;
  sensor: string;
  startDate: string;
  endDate: string;
  bbox: BoundingBox;
  browseUrl?: string;
  downloadUrl?: string;
  cloudCover?: number;
}

export interface NasaCoverageResult {
  granules: NasaGranule[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GIBSLayer {
  id: string;
  name: string;
  description: string;
  category: 'trueColor' | 'vegetation' | 'thermal' | 'atmosphere' | 'other';
  format: 'jpg' | 'png';
  tileMatrixSet: string;
  hasTime: boolean;
  startDate?: string;
  requiresNasaMode?: boolean; // True if layer only works in NASA Mode (EPSG:4326)
}

export interface FirePoint {
  latitude: number;
  longitude: number;
  brightness: number;
  acqDate: string;
  acqTime: string;
  satellite: string;
  confidence: number;
  frp: number;
  dayNight: 'D' | 'N';
}

export interface FireDataResult {
  fires: FirePoint[];
  total: number;
  source: string;
  bbox: BoundingBox;
  dateRange: { start: string; end: string };
}

export interface WeatherData {
  date: string;
  temperature: number;
  temperatureMin: number;
  temperatureMax: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  solarRadiation: number;
  cloudCover?: number;
}

export interface WeatherSummary {
  location: { lat: number; lon: number };
  period: { start: string; end: string };
  current: WeatherData;
  average: {
    temperature: number;
    humidity: number;
    precipitation: number;
  };
  data: WeatherData[];
}

export interface SatellitePass {
  satellite: string;
  noradId: number;
  startTime: string;
  endTime: string;
  maxElevation: number;
  startAzimuth: number;
  endAzimuth: number;
  duration: number;
}

export interface PassPredictionResult {
  location: { lat: number; lon: number; alt: number };
  passes: SatellitePass[];
  queriedAt: string;
}

export interface ImageEnrichment {
  timestamp: string;
  ndvi?: {
    available: boolean;
    layerUrl?: string;
  };
  fireRisk: {
    level: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
    nearbyFires: number;
    nearestKm?: number;
  };
  weather?: WeatherData;
  nasaCoverage?: {
    total: number;
    satellites: string[];
  };
  nextPass?: {
    satellite: string;
    time: string;
    elevation: number;
  };
}

// AI Analysis Types
export interface AIAnalysisFinding {
  category: string;
  description: string;
  confidence: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  area?: string;
}

export interface AIAnalysisResult {
  analysisType: 'general' | 'disaster' | 'landuse' | 'change';
  timestamp: string;
  summary: string;
  confidence: number;
  findings: AIAnalysisFinding[];
  recommendations: string[];
  rawAnalysis?: string;
  // Disaster-specific fields
  disasterType?: 'fire' | 'flood' | 'storm' | 'earthquake' | 'drought' | 'none';
  affectedArea?: string;
  severity?: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  urgency?: 'none' | 'low' | 'medium' | 'high' | 'critical';
  // Land use-specific fields
  classifications?: {
    type: 'urban' | 'agricultural' | 'forest' | 'water' | 'barren' | 'wetland' | 'grassland' | 'snow';
    percentage: number;
    confidence: number;
  }[];
  dominantType?: string;
}

export type AnalysisType = 'general' | 'disaster' | 'landuse';

// AI Analysis API
export const aiApi = {
  analyzeImage: async (
    imageId: string,
    analysisType: AnalysisType = 'general'
  ): Promise<AIAnalysisResult> => {
    const { data } = await api.post<ApiResponse<AIAnalysisResult>>(
      `/ai/analyze/${imageId}`,
      { analysisType }
    );
    return data.data!;
  },

  compareImages: async (
    imageId1: string,
    imageId2: string
  ): Promise<AIAnalysisResult> => {
    const { data } = await api.post<ApiResponse<AIAnalysisResult>>('/ai/compare', {
      imageId1,
      imageId2,
    });
    return data.data!;
  },
};

export const nasaApi = {
  // Search NASA CMR for satellite imagery coverage
  searchCoverage: async (
    bbox: BoundingBox,
    startDate?: string,
    endDate?: string,
    satellite?: string,
    page = 1,
    pageSize = 20
  ): Promise<NasaCoverageResult> => {
    const { data } = await api.post<ApiResponse<NasaCoverageResult>>('/nasa/coverage', {
      bbox,
      startDate,
      endDate,
      satellite,
      page,
      pageSize,
    });
    return data.data!;
  },

  // Get available GIBS layers
  getGibsLayers: async (): Promise<GIBSLayer[]> => {
    const { data } = await api.get<ApiResponse<GIBSLayer[]>>('/nasa/gibs/layers');
    return data.data!;
  },

  // Get GIBS tile URL configuration for Leaflet
  getGibsTileUrl: async (layerId: string, date?: string): Promise<{ url: string; options: any }> => {
    const params = new URLSearchParams({ layerId });
    if (date) params.append('date', date);
    const { data } = await api.get<ApiResponse<{ url: string; options: any }>>(`/nasa/gibs/tile-url?${params}`);
    return data.data!;
  },

  // Get fire data from NASA FIRMS
  getFireData: async (
    bbox: BoundingBox,
    days = 1,
    source = 'VIIRS_NOAA20_NRT'
  ): Promise<FireDataResult> => {
    const { data } = await api.post<ApiResponse<FireDataResult>>('/nasa/fires', {
      bbox,
      days,
      source,
    });
    return data.data!;
  },

  // Get weather data from NASA POWER
  getWeather: async (
    lat: number,
    lon: number,
    startDate?: string,
    endDate?: string
  ): Promise<WeatherSummary> => {
    const { data } = await api.post<ApiResponse<WeatherSummary>>('/nasa/weather', {
      lat,
      lon,
      startDate,
      endDate,
    });
    return data.data!;
  },

  // Get satellite pass predictions
  getSatellitePasses: async (
    lat: number,
    lon: number,
    alt = 0,
    satellites?: string[],
    days = 5
  ): Promise<PassPredictionResult> => {
    const { data } = await api.post<ApiResponse<PassPredictionResult>>('/nasa/satellites/passes', {
      lat,
      lon,
      alt,
      satellites,
      days,
    });
    return data.data!;
  },

  // Enrich an image with NASA data
  enrichImage: async (imageId: string): Promise<ImageEnrichment> => {
    const { data } = await api.post<ApiResponse<ImageEnrichment>>(`/nasa/enrich/${imageId}`);
    return data.data!;
  },
};

// Disaster Monitoring Types
export interface HazardPoint {
  id: string;
  type: 'earthquake' | 'fire' | 'flood' | 'cyclone' | 'volcano' | 'wildfire' | 'other';
  title: string;
  latitude: number;
  longitude: number;
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  timestamp: string;
  details: {
    magnitude?: number;
    depth?: number;
    alertLevel?: string;
    country?: string;
    url?: string;
    [key: string]: any;
  };
}

export interface DisasterSummary {
  timestamp: string;
  counts: {
    earthquakes: number;
    fires: number;
    floods: number;
    cyclones: number;
    volcanoes: number;
    total: number;
  };
  recentSignificant: HazardPoint[];
  alerts: {
    red: number;
    orange: number;
  };
}

export interface Earthquake {
  id: string;
  title: string;
  magnitude: number;
  place: string;
  time: string;
  latitude: number;
  longitude: number;
  depth: number;
  url: string;
  tsunami: boolean;
  alert?: 'green' | 'yellow' | 'orange' | 'red';
}

export interface DisasterAlert {
  id: string;
  title: string;
  description: string;
  hazardType: 'EQ' | 'TC' | 'FL' | 'VO' | 'DR' | 'WF';
  hazardName: string;
  alertLevel: 'Green' | 'Orange' | 'Red';
  severity: number;
  country: string;
  latitude: number;
  longitude: number;
  startDate: string;
  url: string;
}

// Multi-Sensor Fusion Types
export type TimelineSource = 'satellite' | 'weather' | 'fire' | 'pass' | 'earthquake';

export interface TimelineEntry {
  id: string;
  timestamp: string;
  source: TimelineSource;
  title: string;
  description: string;
  icon: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  data: Record<string, any>;
}

export interface TimelineResult {
  entries: TimelineEntry[];
  dateRange: { start: string; end: string };
  sources: TimelineSource[];
  location?: { lat: number; lon: number };
}

export interface IntelligenceReport {
  generatedAt: string;
  location: { lat: number; lon: number };
  dateRange: { start: string; end: string };
  summary: string;
  sections: {
    title: string;
    content: string;
    data?: any;
  }[];
  recommendations: string[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  timeline: TimelineEntry[];
}

// Multi-Sensor Fusion API
export const fusionApi = {
  getTimeline: async (
    lat: number,
    lon: number,
    startDate?: string,
    endDate?: string,
    sources?: TimelineSource[]
  ): Promise<TimelineResult> => {
    const { data } = await api.post<ApiResponse<TimelineResult>>('/fusion/timeline', {
      lat,
      lon,
      startDate,
      endDate,
      sources,
    });
    return data.data!;
  },

  getReportForImage: async (imageId: string): Promise<IntelligenceReport> => {
    const { data } = await api.post<ApiResponse<IntelligenceReport>>(
      `/fusion/report/${imageId}`
    );
    return data.data!;
  },

  getReportForLocation: async (
    lat: number,
    lon: number,
    date?: string
  ): Promise<IntelligenceReport> => {
    const { data } = await api.post<ApiResponse<IntelligenceReport>>('/fusion/report', {
      lat,
      lon,
      date,
    });
    return data.data!;
  },
};

// Disaster Monitoring API
export const disastersApi = {
  getSummary: async (): Promise<DisasterSummary> => {
    const { data } = await api.get<ApiResponse<DisasterSummary>>('/disasters/summary');
    return data.data!;
  },

  getEarthquakes: async (
    minMagnitude = 2.5,
    days = 7,
    limit = 100
  ): Promise<Earthquake[]> => {
    const { data } = await api.get<ApiResponse<Earthquake[]>>(
      `/disasters/earthquakes?minMagnitude=${minMagnitude}&days=${days}&limit=${limit}`
    );
    return data.data!;
  },

  getEarthquakesInBbox: async (
    bbox: BoundingBox,
    days = 7,
    minMagnitude = 2.5
  ): Promise<Earthquake[]> => {
    const { data } = await api.post<ApiResponse<Earthquake[]>>(
      '/disasters/earthquakes/bbox',
      { bbox, days, minMagnitude }
    );
    return data.data!;
  },

  getFloods: async (limit = 50): Promise<DisasterAlert[]> => {
    const { data } = await api.get<ApiResponse<DisasterAlert[]>>(
      `/disasters/floods?limit=${limit}`
    );
    return data.data!;
  },

  getStorms: async (limit = 50): Promise<DisasterAlert[]> => {
    const { data } = await api.get<ApiResponse<DisasterAlert[]>>(
      `/disasters/storms?limit=${limit}`
    );
    return data.data!;
  },

  getAlerts: async (limit = 100): Promise<DisasterAlert[]> => {
    const { data } = await api.get<ApiResponse<DisasterAlert[]>>(
      `/disasters/alerts?limit=${limit}`
    );
    return data.data!;
  },

  getAllHazards: async (minMagnitude = 2.5, days = 7): Promise<HazardPoint[]> => {
    const { data } = await api.get<ApiResponse<HazardPoint[]>>(
      `/disasters/all?minMagnitude=${minMagnitude}&days=${days}`
    );
    return data.data!;
  },
};

// ============ AGRICULTURAL INTELLIGENCE TYPES ============

export interface CropType {
  id: string;
  name: string;
}

export interface CropHealthScore {
  overall: number;
  ndviScore: number;
  moistureScore: number;
  temperatureScore: number;
  category: 'critical' | 'poor' | 'fair' | 'good' | 'excellent';
  trend: 'declining' | 'stable' | 'improving';
}

export interface DroughtIndex {
  level: 'none' | 'abnormally_dry' | 'moderate' | 'severe' | 'extreme' | 'exceptional';
  value: number;
  precipitationDeficit: number;
  daysWithoutRain: number;
  soilMoistureEstimate: 'very_low' | 'low' | 'moderate' | 'adequate' | 'high';
}

export interface YieldPrediction {
  estimatedYieldPercent: number;
  confidence: number;
  factors: {
    name: string;
    impact: 'positive' | 'negative' | 'neutral';
    description: string;
  }[];
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

export interface AgriculturalAnalysis {
  location: { lat: number; lon: number };
  analysisDate: string;
  cropType: string;
  cropHealth: CropHealthScore;
  droughtIndex: DroughtIndex;
  yieldPrediction: YieldPrediction;
  weatherSummary: {
    avgTemp: number;
    totalPrecip: number;
    avgHumidity: number;
    growingDegreeDays: number;
  };
  recommendations: string[];
  alerts: {
    type: 'drought' | 'frost' | 'heat' | 'excess_rain' | 'pest_risk';
    severity: 'low' | 'medium' | 'high';
    message: string;
  }[];
  seasonalComparison?: {
    currentNDVI: number;
    historicalAvgNDVI: number;
    deviation: number;
  };
}

export interface NDVIClassification {
  category: string;
  description: string;
  color: string;
}

// Agricultural Intelligence API
export const agricultureApi = {
  getCropTypes: async (): Promise<CropType[]> => {
    const { data } = await api.get<ApiResponse<CropType[]>>('/agriculture/crop-types');
    return data.data!;
  },

  analyze: async (
    lat: number,
    lon: number,
    ndviValue?: number,
    cropType?: string,
    historicalNDVI?: number[]
  ): Promise<AgriculturalAnalysis> => {
    const { data } = await api.post<ApiResponse<AgriculturalAnalysis>>('/agriculture/analyze', {
      lat,
      lon,
      ndviValue,
      cropType,
      historicalNDVI,
    });
    return data.data!;
  },

  analyzeImage: async (
    imageId: string,
    cropType?: string,
    ndviValue?: number
  ): Promise<AgriculturalAnalysis> => {
    const { data } = await api.post<ApiResponse<AgriculturalAnalysis>>(
      `/agriculture/analyze/${imageId}`,
      { cropType, ndviValue }
    );
    return data.data!;
  },

  classifyNDVI: async (value: number): Promise<NDVIClassification> => {
    const { data } = await api.get<ApiResponse<NDVIClassification>>(
      `/agriculture/ndvi-classify?value=${value}`
    );
    return data.data!;
  },
};

// ============ AUTOMATED TASKING TYPES ============

export interface CollectionWindow {
  startTime: string;
  endTime: string;
  satellite: string;
  score: number;
  cloudCoverage: number;
  maxElevation: number;
  sunElevation: number;
  factors: {
    name: string;
    value: number;
    weight: number;
    description: string;
  }[];
  recommended: boolean;
}

export interface TaskingRecommendation {
  location: { lat: number; lon: number };
  analysisDate: string;
  optimalWindows: CollectionWindow[];
  nextBestWindow: CollectionWindow | null;
  cloudForecast: {
    date: string;
    expectedCoverage: number;
    confidence: number;
  }[];
  satelliteSchedule: {
    satellite: string;
    nextPass: string;
    frequency: string;
  }[];
  priorities: {
    urgencyScore: number;
    factors: string[];
    recommendedAction: string;
  };
}

export interface TaskingCriteria {
  maxCloudCoverage?: number;
  minElevation?: number;
  preferredSatellites?: string[];
  timeOfDay?: 'morning' | 'midday' | 'afternoon' | 'any';
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  sensorType?: 'optical' | 'sar' | 'any';
}

export interface CloudFreeWindows {
  windows: { date: string; cloudCoverage: number; suitable: boolean }[];
  nextClearDay: string | null;
  avgCloudCoverage: number;
}

export interface TaskingScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  recommendation: string;
}

// Automated Tasking API
export const taskingApi = {
  getOptimalWindows: async (
    lat: number,
    lon: number,
    criteria?: TaskingCriteria
  ): Promise<TaskingRecommendation> => {
    const { data } = await api.post<ApiResponse<TaskingRecommendation>>(
      '/tasking/optimal-windows',
      { lat, lon, criteria }
    );
    return data.data!;
  },

  findCloudFreeWindows: async (
    lat: number,
    lon: number,
    maxCloudCoverage = 15,
    daysAhead = 7
  ): Promise<CloudFreeWindows> => {
    const { data } = await api.post<ApiResponse<CloudFreeWindows>>('/tasking/cloud-free', {
      lat,
      lon,
      maxCloudCoverage,
      daysAhead,
    });
    return data.data!;
  },

  scoreRequest: async (
    cloudCoverage: number,
    elevation: number,
    timeUntilPass: number,
    urgency?: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<TaskingScore> => {
    const { data } = await api.post<ApiResponse<TaskingScore>>('/tasking/score', {
      cloudCoverage,
      elevation,
      timeUntilPass,
      urgency,
    });
    return data.data!;
  },

  getRecommendationsForImage: async (
    imageId: string,
    criteria?: TaskingCriteria
  ): Promise<TaskingRecommendation> => {
    const { data } = await api.post<ApiResponse<TaskingRecommendation>>(
      `/tasking/recommend/${imageId}`,
      { criteria }
    );
    return data.data!;
  },
};

// ============ MARITIME/ASSET TRACKING TYPES ============

export interface Vessel {
  mmsi: string;
  name: string;
  callsign?: string;
  imo?: string;
  type: string;
  typeCode: number;
  flag?: string;
  destination?: string;
  eta?: string;
  position: { lat: number; lon: number };
  course: number;
  speed: number;
  heading?: number;
  draught?: number;
  length?: number;
  width?: number;
  lastUpdate: string;
  status?: string;
}

export interface Aircraft {
  icao24: string;
  callsign?: string;
  originCountry: string;
  position: { lat: number; lon: number; altitude: number };
  velocity: number;
  heading: number;
  verticalRate?: number;
  onGround: boolean;
  lastUpdate: string;
  squawk?: string;
  category?: string;
}

export interface VesselTrackingResult {
  data: Vessel[];
  total: number;
  timestamp: string;
  source: string;
  bounds: BoundingBox;
}

export interface AircraftTrackingResult {
  data: Aircraft[];
  total: number;
  timestamp: string;
  source: string;
  bounds: BoundingBox;
}

export interface AssetCorrelation {
  imageId: string;
  imageBounds: BoundingBox;
  capturedAt: string;
  vessels: {
    vessel: Vessel;
    distanceKm: number;
    inFrame: boolean;
  }[];
  aircraft: {
    aircraft: Aircraft;
    distanceKm: number;
    inFrame: boolean;
  }[];
  summary: {
    vesselsInFrame: number;
    vesselTypes: Record<string, number>;
    aircraftInFrame: number;
    nearbyPorts: string[];
  };
}

// Maritime/Asset Tracking API
export const maritimeApi = {
  getVessels: async (bounds: BoundingBox): Promise<VesselTrackingResult> => {
    const { data } = await api.post<ApiResponse<VesselTrackingResult>>('/maritime/vessels', {
      bounds,
    });
    return data.data!;
  },

  getAircraft: async (bounds: BoundingBox): Promise<AircraftTrackingResult> => {
    const { data } = await api.post<ApiResponse<AircraftTrackingResult>>('/maritime/aircraft', {
      bounds,
    });
    return data.data!;
  },

  correlateWithImage: async (imageId: string): Promise<AssetCorrelation> => {
    const { data } = await api.post<ApiResponse<AssetCorrelation>>(
      `/maritime/correlate/${imageId}`
    );
    return data.data!;
  },

  getAllAssets: async (bounds: BoundingBox): Promise<{
    vessels: VesselTrackingResult;
    aircraft: AircraftTrackingResult;
    timestamp: string;
    bounds: BoundingBox;
  }> => {
    const { data } = await api.post<ApiResponse<{
      vessels: VesselTrackingResult;
      aircraft: AircraftTrackingResult;
      timestamp: string;
      bounds: BoundingBox;
    }>>('/maritime/all', { bounds });
    return data.data!;
  },
};

export default api;
