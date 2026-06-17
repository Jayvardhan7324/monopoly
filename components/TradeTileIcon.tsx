import React from 'react';
import { Droplets, Home, Plane, Zap } from 'lucide-react';
import { Tile, TileType } from '../types';

interface TradeTileIconProps {
  tile: Tile;
  className?: string;
}

export const TradeTileIcon: React.FC<TradeTileIconProps> = ({ tile, className = '' }) => {
  const baseClass = `w-5 h-5 shrink-0 rounded-md bg-slate-900/70 border border-white/10 flex items-center justify-center ${className}`;

  if (tile.type === TileType.RAILROAD) {
    return (
      <span className={baseClass} aria-label="Airport">
        <Plane size={13} className="text-sky-300" />
      </span>
    );
  }

  if (tile.type === TileType.UTILITY) {
    const isWater = /water/i.test(tile.name);
    return (
      <span className={baseClass} aria-label={isWater ? 'Water company' : 'Electric company'}>
        {isWater ? (
          <Droplets size={13} className="text-cyan-300" />
        ) : (
          <Zap size={13} className="text-yellow-300" fill="currentColor" />
        )}
      </span>
    );
  }

  if (tile.countryCode) {
    return (
      <img
        src={`https://flagcdn.com/w40/${tile.countryCode}.png`}
        srcSet={`https://flagcdn.com/w80/${tile.countryCode}.png 2x`}
        alt={tile.countryCode}
        className="w-5 h-3.5 object-cover rounded-sm shrink-0"
      />
    );
  }

  return (
    <span className={baseClass} aria-label="Property">
      <Home size={13} className="text-emerald-300" />
    </span>
  );
};
