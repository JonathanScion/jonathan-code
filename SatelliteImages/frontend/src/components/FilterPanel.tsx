import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchFilters } from '@shared/types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface FilterPanelProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

export function FilterPanel({ filters, onFiltersChange }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const activeFilterCount = Object.keys(filters).filter(
    key => filters[key as keyof SearchFilters] !== undefined && filters[key as keyof SearchFilters] !== ''
  ).length;

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="relative"
      >
        <Filter className="w-4 h-4 mr-2" />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-2 bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
            {activeFilterCount}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-eoi shadow-eoi-hover border border-light-border p-6 z-50"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-dark">Filters</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-dark-light hover:text-dark"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="date"
                  label="From Date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => handleChange('dateFrom', e.target.value)}
                />
                <Input
                  type="date"
                  label="To Date"
                  value={filters.dateTo || ''}
                  onChange={(e) => handleChange('dateTo', e.target.value)}
                />
              </div>

              {/* Cloud Coverage */}
              <Input
                type="number"
                label="Max Cloud Coverage (%)"
                min="0"
                max="100"
                value={filters.cloudCoverageMax || ''}
                onChange={(e) => handleChange('cloudCoverageMax', parseInt(e.target.value))}
              />

              {/* Satellite Name */}
              <Input
                type="text"
                label="Satellite Name"
                placeholder="e.g., Sentinel-2, Landsat"
                value={filters.satelliteName || ''}
                onChange={(e) => handleChange('satelliteName', e.target.value)}
              />

              {/* Resolution Range */}
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="number"
                  label="Min Resolution (m/px)"
                  value={filters.resolutionMin || ''}
                  onChange={(e) => handleChange('resolutionMin', parseFloat(e.target.value))}
                />
                <Input
                  type="number"
                  label="Max Resolution (m/px)"
                  value={filters.resolutionMax || ''}
                  onChange={(e) => handleChange('resolutionMax', parseFloat(e.target.value))}
                />
              </div>

              {/* Tags */}
              <Input
                type="text"
                label="Tags (comma-separated)"
                placeholder="urban, vegetation, water"
                value={filters.tags?.join(', ') || ''}
                onChange={(e) => handleChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
              />

              {/* Actions */}
              <div className="flex space-x-2 pt-4 border-t border-light-border">
                <Button
                  variant="outline"
                  onClick={handleClearFilters}
                  className="flex-1"
                >
                  Clear All
                </Button>
                <Button
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  Apply
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
