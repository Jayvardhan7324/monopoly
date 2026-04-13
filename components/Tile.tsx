import React from 'react';
import { Tile as TileType, ColorGroup, TileType as ETileType, Player } from '../types';
// BUG-08: Replaced `Palmtree` (removed in lucide-react v0.468) with `TreePalm`
import { Plane, Zap, Droplets, TreePalm, Skull, ArrowRight, Package, Lock, Home, Building2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Avatar } from './Avatar';
import { motion } from 'motion/react';

interface TileProps {
  tile: TileType;
  players: Player[];
  allPlayers?: Player[];
  onClick: () => void;
  isCurrent: boolean;
  isOwned?: boolean;
  isMonopoly?: boolean;
  taxPool?: number;
  /** Cells per side (default 11 for a standard 40-tile board). Pass when using non-standard board sizes. */
  boardSizeN?: number;
}

// Height/width of the owner color band at the outer edge
const BAND = '30%';

const TileInner: React.FC<TileProps> = ({ tile, players, allPlayers, onClick, isCurrent, isOwned, isMonopoly, taxPool, boardSizeN }) => {
  const isCorner = tile.type === ETileType.CORNER;
  const isProp   = tile.type === ETileType.PROPERTY;
  const isBandTile = isProp || tile.type === ETileType.RAILROAD || tile.type === ETileType.UTILITY;

  const N = boardSizeN ?? 11;
  const isTop    = tile.id >= 0            && tile.id <= N - 1;
  const isRight  = tile.id >= N            && tile.id <= 2 * N - 3;
  const isBottom = tile.id >= 2 * N - 2   && tile.id <= 3 * N - 3;
  const isLeft   = tile.id >= 3 * N - 2   && tile.id <= 4 * N - 5;

  const ownerColor  = tile.ownerId !== null ? ((allPlayers ?? players).find(p => p.id === tile.ownerId)?.color ?? null) : null;
  const isPropertyOwned = isBandTile && ownerColor !== null;
  const contentRotate = isLeft ? 'rotate(-90deg)' : isRight ? 'rotate(90deg)' : 'none';

  const getIcon = () => {
    switch (tile.type) {
      case ETileType.RAILROAD:
        return <Plane size={14} className="text-slate-300 drop-shadow-md" />;
      case ETileType.UTILITY:
        return (
          <div className="flex flex-col items-center gap-[1px]">
            {tile.name.includes('Water') ? (
              <Droplets size={13} className="text-cyan-400 drop-shadow-md" />
            ) : (
              <Zap size={13} className="text-yellow-400 drop-shadow-md" fill="currentColor" />
            )}
            <span className="text-[5px] font-bold text-slate-400 uppercase tracking-tight leading-none">
              {tile.name.includes('Water') ? 'Water' : 'Electric'}
            </span>
            <span className="text-[5px] font-bold text-slate-400 uppercase tracking-tight leading-none">Company</span>
          </div>
        );
      case ETileType.CHANCE:
        return (
          <motion.div
            className="text-rose-400 font-black text-xl drop-shadow-md flex items-center justify-center select-none leading-none w-full h-full"
            animate={{ scale: [1, 1.15, 1], opacity: [0.85, 1, 0.85] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          >?</motion.div>
        );
      case ETileType.COMMUNITY_CHEST:
        return (
          <motion.div
            animate={{ y: [0, -2, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="flex items-center justify-center"
          >
            {tile.name === 'Treasure' ? (
              <img
                src="/assets/money-3221936.svg"
                alt="Treasure"
                className="w-[22px] h-[22px] drop-shadow-md"
              />
            ) : (
              <Package size={20} className="text-amber-400 drop-shadow-md" fill="currentColor" />
            )}
          </motion.div>
        );
      case ETileType.TAX:
        return (
          <div className="bg-slate-700/80 w-[22px] h-[16px] flex items-center justify-center rounded-[3px] border border-slate-500/60 shadow-sm">
            <span className="text-slate-200 font-black text-[8px] leading-none tracking-tight">×10</span>
          </div>
        );
      case ETileType.CORNER:
        if (tile.name === 'START')
          return (
            <div className="flex flex-col items-center justify-center h-full w-full bg-gradient-to-br from-[#1b1c2e] to-[#151525] p-1">
              <span className="text-2xl text-lime-400 font-black tracking-tighter uppercase leading-none drop-shadow-[0_0_8px_rgba(132,204,22,0.4)] pb-1">Start</span>
              <motion.div
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
              >
                <ArrowRight size={28} className="text-lime-500 drop-shadow-md" />
              </motion.div>
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
            <div className="flex flex-col items-center justify-center h-full w-full relative bg-gradient-to-br from-[#1c2236] to-[#162030] overflow-hidden">
              {/* Shimmer background */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent"
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              />
              <motion.div
                animate={{ rotate: [-4, 4, -4] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              >
                <TreePalm size={36} className="text-[#98d287] drop-shadow-[0_0_10px_rgba(152,210,135,0.4)]" />
              </motion.div>
              <span className="text-[10px] text-slate-200 mt-1 font-bold relative z-10">Vacation</span>
              {taxPool !== undefined && taxPool > 0 && (
                <motion.div
                  className="mt-0.5 bg-emerald-500/20 px-1.5 py-0.5 rounded-md border border-emerald-500/40 relative z-10"
                  animate={{
                    boxShadow: ['0 0 6px rgba(16,185,129,0.2)', '0 0 14px rgba(16,185,129,0.5)', '0 0 6px rgba(16,185,129,0.2)'],
                  }}
                  transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                >
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">${taxPool}</span>
                </motion.div>
              )}
            </div>
          );
        if (tile.name === 'Go to Prison')
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

  // Houses/hotel: count badge centered on the color band
  const renderBuildings = () => {
    if (tile.buildingCount === 0) return null;
    const isHotel = tile.buildingCount === 5;
    const bandStyle: React.CSSProperties = {
      position: 'absolute',
      zIndex: 20,
      pointerEvents: 'none',
      ...(isTop    ? { top: '15%',    left: '50%',  transform: 'translate(-50%, -50%)' } : {}),
      ...(isBottom ? { bottom: '15%', left: '50%',  transform: 'translate(-50%, 50%)' }  : {}),
      ...(isLeft   ? { left: '15%',   top: '50%',   transform: 'translate(-50%, -50%)' } : {}),
      ...(isRight  ? { right: '15%',  top: '50%',   transform: 'translate(50%, -50%)' }  : {}),
    };
    return (
      <div style={bandStyle}>
        <div
          className={`flex items-center gap-[2px] px-[3px] py-[2px] rounded-[3px] border border-white/20 shadow-sm ${isHotel ? 'bg-rose-600' : 'bg-emerald-600'}`}
          style={{ transform: contentRotate }}
        >
          {isHotel ? (
            <Building2 size={7} className="text-white shrink-0" />
          ) : (
            <>
              <Home size={7} className="text-white shrink-0" />
              <span className="text-white font-black leading-none" style={{ fontSize: '7px' }}>
                ×{tile.buildingCount}
              </span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={!isCurrent ? { scale: isCorner ? 1.01 : 1.04, zIndex: 30 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`
        relative w-full h-full flex items-center justify-center
        ${isCorner ? 'bg-[#21262d] rounded-[4px]' : 'bg-[#2a303c] rounded-[4px]'}
        cursor-pointer select-none group
        ${isCurrent ? 'ring-2 ring-indigo-500 z-50 shadow-[0_0_20px_rgba(99,102,241,0.3)] scale-[1.01]' : ''}
        ${isOwned && !isCorner ? 'hover:ring-2 hover:ring-white/30 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]' : ''}
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
            {/* ── Owner color band at OUTER edge — only when property is owned ── */}
            {isPropertyOwned && !tile.isMortgaged && (
              <div
                className="absolute z-10 rounded-[3px] transition-all duration-300"
                style={{
                  backgroundColor: ownerColor!,
                  ...(isTop    ? { top: 0, left: 0, right: 0, height: BAND } : {}),
                  ...(isBottom ? { bottom: 0, left: 0, right: 0, height: BAND } : {}),
                  ...(isLeft   ? { left: 0, top: 0, bottom: 0, width: BAND } : {}),
                  ...(isRight  ? { right: 0, top: 0, bottom: 0, width: BAND } : {}),
                }}
              />
            )}

            {/* ── Price badge: floating -8px OUTSIDE, hidden once owned ── */}
            {tile.price > 0 && tile.type !== ETileType.TAX && tile.ownerId === null && (
              <div
                className="absolute z-40 flex items-center justify-center pointer-events-none"
                style={{
                  ...(isTop    ? { top: '-4px',   left: '50%', transform: 'translateX(-50%)' } : {}),
                  ...(isBottom ? { bottom: '-4px', left: '50%', transform: 'translateX(-50%)' } : {}),
                  ...(isLeft   ? { left: '-9px',   top: '50%',  transform: 'translateY(-50%)' } : {}),
                  ...(isRight  ? { right: '-9px',  top: '50%',  transform: 'translateY(-50%)' } : {}),
                }}
              >
                <div style={{ transform: isLeft ? 'rotate(-90deg)' : isRight ? 'rotate(90deg)' : 'none' }}>
                  <span className="inline-flex items-center px-[4px] rounded-[3px] border border-slate-700/50 shadow-md bg-[#1a1f2e] text-slate-200 font-black font-mono tracking-tighter whitespace-nowrap cursor-default" style={{ fontSize: '8px', lineHeight: '14px', height: '14px' }}>
                    ${tile.price}
                  </span>
                </div>
              </div>
            )}

            {/* ── Main content: name + icon (offset inward when band is visible) ── */}
            <div
              className="absolute flex items-center justify-center overflow-hidden p-[2px]"
              style={{
                top:    isPropertyOwned && isTop    ? BAND : 0,
                right:  isPropertyOwned && isRight  ? BAND : 0,
                bottom: isPropertyOwned && isBottom ? BAND : 0,
                left:   isPropertyOwned && isLeft   ? BAND : 0,
              }}
            >
              <div
                className="flex flex-col items-center justify-center gap-[2px] w-full"
                style={{ transform: contentRotate }}
              >
                {tile.name && tile.type !== ETileType.UTILITY && (
                  <span
                    className="max-w-[48px] overflow-hidden whitespace-nowrap text-ellipsis text-center font-bold uppercase tracking-tighter text-slate-100 leading-none"
                    style={{ fontSize: '6.5px', textShadow: '0 1px 2px rgba(0,0,0,0.9)' }}
                  >
                    {tile.name}
                  </span>
                )}
                {(!tile.countryCode && getIcon() !== null) && (
                  <div className="flex items-center justify-center shrink-0 min-h-0 min-w-0">
                    {getIcon()}
                  </div>
                )}
              </div>
            </div>

            {/* ── Flag: floating -8px toward board center (original position), slightly bigger ── */}
            {!isCorner && tile.countryCode && (
              <div
                className="absolute z-40 flex items-center justify-center pointer-events-none"
                style={{
                  ...(isTop    ? { bottom: '-9px', left: '50%', transform: 'translateX(-50%)' } : {}),
                  ...(isBottom ? { top: '-9px',    left: '50%', transform: 'translateX(-50%)' } : {}),
                  ...(isLeft   ? { right: '-9px',  top: '50%',  transform: 'translateY(-50%)' } : {}),
                  ...(isRight  ? { left: '-9px',   top: '50%',  transform: 'translateY(-50%)' } : {}),
                }}
              >
                <div style={{ transform: isLeft ? 'rotate(-90deg)' : isRight ? 'rotate(90deg)' : 'none' }}>
                  <img
                    src={`https://flagcdn.com/w40/${tile.countryCode}.png`}
                    srcSet={`https://flagcdn.com/w80/${tile.countryCode}.png 2x`}
                    alt={tile.countryCode}
                    className="w-[22px] h-[17px] object-cover rounded-[2px] shadow-md border border-white/25"
                    loading="lazy"
                  />
                </div>
              </div>
            )}

            {/* ── Buildings overlay ── */}
            {isProp && renderBuildings()}
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
                      className="w-5 h-5 shadow-[0_0_10px_rgba(0,0,0,0.8)] border-white/40 relative z-10"
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
    </motion.div>
  );
};

export const Tile = React.memo(TileInner);
