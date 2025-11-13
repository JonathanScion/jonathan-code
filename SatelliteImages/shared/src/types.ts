// Satellite Image Metadata
export interface SatelliteImage {
  id: string;
  userId: string;
  filename: string;
  originalFilename: string;
  s3Key: string;
  s3Bucket: string;
  fileSize: number;
  uploadedAt: string;
  capturedAt?: string;

  // Geographic metadata
  bounds?: BoundingBox;
  centerPoint?: GeoPoint;
  projection?: string;

  // Technical metadata
  resolution?: number; // meters per pixel
  width?: number;
  height?: number;
  bands?: number;
  bitDepth?: number;

  // Satellite information
  satelliteName?: string;
  sensorType?: string;
  cloudCoverage?: number; // percentage 0-100

  // User metadata
  title?: string;
  description?: string;
  tags?: string[];
  collectionIds?: string[];

  // Processing
  thumbnailUrl?: string;
  previewUrl?: string;
  status: ImageStatus;

  // Annotations
  annotations?: Annotation[];

  // Analysis results
  analysis?: ImageAnalysis;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}

export enum ImageStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  ERROR = 'ERROR'
}

export interface Annotation {
  id: string;
  type: 'polygon' | 'point' | 'line' | 'rectangle';
  coordinates: GeoPoint[];
  label?: string;
  description?: string;
  color?: string;
  createdAt: string;
}

export interface ImageAnalysis {
  ndvi?: {
    min: number;
    max: number;
    mean: number;
    histogram?: number[];
  };
  detectedObjects?: DetectedObject[];
  landCover?: LandCoverClassification[];
}

export interface DetectedObject {
  type: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LandCoverClassification {
  class: string;
  percentage: number;
  color: string;
}

// Collections
export interface Collection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
  isPublic: boolean;
  shareToken?: string;
}

// Search & Filters
export interface SearchFilters {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  bounds?: BoundingBox;
  cloudCoverageMax?: number;
  tags?: string[];
  satelliteName?: string;
  resolutionMin?: number;
  resolutionMax?: number;
  collectionId?: string;
}

export interface SearchResult {
  images: SatelliteImage[];
  total: number;
  page: number;
  pageSize: number;
}

// Upload
export interface UploadRequest {
  filename: string;
  contentType: string;
  fileSize: number;
  // Optional metadata extracted from GeoTIFF on frontend
  centerPoint?: GeoPoint;
  bounds?: BoundingBox;
  width?: number;
  height?: number;
  bands?: number;
  bitDepth?: number;
  resolution?: number;
  capturedAt?: string;
  satelliteName?: string;
  sensorType?: string;
  projection?: string;
  cloudCoverage?: number;
}


export interface UploadResponse {
  uploadUrl: string;
  imageId: string;
  s3Key: string;
}

// API Responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Comparison
export interface ImageComparison {
  imageId1: string;
  imageId2: string;
  changeDetection?: {
    changedPixels: number;
    percentageChanged: number;
    changeMap?: string; // S3 URL to generated change map
  };
}

// Statistics
export interface UserStatistics {
  totalImages: number;
  totalStorage: number; // bytes
  coverageArea: number; // square kilometers
  uploadsByMonth: { [month: string]: number };
  imagesByTag: { [tag: string]: number };
  imagesBySatellite: { [satellite: string]: number };
}

// Export
export interface ExportRequest {
  imageIds: string[];
  format: 'geotiff' | 'png' | 'jpeg';
  includeMetadata: boolean;
}

export interface ExportResponse {
  exportId: string;
  downloadUrl: string;
  expiresAt: string;
}

// Imaging Request Scheduling
export enum RequestStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export enum RequestPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export interface ImagingRequest {
  id: string;
  userId: string;

  // Location details
  targetLocation: GeoPoint;
  targetBounds?: BoundingBox;
  locationName?: string;

  // Scheduling details
  requestedStartDate: string; // ISO date
  requestedEndDate: string; // ISO date
  scheduledDate?: string; // Actual scheduled imaging date
  completedDate?: string;

  // Request metadata
  priority: RequestPriority;
  status: RequestStatus;
  title: string;
  description?: string;

  // Technical requirements
  minResolution?: number; // meters per pixel
  maxCloudCoverage?: number; // percentage
  preferredSatellites?: string[];

  // Recurrence (for Phase 2+)
  isRecurring?: boolean;
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';

  // Results
  capturedImageIds?: string[]; // Links to resulting SatelliteImage IDs

  // Timestamps
  createdAt: string;
  updatedAt: string;

  // Notes and communication
  notes?: string;
  cancelReason?: string;
}

export interface CreateImagingRequestInput {
  targetLocation: GeoPoint;
  targetBounds?: BoundingBox;
  locationName?: string;
  requestedStartDate: string;
  requestedEndDate: string;
  priority: RequestPriority;
  title: string;
  description?: string;
  minResolution?: number;
  maxCloudCoverage?: number;
  preferredSatellites?: string[];
}

export interface UpdateImagingRequestInput {
  status?: RequestStatus;
  scheduledDate?: string;
  priority?: RequestPriority;
  title?: string;
  description?: string;
  notes?: string;
  cancelReason?: string;
}

export interface ImagingRequestFilters {
  query?: string;
  status?: RequestStatus;
  priority?: RequestPriority;
  startDate?: string;
  endDate?: string;
  userId?: string;
}
