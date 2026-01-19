import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Grid3x3, List, Map as MapIcon, Loader, Trash2, Layers, X } from 'lucide-react';
import { useAtom } from 'jotai';
import { imagesApi } from '@/lib/api';
import { viewModeAtom, searchFiltersAtom, selectedImagesAtom } from '@/lib/store';
import { SearchBar } from '@/components/SearchBar';
import { FilterPanel } from '@/components/FilterPanel';
import { ImageCard } from '@/components/ImageCard';
import { MapViewer } from '@/components/MapViewer';
import { GlobeViewer } from '@/components/GlobeViewer';
import { Button } from '@/components/ui/Button';
import type { SatelliteImage, SearchFilters } from '@shared/types';

export function GalleryPage() {
  const [viewMode, setViewMode] = useAtom(viewModeAtom);
  const [filters, setFilters] = useAtom(searchFiltersAtom);
  const [selectedImages, setSelectedImages] = useAtom(selectedImagesAtom);
  const [page, setPage] = useState(1);
  const [showGlobe, setShowGlobe] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['images', filters, page],
    queryFn: () => imagesApi.search(filters, page, 20),
  });

  // Bulk delete mutation
  const deleteSelectedImages = async () => {
    if (!window.confirm(`Delete ${selectedImages.length} image(s)? This cannot be undone.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await Promise.all(selectedImages.map(img => imagesApi.delete(img.id)));
      setSelectedImages([]);
      queryClient.invalidateQueries({ queryKey: ['images'] });
    } catch (err) {
      console.error('Error deleting images:', err);
      alert('Failed to delete some images');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCompareSelected = () => {
    if (selectedImages.length >= 2) {
      navigate(`/compare?image1=${selectedImages[0].id}&image2=${selectedImages[1].id}`);
    }
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const handleSearch = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, query }));
    setPage(1);
  }, [setFilters]);

  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, [setFilters]);

  const handleImageSelect = (image: SatelliteImage) => {
    setSelectedImages(prev =>
      prev.some(img => img.id === image.id)
        ? prev.filter(img => img.id !== image.id)
        : [...prev, image]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">Image Gallery</h1>
          <p className="text-dark-light">Browse and search your satellite imagery collection</p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <SearchBar onSearch={handleSearch} />
          </div>
          <FilterPanel filters={filters} onFiltersChange={handleFiltersChange} />
        </div>

        {/* View Controls */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'map' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <MapIcon className="w-4 h-4" />
            </Button>
            <Button
              variant={showGlobe ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setShowGlobe(!showGlobe)}
            >
              🌍 Globe
            </Button>
          </div>

          {selectedImages.length > 0 && (
            <div className="flex items-center space-x-2 bg-primary/10 px-3 py-1.5 rounded-lg">
              <span className="text-sm font-medium text-primary">
                {selectedImages.length} selected
              </span>
              <div className="h-4 w-px bg-primary/30" />
              <Button
                variant="ghost"
                size="sm"
                onClick={deleteSelectedImages}
                disabled={isDeleting}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
              {selectedImages.length >= 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCompareSelected}
                  className="text-primary"
                >
                  <Layers className="w-4 h-4 mr-1" />
                  Compare
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-gray-500"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-red-600">Error loading images. Please try again.</p>
          </div>
        )}

        {data && (
          <>
            {showGlobe && (
              <div className="mb-8">
                <GlobeViewer images={data.images} />
              </div>
            )}

            {viewMode === 'map' && (
              <MapViewer images={data.images} height="600px" />
            )}

            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data.images.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    onSelect={handleImageSelect}
                    isSelected={selectedImages.some(img => img.id === image.id)}
                    showCheckbox
                  />
                ))}
              </div>
            )}

            {viewMode === 'list' && (
              <div className="space-y-4">
                {data.images.map((image) => (
                  <ImageCard
                    key={image.id}
                    image={image}
                    onSelect={handleImageSelect}
                    isSelected={selectedImages.some(img => img.id === image.id)}
                    showCheckbox
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            {data.total > 20 && (
              <div className="mt-8 flex justify-center space-x-2">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-dark-light">
                  Page {page} of {Math.ceil(data.total / 20)}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= Math.ceil(data.total / 20)}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}

            {data.images.length === 0 && (
              <div className="text-center py-20">
                <p className="text-dark-light text-lg">No images found. Try adjusting your filters.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
