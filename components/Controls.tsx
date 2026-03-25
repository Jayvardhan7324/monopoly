import React, { useState, useEffect, useMemo } from 'react';
import { GameState, TileType, ColorGroup, Player, Tile } from '../types';
import { Dice } from './Dice';
import {
  Dices, ArrowRight, CheckCircle, MapPin, Trophy, Landmark,
  Handshake, Coins, X, TrendingUp, Gavel, Hammer, Bot,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { playSound } from '../services/audioService';
import { motion, AnimatePresence } from 'motion/react';
import { GAME_CONSTANTS } from '../constants';

interface ControlsProps {
  gameState: GameState;
  myPlayerId: number;
  logs?: string[];
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
  gameState, myPlayerId, logs, onRoll, onBuy, onEndTurn, onUpgrade, onOpenProperty, onTrade, dispatch, onViewPlayer,
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
    if (!currentPlayer || !currentTile || currentTile.ownerId !== currentPlayer.id || currentTile.type !== TileType.PROPERTY) return false;
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

  const myPlayer = gameState.players.find(p => p.id === myPlayerId);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="flex -space-x-40 relative -mt-32">
          <Dice value={gameState.dice[0]} isRolling={isRollingAnim} size={300} index={0} />
          <Dice value={gameState.dice[1]} isRolling={isRollingAnim} size={300} index={1} />
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-4 relative min-h-0 w-full animate-fade-in p-2 z-10">



        {/* Main action */}
        <div className="flex-1 flex flex-col justify-center items-center relative py-2 overflow-hidden">
          {gameState.winnerId !== null ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <Trophy size={60} className="text-amber-400 mb-2 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
              </motion.div>
              <h1 className="text-5xl font-black text-white tracking-tighter uppercase bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">Empire Restored</h1>
              <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
                {gameState.players.find(p => p.id === gameState.winnerId)?.name} is the last one standing
              </p>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="mt-6 px-10 py-4 bg-gradient-to-r from-white to-slate-100 text-slate-900 rounded-xl font-black text-lg hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all uppercase tracking-tight active:scale-95"
              >
                New Empire
              </button>
            </motion.div>
          ) : (
            <>
              {(gameState.phase === 'ROLL' || gameState.phase === 'MOVING' || gameState.phase === 'RESOLVING') && (
                <div className="flex flex-col items-center gap-3 mt-16">
                  {/* Bot thinking indicator — shown during ROLL, MOVING, RESOLVING */}
                  {currentPlayer.isBot && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-700/40 rounded-full text-slate-400 text-xs font-bold uppercase tracking-widest"
                    >
                      <Bot size={13} className="text-indigo-400" />
                      {gameState.phase === 'ROLL' ? `${currentPlayer.name} is thinking…` : `${currentPlayer.name} is moving…`}
                    </motion.div>
                  )}
                  {gameState.phase === 'ROLL' && !currentPlayer.isBot && isHumanTurn && (
                    currentPlayer.inJail ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="flex flex-row flex-wrap justify-center items-center gap-3"
                      >
                        <button
                          onClick={() => dispatch({ type: 'PAY_JAIL_FINE' })}
                          disabled={currentPlayer.money < GAME_CONSTANTS.JAIL_FINE}
                          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-600/20 border border-white/10 active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2"
                        >
                          <Coins size={14} />
                          Bail ${GAME_CONSTANTS.JAIL_FINE}
                        </button>
                        <button
                          onClick={() => dispatch({ type: 'ATTEMPT_JAIL_ROLL' })}
                          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-600/20 border border-white/10 active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2"
                        >
                          <Dices size={14} />
                          Roll Doubles
                        </button>
                        <button
                          onClick={() => dispatch({ type: 'SKIP_JAIL_TURN' })}
                          disabled={currentPlayer.jailTurns >= GAME_CONSTANTS.MAX_JAIL_TURNS - 1}
                          className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-400 rounded-xl font-black text-xs shadow-lg border border-white/5 active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2"
                        >
                          <ArrowRight size={14} />
                          Wait Turn
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onRoll}
                        className="px-10 py-5 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-400 hover:via-indigo-500 hover:to-indigo-600 text-white rounded-xl font-black text-xl shadow-[0_0_30px_rgba(99,102,241,0.4)] border border-white/10 animate-glow-pulse relative overflow-hidden group"
                      >
                        {/* Shimmer overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                        <span className="relative z-10">ROLL DICE</span>
                      </motion.button>
                    )
                  )}
                </div>
              )}

              {(gameState.phase === 'ACTION' || gameState.phase === 'TURN_END') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="flex flex-col items-center gap-3 mt-10 w-full"
                >
                  {/* Top row: Buy + Build */}
                  {(!currentPlayer.isBot && isHumanTurn && (canBuy || canUpgrade)) && (
                    <div className="flex flex-row flex-wrap justify-center items-center gap-3">
                      {gameState.phase === 'ACTION' && canBuy && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={onBuy}
                          className="px-8 py-4 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600 text-white rounded-xl font-black text-lg shadow-[0_0_30px_rgba(16,185,129,0.4)] border border-white/10 relative overflow-hidden group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out" />
                          <span className="relative z-10 flex items-center justify-center">BUY FOR ${currentTile.price}</span>
                        </motion.button>
                      )}
                      {gameState.phase === 'ACTION' && canUpgrade && (
                        <motion.button
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => onUpgrade(currentTile.id)}
                          className="px-8 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl font-black text-md shadow-xl shadow-amber-600/20 uppercase tracking-tight active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Hammer size={16} />
                          {currentTile.buildingCount === 4 ? 'Build Hotel' : 'Build House'} (${currentTile.houseCost})
                        </motion.button>
                      )}
                    </div>
                  )}

                  {/* Bottom row — SKIP shown only when auction won't handle it; END TURN always in TURN_END */}
                  {!currentPlayer.isBot && isHumanTurn && (
                    <div className="flex flex-row justify-center items-center gap-3">
                      {/* Show SKIP in ACTION only if auction is off, tile is already owned, or not purchasable */}
                      {(gameState.phase === 'TURN_END' ||
                        !gameState.settings.rules.auctionEnabled ||
                        currentTile.ownerId !== null ||
                        currentTile.price === 0) && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.05 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={onEndTurn}
                          className={`px-8 py-4 text-white rounded-xl font-black text-lg border border-white/10 relative overflow-hidden group transition-all tracking-tighter uppercase ${
                            gameState.phase === 'TURN_END'
                              ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-400 hover:via-indigo-500 hover:to-indigo-600 shadow-[0_0_30px_rgba(99,102,241,0.4)]'
                              : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:via-slate-700 hover:to-slate-800 shadow-lg'
                          }`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out" />
                          <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
                            {gameState.phase === 'TURN_END' ? <CheckCircle size={18} /> : <ArrowRight size={18} />}
                            {gameState.phase === 'TURN_END' ? 'END TURN' : 'SKIP'}
                          </span>
                        </motion.button>
                      )}

                      {/* Auction button — replaces SKIP when auction is on and tile is buyable */}
                      {gameState.phase === 'ACTION' && gameState.settings.rules.auctionEnabled && currentTile.ownerId === null && currentTile.price > 0 && (
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => dispatch({ type: 'START_AUCTION' })}
                          className="px-8 py-4 bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 hover:from-rose-400 hover:via-rose-500 hover:to-rose-600 text-white rounded-xl font-black text-lg shadow-[0_0_30px_rgba(244,63,94,0.3)] border border-white/10 relative overflow-hidden group transition-all tracking-tighter uppercase"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out" />
                          <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
                            <Gavel size={18} />
                            PUT TO AUCTION
                          </span>
                        </motion.button>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
          {/* Activity Feed — hidden when action buttons are showing or during human roll */}
          {logs && logs.length > 0 && gameState.phase !== 'ACTION' && gameState.phase !== 'TURN_END' && !(gameState.phase === 'ROLL' && !currentPlayer.isBot) && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[85%] max-w-[400px] z-50 pointer-events-none space-y-1">
              <AnimatePresence mode="popLayout">
                {logs.slice(0, 3).map((log, i) => (
                  <motion.div
                    key={`${i}-${log}`}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1 - i * 0.25, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className={`text-[9.5px] font-bold text-center px-4 py-0.5 rounded-full backdrop-blur-md shadow-lg border tracking-tight
                    ${i === 0
                        ? 'text-indigo-100 bg-indigo-950/90 border-indigo-500/40'
                        : 'text-slate-400 bg-slate-950/80 border-slate-700/40'}`}
                  >
                    {log}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};