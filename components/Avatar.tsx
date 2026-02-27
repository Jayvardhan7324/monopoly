
import React from 'react';
import { Skull, Lock } from 'lucide-react';

export const APPEARANCE_COLORS = [
  '#b4d455', '#fcd34d', '#f97316', '#78350f',
  '#64748b', '#67e8f9', '#5eead4', '#86efac',
  '#d4a373', '#d946ef', '#9f1239', '#8b5cf6'
];

interface AvatarProps {
  avatarId?: number;
  color?: string;
  className?: string;
  isBankrupt?: boolean;
  inJail?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ avatarId = 0, color, className = "w-6 h-6", isBankrupt, inJail }) => {
  const bgColor = color || APPEARANCE_COLORS[avatarId % APPEARANCE_COLORS.length];
  
  return (
    <div 
      className={`
        ${className} rounded-full flex items-center justify-center shrink-0 relative overflow-hidden transition-all
        ${isBankrupt ? 'opacity-50 grayscale' : 'shadow-md'}
      `}
      style={{ backgroundColor: bgColor }}
    >
      <div className="flex gap-[15%] w-[50%] z-10">
        <div className="w-full aspect-square bg-white rounded-full flex items-center justify-center shadow-inner">
          <div className="w-[45%] aspect-square bg-slate-900 rounded-full translate-x-[15%]" />
        </div>
        <div className="w-full aspect-square bg-white rounded-full flex items-center justify-center shadow-inner">
          <div className="w-[45%] aspect-square bg-slate-900 rounded-full translate-x-[15%]" />
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
