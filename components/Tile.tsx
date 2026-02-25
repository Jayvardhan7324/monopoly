import React from 'react';
import { Tile as TileType, ColorGroup, TileType as ETileType, Player } from '../types';
import { Plane, Zap, Droplets, Landmark, Palmtree, Skull, ArrowRight, Package, Home, Building2, Crown } from 'lucide-react';
import { Avatar } from './Avatar';
import { motion } from 'motion/react';

interface TileProps {
  tile: TileType;
  players: Player[];
  onClick: () => void;
  isCurrent: boolean;
  isOwned?: boolean;
  isMonopoly?: boolean;
}

const colorMap: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]: '#4b5563',
  [ColorGroup.LIGHT_BLUE]: '#3b82f6',
  [ColorGroup.PINK]: '#a855f7',
  [ColorGroup.ORANGE]: '#f59e0b',
  [ColorGroup.YELLOW]: '#fbbf24',
  [ColorGroup.GREEN]: '#10b981',
  [ColorGroup.DARK_BLUE]: '#1d4ed8',
  [ColorGroup.RED]: '#ef4444',
  [ColorGroup.NONE]: '#334155',
};

const playerColors = ['#ef4444', '#3b82f6', '#22c55e', '#eab308'];

export const Tile: React.FC<TileProps> = ({ tile, players, onClick, isCurrent, isOwned, isMonopoly }) => {
  const isCorner = tile.type === ETileType.CORNER;
  const isProp = tile.type === ETileType.PROPERTY;
  
  const isTop = tile.id >= 0 && tile.id <= 10;
  const isRight = tile.id >= 11 && tile.id <= 19;
  const isBottom = tile.id >= 20 && tile.id <= 30;
  const isLeft = tile.id >= 31 && tile.id <= 39;

  const ownerColor = tile.ownerId !== null ? playerColors[tile.ownerId] : null;

  const getIcon = () => {
    switch(tile.type) {
      case ETileType.RAILROAD: return <Plane size={20} className="text-slate-300" />;
      case ETileType.UTILITY: 
        return tile.name.includes("Water") 
          ? <Droplets size={22} className="text-cyan-400" /> 
          : <Zap size={22} className="text-yellow-400" fill="currentColor" />;
      case ETileType.CHANCE: 
        return <div className="text-pink-400 font-black text-3xl select-none leading-none">?</div>;
      case ETileType.COMMUNITY_CHEST: 
        return (
          <div className="p-1 bg-amber-500/20 rounded border border-amber-500/30">
             <div className="w-7 h-7 flex items-center justify-center bg-amber-500/40 rounded-sm">
                <Package size={18} className="text-amber-400" fill="currentColor" />
             </div>
          </div>
        );
      case ETileType.TAX: 
        return (
          <div className="bg-slate-700/50 p-1.5 rounded-md border border-slate-600/50">
            <div className="w-8 h-8 flex items-center justify-center text-slate-300 font-black text-[10px]">
              <span>%10</span>
            </div>
          </div>
        );
      case ETileType.CORNER:
        if (tile.name === 'START') return (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <div className="flex gap-1 mb-1">
                {[...Array(4)].map((_, i) => <div key={i} className="w-1.5 h-1.5 md:w-2.5 md:h-2.5 rounded-full" style={{ backgroundColor: playerColors[i] }}></div>)}
            </div>
            <span className="text-[10px] md:text-[16px] text-lime-400 font-black tracking-widest uppercase">Start</span>
            <ArrowRight size={16} className="md:w-6 md:h-6 text-lime-500 -mt-1" />
          </div>
        );
        if (tile.name === 'In Prison') return (
          <div className="flex flex-col items-center justify-center h-full p-1 relative">
            <span className="absolute top-1 text-[6px] md:text-[8px] text-slate-500 font-black uppercase">Passing</span>
            <div className="w-6 h-5 md:w-10 md:h-8 bg-slate-900 border border-slate-700 flex items-center justify-center gap-1 my-1 rounded">
                <div className="w-[1px] h-full bg-slate-700"></div>
                <div className="w-[1px] h-full bg-slate-700"></div>
            </div>
            <span className="absolute bottom-1 text-[6px] md:text-[8px] text-slate-400 font-black uppercase">In Prison</span>
          </div>
        );
        if (tile.name === 'Vacation') return (
          <div className="flex flex-col items-center justify-center h-full">
            <Palmtree size={20} className="md:w-8 md:h-8 text-emerald-400" />
            <span className="text-[7px] md:text-[9px] text-emerald-400 font-black uppercase">Vacation</span>
          </div>
        );
        if (tile.name === 'Go to prison') return (
          <div className="flex flex-col items-center justify-center h-full">
            <Skull size={20} className="md:w-8 md:h-8 text-slate-200" />
            <span className="text-[7px] md:text-[9px] text-slate-400 font-black uppercase">Go to jail</span>
          </div>
        );
        return null;
      default: return null;
    }
  };

  let flexDir = 'flex-col';
  let barClass = '';
  let contentRotation = '';
  let buildingFlexDir = 'flex-row';
  
  if (isTop) {
    flexDir = 'flex-col-reverse';
    barClass = 'w-full h-[16px] md:h-[24px] border-t border-black/20';
    buildingFlexDir = 'flex-row';
  } else if (isBottom) {
    flexDir = 'flex-col';
    barClass = 'w-full h-[16px] md:h-[24px] border-b border-black/20';
    buildingFlexDir = 'flex-row';
  } else if (isLeft) {
    flexDir = 'flex-row-reverse';
    barClass = 'h-full w-[16px] md:w-[24px] border-r border-black/20';
    contentRotation = 'rotate-90';
    buildingFlexDir = 'flex-col';
  } else if (isRight) {
    flexDir = 'flex-row';
    barClass = 'h-full w-[16px] md:w-[24px] border-l border-black/20';
    contentRotation = '-rotate-90';
    buildingFlexDir = 'flex-col';
  }

  const renderBuildings = () => {
    if (tile.buildingCount === 0) return null;

    if (tile.buildingCount === 5) {
      return (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="w-4 h-4 bg-rose-600 border border-white/20 rounded-sm shadow-[0_0_8px_rgba(225,29,72,0.6)] flex items-center justify-center">
             <div className="w-[70%] h-[30%] bg-white/30 rounded-full" />
          </div>
        </div>
      );
    }

    return (
      <div className={`absolute inset-0 flex ${buildingFlexDir} items-center justify-center gap-0.5 z-20 pointer-events-none p-0.5`}>
        {[...Array(tile.buildingCount)].map((_, i) => (
          <div 
            key={i} 
            className="w-2 h-2 bg-emerald-500 border border-white/10 rounded-xs shadow-[0_0_4px_rgba(16,185,129,0.4)] flex items-center justify-center"
          >
             <div className="w-[60%] h-[60%] bg-white/20 rounded-full" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      onClick={onClick}
      className={`
        relative w-full h-full flex ${flexDir}
        ${isCorner ? 'bg-[#21262d]' : 'bg-[#2a303c]'} 
        border transition-all cursor-pointer select-none overflow-hidden
        hover:bg-[#323946] group
        ${isCurrent ? 'ring-2 ring-indigo-500 z-50 scale-[1.02] shadow-2xl' : ''}
        ${isOwned && !isCorner ? 'hover:ring-2 hover:ring-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-[1.05] hover:z-30 transition-transform duration-300' : ''}
        ${isMonopoly && tile.buildingCount > 0 ? 'border-amber-400/50 shadow-[inset_0_0_10px_rgba(251,191,36,0.2)]' : 'border-black/40'}
      `}
    >
      {/* Monopoly Crown Indicator */}
      {isMonopoly && tile.buildingCount > 0 && (
          <div className="absolute top-0.5 right-0.5 z-20 text-amber-400 drop-shadow-md animate-pulse">
              <Crown size={10} fill="currentColor" />
          </div>
      )}

      {/* Property Color Bar */}
      {(isProp || tile.type === ETileType.RAILROAD || tile.type === ETileType.UTILITY) && (
        <div 
          className={`${barClass} relative flex items-center justify-center p-0.5 z-10`}
          style={{ backgroundColor: colorMap[tile.group] }}
        >
          {/* Flag Icon */}
          {tile.countryCode && (
            <img 
              src={`https://flagcdn.com/w20/${tile.countryCode}.png`} 
              alt={tile.countryCode} 
              className="w-3.5 h-3.5 object-cover rounded-full border border-black/20 z-0 opacity-40 grayscale-[0.5]"
            />
          )}
          {/* Building Markers Overlay */}
          {isProp && renderBuildings()}
        </div>
      )}

      {/* Main Content Area */}
      <div className={`flex-1 relative overflow-hidden flex flex-col items-center justify-center ${contentRotation}`}>
        {!isCorner ? (
          <div className="w-full h-full flex flex-col items-center justify-between py-1.5 px-0.5">
            <div className="font-black text-[7px] md:text-[8px] text-slate-100 uppercase tracking-tighter text-center leading-[1.1] max-w-full break-words line-clamp-2 px-0.5">
              {tile.name}
            </div>
            
            <div className="flex-1 flex items-center justify-center w-full min-h-0">
              {getIcon()}
            </div>

            {tile.price > 0 && (
              <div className="bg-black/90 px-1 py-0.5 rounded border border-white/10 text-[7px] md:text-[8px] font-black text-white whitespace-nowrap">
                {tile.price}$
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full">
            {getIcon()}
          </div>
        )}
      </div>

      {/* Owner Indicator Overlay */}
      {ownerColor && (
        <div 
          className={`absolute pointer-events-none opacity-30 inset-0 z-0`}
          style={{ backgroundColor: ownerColor }}
        />
      )}

      {/* Players on Tile Overlay */}
      {players.length > 0 && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none p-1">
          <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
            {players.map((p) => {
              const isThisPlayerCurrent = isCurrent && p.id === players[0]?.id; // Simplification, just glow if it's their turn
              return (
                <motion.div 
                  layoutId={`player-${p.id}`}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  key={p.id} 
                  className={`relative ${isThisPlayerCurrent ? 'animate-pulse' : ''}`}
                >
                  {isThisPlayerCurrent && (
                    <div className="absolute inset-0 bg-white/50 blur-md rounded-full scale-150"></div>
                  )}
                  <Avatar 
                    avatarId={p.avatar} 
                    color={p.color} 
                    isBankrupt={p.isBankrupt}
                    inJail={p.inJail}
                    className="w-4 h-4 md:w-6 md:h-6 shadow-[0_0_10px_rgba(0,0,0,0.8)] border-white/40 relative z-10" 
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
