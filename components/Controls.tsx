import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { GameState, TileType, ColorGroup, Player, Tile } from '../types';
import { Dice } from './Dice';
import {
  Dices, ArrowRight, CheckCircle, MapPin, Trophy, Landmark,
  Handshake, Coins, X, TrendingUp, Gavel, Hammer, Bot, AlertTriangle,
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
  onTrade: (offer: { cash: number; properties: number[]; requestCash: number }, targetTileId: number | null, targetPlayerId: number) => void;
  dispatch: React.Dispatch<any>;
  onViewPlayer: (playerId: number) => void;
  onReset?: () => void;
  netWorthHistory?: Array<{ turn: number; values: Record<number, number> }>;
}

const colorMap: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]: 'bg-amber-900',
  [ColorGroup.LIGHT_BLUE]: 'bg-sky-400',
  [ColorGroup.PINK]: 'bg-pink-500',
  [ColorGroup.ORANGE]: 'bg-orange-500',
  [ColorGroup.RED]: 'bg-red-600',
  [ColorGroup.YELLOW]: 'bg-yellow-600',
  [ColorGroup.GREEN]: 'bg-emerald-600',
  [ColorGroup.DARK_BLUE]: 'bg-blue-700',
  [ColorGroup.NONE]: 'bg-slate-700',
};

export const Controls: React.FC<ControlsProps> = ({
  gameState, myPlayerId, logs, onRoll, onBuy, onEndTurn, onUpgrade, onOpenProperty, onTrade, dispatch, onViewPlayer, onReset, netWorthHistory,
}) => {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentTile = gameState.tiles[currentPlayer?.position || 0];
  const isHumanTurn = currentPlayer?.id === myPlayerId;

  const showConfetti = localStorage.getItem('pref_confetti') !== 'false';
  const showGoldFrame = localStorage.getItem('pref_goldFrame') !== 'false';
  const [confettiPieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 1.2,
      dur: 1.8 + Math.random() * 1.4,
      color: ['#f59e0b','#6366f1','#ec4899','#10b981','#f97316','#a855f7','#3b82f6'][i % 7],
      size: 6 + Math.random() * 6,
    }))
  );

  // Dice rolling animation — trigger whenever dice values change (covers
  // regular rolls, jail roll success, and failed jail rolls that skip MOVING).
  const [isRollingAnim, setIsRollingAnim] = useState(false);
  const prevDiceRef = useRef<[number, number]>([gameState.dice[0], gameState.dice[1]]);
  useEffect(() => {
    const [pd0, pd1] = prevDiceRef.current;
    const [d0, d1] = gameState.dice;
    if (d0 !== pd0 || d1 !== pd1) {
      prevDiceRef.current = [d0, d1];
      setIsRollingAnim(true);
      const timer = setTimeout(() => setIsRollingAnim(false), 500);
      return () => clearTimeout(timer);
    }
  }, [gameState.dice[0], gameState.dice[1]]);

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

  const canBuy = !!currentTile && currentTile.price > 0 && currentPlayer.money >= currentTile.price && currentTile.ownerId === null;

  const myPlayer = gameState.players.find(p => p.id === myPlayerId);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="flex -space-x-40 relative -mt-52">
          <Dice value={gameState.dice[0]} isRolling={isRollingAnim} size={300} index={0} />
          <Dice value={gameState.dice[1]} isRolling={isRollingAnim} size={300} index={1} />
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-4 relative min-h-0 w-full animate-fade-in p-2 z-10">



        {/* Main action */}
        <div className="flex-1 flex flex-col items-center relative overflow-hidden justify-center translate-y-[8%]">
          {gameState.winnerId !== null ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
              className="flex flex-col items-center gap-4 text-center relative"
            >
              {showConfetti && confettiPieces.map(p => (
                <motion.div
                  key={p.id}
                  initial={{ y: -20, x: `${p.x}%`, opacity: 1, rotate: 0 }}
                  animate={{ y: 220, opacity: 0, rotate: 360 * (p.id % 2 === 0 ? 1 : -1) }}
                  transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'easeIn' }}
                  style={{ position: 'absolute', top: 0, left: 0, width: p.size, height: p.size, borderRadius: 2, background: p.color, pointerEvents: 'none' }}
                />
              ))}
              <motion.div
                animate={{ y: [0, -10, 0], rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <Trophy size={52} className="text-amber-400 mb-2 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
              </motion.div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase bg-gradient-to-r from-amber-200 via-white to-amber-200 bg-clip-text text-transparent">Empire Restored</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                {gameState.players.find(p => p.id === gameState.winnerId)?.name} is the last one standing
              </p>
              {/* Leaderboard */}
              <div className="flex flex-col gap-1.5 w-full max-w-[260px] mt-1">
                {[...gameState.players]
                  .sort((a, b) => {
                    const netA = a.money + gameState.tiles.filter(t => t.ownerId === a.id).reduce((s, t) => s + t.price, 0);
                    const netB = b.money + gameState.tiles.filter(t => t.ownerId === b.id).reduce((s, t) => s + t.price, 0);
                    return netB - netA;
                  })
                  .map((p, idx) => {
                    const netWorth = p.money + gameState.tiles.filter(t => t.ownerId === p.id).reduce((s, t) => s + t.price, 0);
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.07, type: 'spring', stiffness: 300, damping: 25 }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${idx === 0 ? (showGoldFrame ? 'bg-amber-500/15 border-2 border-amber-400/60 shadow-[0_0_12px_rgba(251,191,36,0.35)]' : 'bg-amber-500/10 border border-amber-500/25') : 'bg-slate-800/50 border border-white/5'}`}
                      >
                        <span className={`text-xs font-black w-5 ${idx === 0 ? 'text-amber-400' : 'text-slate-500'}`}>#{idx + 1}</span>
                        <Avatar avatarId={p.avatarId} color={p.color} isBankrupt={p.isBankrupt} className="w-5 h-5 shrink-0" />
                        <span className="text-xs font-black text-white flex-1 truncate uppercase tracking-tight">{p.name}</span>
                        <span className={`text-xs font-mono font-bold ${p.isBankrupt ? 'text-rose-500/60 line-through' : 'text-emerald-400'}`}>${netWorth.toLocaleString()}</span>
                      </motion.div>
                    );
                  })
                }
              </div>
              {/* Net Worth History Chart */}
              {netWorthHistory && netWorthHistory.length > 2 && (() => {
                const W = 260, H = 100, PAD = 24;
                const turns = netWorthHistory.map(h => h.turn);
                const minTurn = turns[0], maxTurn = turns[turns.length - 1];
                const allVals = netWorthHistory.flatMap(h => Object.values(h.values));
                const maxVal = Math.max(...allVals, 1);
                const activePlayers = gameState.players.filter(p => netWorthHistory[0]?.values[p.id] !== undefined);
                const toX = (t: number) => PAD + ((t - minTurn) / Math.max(maxTurn - minTurn, 1)) * (W - PAD * 2);
                const toY = (v: number) => H - PAD / 2 - (v / maxVal) * (H - PAD);
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="w-full max-w-[280px] mt-3 bg-slate-900/60 border border-slate-700/40 rounded-xl p-3"
                  >
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1">
                      <TrendingUp size={10} className="text-indigo-400" /> Net Worth Over Time
                    </p>
                    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
                      {/* Grid lines */}
                      {[0, 0.5, 1].map(frac => (
                        <line key={frac} x1={PAD} x2={W - PAD} y1={toY(maxVal * frac)} y2={toY(maxVal * frac)}
                          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                      ))}
                      {/* Player lines */}
                      {activePlayers.map(p => {
                        const pts = netWorthHistory
                          .filter(h => h.values[p.id] !== undefined)
                          .map(h => `${toX(h.turn)},${toY(h.values[p.id])}`).join(' ');
                        return (
                          <polyline key={p.id} points={pts} fill="none"
                            stroke={p.color} strokeWidth={p.isBankrupt ? 1 : 1.5}
                            strokeOpacity={p.isBankrupt ? 0.35 : 0.9}
                            strokeLinecap="round" strokeLinejoin="round" />
                        );
                      })}
                      {/* Axis labels */}
                      <text x={PAD} y={H} fontSize={7} fill="rgba(148,163,184,0.6)" textAnchor="middle">{minTurn}</text>
                      <text x={W - PAD} y={H} fontSize={7} fill="rgba(148,163,184,0.6)" textAnchor="middle">{maxTurn}</text>
                      <text x={PAD - 4} y={toY(maxVal) + 3} fontSize={7} fill="rgba(148,163,184,0.6)" textAnchor="end">${(maxVal / 1000).toFixed(1)}k</text>
                    </svg>
                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                      {activePlayers.map(p => (
                        <span key={p.id} className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
                          <span className="inline-block w-3 h-[2px] rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                );
              })()}

              <button
                onClick={() => onReset ? onReset() : dispatch({ type: 'RESET_GAME' })}
                aria-label="Start a new game"
                className="mt-4 px-10 py-3 bg-gradient-to-r from-white to-slate-100 text-slate-900 rounded-xl font-black text-base hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all uppercase tracking-tight active:scale-95"
              >
                New Empire
              </button>
            </motion.div>
          ) : (
            <>
              {(gameState.phase === 'ROLL' || gameState.phase === 'MOVING' || gameState.phase === 'RESOLVING') && (
                <div className="flex flex-col items-center gap-3 mt-6">
                  {/* Vacation skip banner */}
                  <AnimatePresence>
                    {currentPlayer.onVacation && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-900/40 border border-emerald-500/30 rounded-full text-emerald-300 text-xs font-bold uppercase tracking-widest"
                      >
                        <span>🌴</span>
                        {currentPlayer.name} is on Vacation — turn skipped!
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                        {(currentPlayer.jailFreeCards ?? 0) > 0 && (
                          <button
                            onClick={() => dispatch({ type: 'USE_JAIL_CARD' })}
                            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black text-xs shadow-lg shadow-amber-600/20 border border-white/10 active:scale-95 transition-all uppercase tracking-widest flex items-center gap-2"
                            aria-label={`Use Get Out of Jail Free card (${currentPlayer.jailFreeCards} held)`}
                          >
                            🎟️ Use Card ({currentPlayer.jailFreeCards})
                          </button>
                        )}
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
                        className="px-7 py-3 bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-400 hover:via-indigo-500 hover:to-indigo-600 text-white rounded-xl font-black text-base shadow-[0_0_30px_rgba(99,102,241,0.4)] border border-white/10 animate-glow-pulse relative overflow-hidden group"
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
                  className="flex flex-col items-center gap-2.5 mt-6 w-full"
                >
                  {/* Top row: Buy + Build */}
                  {(!currentPlayer.isBot && isHumanTurn && (canBuy || canUpgrade)) && (
                    <div className="flex flex-row flex-wrap justify-center items-center gap-3">
                      {gameState.phase === 'ACTION' && canBuy && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={onBuy}
                          aria-label={`Buy ${currentTile.name} for $${currentTile.price}`}
                          className="px-5 py-3 bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 hover:from-emerald-400 hover:via-emerald-500 hover:to-emerald-600 text-white rounded-xl font-black text-sm shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-white/10 relative overflow-hidden group"
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
                          aria-label={`Build ${currentTile.buildingCount === 4 ? 'hotel' : 'house'} for $${currentTile.houseCost}`}
                          className="px-4 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl font-black text-xs shadow-xl shadow-amber-600/20 uppercase tracking-tight active:scale-95 flex items-center justify-center gap-2"
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
                          whileHover={currentPlayer.money < 0 ? undefined : { scale: 1.05 }}
                          whileTap={currentPlayer.money < 0 ? undefined : { scale: 0.95 }}
                          onClick={currentPlayer.money < 0 ? undefined : onEndTurn}
                          disabled={currentPlayer.money < 0}
                          aria-label={currentPlayer.money < 0 ? 'Settle debt first' : gameState.phase === 'TURN_END' ? 'End turn' : 'Skip action'}
                          title={currentPlayer.money < 0 ? 'Mortgage, sell houses, trade, or declare bankruptcy to continue.' : undefined}
                          className={`px-5 py-3 text-white rounded-xl font-black text-sm border border-white/10 relative overflow-hidden group transition-all tracking-tighter uppercase ${
                            currentPlayer.money < 0
                              ? 'bg-gradient-to-br from-rose-900/60 via-rose-950/70 to-slate-900 opacity-60 cursor-not-allowed'
                              : gameState.phase === 'TURN_END'
                              ? 'bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-700 hover:from-indigo-400 hover:via-indigo-500 hover:to-indigo-600 shadow-[0_0_30px_rgba(99,102,241,0.4)]'
                              : 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:via-slate-700 hover:to-slate-800 shadow-lg'
                          }`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out" />
                          <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
                            {currentPlayer.money < 0 ? <AlertTriangle size={18} /> : gameState.phase === 'TURN_END' ? <CheckCircle size={18} /> : <ArrowRight size={18} />}
                            {currentPlayer.money < 0 ? 'IN DEBT' : gameState.phase === 'TURN_END' ? 'END TURN' : 'SKIP'}
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
                          aria-label="Put property to auction"
                          className="px-5 py-3 bg-gradient-to-br from-rose-500 via-rose-600 to-rose-700 hover:from-rose-400 hover:via-rose-500 hover:to-rose-600 text-white rounded-xl font-black text-sm shadow-[0_0_20px_rgba(244,63,94,0.2)] border border-white/10 relative overflow-hidden group transition-all tracking-tighter uppercase"
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