import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Trash2,
  Edit,
  MapPin,
  Calendar,
  Layers,
  CloudOff,
  Satellite as SatelliteIcon,
  Share2,
  Plus,
  Map,
  Globe2
} from 'lucide-react';
import { imagesApi } from '@/lib/api';
import { formatDate, formatBytes, formatDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MapViewer, type ProjectionMode } from '@/components/MapViewer';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TIFFViewer } from '@/components/TIFFViewer';
import { NasaLayersPanel } from '@/components/NasaLayersPanel';
import { NasaTimeline } from '@/components/NasaTimeline';
import { AIAnalysisPanel } from '@/components/AIAnalysisPanel';
import { FusionTimeline } from '@/components/FusionTimeline';

export function ImageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', tags: '' });
  const [enabledLayers, setEnabledLayers] = useState<string[]>([]);
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('streetMap');
  const [layerDate, setLayerDate] = useState<string>(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });

  // Layers that only work in NASA mode (EPSG:4326)
  const nasaOnlyLayers = new Set([
    'MODIS_Terra_Thermal_Anomalies_All',
    'MODIS_Aqua_Thermal_Anomalies_All',
    'VIIRS_NOAA20_Thermal_Anomalies_375m_All',
    'VIIRS_SNPP_Thermal_Anomalies_375m_All',
    'MODIS_Terra_Aerosol_Optical_Depth',
    'MODIS_Terra_Cloud_Top_Temp_Day',
  ]);

  // Auto-clear NASA-only layers when switching to Street mode
  const handleModeChange = (newMode: ProjectionMode) => {
    if (newMode === 'streetMap') {
      // Remove any NASA-only layers that are currently enabled
      setEnabledLayers(prev => prev.filter(id => !nasaOnlyLayers.has(id)));
    }
    setProjectionMode(newMode);
  };

  const handleLayerToggle = (layerId: string, enabled: boolean, date?: string) => {
    if (enabled) {
      setEnabledLayers(prev => [...prev, layerId]);
    } else {
      setEnabledLayers(prev => prev.filter(id => id !== layerId));
    }
    if (date) setLayerDate(date);
  };

  const { data: image, isLoading } = useQuery({
    queryKey: ['image', id],
    queryFn: () => imagesApi.getById(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => imagesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['images'] });
      navigate('/gallery');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (updates: any) => imagesApi.update(id!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['image', id] });
      setIsEditModalOpen(false);
    },
  });

  if (isLoading || !image) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleEdit = () => {
    setEditForm({
      title: image.title || '',
      description: image.description || '',
      tags: image.tags?.join(', ') || '',
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      title: editForm.title,
      description: editForm.description,
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button variant="outline">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button
              variant="outline"
              onClick={() => image.previewUrl && window.open(image.previewUrl, '_blank')}
              disabled={!image.previewUrl}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={() => deleteMutation.mutate()}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Viewer */}
            <Card>
              {image.previewUrl ? (
                <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 relative overflow-hidden">
                  {/* Use img tag for PNG/JPG previews, TIFFViewer only for TIF files */}
                  {image.previewUrl.toLowerCase().endsWith('.tif') || image.previewUrl.toLowerCase().endsWith('.tiff') ? (
                    <TIFFViewer
                      url={image.previewUrl}
                      className="w-full h-full"
                    />
                  ) : (
                    <img
                      src={image.previewUrl}
                      alt={image.title || image.filename}
                      className="w-full h-full object-contain"
                    />
                  )}
                  <div className="absolute bottom-4 right-4">
                    <Button
                      onClick={() => window.open(image.previewUrl, '_blank')}
                      className="shadow-lg"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download Full Image
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 relative">
                  <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                    <Layers className="w-24 h-24 text-gray-400" />
                    <div className="text-center">
                      <p className="text-dark-light mb-2">TIFF/GeoTIFF Image</p>
                      <p className="text-sm text-dark-light">No preview available</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* NASA Timeline - shows when layers are enabled */}
            {enabledLayers.length > 0 && (
              <NasaTimeline
                selectedDate={layerDate || new Date(Date.now() - 86400000).toISOString().split('T')[0]}
                onDateChange={setLayerDate}
                capturedAt={image.capturedAt}
              />
            )}

            {/* Map */}
            {image.centerPoint && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Location</span>
                    <div className="flex items-center gap-2">
                      {enabledLayers.length > 0 && (
                        <span className="text-xs text-gray-500 font-normal">
                          {enabledLayers.length} layer{enabledLayers.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {/* Projection Mode Toggle */}
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        <button
                          onClick={() => handleModeChange('streetMap')}
                          className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                            projectionMode === 'streetMap'
                              ? 'bg-primary text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                          title="Street Map mode - OpenStreetMap base, limited NASA layers"
                        >
                          <Map className="w-3 h-3" />
                          Street
                        </button>
                        <button
                          onClick={() => handleModeChange('nasaMode')}
                          className={`px-2 py-1 text-xs flex items-center gap-1 transition-colors ${
                            projectionMode === 'nasaMode'
                              ? 'bg-primary text-white'
                              : 'bg-white text-gray-600 hover:bg-gray-50'
                          }`}
                          title="NASA mode - Blue Marble base, ALL NASA layers including fire detection"
                        >
                          <Globe2 className="w-3 h-3" />
                          NASA
                        </button>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {projectionMode === 'nasaMode' && (
                    <div className="mb-2 p-2 bg-blue-50 text-blue-700 text-xs rounded">
                      NASA Mode: All layers available including fire detection. Uses NASA Blue Marble base map.
                    </div>
                  )}
                  <MapViewer
                    images={[image]}
                    selectedImage={image}
                    height="400px"
                    gibsLayers={enabledLayers.map(id => ({ id, date: layerDate }))}
                    projectionMode={projectionMode}
                  />
                </CardContent>
              </Card>
            )}

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-dark-light">
                  {image.description || 'No description available.'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Metadata */}
            <Card>
              <CardHeader>
                <CardTitle>{image.title || image.filename}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Badge variant={image.status === 'READY' ? 'success' : 'warning'}>
                    {image.status}
                  </Badge>
                </div>

                <div className="space-y-3 text-sm">
                  {image.capturedAt && (
                    <div className="flex items-start space-x-2">
                      <Calendar className="w-4 h-4 text-dark-light mt-0.5" />
                      <div>
                        <div className="text-dark-light">Captured</div>
                        <div className="text-dark font-medium">{formatDate(image.capturedAt)}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start space-x-2">
                    <Calendar className="w-4 h-4 text-dark-light mt-0.5" />
                    <div>
                      <div className="text-dark-light">Uploaded</div>
                      <div className="text-dark font-medium">{formatDateTime(image.uploadedAt)}</div>
                    </div>
                  </div>

                  {image.centerPoint && (
                    <div className="flex items-start space-x-2">
                      <MapPin className="w-4 h-4 text-dark-light mt-0.5" />
                      <div>
                        <div className="text-dark-light">Coordinates</div>
                        <div className="text-dark font-medium">
                          {image.centerPoint.lat.toFixed(4)}, {image.centerPoint.lon.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  )}

                  {image.satelliteName && (
                    <div className="flex items-start space-x-2">
                      <SatelliteIcon className="w-4 h-4 text-dark-light mt-0.5" />
                      <div>
                        <div className="text-dark-light">Satellite</div>
                        <div className="text-dark font-medium">{image.satelliteName}</div>
                      </div>
                    </div>
                  )}

                  {image.cloudCoverage !== undefined && (
                    <div className="flex items-start space-x-2">
                      <CloudOff className="w-4 h-4 text-dark-light mt-0.5" />
                      <div>
                        <div className="text-dark-light">Cloud Coverage</div>
                        <div className="text-dark font-medium">{image.cloudCoverage}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Technical Details */}
            <Card>
              <CardHeader>
                <CardTitle>Technical Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-dark-light">File Size</span>
                  <span className="text-dark font-medium">{formatBytes(image.fileSize)}</span>
                </div>
                {image.width && image.height && (
                  <div className="flex justify-between">
                    <span className="text-dark-light">Dimensions</span>
                    <span className="text-dark font-medium">{image.width} × {image.height}</span>
                  </div>
                )}
                {image.resolution && (
                  <div className="flex justify-between">
                    <span className="text-dark-light">Resolution</span>
                    <span className="text-dark font-medium">{image.resolution} m/px</span>
                  </div>
                )}
                {image.bands && (
                  <div className="flex justify-between">
                    <span className="text-dark-light">Bands</span>
                    <span className="text-dark font-medium">
                      {typeof image.bands === 'number' ? image.bands : 'N/A'}
                    </span>
                  </div>
                )}
                {image.bitDepth && (
                  <div className="flex justify-between">
                    <span className="text-dark-light">Bit Depth</span>
                    <span className="text-dark font-medium">
                      {typeof image.bitDepth === 'number' ? image.bitDepth : Array.isArray(image.bitDepth) ? image.bitDepth[0] : 'N/A'} bit
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            {image.tags && image.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {image.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Collection
                </Button>
                <Link to={`/compare?image1=${image.id}`} className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Layers className="w-4 h-4 mr-2" />
                    Compare with Another
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* AI Analysis Panel */}
            <AIAnalysisPanel
              imageId={image.id}
              existingAnalysis={(image as any).analysis}
            />

            {/* Multi-Sensor Fusion Timeline */}
            <FusionTimeline
              imageId={image.id}
              centerPoint={image.centerPoint}
              capturedAt={image.capturedAt}
            />

            {/* NASA Layers Panel */}
            <NasaLayersPanel
              imageId={image.id}
              centerPoint={image.centerPoint}
              bounds={image.bounds}
              capturedAt={image.capturedAt}
              enrichment={(image as any).nasaEnrichment}
              onLayerToggle={handleLayerToggle}
              enabledLayers={enabledLayers}
              projectionMode={projectionMode}
            />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Image Details"
      >
        <div className="space-y-4">
          <Input
            label="Title"
            value={editForm.title}
            onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          />
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Description</label>
            <textarea
              className="w-full px-3 py-2 border border-light-border rounded-eoi focus:outline-none focus:ring-2 focus:ring-primary"
              rows={4}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
          <Input
            label="Tags (comma-separated)"
            value={editForm.tags}
            onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
          />
          <div className="flex space-x-2">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} className="flex-1" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
