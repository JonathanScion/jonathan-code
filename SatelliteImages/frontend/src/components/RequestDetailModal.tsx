import { X, MapPin, Calendar, Clock, CheckCircle, AlertCircle, XCircle, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import type { ImagingRequest, RequestStatus } from '@shared/types';

interface RequestDetailModalProps {
  request: ImagingRequest;
  onClose: () => void;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
}

export function RequestDetailModal({ request, onClose, onDelete, isDeleting }: RequestDetailModalProps) {
  const getStatusIcon = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'SCHEDULED':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'FAILED':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'CANCELLED':
        return <XCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: RequestStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      case 'CANCELLED':
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-start">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-dark mb-2">{request.title}</h2>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center space-x-1 px-3 py-1 rounded-eoi text-sm font-medium ${getStatusColor(request.status)}`}>
                {getStatusIcon(request.status)}
                <span>{request.status}</span>
              </span>
              <span className="text-sm text-dark-light">ID: {request.id}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dark-light hover:text-dark transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Description */}
          {request.description && (
            <div>
              <h3 className="text-lg font-semibold text-dark mb-2">Description</h3>
              <p className="text-dark-light">{request.description}</p>
            </div>
          )}

          {/* Location Information */}
          <div>
            <h3 className="text-lg font-semibold text-dark mb-3">Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="flex items-center text-dark-light mb-1">
                  <MapPin className="w-4 h-4 mr-2" />
                  Location Name
                </div>
                <div className="text-dark font-medium">
                  {request.locationName || 'Not specified'}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="text-dark-light mb-1">GPS Coordinates</div>
                <div className="text-dark font-medium">
                  {request.targetLocation.lat.toFixed(6)}, {request.targetLocation.lon.toFixed(6)}
                </div>
              </div>
            </div>
          </div>

          {/* Timing Information */}
          <div>
            <h3 className="text-lg font-semibold text-dark mb-3">Timing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="flex items-center text-dark-light mb-1">
                  <Calendar className="w-4 h-4 mr-2" />
                  Requested Window
                </div>
                <div className="text-dark font-medium">
                  {new Date(request.requestedStartDate).toLocaleDateString()} - {new Date(request.requestedEndDate).toLocaleDateString()}
                </div>
              </div>
              {request.scheduledDate && (
                <div className="bg-gray-50 p-4 rounded-eoi">
                  <div className="flex items-center text-dark-light mb-1">
                    <Calendar className="w-4 h-4 mr-2" />
                    Scheduled Date
                  </div>
                  <div className="text-dark font-medium">
                    {new Date(request.scheduledDate).toLocaleString()}
                  </div>
                </div>
              )}
              {request.completedDate && (
                <div className="bg-gray-50 p-4 rounded-eoi">
                  <div className="flex items-center text-dark-light mb-1">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Completed Date
                  </div>
                  <div className="text-dark font-medium">
                    {new Date(request.completedDate).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Technical Requirements */}
          <div>
            <h3 className="text-lg font-semibold text-dark mb-3">Technical Requirements</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="text-dark-light mb-1">Priority</div>
                <div className="text-dark font-medium">{request.priority}</div>
              </div>
              {request.minResolution && (
                <div className="bg-gray-50 p-4 rounded-eoi">
                  <div className="text-dark-light mb-1">Min Resolution</div>
                  <div className="text-dark font-medium">{request.minResolution} m/pixel</div>
                </div>
              )}
              {request.maxCloudCoverage !== undefined && (
                <div className="bg-gray-50 p-4 rounded-eoi">
                  <div className="text-dark-light mb-1">Max Cloud Coverage</div>
                  <div className="text-dark font-medium">{request.maxCloudCoverage}%</div>
                </div>
              )}
            </div>
            {request.preferredSatellites && request.preferredSatellites.length > 0 && (
              <div className="mt-4 bg-gray-50 p-4 rounded-eoi">
                <div className="text-dark-light mb-2">Preferred Satellites</div>
                <div className="flex flex-wrap gap-2">
                  {request.preferredSatellites.map((sat, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-blue-100 text-blue-800 rounded-eoi text-sm"
                    >
                      {sat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Information */}
          {(request.cancelReason || request.notes) && (
            <div>
              <h3 className="text-lg font-semibold text-dark mb-3">Additional Information</h3>
              {request.cancelReason && (
                <div className="bg-red-50 p-4 rounded-eoi mb-3">
                  <div className="text-red-700 font-medium mb-1">Cancel Reason</div>
                  <div className="text-red-600">{request.cancelReason}</div>
                </div>
              )}
              {request.notes && (
                <div className="bg-gray-50 p-4 rounded-eoi">
                  <div className="text-dark-light mb-1">Notes</div>
                  <div className="text-dark">{request.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {request.capturedImageIds && request.capturedImageIds.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-dark mb-3">Captured Images</h3>
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="text-dark-light mb-2">{request.capturedImageIds.length} image(s) captured</div>
                <div className="space-y-1">
                  {request.capturedImageIds.map((imageId, idx) => (
                    <div key={idx} className="text-dark font-mono text-sm">
                      {imageId}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div>
            <h3 className="text-lg font-semibold text-dark mb-3">Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="text-dark-light mb-1">Created</div>
                <div className="text-dark font-medium">
                  {new Date(request.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="text-dark-light mb-1">Last Updated</div>
                <div className="text-dark font-medium">
                  {new Date(request.updatedAt).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-50 p-4 rounded-eoi">
                <div className="text-dark-light mb-1">User ID</div>
                <div className="text-dark font-medium">{request.userId}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex justify-between">
            {onDelete && (
              <Button
                variant="outline"
                onClick={() => onDelete(request.id)}
                disabled={isDeleting}
                className="text-red-600 border-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'Deleting...' : 'Delete Request'}
              </Button>
            )}
            <Button onClick={onClose} className={!onDelete ? 'ml-auto' : ''}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
