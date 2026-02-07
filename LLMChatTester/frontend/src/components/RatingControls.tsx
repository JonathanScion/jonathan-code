import { useState } from 'react';
import type { ResponseRating } from '../types';

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
  stats: {
    claude: { wins: number; avgStars: number; totalRated: number };
    openai: { wins: number; avgStars: number; totalRated: number };
    gemini: { wins: number; avgStars: number; totalRated: number };
  };
}

export function RatingStats({ stats }: RatingStatsProps) {
  const providers = [
    { key: 'claude' as const, name: 'Claude', color: 'text-orange-400' },
    { key: 'openai' as const, name: 'ChatGPT', color: 'text-green-400' },
    { key: 'gemini' as const, name: 'Gemini', color: 'text-blue-400' },
  ];

  const totalWins = stats.claude.wins + stats.openai.wins + stats.gemini.wins;

  if (totalWins === 0 && stats.claude.totalRated === 0 && stats.openai.totalRated === 0 && stats.gemini.totalRated === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-4 text-xs">
      {providers.map(({ key, name, color }) => {
        const { wins, avgStars, totalRated } = stats[key];
        const winPercent = totalWins > 0 ? Math.round((wins / totalWins) * 100) : 0;

        return (
          <div key={key} className="flex items-center gap-2">
            <span className={color}>{name}:</span>
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
