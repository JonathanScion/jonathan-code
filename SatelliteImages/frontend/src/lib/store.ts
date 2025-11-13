import { atom } from 'jotai';
import type { SatelliteImage, SearchFilters } from '@shared/types';

// Selected images for comparison
export const selectedImagesAtom = atom<SatelliteImage[]>([]);

// Current search filters
export const searchFiltersAtom = atom<SearchFilters>({});

// View mode (grid, list, map)
export const viewModeAtom = atom<'grid' | 'list' | 'map'>('grid');

// Upload progress tracking
export interface UploadProgress {
  file: File;
  progress: number;
  imageId?: string;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

export const uploadProgressAtom = atom<UploadProgress[]>([]);

// Globe view state
export const globeViewAtom = atom({
  enabled: true,
  autoRotate: true,
});

// Sidebar state
export const sidebarOpenAtom = atom(true);
