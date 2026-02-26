import React, { useState } from 'react';
import { Tile, TileType, Player, ColorGroup } from '../types';
import { X, ArrowUpCircle, AlertCircle, Banknote, Landmark, Unlock, Home, Building2, AlertTriangle } from 'lucide-react';
import { Avatar } from './Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { GAME_CONSTANTS } from '../constants';

interface PropertyModalProps {
  tile: Tile;
  owner?: Player;
  onClose: () => void;
  onUpgrade?: () => void;
  canUpgrade: boolean;
  currentPlayer?: Player;
  myProperties?: Tile[];
  onTrade?: (offer: { cash: number; properties: number[]; requestCash: number }) => void;
  onMortgage?: () => void;
  onUnmortgage?: () => void;
  onSell?: () => void;
}

const colorMap: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]: 'bg-amber-900',
  [ColorGroup.LIGHT_BLUE]: 'bg-cyan-600',
  [ColorGroup.PINK]: 'bg-fuchsia-600',
  [ColorGroup.ORANGE]: 'bg-orange-600',
  [ColorGroup.RED]: 'bg-red-700',
  [ColorGroup.YELLOW]: 'bg-yellow-600',
  [ColorGroup.GREEN]: 'bg-emerald-700',
  [ColorGroup.DARK_BLUE]: 'bg-blue-800',
  [ColorGroup.NONE]: 'bg-slate-700',
};

export const PropertyModal: React.FC<PropertyModalProps> = ({
  tile, owner, onClose, onUpgrade, canUpgrade, currentPlayer, onMortgage, onUnmortgage, onSell,
}) => {
  // IMP-19: Sell confirmation state
  const [showSellConfirm, setShowSellConfirm] = useState(false);

  const isProperty = tile.type === TileType.PROPERTY;
  const isMine = owner?.id === currentPlayer?.id;
  const mortgageValue = Math.floor(tile.price * GAME_CONSTANTS.MORTGAGE_RATE);
  const unmortgageCost = Math.floor(mortgageValue * GAME_CONSTANTS.UNMORTGAGE_FEE);
  const sellValue = Math.floor(tile.price * GAME_CONSTANTS.SELL_RATE);

  const getLevelLabel = (count: number) => {
    if (count === 0) return 'Base Rent';
    if (count === 5) return 'Hotel';
    return `${count} ${count === 1 ? 'House' : 'Houses'}`;
  };

  const handleSell = () => {
    if (!showSellConfirm) {
      setShowSellConfirm(true);
      return;
    }
    setShowSellConfirm(false);
    onSell?.();
  };

  const handleClose = () => {
    setShowSellConfirm(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="shadcn-card bg-slate-900 w-full max-w-[320px] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className={`${colorMap[tile.group]} p-4 relative overflow-hidden`}>
          <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
          <button onClick={handleClose} className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors z-10">
            <X size={18} />
          </button>
          <div className="relative z-10 text-[8px] font-black text-white/60 uppercase tracking-widest mb-0.5">{tile.type}</div>
          <h2 className="relative z-10 text-2xl font-black text-white uppercase tracking-tighter drop-shadow-md">{tile.name}</h2>
          {tile.isMortgaged && (
            <div className="relative z-10 mt-1 inline-block px-2 py-0.5 bg-black/40 backdrop-blur-sm rounded-full border border-white/20 text-[8px] font-bold text-white uppercase tracking-widest">
              Asset Mortgaged
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Portfolio Owner</span>
              {owner ? (
                <div className="flex items-center gap-1.5">
                  <Avatar avatarId={owner.avatar} color={owner.color} isBankrupt={owner.isBankrupt} inJail={owner.inJail} className="w-4 h-4" />
                  <span className="font-bold text-xs">{owner.name}</span>
                </div>
              ) : (
                <span className="text-slate-500 italic text-xs">Market Available</span>
              )}
            </div>
            <div className="text-right space-y-0.5">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">List Price</span>
              <span className="font-mono text-lg font-black text-emerald-400">${tile.price}</span>
            </div>
          </div>

          {/* Rent Table */}
          <div className="space-y-1.5 mb-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800">
            {!tile.isMortgaged ? (
              <div className="text-[10px] flex flex-col gap-1">
                <div className={`flex justify-between items-center px-1 rounded ${tile.buildingCount === 0 ? 'text-white font-bold bg-white/5 py-0.5' : 'text-slate-400'}`}>
                  <span>Base Rent</span>
                  <span className="font-mono">${tile.rent[0]}</span>
                </div>
                {isProperty && [1, 2, 3, 4, 5].map(lvl => (
                  <div
                    key={lvl}
                    className={`flex justify-between items-center px-1 rounded ${tile.buildingCount === lvl ? 'text-white font-bold bg-white/5 py-0.5' : 'text-slate-400'} ${lvl === 5 ? 'mt-0.5 pt-0.5 border-t border-white/5' : ''}`}
                  >
                    <div className="flex items-center gap-1">
                      {lvl < 5
                        ? <Home size={8} className={tile.buildingCount === lvl ? 'text-emerald-400' : 'text-slate-600'} />
                        : <Building2 size={8} className={tile.buildingCount === lvl ? 'text-rose-400' : 'text-slate-600'} />
                      }
                      <span>{getLevelLabel(lvl)}</span>
                    </div>
                    <span className={`font-mono ${lvl === 5 ? 'text-rose-400' : ''}`}>${tile.rent[lvl]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-2 text-rose-500 text-[10px] font-bold flex items-center justify-center gap-1.5">
                <AlertCircle size={12} /> Revenue streams suspended
              </div>
            )}
          </div>

          {/* Action Panel */}
          <div className="space-y-2">
            {isMine && !tile.isMortgaged && canUpgrade && isProperty && tile.buildingCount < 5 && (
              <button
                onClick={onUpgrade}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 text-xs"
              >
                <ArrowUpCircle size={16} /> {tile.buildingCount === 4 ? 'Build Hotel' : 'Build Estate'} (-${tile.houseCost})
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              {isMine && tile.buildingCount === 0 && (
                tile.isMortgaged ? (
                  <button
                    onClick={onUnmortgage}
                    className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <Unlock size={12} /> Reclaim (-${unmortgageCost})
                  </button>
                ) : (
                  <button
                    onClick={onMortgage}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <Banknote size={12} /> Mortgage (+${mortgageValue})
                  </button>
                )
              )}

              {isMine && !tile.isMortgaged && tile.buildingCount === 0 && onSell && (
                <AnimatePresence mode="wait">
                  {showSellConfirm ? (
                    <motion.div
                      key="confirm"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex gap-1.5"
                    >
                      <button
                        onClick={handleSell}
                        className="flex-1 bg-rose-600 hover:bg-rose-500 text-white border border-rose-500 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all active:scale-95"
                      >
                        <AlertTriangle size={10} /> Confirm
                      </button>
                      <button
                        onClick={() => setShowSellConfirm(false)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 py-2 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                      >
                        No
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="sell"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={handleSell}
                      className="bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-900/30 py-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <Landmark size={12} /> Sell (+${sellValue})
                    </motion.button>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};