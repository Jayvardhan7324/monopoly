import React from 'react';
import { Skull, Lock } from 'lucide-react';

export const APPEARANCE_COLORS = [
  '#b4d455', '#fcd34d', '#f97316', '#78350f',
  '#64748b', '#67e8f9', '#5eead4', '#86efac',
  '#d4a373', '#d946ef', '#9f1239', '#8b5cf6'
];

// BUG-FIX: Each avatar index gets a unique pupil color so players are visually distinguishable
const PUPIL_COLORS = [
  '#1e3a5f', // 0 deep blue
  '#3d1a00', // 1 dark brown
  '#0a3d2e', // 2 dark green
  '#3d0000', // 3 dark red
  '#1a1a3e', // 4 indigo
  '#00263d', // 5 teal
  '#2d1b00', // 6 amber
  '#1a3d00', // 7 lime
  '#3d1a2e', // 8 plum
  '#3d2800', // 9 gold
  '#001a3d', // 10 navy
  '#1a003d', // 11 violet
];

// Eye offsets give each avatar a slightly different expression
const EYE_OFFSETS = [
  [15, 15], [15, 10], [10, 15], [20, 15],
  [15, 20], [12, 12], [18, 12], [12, 18],
  [16, 14], [14, 16], [13, 13], [17, 17],
];

interface AvatarProps {
  avatarId?: number;
  color?: string;
  className?: string;
  isBankrupt?: boolean;
  inJail?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ avatarId = 0, color, className = 'w-6 h-6', isBankrupt, inJail }) => {
  const bgColor = color || APPEARANCE_COLORS[avatarId % APPEARANCE_COLORS.length];
  const pupilColor = PUPIL_COLORS[avatarId % PUPIL_COLORS.length];
  const [offsetX, offsetY] = EYE_OFFSETS[avatarId % EYE_OFFSETS.length];

  return (
    <div
      className={`
        ${className} rounded-full flex items-center justify-center shrink-0 relative overflow-hidden transition-all
        ${isBankrupt ? 'opacity-50 grayscale' : 'shadow-md'}
      `}
      style={{ backgroundColor: bgColor }}
    >
      {/* Eyes — unique per avatarId */}
      <div className="flex gap-[15%] w-[50%] z-10">
        <div
          className="w-full aspect-square bg-white rounded-full flex items-center justify-center shadow-inner"
        >
          <div
            className="w-[45%] aspect-square rounded-full"
            style={{
              backgroundColor: pupilColor,
              transform: `translate(${offsetX > 15 ? '20%' : '-5%'}, ${offsetY > 15 ? '15%' : '-5%'})`,
            }}
          />
        </div>
        <div
          className="w-full aspect-square bg-white rounded-full flex items-center justify-center shadow-inner"
        >
          <div
            className="w-[45%] aspect-square rounded-full"
            style={{
              backgroundColor: pupilColor,
              transform: `translate(${offsetX > 15 ? '20%' : '-5%'}, ${offsetY > 15 ? '15%' : '-5%'})`,
            }}
          />
        </div>
      </div>

      {/* Bankrupt Indicator */}
      {isBankrupt && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
          <Skull size="60%" className="text-slate-300" strokeWidth={2.5} />
        </div>
      )}

      {/* Jail Indicator */}
      {inJail && !isBankrupt && (
        <div className="absolute inset-0 z-20">
          <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_20%,rgba(0,0,0,0.5)_20%,rgba(0,0,0,0.5)_25%)]" />
          <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-rose-600 rounded-full border border-white flex items-center justify-center shadow-sm">
            <Lock size="70%" className="text-white" strokeWidth={3} />
          </div>
        </div>
      )}
    </div>
  );
};