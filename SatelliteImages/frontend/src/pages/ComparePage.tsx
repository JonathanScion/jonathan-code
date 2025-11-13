import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { GitCompare, Layers } from 'lucide-react';
import { imagesApi } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';

export function ComparePage() {
  const [searchParams] = useSearchParams();
  const [image1Id, setImage1Id] = useState(searchParams.get('image1') || '');
  const [image2Id, setImage2Id] = useState(searchParams.get('image2') || '');

  const { data: imagesResult } = useQuery({
    queryKey: ['images-all'],
    queryFn: () => imagesApi.search({}, 1, 100),
  });

  const { data: image1 } = useQuery({
    queryKey: ['image', image1Id],
    queryFn: () => imagesApi.getById(image1Id),
    enabled: !!image1Id,
  });

  const { data: image2 } = useQuery({
    queryKey: ['image', image2Id],
    queryFn: () => imagesApi.getById(image2Id),
    enabled: !!image2Id,
  });

  const imageOptions = imagesResult?.images.map(img => ({
    value: img.id,
    label: img.title || img.filename,
  })) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark mb-2">
            <GitCompare className="inline w-8 h-8 mr-2" />
            Compare Images
          </h1>
          <p className="text-dark-light">Compare two satellite images side by side</p>
        </div>

        {/* Image Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Image 1</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                options={[{ value: '', label: 'Select an image' }, ...imageOptions]}
                value={image1Id}
                onChange={(e) => setImage1Id(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Image 2</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                options={[{ value: '', label: 'Select an image' }, ...imageOptions]}
                value={image2Id}
                onChange={(e) => setImage2Id(e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Comparison View */}
        {image1 && image2 && (
          <Card>
            <CardHeader>
              <CardTitle>Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video bg-gray-200 rounded overflow-hidden">
                <div className="absolute inset-0 grid grid-cols-2 gap-1">
                  <div className="relative">
                    {image1.previewUrl ? (
                      <img
                        src={image1.previewUrl}
                        alt={image1.title || image1.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <Layers className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                      {image1.title || image1.filename}
                    </div>
                  </div>

                  <div className="relative">
                    {image2.previewUrl ? (
                      <img
                        src={image2.previewUrl}
                        alt={image2.title || image2.filename}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-300">
                        <Layers className="w-16 h-16 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                      {image2.title || image2.filename}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata Comparison */}
              <div className="mt-6 grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-dark mb-3">Image 1 Details</h3>
                  <dl className="space-y-2 text-sm">
                    {image1.capturedAt && (
                      <>
                        <dt className="text-dark-light">Captured</dt>
                        <dd className="text-dark">{new Date(image1.capturedAt).toLocaleDateString()}</dd>
                      </>
                    )}
                    {image1.resolution && (
                      <>
                        <dt className="text-dark-light">Resolution</dt>
                        <dd className="text-dark">{image1.resolution} m/px</dd>
                      </>
                    )}
                    {image1.cloudCoverage !== undefined && (
                      <>
                        <dt className="text-dark-light">Cloud Coverage</dt>
                        <dd className="text-dark">{image1.cloudCoverage}%</dd>
                      </>
                    )}
                  </dl>
                </div>

                <div>
                  <h3 className="font-semibold text-dark mb-3">Image 2 Details</h3>
                  <dl className="space-y-2 text-sm">
                    {image2.capturedAt && (
                      <>
                        <dt className="text-dark-light">Captured</dt>
                        <dd className="text-dark">{new Date(image2.capturedAt).toLocaleDateString()}</dd>
                      </>
                    )}
                    {image2.resolution && (
                      <>
                        <dt className="text-dark-light">Resolution</dt>
                        <dd className="text-dark">{image2.resolution} m/px</dd>
                      </>
                    )}
                    {image2.cloudCoverage !== undefined && (
                      <>
                        <dt className="text-dark-light">Cloud Coverage</dt>
                        <dd className="text-dark">{image2.cloudCoverage}%</dd>
                      </>
                    )}
                  </dl>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!image1 && !image2 && (
          <div className="text-center py-20">
            <GitCompare className="w-16 h-16 text-dark-light mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark mb-2">Select images to compare</h3>
            <p className="text-dark-light">Choose two images from the dropdowns above</p>
          </div>
        )}
      </div>
    </div>
  );
}
