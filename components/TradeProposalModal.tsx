import React from 'react';
import { Player, Tile, TradeOffer } from '../types';
import { motion } from 'motion/react';
import { X, ArrowRightLeft, Coins } from 'lucide-react';
import { Avatar } from './Avatar';
import { useModalAccessibility } from '../hooks/useModalAccessibility';
import { TradeTileIcon } from './TradeTileIcon';

interface TradeProposalModalProps {
  trade: TradeOffer;
  players: Player[];
  tiles: Tile[];
  myPlayerId: number;
  onAccept: () => void;
  onDecline: () => void;
  onDismiss?: () => void;
  onCancel?: () => void;
}

export const TradeProposalModal: React.FC<TradeProposalModalProps> = ({
  trade,
  players,
  tiles,
  myPlayerId,
  onAccept,
  onDecline,
  onDismiss,
  onCancel,
}) => {
  const proposer = players.find(p => p.id === trade.proposerId);
  const target = players.find(p => p.id === trade.targetId);
  const targetTile = trade.targetPropertyId !== null ? tiles[trade.targetPropertyId] : null;
  const offeredTiles = trade.offerPropertyIds.map(id => tiles[id]).filter(Boolean);
  const isTarget = myPlayerId === trade.targetId;

  // UX-2: Escape-to-close (treats dismiss or decline as close action).
  const closeAction = onDismiss ?? onDecline ?? onCancel ?? (() => {});
  const modalRef = useModalAccessibility<HTMLDivElement>({ isOpen: true, onClose: closeAction });

  if (!proposer || !target) return null;

  const groupColor: Record<string, string> = {
    BROWN: '#78350f', LIGHT_BLUE: '#38bdf8', PINK: '#ec4899',
    ORANGE: '#f97316', RED: '#dc2626', YELLOW: '#ca8a04',
    GREEN: '#059669', DARK_BLUE: '#1d4ed8',
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-proposal-title"
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0f172a] border border-indigo-500/30 rounded-2xl w-full max-w-[300px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] outline-none"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/20 to-transparent flex items-center justify-between">
          <div>
            <h2 id="trade-proposal-title" className="text-lg font-black text-white uppercase tracking-tight leading-tight">Incoming Trade</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{proposer.name} wants to deal</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ArrowRightLeft size={16} />
            </div>
            {onDismiss && (
              <button
                onClick={onDismiss}
                title="Dismiss — you can review this trade in the Trades panel"
                aria-label="Dismiss trade — review later in Trades panel"
                className="w-11 h-11 -m-1.5 rounded-full hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors group/x focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                <span className="inline-flex w-8 h-8 rounded-full bg-slate-800 items-center justify-center transition-transform duration-200 group-hover/x:rotate-90">
                  <X size={14} />
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {/* Proposer Offers */}
          <section role="region" aria-label={`${proposer.name}'s offer`} className="space-y-2">
            <div className="flex items-center gap-1.5 text-indigo-400 mb-1">
              <Avatar avatarId={proposer.avatarId} color={proposer.color} className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">{proposer.name} Offers:</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {trade.offerCash > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Coins size={12} className="text-emerald-400"/> Cash</span>
                  <span className="text-emerald-400 font-mono font-bold text-sm">${trade.offerCash}</span>
                </div>
              )}
              {offeredTiles.map(tile => (
                <div key={tile.id} className="bg-white/5 border border-white/5 rounded-lg p-2 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: groupColor[tile.group] ?? '#64748b' }} />
                  <TradeTileIcon tile={tile} className="w-4 h-4" />
                  <span className="text-[10px] font-bold text-white uppercase truncate">{tile.name}</span>
                </div>
              ))}
              {trade.offerCash === 0 && offeredTiles.length === 0 && (
                <div className="text-slate-600 text-[10px] italic">Nothing offered</div>
              )}
            </div>
          </section>

          <div className="flex justify-center -my-2 relative z-10" aria-hidden="true">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
              <ArrowRightLeft size={12} />
            </div>
          </div>

          {/* Proposer Requests */}
          <section role="region" aria-label={`Requested from ${target.name}`} className="space-y-2">
            <div className="flex items-center gap-1.5 text-rose-400 mb-1">
              <Avatar avatarId={target.avatarId} color={target.color} className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">In Exchange For:</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {targetTile && (
                <div className="bg-white/5 border border-white/5 rounded-lg p-2 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full shrink-0" style={{ backgroundColor: groupColor[targetTile.group] ?? '#64748b' }} />
                  <TradeTileIcon tile={targetTile} className="w-4 h-4" />
                  <span className="text-[10px] font-bold text-white uppercase truncate">{targetTile.name}</span>
                </div>
              )}
              {trade.requestCash > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Coins size={12} className="text-rose-400"/> Cash</span>
                  <span className="text-rose-400 font-mono font-bold text-sm">${trade.requestCash}</span>
                </div>
              )}
              {!targetTile && trade.requestCash === 0 && (
                <div className="text-slate-600 text-[10px] italic">Nothing requested</div>
              )}
            </div>
          </section>
        </div>

        {/* Actions */}
        <div className="p-3 bg-black/40 border-t border-white/5 mt-auto">
          {isTarget ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onDecline}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95"
              >
                Decline
              </button>
              <button
                onClick={onAccept}
                className="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
              >
                Accept Deal
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="flex-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest py-2">
                Waiting for {target.name}…
              </p>
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="py-2.5 px-4 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-400 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <X size={11} />
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
