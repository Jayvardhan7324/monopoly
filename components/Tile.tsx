import React from 'react';
import { Tile as TileType, ColorGroup, TileType as ETileType, Player } from '../types';
// BUG-08: Replaced `Palmtree` (removed in lucide-react v0.468) with `TreePalm`
import { Plane, Zap, Droplets, TreePalm, Skull, ArrowRight, Package, Home, Building2, Crown, Lock } from 'lucide-react';
import { Avatar } from './Avatar';
import { PLAYER_COLORS } from '../constants';
import { motion } from 'motion/react';

interface TileProps {
  tile: TileType;
  players: Player[];
  onClick: () => void;
  isCurrent: boolean;
  isOwned?: boolean;
  isMonopoly?: boolean;
  taxPool?: number;
}

// Property group colors — used for the outer color band
const GROUP_COLORS: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]:     '#92400e',
  [ColorGroup.LIGHT_BLUE]:'#0891b2',
  [ColorGroup.PINK]:      '#c026d3',
  [ColorGroup.ORANGE]:    '#ea580c',
  [ColorGroup.RED]:       '#dc2626',
  [ColorGroup.YELLOW]:    '#ca8a04',
  [ColorGroup.GREEN]:     '#15803d',
  [ColorGroup.DARK_BLUE]: '#1d4ed8',
  [ColorGroup.NONE]:      'transparent',
};

// Width/height of the color band as a percentage of the tile
const BAND = '32%';

const TileInner: React.FC<TileProps> = ({ tile, players, onClick, isCurrent, isOwned, isMonopoly, taxPool }) => {
  const isCorner = tile.type === ETileType.CORNER;
  const isProp   = tile.type === ETileType.PROPERTY;

  const isTop    = tile.id >= 0  && tile.id <= 10;
  const isRight  = tile.id >= 11 && tile.id <= 19;
  const isBottom = tile.id >= 20 && tile.id <= 30;
  const isLeft   = tile.id >= 31 && tile.id <= 39;

  const ownerColor = tile.ownerId !== null ? (PLAYER_COLORS[tile.ownerId] || '#888') : null;
  const groupColor = isProp && tile.group !== ColorGroup.NONE ? GROUP_COLORS[tile.group] : null;
  const contentRotate = isLeft ? 'rotate(-90deg)' : isRight ? 'rotate(90deg)' : 'none';

  const getIcon = () => {
    switch (tile.type) {
      case ETileType.RAILROAD:
        return <Plane size={13} className="text-slate-300 drop-shadow-md" />;
      case ETileType.UTILITY:
        return (
          <div className="flex flex-col items-center gap-[1px]">
            {tile.name.includes('Water') ? (
              <Droplets size={12} className="text-cyan-400 drop-shadow-md" />
            ) : (
              <Zap size={12} className="text-yellow-400 drop-shadow-md" fill="currentColor" />
            )}
            <span className="text-[4.5px] font-bold text-slate-400 uppercase tracking-tight leading-none">
              {tile.name.includes('Water') ? 'Water' : 'Electric'}
            </span>
            <span className="text-[4.5px] font-bold text-slate-400 uppercase tracking-tight leading-none">Co.</span>
          </div>
        );
      case ETileType.CHANCE:
        return <div className="text-rose-400 font-black text-xl drop-shadow-md flex items-center justify-center select-none leading-none w-full h-full">?</div>;
      case ETileType.COMMUNITY_CHEST:
        return <Package size={17} className="text-amber-400 drop-shadow-md" fill="currentColor" />;
      case ETileType.TAX:
        return (
          <div className="bg-slate-700/80 w-[20px] h-[14px] flex items-center justify-center rounded-[3px] border border-slate-500/60 shadow-sm">
            <span className="text-slate-200 font-black text-[6.5px] leading-none tracking-tight">×10</span>
          </div>
        );
      case ETileType.CORNER:
        if (tile.name === 'START')
          return (
            <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-[#1b1c2e] to-[#151525] p-1">
              <span className="text-2xl text-lime-400 font-black tracking-tighter uppercase leading-none drop-shadow-[0_0_8px_rgba(132,204,22,0.4)] pb-1">Start</span>
              <ArrowRight size={28} className="text-lime-500 drop-shadow-md" />
            </div>
          );
        if (tile.name === 'In Prison')
          return (
            <div className="flex flex-col h-full w-full relative bg-gradient-to-br from-[#252331] to-[#1e1b2e] overflow-hidden">
              <span className="absolute top-1.5 right-1.5 text-[8px] text-slate-300 font-bold tracking-wider">Passing by</span>
              <div className="absolute bottom-0 right-0 w-[60%] h-[75%] bg-slate-400/20 border-t border-l border-slate-500/30 flex shadow-inner">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex-1 border-r border-slate-500/30 bg-white/5" />
                ))}
              </div>
              <span className="absolute bottom-1.5 right-1.5 text-[10px] text-white font-black z-10 drop-shadow-lg text-right leading-none w-10 pr-1">In Prison</span>
            </div>
          );
        if (tile.name === 'Vacation')
          return (
            <div className="flex flex-col items-center justify-center h-full w-full relative bg-gradient-to-br from-[#1c2236] to-[#162030]">
              <TreePalm size={36} className="text-[#98d287] drop-shadow-[0_0_10px_rgba(152,210,135,0.3)]" />
              <span className="text-[10px] text-slate-200 mt-1 font-bold">Vacation</span>
              {taxPool !== undefined && taxPool > 0 && (
                <div className="mt-0.5 bg-emerald-500/20 px-1.5 py-0.5 rounded-md border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">${taxPool}</span>
                </div>
              )}
            </div>
          );
        if (tile.name === 'Go to prison')
          return (
            <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-[#1e1c28] to-[#181520]">
              <Skull size={34} className="text-slate-100 drop-shadow-lg mb-1" />
              <span className="text-[10px] text-slate-100 font-bold">Go to prison</span>
            </div>
          );
        return null;
      default:
        return null;
    }
  };

  // Houses/hotel shown as icon + count badge
  const renderBuildings = () => {
    if (tile.buildingCount === 0) return null;
    const isHotel = tile.buildingCount === 5;
    return (
      <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
        <div
          className={`flex items-center gap-[2px] px-[3px] py-[2px] rounded-[3px] border border-white/20 shadow-sm ${isHotel ? 'bg-rose-600' : 'bg-emerald-600'}`}
          style={{ transform: contentRotate }}
        >
          {isHotel ? (
            <Building2 size={7} className="text-white" />
          ) : (
            <>
              <Home size={7} className="text-white" />
              <span className="text-white font-black leading-none" style={{ fontSize: '5.5px' }}>×{tile.buildingCount}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative w-full h-full flex items-center justify-center
        ${isCorner ? 'bg-[#21262d] rounded-[4px]' : 'bg-[#2a303c] rounded-[4px]'}
        transition-all duration-200 cursor-pointer select-none
        hover:bg-[#323946] hover:brightness-110 group
        ${isCurrent ? 'ring-2 ring-indigo-500 z-50 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.01]' : ''}
        ${isOwned && !isCorner ? 'hover:ring-2 hover:ring-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-[1.02] hover:z-30 transition-transform duration-300' : ''}
        ${isMonopoly && tile.buildingCount > 0 ? 'ring-1 ring-amber-400/50 shadow-[inset_0_0_15px_rgba(251,191,36,0.3)]' : ''}
      `}
    >
      <div
        className="relative flex-shrink-0 w-full h-full"
        style={{
          width: 'calc(100% / var(--board-scale, 1))',
          height: 'calc(100% / var(--board-scale, 1))',
          transform: 'scale(var(--board-scale, 1))',
          transformOrigin: 'center',
        }}
      >
        {/* Monopoly Crown */}
        {isMonopoly && tile.buildingCount > 0 && (
          <div className="absolute top-0.5 right-0.5 z-30 text-amber-400 drop-shadow-md animate-pulse">
            <Crown size={12} fill="currentColor" />
          </div>
        )}

        {/* Mortgaged overlay */}
        {tile.isMortgaged && !isCorner && (
          <div className="absolute inset-0 z-40 pointer-events-none rounded-[4px] overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/70" />
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(0,0,0,0.35)_4px,rgba(0,0,0,0.35)_8px)]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-[8px] font-black text-rose-500 uppercase tracking-widest bg-black/80 px-1 py-0.5 rounded border border-rose-500/50 drop-shadow-2xl"
                style={{ transform: contentRotate }}
              >
                MRTG
              </span>
            </div>
          </div>
        )}

        {/* Non-corner tile body */}
        {!isCorner ? (
          <>
            {/* ── Property group color band at outer edge, price lives here ── */}
            {groupColor && (
              <div
                className="absolute z-10 flex items-center justify-center overflow-hidden rounded-[3px]"
                style={{
                  backgroundColor: groupColor,
                  ...(isTop    ? { top: 0, left: 0, right: 0, height: BAND } : {}),
                  ...(isBottom ? { bottom: 0, left: 0, right: 0, height: BAND } : {}),
                  ...(isLeft   ? { left: 0, top: 0, bottom: 0, width: BAND } : {}),
                  ...(isRight  ? { right: 0, top: 0, bottom: 0, width: BAND } : {}),
                }}
              >
                <span
                  className="text-white font-black drop-shadow-sm leading-none select-none"
                  style={{
                    fontSize: '5.5px',
                    transform: isLeft ? 'rotate(-90deg)' : isRight ? 'rotate(90deg)' : 'none',
                  }}
                >
                  ${tile.price}
                </span>
              </div>
            )}

            {/* ── Price for non-property tiles (railroads, utilities) ── */}
            {!groupColor && tile.price > 0 && tile.type !== ETileType.TAX && (
              <div
                className="absolute z-10 flex items-center justify-center pointer-events-none"
                style={{
                  ...(isTop    ? { top: '2px', left: 0, right: 0 } : {}),
                  ...(isBottom ? { bottom: '2px', left: 0, right: 0 } : {}),
                  ...(isLeft   ? { left: '2px', top: 0, bottom: 0 } : {}),
                  ...(isRight  ? { right: '2px', top: 0, bottom: 0 } : {}),
                }}
              >
                <span
                  className="font-black text-slate-300 leading-none"
                  style={{
                    fontSize: '5.5px',
                    transform: isLeft ? 'rotate(-90deg)' : isRight ? 'rotate(90deg)' : 'none',
                  }}
                >
                  ${tile.price}
                </span>
              </div>
            )}

            {/* ── Main content: name + flag/icon (inset to leave room for band) ── */}
            <div
              className="absolute flex items-center justify-center overflow-hidden p-[2px]"
              style={{
                top:    groupColor && isTop    ? BAND : 0,
                right:  groupColor && isRight  ? BAND : 0,
                bottom: groupColor && isBottom ? BAND : 0,
                left:   groupColor && isLeft   ? BAND : 0,
              }}
            >
              <div
                className="flex flex-col items-center justify-center gap-[2px] w-full"
                style={{ transform: contentRotate }}
              >
                {tile.name && tile.type !== ETileType.UTILITY && (
                  <span
                    className="max-w-[44px] overflow-hidden whitespace-nowrap text-ellipsis text-center font-bold uppercase tracking-tighter text-slate-100 leading-none"
                    style={{ fontSize: '5.5px', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                  >
                    {tile.name}
                  </span>
                )}
                {tile.countryCode ? (
                  <img
                    src={`https://flagcdn.com/w40/${tile.countryCode}.png`}
                    srcSet={`https://flagcdn.com/w80/${tile.countryCode}.png 2x`}
                    alt={tile.countryCode}
                    className="w-[18px] h-[13px] object-cover rounded-[2px] shadow-sm border border-white/20"
                    loading="lazy"
                  />
                ) : getIcon() !== null ? (
                  <div className="flex items-center justify-center shrink-0 min-h-0 min-w-0">
                    {getIcon()}
                  </div>
                ) : null}
              </div>
            </div>

            {/* ── Buildings overlay ── */}
            {isProp && renderBuildings()}

            {/* ── Owner color strip on the inner (board-facing) edge ── */}
            {ownerColor && !tile.isMortgaged && (
              <div
                className="absolute pointer-events-none z-10 inset-0 rounded-[4px] transition-all duration-300"
                style={{
                  boxShadow: isTop
                    ? `inset 0 -3px 0 0 ${ownerColor}`
                    : isBottom
                      ? `inset 0 3px 0 0 ${ownerColor}`
                      : isLeft
                        ? `inset -3px 0 0 0 ${ownerColor}`
                        : `inset 3px 0 0 0 ${ownerColor}`,
                }}
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0">{getIcon()}</div>
        )}

        {/* Players on tile */}
        {players.length > 0 && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none p-1">
            <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
              {players.map(p => (
                <motion.div
                  layoutId={`player-${p.id}`}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  key={p.id}
                  className="relative"
                >
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 bg-white/40 blur-md rounded-full scale-150"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    />
                  )}
                  <div className="relative">
                    <Avatar
                      avatarId={p.avatarId}
                      color={p.color}
                      isBankrupt={p.isBankrupt}
                      inJail={p.inJail}
                      className="w-6 h-6 shadow-[0_0_10px_rgba(0,0,0,0.8)] border-white/40 relative z-10"
                    />
                    {p.inJail && tile.id === 10 && (
                      <div className="absolute -inset-0.5 rounded-full border-2 border-rose-500 animate-pulse z-20 pointer-events-none" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const Tile = React.memo(TileInner);
