import React, { useState, useEffect, useMemo } from 'react';
import { GameState, TileType, ColorGroup, Player, Tile } from '../types';
import { Dice } from './Dice';
import {
  Dices, ArrowRight, CheckCircle, MapPin, Trophy, Landmark,
  Handshake, Coins, X, TrendingUp, Gavel, Hammer, Lock,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { playSound } from '../services/audioService';
import { motion, AnimatePresence } from 'motion/react';
import { GAME_CONSTANTS } from '../constants';

interface ControlsProps {
  gameState: GameState;
  myPlayerId: number;
  onRoll: () => void;
  onBuy: () => void;
  onEndTurn: () => void;
  onUpgrade: (tileId: number) => void;
  onOpenProperty: (tileId: number) => void;
  onTrade: (offer: { cash: number; properties: number[]; requestCash: number }, targetTileId: number) => void;
  dispatch: React.Dispatch<any>;
  onViewPlayer: (playerId: number) => void;
}

const colorMap: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]: 'bg-amber-900',
  [ColorGroup.LIGHT_BLUE]: 'bg-sky-400',
  [ColorGroup.PINK]: 'bg-pink-500',
  [ColorGroup.ORANGE]: 'bg-orange-500',
  [ColorGroup.RED]: 'bg-red-600',
  [ColorGroup.YELLOW]: 'bg-yellow-400',
  [ColorGroup.GREEN]: 'bg-emerald-600',
  [ColorGroup.DARK_BLUE]: 'bg-blue-700',
  [ColorGroup.NONE]: 'bg-slate-700',
};

export const Controls: React.FC<ControlsProps> = ({
  gameState, myPlayerId, onRoll, onBuy, onEndTurn, onUpgrade, onOpenProperty, onTrade, dispatch, onViewPlayer,
}) => {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentTile = gameState.tiles[currentPlayer?.position || 0];
  const isHumanTurn = currentPlayer?.id === myPlayerId;

  // Dice rolling animation state
  const [isRollingAnim, setIsRollingAnim] = useState(false);
  useEffect(() => {
    if (gameState.phase === 'MOVING') {
      setIsRollingAnim(true);
      const timer = setTimeout(() => setIsRollingAnim(false), 500);
      return () => clearTimeout(timer);
    } else {
      setIsRollingAnim(false);
    }
  }, [gameState.phase]);

  const canUpgrade = useMemo(() => {
    if (!currentTile || currentTile.ownerId !== currentPlayer?.id || currentTile.type !== TileType.PROPERTY) return false;
    if (currentPlayer.money < currentTile.houseCost) return false;
    if (currentTile.buildingCount >= 5) return false;
    const groupTiles = gameState.tiles.filter(t => t.group === currentTile.group);
    const hasMonopoly = groupTiles.every(t => t.ownerId === currentPlayer.id);
    if (!hasMonopoly) return false;
    if (gameState.settings.rules.evenBuild) {
      const minBuildings = Math.min(...groupTiles.map(t => t.buildingCount));
      if (currentTile.buildingCount > minBuildings) return false;
    }
    return true;
  }, [currentTile, currentPlayer, gameState.tiles, gameState.settings.rules.evenBuild]);

  if (!currentPlayer) return null;

  const canBuy = currentTile.price > 0 && currentPlayer.money >= currentTile.price && currentTile.ownerId === null;

  return (
    <div className="w-full h-full flex flex-col gap-4 text-slate-100 p-2 animate-fade-in relative">

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 relative min-h-0">

        {/* Auction overlay */}
        {gameState.phase === 'AUCTION' && gameState.auction && (
          <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-md rounded-2xl border border-indigo-500/30 shadow-[0_0_100px_rgba(79,70,229,0.4)] animate-fade-in flex flex-col items-center justify-center p-4 overflow-hidden">
            <div className="flex items-center gap-2 text-indigo-400 font-black tracking-[0.2em] uppercase text-[10px] mb-4">
              <Gavel size={16} className="animate-bounce" /> Public Auction
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter text-center mb-4 drop-shadow-lg">
              {gameState.tiles[gameState.auction.tileId].name}
            </h2>

            <div className="flex flex-col items-center gap-2 mb-6">
              <div className="text-slate-500 text-[9px] font-bold uppercase tracking-[0.3em]">Current Bid</div>
              <div className="text-5xl font-black text-emerald-400 font-mono tracking-tighter drop-shadow-[0_0_40px_rgba(52,211,153,0.3)]">
                ${gameState.auction.currentBid}
              </div>
              {gameState.auction.highestBidderId !== null && (
                <div className={`flex items-center gap-3 mt-4 px-4 py-2 rounded-2xl border transition-all duration-300 ${gameState.auction.highestBidderId === 0 ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800/80 border-white/10'}`}>
                  <span className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">Highest Bidder</span>
                  <div className="flex items-center gap-2">
                    <Avatar
                      color={gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.color || ''}
                      className="w-5 h-5"
                    />
                    <span className={`text-sm font-black uppercase tracking-tight ${gameState.auction.highestBidderId === 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.name}
                      {gameState.auction.highestBidderId === 0 && ' (YOU)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full max-w-sm flex gap-4 mb-6">
              <button
                onClick={() => dispatch({ type: 'PLACE_BID', payload: { playerId: 0, amount: (gameState.auction?.currentBid || 0) + GAME_CONSTANTS.MIN_AUCTION_INCREMENT } })}
                disabled={gameState.players[0].money < (gameState.auction?.currentBid || 0) + GAME_CONSTANTS.MIN_AUCTION_INCREMENT || gameState.players[0].isBankrupt}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-indigo-600/30 active:scale-95 disabled:opacity-30 flex flex-col items-center justify-center gap-1 group"
              >
                <span className="text-[10px] opacity-60 font-bold uppercase tracking-widest group-hover:opacity-100 transition-opacity">Min Bid</span>
                <span>+${GAME_CONSTANTS.MIN_AUCTION_INCREMENT}</span>
              </button>
              <button
                onClick={() => dispatch({ type: 'PLACE_BID', payload: { playerId: 0, amount: (gameState.auction?.currentBid || 0) + 20 } })}
                disabled={gameState.players[0].money < (gameState.auction?.currentBid || 0) + 20 || gameState.players[0].isBankrupt}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-emerald-600/30 active:scale-95 disabled:opacity-30 flex flex-col items-center justify-center gap-1 group"
              >
                <span className="text-[10px] opacity-60 font-bold uppercase tracking-widest group-hover:opacity-100 transition-opacity">Aggressive</span>
                <span>+$20</span>
              </button>
            </div>

            <div className="w-full max-w-sm flex flex-col gap-2 z-10">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-bold uppercase text-slate-500 tracking-[0.2em]">Time Remaining</span>
                <span className={`font-mono font-black text-2xl ${gameState.auction.timer <= 3 ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`}>
                  {gameState.auction.timer}s
                </span>
              </div>
              <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden border border-white/5">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${gameState.auction.timer <= 3 ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'}`}
                  style={{ width: `${(gameState.auction.timer / GAME_CONSTANTS.AUCTION_TIMER_SECONDS) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Main action */}
        <div className="flex-1 flex flex-col justify-center items-center relative py-2 overflow-hidden">
          {gameState.winnerId !== null ? (
            <div className="flex flex-col items-center gap-4 animate-slide-up text-center">
              <Trophy size={60} className="text-amber-400 animate-bounce mb-2" />
              <h1 className="text-5xl font-black text-white tracking-tighter uppercase">Empire Restored</h1>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
                {gameState.players.find(p => p.id === gameState.winnerId)?.name} is the last one standing
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 px-10 py-4 bg-white text-black rounded-xl font-black text-lg hover:bg-slate-200 transition-all uppercase tracking-tight"
              >
                New Empire
              </button>
            </div>
          ) : (
            <>
              {(gameState.phase === 'ROLL' || gameState.phase === 'MOVING' || gameState.phase === 'RESOLVING') && (
                <div className="flex flex-col items-center gap-12">
                  <div className="flex gap-16">
                    <Dice value={gameState.dice[0]} isRolling={isRollingAnim} size={100} />
                    <Dice value={gameState.dice[1]} isRolling={isRollingAnim} size={100} />
                  </div>

                  {gameState.phase === 'ROLL' && !currentPlayer.isBot && (
                    currentPlayer.inJail ? (
                      <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-950/80 p-6 rounded-3xl border border-rose-500/30 shadow-[0_0_50px_rgba(244,63,94,0.1)] relative overflow-hidden">
                        {/* Jail Bars Background */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 15px, #fff 15px, #fff 18px)' }} />
                        
                        <div className="flex flex-col items-center gap-1 relative z-10">
                          <div className="w-12 h-12 bg-rose-500/20 rounded-full flex items-center justify-center text-rose-500 mb-2 border border-rose-500/30">
                            <Lock size={24} />
                          </div>
                          <h3 className="text-xl font-black text-white uppercase tracking-tighter">Detained</h3>
                          <div className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-400 text-[9px] font-black uppercase tracking-[0.2em]">
                            Turn {currentPlayer.jailTurns + 1} of {GAME_CONSTANTS.MAX_JAIL_TURNS}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-4 relative z-10">
                          <button
                            onClick={() => dispatch({ type: 'PAY_JAIL_FINE' })}
                            disabled={currentPlayer.money < GAME_CONSTANTS.JAIL_FINE}
                            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-xl font-black text-[10px] shadow-lg shadow-emerald-600/20 border border-white/10 active:scale-95 transition-all uppercase tracking-widest flex flex-col items-center gap-1"
                          >
                            <Coins size={14} />
                            <span>Bail ${GAME_CONSTANTS.JAIL_FINE}</span>
                          </button>
                          <button
                            onClick={() => dispatch({ type: 'ATTEMPT_JAIL_ROLL' })}
                            className="px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-[10px] shadow-lg shadow-indigo-600/20 border border-white/10 active:scale-95 transition-all uppercase tracking-widest flex flex-col items-center gap-1"
                          >
                            <Dices size={14} />
                            <span>Roll Doubles</span>
                          </button>
                          <button
                            onClick={() => dispatch({ type: 'SKIP_JAIL_TURN' })}
                            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl font-black text-[10px] shadow-lg border border-white/5 active:scale-95 transition-all uppercase tracking-widest flex flex-col items-center gap-1"
                          >
                            <ArrowRight size={14} />
                            <span>Wait Turn</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={onRoll}
                        className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-2xl shadow-2xl shadow-indigo-600/30 border border-white/10 active:scale-95 transition-all"
                      >
                        ROLL DICE
                      </button>
                    )
                  )}
                </div>
              )}

              {(gameState.phase === 'ACTION' || gameState.phase === 'TURN_END') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex flex-col items-center gap-6 w-full max-w-md"
                >
                  <div className="w-full bg-black/90 rounded-2xl p-8 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center">
                    <p className="text-white text-xl md:text-2xl font-medium italic leading-relaxed tracking-tight">
                      "{gameState.logs[0]}"
                    </p>

                    {gameState.phase === 'ACTION' && !currentPlayer.isBot && canBuy && (
                      <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em]">Market Opportunity</div>
                        <button
                          onClick={onBuy}
                          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-lg shadow-xl shadow-emerald-600/20 uppercase tracking-tight active:scale-95"
                        >
                          BUY PROPERTY for ${currentTile.price}
                        </button>
                      </div>
                    )}

                    {!currentPlayer.isBot && canUpgrade && (
                      <div className="mt-8 flex flex-col items-center gap-4 border-t border-white/10 pt-6">
                        <div className="text-[11px] font-black text-amber-500 uppercase tracking-[0.3em]">Property Improvement</div>
                        <button
                          onClick={() => onUpgrade(currentTile.id)}
                          className="w-full py-4 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-lg shadow-xl shadow-amber-600/20 uppercase tracking-tight active:scale-95 flex items-center justify-center gap-3"
                        >
                          <Hammer size={20} />
                          {currentTile.buildingCount === 4 ? 'Build Hotel' : 'Build House'} (${currentTile.houseCost})
                        </button>
                      </div>
                    )}

                    {gameState.phase === 'TURN_END' && currentPlayer.isBot && gameState.turnLogs.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-6 border-t border-white/10 pt-6 overflow-hidden"
                      >
                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Turn Summary</div>
                        <div className="space-y-2 text-left max-h-40 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                          {gameState.turnLogs.map((log, idx) => (
                            <motion.div
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              key={idx}
                              className="text-xs text-slate-300 flex items-start gap-2"
                            >
                              <div className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                              <span className="leading-relaxed">{log}</span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {!currentPlayer.isBot && (
                      <button
                        onClick={() => {
                          if (gameState.phase === 'ACTION' && gameState.settings.rules.auctionEnabled && currentTile.ownerId === null) {
                            dispatch({ type: 'START_AUCTION' });
                          } else {
                            onEndTurn();
                          }
                        }}
                        className="w-full mt-8 py-4 bg-slate-100 text-slate-950 rounded-xl font-black text-lg flex items-center justify-center gap-3 hover:bg-white transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 uppercase tracking-tighter"
                      >
                        {gameState.phase === 'ACTION'
                          ? gameState.settings.rules.auctionEnabled
                            ? 'PUT TO AUCTION'
                            : 'SKIP TRANSACTION'
                          : 'FINISH TURN'}
                        <ArrowRight size={20} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};