import React, { useState } from 'react';
import { Tile, TileType, Player, ColorGroup } from '../types';
import { X, ArrowUpCircle, AlertCircle, Banknote, Landmark, Unlock, Home, Building2, AlertTriangle, ArrowRightLeft, Coins, Check } from 'lucide-react';
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
  tile, owner, onClose, onUpgrade, canUpgrade, currentPlayer, myProperties, onTrade, onMortgage, onUnmortgage, onSell,
}) => {
  // IMP-19: Sell confirmation state
  const [showSellConfirm, setShowSellConfirm] = useState(false);
  // Trade offer builder state
  const [showTradeBuilder, setShowTradeBuilder] = useState(false);
  const [tradeOfferCash, setTradeOfferCash] = useState(0);
  const [tradeRequestCash, setTradeRequestCash] = useState(0);
  const [tradeOfferPropertyIds, setTradeOfferPropertyIds] = useState<number[]>([]);

  const isProperty = tile.type === TileType.PROPERTY;
  const isMine = owner?.id === currentPlayer?.id;
  const isOtherOwned = owner && !isMine;
  const mortgageValue = Math.floor(tile.price * GAME_CONSTANTS.MORTGAGE_RATE);
  const unmortgageCost = Math.floor(mortgageValue * GAME_CONSTANTS.UNMORTGAGE_FEE);
  const sellValue = Math.floor(tile.price * GAME_CONSTANTS.SELL_RATE);

  // Tradeable properties: mine, not mortgaged, no buildings
  const tradeableProperties = (myProperties || []).filter(t =>
    t.ownerId === currentPlayer?.id && !t.isMortgaged && t.buildingCount === 0 && t.id !== tile.id
  );

  const toggleTradeProperty = (id: number) => {
    setTradeOfferPropertyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const submitTrade = () => {
    if (!onTrade) return;
    onTrade({ cash: tradeOfferCash, properties: tradeOfferPropertyIds, requestCash: tradeRequestCash });
    setShowTradeBuilder(false);
    setTradeOfferCash(0);
    setTradeRequestCash(0);
    setTradeOfferPropertyIds([]);
    onClose();
  };

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
    setShowTradeBuilder(false);
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
        className="shadcn-card bg-slate-900 w-full max-w-[360px] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className={`${colorMap[tile.group]} p-4 relative overflow-hidden shrink-0`}>
          <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
          <button onClick={handleClose} className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors z-10">
            <X size={18} />
          </button>
          <h2 className="relative z-10 text-xl font-black text-white drop-shadow-md uppercase tracking-tighter">{tile.name}</h2>
          <p className="relative z-10 text-white/60 text-[9px] font-bold uppercase tracking-widest mt-1">{tile.group !== 'NONE' ? tile.group.replace('_', ' ') : tile.type} district</p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
            <div className="space-y-0.5">
              <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Portfolio Owner</span>
              {owner ? (
                <div className="flex items-center gap-1.5">
                  <Avatar avatarId={owner.avatarId} color={owner.color} isBankrupt={owner.isBankrupt} inJail={owner.inJail} className="w-4 h-4" />
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

            {/* Trade Button — show when another player owns this property */}
            {isOtherOwned && onTrade && currentPlayer && !tile.isMortgaged && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 border-t border-slate-800 pt-3"
              >
                {!showTradeBuilder ? (
                  <button
                    onClick={() => setShowTradeBuilder(true)}
                    className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <ArrowRightLeft size={16} /> Propose Trade for {tile.name}
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 overflow-hidden"
                  >
                    <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Trade Offer Builder</div>

                    {/* Offer Cash */}
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Coins size={12} className="text-emerald-400" /> Offer Cash
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400">${tradeOfferCash}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={currentPlayer.money}
                        step={50}
                        value={tradeOfferCash}
                        onChange={(e) => setTradeOfferCash(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                      />
                      <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                        <span>$0</span>
                        <span>${currentPlayer.money}</span>
                      </div>
                    </div>

                    {/* Request Cash */}
                    <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Coins size={12} className="text-rose-400" /> Request Cash
                        </span>
                        <span className="text-xs font-mono font-bold text-rose-400">${tradeRequestCash}</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={owner ? owner.money : 0}
                        step={50}
                        value={tradeRequestCash}
                        onChange={(e) => setTradeRequestCash(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-rose-500"
                      />
                      <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                        <span>$0</span>
                        <span>${owner?.money || 0}</span>
                      </div>
                    </div>

                    {/* Offer Properties */}
                    {tradeableProperties.length > 0 && (
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Offer Properties</span>
                        <div className="max-h-28 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700 pr-1">
                          {tradeableProperties.map(prop => {
                            const isSelected = tradeOfferPropertyIds.includes(prop.id);
                            return (
                              <button
                                key={prop.id}
                                onClick={() => toggleTradeProperty(prop.id)}
                                className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all text-[10px] ${isSelected ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'bg-slate-800/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}
                              >
                                <div className={`w-1 h-5 rounded-full ${colorMap[prop.group]}`} />
                                <span className="flex-1 font-bold truncate">{prop.name}</span>
                                <span className="font-mono text-slate-500">${prop.price}</span>
                                {isSelected && <Check size={12} className="text-indigo-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Submit/Cancel */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => { setShowTradeBuilder(false); setTradeOfferCash(0); setTradeRequestCash(0); setTradeOfferPropertyIds([]); }}
                        className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={submitTrade}
                        disabled={tradeOfferCash === 0 && tradeOfferPropertyIds.length === 0 && tradeRequestCash === 0}
                        className="py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-1.5"
                      >
                        <ArrowRightLeft size={12} /> Send Offer
                      </button>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};