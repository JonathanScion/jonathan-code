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

  uploadToS3: async (url: string, file: File, onProgress?: (progress: number) => void) => {
    await axios.put(url, file, {
      headers: {
        'Content-Type': file.type,
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

export default api;
