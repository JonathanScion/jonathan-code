import { useState } from 'react';
import { Filter } from 'lucide-react';
import { Button } from './ui/Button';
import type { RequestStatus, RequestPriority } from '@shared/types';

interface RequestFilterPanelProps {
  statusFilter: RequestStatus | 'ALL';
  priorityFilter: RequestPriority | 'ALL';
  onStatusChange: (status: RequestStatus | 'ALL') => void;
  onPriorityChange: (priority: RequestPriority | 'ALL') => void;
}

export function RequestFilterPanel({
  statusFilter,
  priorityFilter,
  onStatusChange,
  onPriorityChange,
}: RequestFilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const hasActiveFilters = statusFilter !== 'ALL' || priorityFilter !== 'ALL';

  const handleClearFilters = () => {
    onStatusChange('ALL');
    onPriorityChange('ALL');
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Filter className="w-4 h-4 mr-2" />
        Filters
        {hasActiveFilters && (
          <span className="ml-2 bg-primary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
            {(statusFilter !== 'ALL' ? 1 : 0) + (priorityFilter !== 'ALL' ? 1 : 0)}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-light-border z-20">
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-dark">Filters</h3>
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => onStatusChange(e.target.value as RequestStatus | 'ALL')}
                  className="w-full px-3 py-2 border border-light-border rounded-eoi focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="SCHEDULED">Scheduled</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-dark mb-2">
                  Priority
                </label>
                <select
                  value={priorityFilter}
                  onChange={(e) => onPriorityChange(e.target.value as RequestPriority | 'ALL')}
                  className="w-full px-3 py-2 border border-light-border rounded-eoi focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
