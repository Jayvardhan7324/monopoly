import React, { useState } from 'react';
import { Tile, TileType, Player, ColorGroup } from '../types';
import { X, ArrowUpCircle, AlertCircle, Banknote, Landmark, Unlock, Home, Building2, AlertTriangle, ArrowRightLeft, Coins, Check } from 'lucide-react';
import { Avatar } from './Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { GAME_CONSTANTS } from '../constants';
import { Card, CardContent, CardHeader } from './ui/card';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

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
  const [showSellConfirm, setShowSellConfirm] = useState(false);
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
    if (!showSellConfirm) { setShowSellConfirm(true); return; }
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
        // Portrait: narrower & taller
        className="w-full max-w-[300px] max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <Card className="bg-slate-900 border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
          {/* Coloured Header Banner */}
          <CardHeader className={`${colorMap[tile.group]} p-0 shrink-0 relative overflow-hidden`}>
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            <div className="p-4 pr-8 relative z-10">
              <h2 className="text-lg font-black text-white drop-shadow-md uppercase tracking-tighter leading-tight">{tile.name}</h2>
              <p className="text-white/60 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                {tile.group !== 'NONE' ? tile.group.replace('_', ' ') : tile.type} district
              </p>
            </div>
            {/* Small X button */}
            <button
              onClick={handleClose}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/70 hover:text-white transition-colors z-20"
            >
              <X size={14} />
            </button>
          </CardHeader>

          <CardContent className="p-4 space-y-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
            {/* Owner / Price Row */}
            <div className="flex justify-between items-center">
              <div className="space-y-0.5">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Portfolio Owner</span>
                {owner ? (
                  <div className="flex items-center gap-1.5">
                    <Avatar avatarId={owner.avatarId} color={owner.color} isBankrupt={owner.isBankrupt} inJail={owner.inJail} className="w-4 h-4" />
                    <span className="font-bold text-xs">{owner.name}</span>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-700 py-0 px-1.5">Market Available</Badge>
                )}
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">List Price</span>
                <span className="font-mono text-lg font-black text-emerald-400">${tile.price}</span>
              </div>
            </div>

            <Separator className="bg-slate-800" />

            {/* Rent Table */}
            <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-1">
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

            <Separator className="bg-slate-800" />

            {/* Action Panel */}
            <div className="space-y-2">
              {isMine && !tile.isMortgaged && canUpgrade && isProperty && tile.buildingCount < 5 && (
                <Button
                  onClick={onUpgrade}
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs shadow-lg shadow-indigo-600/20"
                >
                  <ArrowUpCircle size={14} /> {tile.buildingCount === 4 ? 'Build Hotel' : 'Build Estate'} (-${tile.houseCost})
                </Button>
              )}

              <div className="grid grid-cols-2 gap-2">
                {isMine && tile.buildingCount === 0 && (
                  tile.isMortgaged ? (
                    <Button
                      onClick={onUnmortgage}
                      size="sm"
                      variant="outline"
                      className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border-emerald-500/30 text-[10px]"
                    >
                      <Unlock size={11} /> Reclaim (-${unmortgageCost})
                    </Button>
                  ) : (
                    <Button
                      onClick={onMortgage}
                      size="sm"
                      variant="outline"
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 text-[10px]"
                    >
                      <Banknote size={11} /> Mortgage (+${mortgageValue})
                    </Button>
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
                        className="flex gap-1.5 col-span-2"
                      >
                        <Button onClick={handleSell} size="sm" className="flex-1 bg-rose-600 hover:bg-rose-500 text-[10px]">
                          <AlertTriangle size={10} /> Confirm
                        </Button>
                        <Button onClick={() => setShowSellConfirm(false)} size="sm" variant="outline" className="flex-1 border-slate-700 text-slate-300 text-[10px]">
                          No
                        </Button>
                      </motion.div>
                    ) : (
                      <motion.div key="sell" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                        <Button
                          onClick={handleSell}
                          size="sm"
                          variant="outline"
                          className="w-full bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border-rose-900/30 text-[10px]"
                        >
                          <Landmark size={11} /> Sell (+${sellValue})
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>

              {/* Trade Button */}
              {isOtherOwned && onTrade && currentPlayer && !tile.isMortgaged && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-1">
                  <Separator className="bg-slate-800 mb-3" />
                  {!showTradeBuilder ? (
                    <Button
                      onClick={() => setShowTradeBuilder(true)}
                      size="sm"
                      variant="outline"
                      className="w-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/30 text-xs"
                    >
                      <ArrowRightLeft size={14} /> Propose Trade for {tile.name}
                    </Button>
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
                          type="range" min={0} max={currentPlayer.money} step={50}
                          value={tradeOfferCash} onChange={e => setTradeOfferCash(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                          <span>$0</span><span>${currentPlayer.money}</span>
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
                          type="range" min={0} max={owner ? owner.money : 0} step={50}
                          value={tradeRequestCash} onChange={e => setTradeRequestCash(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-rose-500"
                        />
                        <div className="flex justify-between text-[9px] text-slate-600 font-mono">
                          <span>$0</span><span>${owner?.money || 0}</span>
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
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-slate-700 text-slate-300 text-[10px]"
                          onClick={() => { setShowTradeBuilder(false); setTradeOfferCash(0); setTradeRequestCash(0); setTradeOfferPropertyIds([]); }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={submitTrade}
                          disabled={tradeOfferCash === 0 && tradeOfferPropertyIds.length === 0 && tradeRequestCash === 0}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] shadow-lg shadow-indigo-600/20"
                        >
                          <ArrowRightLeft size={11} /> Send Offer
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};