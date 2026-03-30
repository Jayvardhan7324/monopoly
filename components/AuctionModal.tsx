import React from 'react';
import { GameState } from '../types';
import { Avatar } from './Avatar';
import { Gavel } from 'lucide-react';
import { GAME_CONSTANTS } from '../constants';
import { motion } from 'motion/react';

interface AuctionModalProps {
  gameState: GameState;
  myPlayerId: number;
  dispatch: React.Dispatch<any>;
  isSpectator?: boolean;
}

export const AuctionModal: React.FC<AuctionModalProps> = ({ gameState, myPlayerId, dispatch, isSpectator = false }) => {
  if (gameState.phase !== 'AUCTION' || !gameState.auction) return null;

  const myPlayer = gameState.players.find(p => p.id === myPlayerId);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#0f172a] shadow-2xl rounded-2xl border border-indigo-500/30 flex flex-col items-center p-6 overflow-hidden w-full max-w-[340px] min-h-[420px] max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="flex flex-col items-center w-full mt-2">
          <div className="flex items-center gap-2 text-indigo-400 font-black tracking-[0.2em] uppercase text-[10px] mb-3">
            <Gavel size={16} className="animate-bounce" /> Public Auction
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tighter text-center mb-1 drop-shadow-lg">
            {gameState.tiles[gameState.auction.tileId].name}
          </h2>
        </div>

        {/* Middle Section (Dynamic centering) */}
        <div className="flex flex-col items-center w-full my-auto py-2">
          <div className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em] mb-1">Current Bid</div>
          <div className="text-4xl font-black text-emerald-400 font-mono tracking-tighter drop-shadow-[0_0_20px_rgba(52,211,153,0.3)]">
            ${gameState.auction.currentBid}
          </div>
          {gameState.auction.highestBidderId !== null ? (
            <div className={`flex items-center gap-2 mt-4 px-3 py-1.5 rounded-xl border transition-all duration-300 ${gameState.auction.highestBidderId === myPlayerId ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800/80 border-white/10'}`}>
              <span className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">Highest</span>
              <div className="flex items-center gap-1.5">
                <Avatar avatarId={gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.avatarId} color={gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.color || ''} className="w-5 h-5" />
                <span className={`text-xs font-black uppercase tracking-tight ${gameState.auction.highestBidderId === myPlayerId ? 'text-emerald-400' : 'text-white'}`}>
                  {gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.name}
                  {gameState.auction.highestBidderId === myPlayerId && ' (YOU)'}
                </span>
              </div>
            </div>
          ) : (
            <div className="h-[36px] mt-4" />
          )}
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col w-full gap-5 mb-1">
          <div className="w-full flex gap-3">
            <button
              onClick={() => dispatch({ type: 'PLACE_BID', payload: { playerId: myPlayerId, amount: (gameState.auction?.currentBid || 0) + GAME_CONSTANTS.MIN_AUCTION_INCREMENT } })}
              disabled={
                isSpectator ||
                gameState.auction.highestBidderId === myPlayerId ||
                (myPlayer?.money ?? 0) < (gameState.auction?.currentBid || 0) + GAME_CONSTANTS.MIN_AUCTION_INCREMENT ||
                (myPlayer?.isBankrupt ?? false)
              }
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-indigo-600/30 active:scale-95 disabled:opacity-30 flex flex-col items-center justify-center group"
            >
              <span className="text-[8px] opacity-60 font-bold uppercase tracking-widest group-hover:opacity-100 transition-opacity">Min Bid</span>
              <span>+${GAME_CONSTANTS.MIN_AUCTION_INCREMENT}</span>
            </button>
            <button
              onClick={() => dispatch({ type: 'PLACE_BID', payload: { playerId: myPlayerId, amount: (gameState.auction?.currentBid || 0) + 20 } })}
              disabled={
                isSpectator ||
                gameState.auction.highestBidderId === myPlayerId ||
                (myPlayer?.money ?? 0) < (gameState.auction?.currentBid || 0) + 20 ||
                (myPlayer?.isBankrupt ?? false)
              }
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-emerald-600/30 active:scale-95 disabled:opacity-30 flex flex-col items-center justify-center group"
            >
              <span className="text-[8px] opacity-60 font-bold uppercase tracking-widest group-hover:opacity-100 transition-opacity">Aggressive</span>
              <span>+$20</span>
            </button>
          </div>

          <div className="w-full flex flex-col items-center gap-1.5 z-10">
            <span className="text-[8px] font-bold uppercase text-slate-500 tracking-[0.2em] self-start">Time Remaining</span>
            <div className="relative flex items-center justify-center w-20 h-20">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="5" />
                <circle
                  cx="40" cy="40" r="34" fill="none"
                  stroke={gameState.auction.timer <= 3 ? '#f43f5e' : '#6366f1'}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - gameState.auction.timer / GAME_CONSTANTS.AUCTION_TIMER_SECONDS)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                />
              </svg>
              <div className="flex flex-col items-center z-10">
                <span className={`font-mono font-black text-2xl leading-none ${gameState.auction.timer <= 3 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                  {gameState.auction.timer}
                </span>
                <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">sec</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
