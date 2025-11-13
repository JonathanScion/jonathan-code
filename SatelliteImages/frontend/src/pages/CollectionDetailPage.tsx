import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { collectionsApi, imagesApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ImageCard } from '@/components/ImageCard';
import { formatDate } from '@/lib/utils';

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: collection, isLoading: isLoadingCollection } = useQuery({
    queryKey: ['collection', id],
    queryFn: () => collectionsApi.getById(id!),
    enabled: !!id,
  });

  const { data: imagesData } = useQuery({
    queryKey: ['collection-images', id],
    queryFn: async () => {
      if (!collection?.imageIds.length) return [];
      // In a real app, you'd have a batch endpoint
      const images = await Promise.all(
        collection.imageIds.map(imageId => imagesApi.getById(imageId))
      );
      return images;
    },
    enabled: !!collection,
  });

  if (isLoadingCollection || !collection) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" onClick={() => navigate('/collections')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Collections
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">{collection.name}</h1>
          <p className="text-dark-light mb-4">{collection.description}</p>
          <div className="flex items-center space-x-4 text-sm text-dark-light">
            <span>{collection.imageIds.length} images</span>
            <span>•</span>
            <span>Updated {formatDate(collection.updatedAt)}</span>
          </div>
        </div>

        {imagesData && imagesData.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {imagesData.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-dark-light">No images in this collection yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
