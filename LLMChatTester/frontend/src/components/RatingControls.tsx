import { useState } from 'react';
import type { ResponseRating, LLMProvider } from '../types';
import { PROVIDER_INFO } from '../types';

interface RatingControlsProps {
  rating: ResponseRating;
  isWinnerDisabled?: boolean;
  onRatingChange: (rating: ResponseRating) => void;
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (stars: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onChange(value === star ? 0 : star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-lg transition-colors focus:outline-none"
          title={value === star ? 'Clear rating' : `Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <span
            className={
              (hovered >= star || value >= star)
                ? 'text-yellow-400'
                : 'text-gray-600'
            }
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

export function RatingControls({
  rating,
  isWinnerDisabled = false,
  onRatingChange,
}: RatingControlsProps) {
  const [showNotes, setShowNotes] = useState(false);

  const handleStarsChange = (stars: number) => {
    onRatingChange({ ...rating, stars });
  };

  const handleWinnerToggle = () => {
    onRatingChange({ ...rating, isWinner: !rating.isWinner });
  };

  const handleNotesChange = (notes: string) => {
    onRatingChange({ ...rating, notes });
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-700 space-y-2">
      <div className="flex items-center justify-between">
        <StarRating value={rating.stars} onChange={handleStarsChange} />
        <div className="flex items-center gap-2">
          <button
            onClick={handleWinnerToggle}
            disabled={isWinnerDisabled && !rating.isWinner}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              rating.isWinner
                ? 'bg-yellow-500 text-black font-semibold'
                : isWinnerDisabled
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={rating.isWinner ? 'Remove winner' : 'Mark as winner'}
          >
            {rating.isWinner ? '🏆 Winner' : 'Best'}
          </button>
          <button
            onClick={() => setShowNotes(!showNotes)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              rating.notes
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title={showNotes ? 'Hide notes' : 'Add notes'}
          >
            {rating.notes ? '📝' : '+'} Notes
          </button>
        </div>
      </div>
      {showNotes && (
        <textarea
          value={rating.notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Add notes about this response..."
          rows={2}
          className="w-full p-2 text-xs bg-gray-700 text-gray-200 rounded border border-gray-600 resize-none focus:border-blue-500 focus:outline-none"
        />
      )}
    </div>
  );
}

// Summary stats component
interface RatingStatsProps {
  stats: Record<LLMProvider, { wins: number; avgStars: number; totalRated: number }>;
  enabledProviders: LLMProvider[];
}

export function RatingStats({ stats, enabledProviders }: RatingStatsProps) {
  const totalWins = enabledProviders.reduce((sum, p) => sum + stats[p].wins, 0);
  const anyRated = enabledProviders.some(p => stats[p].totalRated > 0);

  if (totalWins === 0 && !anyRated) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 text-xs">
      {enabledProviders.map((key) => {
        const info = PROVIDER_INFO[key];
        const { wins, avgStars, totalRated } = stats[key];
        const winPercent = totalWins > 0 ? Math.round((wins / totalWins) * 100) : 0;

        return (
          <div key={key} className="flex items-center gap-2">
            <span className={info.textColor}>{info.name}:</span>
            {wins > 0 && (
              <span className="text-yellow-400" title={`${wins} wins`}>
                🏆 {winPercent}%
              </span>
            )}
            {totalRated > 0 && (
              <span className="text-gray-400" title={`Average rating from ${totalRated} responses`}>
                ★ {avgStars.toFixed(1)}
              </span>
            )}
            {wins === 0 && totalRated === 0 && (
              <span className="text-gray-500">-</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
