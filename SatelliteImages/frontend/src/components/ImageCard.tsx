import { Link } from 'react-router-dom';
import { Calendar, MapPin, Layers, CloudOff, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { SatelliteImage } from '@shared/types';
import { formatDate, formatBytes } from '@/lib/utils';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { TIFFViewer } from './TIFFViewer';

interface ImageCardProps {
  image: SatelliteImage;
  onSelect?: (image: SatelliteImage) => void;
  isSelected?: boolean;
  showCheckbox?: boolean;
}

export function ImageCard({ image, onSelect, isSelected, showCheckbox }: ImageCardProps) {

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Link to={`/image/${image.id}`}>
        <Card hover className="overflow-hidden relative group">
          {showCheckbox && (
            <div
              className="absolute top-2 right-2 z-10"
              onClick={(e) => {
                e.preventDefault();
                onSelect?.(image);
              }}
            >
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                isSelected ? 'bg-primary border-primary' : 'bg-white border-gray-300'
              }`}>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
            </div>
          )}

          {/* Thumbnail */}
          <div className="aspect-video bg-gradient-to-br from-gray-200 to-gray-300 relative overflow-hidden">
            {image.previewUrl ? (
              image.previewUrl.toLowerCase().endsWith('.tif') || image.previewUrl.toLowerCase().endsWith('.tiff') ? (
                <TIFFViewer
                  url={image.previewUrl}
                  className="w-full h-full"
                  maxDimension={400}
                />
              ) : (
                <img
                  src={image.previewUrl}
                  alt={image.title || image.filename}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Layers className="w-16 h-16 text-gray-400 mb-2" />
                <span className="text-xs text-gray-500">TIFF/GeoTIFF</span>
              </div>
            )}

            {/* Status badge */}
            <div className="absolute top-2 left-2 z-10">
              <Badge variant={image.status === 'READY' ? 'success' : 'warning'}>
                {image.status}
              </Badge>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className="font-semibold text-dark mb-2 truncate">
              {image.title || image.filename}
            </h3>

            <div className="space-y-2 text-sm text-dark-light">
              {image.capturedAt && (
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(image.capturedAt)}</span>
                </div>
              )}

              {image.centerPoint && (
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {image.centerPoint.lat.toFixed(4)}, {image.centerPoint.lon.toFixed(4)}
                  </span>
                </div>
              )}

              {image.cloudCoverage !== undefined && (
                <div className="flex items-center space-x-2">
                  <CloudOff className="w-4 h-4" />
                  <span>{image.cloudCoverage}% cloud coverage</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <span className="text-xs">{formatBytes(image.fileSize)}</span>
                {image.resolution && (
                  <span className="text-xs">{image.resolution}m/px</span>
                )}
              </div>
            </div>

            {/* Tags */}
            {image.tags && image.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {image.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {image.tags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{image.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
