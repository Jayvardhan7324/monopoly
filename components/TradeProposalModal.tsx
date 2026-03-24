import React from 'react';
import { Player, Tile, TradeOffer } from '../types';
import { motion } from 'motion/react';
import { X, ArrowRightLeft, Landmark, Coins } from 'lucide-react';
import { Avatar } from './Avatar';

interface TradeProposalModalProps {
  trade: TradeOffer;
  players: Player[];
  tiles: Tile[];
  myPlayerId: number;
  onAccept: () => void;
  onDecline: () => void;
}

export const TradeProposalModal: React.FC<TradeProposalModalProps> = ({
  trade,
  players,
  tiles,
  myPlayerId,
  onAccept,
  onDecline
}) => {
  const proposer = players.find(p => p.id === trade.proposerId);
  const target = players.find(p => p.id === trade.targetId);
  const targetTile = tiles[trade.targetPropertyId];
  const offeredTiles = trade.offerPropertyIds.map(id => tiles[id]);

  if (!proposer || !target) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0f172a] border border-indigo-500/30 rounded-2xl w-full max-w-[300px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/20 to-transparent flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white uppercase tracking-tight leading-tight">Incoming Trade</h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{proposer.name} wants to deal</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <ArrowRightLeft size={16} />
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {/* Proposer Offers */}
          <div className="space-y-2">
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
                  <div className={`w-1 h-4 rounded-full bg-slate-500`} style={{ backgroundColor: tile.group !== 'NONE' ? undefined : '#64748b' }} />
                  <span className="text-[10px] font-bold text-white uppercase truncate">{tile.name}</span>
                </div>
              ))}
              {trade.offerCash === 0 && offeredTiles.length === 0 && (
                <div className="text-slate-600 text-[10px] italic">Nothing offered</div>
              )}
            </div>
          </div>

          <div className="flex justify-center -my-2 relative z-10">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
              <ArrowRightLeft size={12} />
            </div>
          </div>

          {/* Proposer Requests */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-rose-400 mb-1">
              <Avatar avatarId={target.avatarId} color={target.color} className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-widest">In Exchange For:</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <div className="bg-white/5 border border-white/5 rounded-lg p-2 flex items-center gap-2">
                <div className={`w-1 h-4 rounded-full bg-slate-500`} style={{ backgroundColor: targetTile.group !== 'NONE' ? undefined : '#64748b' }} />
                <span className="text-[10px] font-bold text-white uppercase truncate">{targetTile.name}</span>
              </div>
              {trade.requestCash > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1"><Coins size={12} className="text-rose-400"/> Cash</span>
                  <span className="text-rose-400 font-mono font-bold text-sm">${trade.requestCash}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 bg-black/40 border-t border-white/5 grid grid-cols-2 gap-2 mt-auto">
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
      </motion.div>
    </div>
  );
};
