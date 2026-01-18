import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface NasaTimelineProps {
  startDate?: string; // Default: 1 year ago
  endDate?: string;   // Default: yesterday
  selectedDate: string;
  onDateChange: (date: string) => void;
  capturedAt?: string; // Image capture date for reference marker
}

export function NasaTimeline({
  startDate,
  endDate,
  selectedDate,
  onDateChange,
  capturedAt,
}: NasaTimelineProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  // Calculate date range (default: 1 year history)
  const dateRange = useMemo(() => {
    const end = endDate ? new Date(endDate) : new Date();
    end.setDate(end.getDate() - 1); // Yesterday (today's data may not be available)

    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

    return { start, end };
  }, [startDate, endDate]);

  // Generate month markers
  const monthMarkers = useMemo(() => {
    const markers: { date: Date; label: string }[] = [];
    const current = new Date(dateRange.start);
    current.setDate(1); // First of month

    while (current <= dateRange.end) {
      markers.push({
        date: new Date(current),
        label: current.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      });
      current.setMonth(current.getMonth() + 1);
    }

    return markers;
  }, [dateRange]);

  // Calculate slider position (0-100)
  const sliderPosition = useMemo(() => {
    const selected = new Date(selectedDate);
    const totalRange = dateRange.end.getTime() - dateRange.start.getTime();
    const fromStart = selected.getTime() - dateRange.start.getTime();
    return Math.max(0, Math.min(100, (fromStart / totalRange) * 100));
  }, [selectedDate, dateRange]);

  // Calculate capture date marker position
  const captureMarkerPosition = useMemo(() => {
    if (!capturedAt) return null;
    const capture = new Date(capturedAt);
    const totalRange = dateRange.end.getTime() - dateRange.start.getTime();
    const fromStart = capture.getTime() - dateRange.start.getTime();
    const pos = (fromStart / totalRange) * 100;
    if (pos < 0 || pos > 100) return null;
    return pos;
  }, [capturedAt, dateRange]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    const totalRange = dateRange.end.getTime() - dateRange.start.getTime();
    const newDate = new Date(dateRange.start.getTime() + (value / 100) * totalRange);
    onDateChange(newDate.toISOString().split('T')[0]);
  };

  const stepDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);

    // Clamp to range
    if (current < dateRange.start) return;
    if (current > dateRange.end) return;

    onDateChange(current.toISOString().split('T')[0]);
  };

  const goToMonth = (date: Date) => {
    const target = new Date(date);
    if (target < dateRange.start) target.setTime(dateRange.start.getTime());
    if (target > dateRange.end) target.setTime(dateRange.end.getTime());
    onDateChange(target.toISOString().split('T')[0]);
  };

  // Auto-play animation
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Animation effect
  useMemo(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const current = new Date(selectedDate);
      current.setDate(current.getDate() + 7); // Advance by 1 week

      if (current > dateRange.end) {
        setIsPlaying(false);
        return;
      }

      onDateChange(current.toISOString().split('T')[0]);
    }, 500); // 500ms per step

    return () => clearInterval(interval);
  }, [isPlaying, selectedDate, dateRange.end, onDateChange]);

  const formatDisplayDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-primary" />
          <span className="font-medium">Historical Timeline</span>
        </div>
        <div className="text-sm text-gray-600">
          {formatDisplayDate(selectedDate)}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => stepDate(-7)}
          disabled={new Date(selectedDate) <= dateRange.start}
        >
          <ChevronLeft className="w-4 h-4" />
          Week
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => stepDate(-1)}
          disabled={new Date(selectedDate) <= dateRange.start}
        >
          <ChevronLeft className="w-4 h-4" />
          Day
        </Button>

        <Button
          variant={isPlaying ? 'primary' : 'outline'}
          size="sm"
          onClick={togglePlay}
          className="px-3"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => stepDate(1)}
          disabled={new Date(selectedDate) >= dateRange.end}
        >
          Day
          <ChevronRight className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => stepDate(7)}
          disabled={new Date(selectedDate) >= dateRange.end}
        >
          Week
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Timeline Slider */}
      <div className="relative pt-6 pb-2">
        {/* Month markers */}
        <div className="absolute top-0 left-0 right-0 flex justify-between text-xs text-gray-500">
          {monthMarkers.slice(0, 12).map((marker, idx) => (
            <button
              key={idx}
              onClick={() => goToMonth(marker.date)}
              className="hover:text-primary transition-colors"
              style={{ marginLeft: idx === 0 ? 0 : undefined }}
            >
              {marker.label}
            </button>
          ))}
        </div>

        {/* Slider track */}
        <div className="relative h-2 bg-gray-200 rounded-full">
          {/* Progress fill */}
          <motion.div
            className="absolute h-full bg-primary rounded-full"
            style={{ width: `${sliderPosition}%` }}
            animate={{ width: `${sliderPosition}%` }}
            transition={{ duration: 0.1 }}
          />

          {/* Capture date marker */}
          {captureMarkerPosition !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-orange-500 rounded-full border-2 border-white shadow z-10"
              style={{ left: `${captureMarkerPosition}%`, marginLeft: -6 }}
              title={`Image captured: ${capturedAt}`}
            />
          )}

          {/* Slider input */}
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={sliderPosition}
            onChange={handleSliderChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          {/* Slider thumb indicator */}
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg"
            style={{ left: `${sliderPosition}%`, marginLeft: -8 }}
            animate={{ left: `${sliderPosition}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        {/* Legend */}
        {captureMarkerPosition !== null && (
          <div className="flex items-center justify-end mt-2 text-xs text-gray-500">
            <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-1" />
            Image capture date
          </div>
        )}
      </div>

      {/* Quick jump buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() - 8); // 1 week ago
            onDateChange(d.toISOString().split('T')[0]);
          }}
        >
          1 week ago
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 1);
            onDateChange(d.toISOString().split('T')[0]);
          }}
        >
          1 month ago
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 3);
            onDateChange(d.toISOString().split('T')[0]);
          }}
        >
          3 months ago
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const d = new Date();
            d.setMonth(d.getMonth() - 6);
            onDateChange(d.toISOString().split('T')[0]);
          }}
        >
          6 months ago
        </Button>
        {capturedAt && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateChange(capturedAt.split('T')[0])}
            className="text-orange-600"
          >
            Capture date
          </Button>
        )}
      </div>
    </div>
  );
}
