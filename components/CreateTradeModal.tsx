import React, { useState } from 'react';
import { Player, Tile, ColorGroup, TileType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRightLeft, Coins, Check, User } from 'lucide-react';
import { Avatar } from './Avatar';
import { Button } from './ui/button';

interface CreateTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  tiles: Tile[];
  myPlayerId: number;
  onTrade: (offerCash: number, offerPropertyIds: number[], targetTileId: number, requestCash: number) => void;
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

export const CreateTradeModal: React.FC<CreateTradeModalProps> = ({
  isOpen, onClose, players, tiles, myPlayerId, onTrade
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [targetTileId, setTargetTileId] = useState<number | null>(null);
  
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerPropertyIds, setOfferPropertyIds] = useState<number[]>([]);

  if (!isOpen) return null;

  const myPlayer = players.find(p => p.id === myPlayerId);
  const targetPlayer = players.find(p => p.id === targetPlayerId);
  const targetTile = targetTileId !== null ? tiles[targetTileId] : null;

  const myTradeableProperties = tiles.filter(t => 
    t.ownerId === myPlayerId && !t.isMortgaged && t.buildingCount === 0 && (t.type === TileType.PROPERTY || t.type === TileType.RAILROAD || t.type === TileType.UTILITY)
  );

  const opponents = players.filter(p => !p.isBankrupt && p.id !== myPlayerId);

  const handleClose = () => {
    setStep(1);
    setTargetPlayerId(null);
    setTargetTileId(null);
    setOfferCash(0);
    setRequestCash(0);
    setOfferPropertyIds([]);
    onClose();
  };

  const submitTrade = () => {
    if (targetTileId === null) return;
    onTrade(offerCash, offerPropertyIds, targetTileId, requestCash);
    handleClose();
  };

  const toggleOfferProperty = (id: number) => {
    setOfferPropertyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-[320px] bg-[#0f172a] border border-indigo-500/30 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
      >
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/20 to-transparent flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight">Create Trade</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              {step === 1 ? 'Select Partner' : step === 2 ? 'Select Target Asset' : 'Build Offer'}
            </p>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0 transition-colors group/close">
            <span className="inline-flex transition-transform duration-200 group-hover/close:rotate-90"><X size={16} /></span>
          </button>
        </div>

        <div className="p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 flex-1">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                {opponents.length === 0 ? (
                  <div className="text-center text-slate-500 text-xs italic py-4">No opponents available.</div>
                ) : (
                  opponents.map(p => {
                    const count = tiles.filter(t => t.ownerId === p.id && !t.isMortgaged).length;
                    return (
                      <button
                        key={p.id}
                        disabled={count === 0}
                        onClick={() => { setTargetPlayerId(p.id); setStep(2); }}
                        className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Avatar avatarId={p.avatarId} color={p.color} className="w-8 h-8" />
                        <div className="text-left flex-1 min-w-0">
                          <div className="text-sm font-bold text-white uppercase truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest">{count} Tradeable Assets</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}

            {step === 2 && targetPlayer && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                {tiles.filter(t => t.ownerId === targetPlayerId && !t.isMortgaged).map(tile => (
                  <button
                    key={tile.id}
                    onClick={() => { setTargetTileId(tile.id); setStep(3); }}
                    className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 transition-colors"
                  >
                    <div className={`w-2 h-8 rounded-full ${colorMap[tile.group]}`} style={{ backgroundColor: tile.group !== 'NONE' ? undefined : '#64748b' }} />
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-xs font-bold text-white uppercase truncate">{tile.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">${tile.price}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

            {step === 3 && targetPlayer && targetTile && myPlayer && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                
                {/* Target Asset display */}
                <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest block mb-0.5">Targeting Asset</span>
                    <span className="text-xs font-bold text-white uppercase">{targetTile.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest block mb-0.5">Owner</span>
                    <div className="flex items-center gap-1"><Avatar avatarId={targetPlayer.avatarId} color={targetPlayer.color} className="w-3 h-3"/><span className="text-[10px] font-bold text-white uppercase">{targetPlayer.name}</span></div>
                  </div>
                </div>

                {/* Offer Cash */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Coins size={12} className="text-emerald-400" /> Offer Cash</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">${offerCash}</span>
                  </div>
                  <input type="range" min={0} max={myPlayer.money} step={50} value={offerCash} onChange={e => setOfferCash(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-emerald-500" />
                </div>

                {/* Request Cash */}
                <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Coins size={12} className="text-rose-400" /> Request Extra Cash</span>
                    <span className="text-xs font-mono font-bold text-rose-400">${requestCash}</span>
                  </div>
                  <input type="range" min={0} max={targetPlayer.money} step={50} value={requestCash} onChange={e => setRequestCash(parseInt(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-rose-500" />
                </div>

                {/* Offer Properties */}
                {myTradeableProperties.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Include Properties</span>
                    <div className="grid grid-cols-1 gap-1.5">
                      {myTradeableProperties.map(prop => {
                        const isSelected = offerPropertyIds.includes(prop.id);
                        return (
                          <button key={prop.id} onClick={() => toggleOfferProperty(prop.id)} className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all text-[10px] ${isSelected ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300' : 'bg-slate-800/50 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>
                            <div className={`w-1 h-5 rounded-full ${colorMap[prop.group]}`} style={{ backgroundColor: prop.group !== 'NONE' ? undefined : '#64748b' }} />
                            <span className="flex-1 font-bold truncate uppercase">{prop.name}</span>
                            {isSelected && <Check size={12} className="text-indigo-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-3 bg-black/40 border-t border-white/5 grid grid-cols-2 gap-2 mt-auto">
          {step > 1 ? (
            <button onClick={() => setStep((step - 1) as 1 | 2)} className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95">
              Back
            </button>
          ) : (
            <button onClick={handleClose} className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95">
              Cancel
            </button>
          )}

          {step === 3 ? (
            <button onClick={submitTrade} disabled={offerCash === 0 && offerPropertyIds.length === 0 && requestCash === 0} className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-1.5">
              <ArrowRightLeft size={12} /> Send Offer
            </button>
          ) : (
            <button disabled className="py-3 rounded-xl bg-slate-800 opacity-50 text-slate-500 font-black uppercase tracking-widest text-[10px]">
              Next
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
