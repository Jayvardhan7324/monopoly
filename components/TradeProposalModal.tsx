import React from 'react';
import { Player, Tile, TradeOffer } from '../types';
import { motion } from 'motion/react';
import { X, ArrowRightLeft, Landmark, Coins } from 'lucide-react';
import { Avatar } from './Avatar';

interface TradeProposalModalProps {
  trade: TradeOffer;
  players: Player[];
  tiles: Tile[];
  onAccept: () => void;
  onDecline: () => void;
}

export const TradeProposalModal: React.FC<TradeProposalModalProps> = ({
  trade,
  players,
  tiles,
  onAccept,
  onDecline
}) => {
  const proposer = players.find(p => p.id === trade.proposerId)!;
  const target = players.find(p => p.id === trade.targetId)!;
  const targetTile = tiles[trade.targetPropertyId];
  const offeredTiles = trade.offerPropertyIds.map(id => tiles[id]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-[#0f172a] border border-indigo-500/30 rounded-3xl w-full max-w-xl overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.2)]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-gradient-to-r from-indigo-500/20 to-transparent flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
            <ArrowRightLeft size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">Incoming Trade Offer</h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{proposer.name} wants to deal</p>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {/* Proposer Offers */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-indigo-400">
              <Avatar color={proposer.color} className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase tracking-widest">{proposer.name} Offers:</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {trade.offerCash > 0 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Coins size={16} />
                  </div>
                  <span className="text-emerald-400 font-mono font-bold">${trade.offerCash}</span>
                </div>
              )}
              {offeredTiles.map(tile => (
                <div key={tile.id} className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                  <div className={`w-1 h-6 rounded-full bg-slate-500`} style={{ backgroundColor: tile.group !== 'NONE' ? undefined : '#64748b' }} />
                  <span className="text-xs font-bold text-white uppercase">{tile.name}</span>
                </div>
              ))}
              {trade.offerCash === 0 && offeredTiles.length === 0 && (
                <div className="text-slate-600 text-xs italic">Nothing offered</div>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500">
              <ArrowRightLeft size={20} />
            </div>
          </div>

          {/* Proposer Requests */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <Avatar color={target.color} className="w-6 h-6" />
              <span className="text-[10px] font-black uppercase tracking-widest">In Exchange For:</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-white/5 border border-white/5 rounded-xl p-3 flex items-center gap-3">
                <div className={`w-1 h-6 rounded-full bg-slate-500`} style={{ backgroundColor: targetTile.group !== 'NONE' ? undefined : '#64748b' }} />
                <span className="text-xs font-bold text-white uppercase">{targetTile.name}</span>
              </div>
              {trade.requestCash > 0 && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-400">
                    <Coins size={16} />
                  </div>
                  <span className="text-rose-400 font-mono font-bold">${trade.requestCash}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 bg-black/40 border-t border-white/5 grid grid-cols-2 gap-4">
          <button
            onClick={onDecline}
            className="py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase tracking-widest text-xs transition-all active:scale-95"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            Accept Deal
          </button>
        </div>
      </motion.div>
    </div>
  );
};
