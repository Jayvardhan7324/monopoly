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
  gameState, onRoll, onBuy, onEndTurn, onUpgrade, onOpenProperty, onTrade, dispatch, onViewPlayer,
}) => {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const currentTile = gameState.tiles[currentPlayer?.position || 0];
  const isHumanTurn = currentPlayer?.id === 0;

  // Trading state
  const [isTradeMode, setIsTradeMode] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [offeredCash, setOfferedCash] = useState(0);
  const [requestedCash, setRequestedCash] = useState(0);
  const [selectedOfferPropertyIds, setSelectedOfferPropertyIds] = useState<number[]>([]);
  const [targetTileId, setTargetTileId] = useState<number | null>(null);

  // BUG-03: Filter out mortgaged properties from tradeable assets
  const myProperties = useMemo(
    () => gameState.tiles.filter(t => t.ownerId === 0 && t.buildingCount === 0 && !t.isMortgaged),
    [gameState.tiles]
  );

  const targetPlayerProperties = useMemo(
    () =>
      targetPlayerId !== null
        ? gameState.tiles.filter(t => t.ownerId === targetPlayerId && t.buildingCount === 0 && !t.isMortgaged)
        : [],
    [gameState.tiles, targetPlayerId]
  );

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

  const handleToggleTrade = () => {
    playSound(isTradeMode ? 'modal_close' : 'modal_open');
    setIsTradeMode(!isTradeMode);
    if (!isTradeMode) {
      const firstOpponent = gameState.players.find(p => p.id !== 0 && !p.isBankrupt);
      if (firstOpponent) setTargetPlayerId(firstOpponent.id);
    }
  };

  const toggleOfferProperty = (id: number) => {
    playSound('ui_click');
    setSelectedOfferPropertyIds(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const submitTrade = () => {
    if (targetTileId !== null) {
      playSound('trade_offer');
      onTrade({ cash: offeredCash, properties: selectedOfferPropertyIds, requestCash: requestedCash }, targetTileId);
      setIsTradeMode(false);
      resetTrade();
    }
  };

  const resetTrade = () => {
    setOfferedCash(0);
    setRequestedCash(0);
    setSelectedOfferPropertyIds([]);
    setTargetTileId(null);
  };

  if (!currentPlayer) return null;

  const canBuy = currentTile.price > 0 && currentPlayer.money >= currentTile.price && currentTile.ownerId === null;

  return (
    <div className="w-full h-full flex flex-col gap-4 text-slate-100 p-2 animate-fade-in relative">

      {/* Header HUD */}
      {gameState.phase !== 'AUCTION' && (
        <div className="grid grid-cols-[1fr_auto] gap-2 md:gap-3">
          <div className="bg-slate-900/40 backdrop-blur-xl p-2 md:p-3 rounded-xl flex items-center justify-between relative overflow-hidden border border-white/10 shadow-2xl">
            <div className="absolute top-0 left-0 w-full h-1 opacity-80" style={{ backgroundColor: currentPlayer.color }} />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <div className="flex items-center gap-2 md:gap-4 min-w-0 mr-2 flex-1">
              <div className="w-8 h-8 md:w-12 md:h-12 shrink-0 rounded-xl border-2 border-white/10 bg-slate-950 flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] relative">
                <Avatar
                  avatarId={currentPlayer.avatar}
                  color={currentPlayer.color}
                  isBankrupt={currentPlayer.isBankrupt}
                  inJail={currentPlayer.inJail}
                  className="w-5 h-5 md:w-8 md:h-8"
                />
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 md:w-4 md:h-4 bg-slate-900 rounded-lg border border-white/20 flex items-center justify-center text-[7px] md:text-[9px] font-black text-white shadow-lg">
                  {gameState.currentPlayerIndex + 1}
                </div>
              </div>
              <div className="flex flex-col min-w-0 pr-2">
                <h2 className="font-black text-base md:text-xl tracking-tighter text-white uppercase italic truncate">{currentPlayer.name}</h2>
                <div className="flex items-center gap-1.5 text-[7px] md:text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] truncate">
                  <MapPin size={8} className="text-indigo-400 shrink-0" /> <span className="truncate">{currentTile.name}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleTrade}
              disabled={gameState.players.find(p => p.id === 0)?.isBankrupt}
              className={`relative shrink-0 group overflow-hidden px-2 py-1.5 md:px-4 md:py-2 rounded-lg border transition-all flex items-center gap-1.5 md:gap-2 font-black text-[8px] md:text-[10px] uppercase tracking-widest disabled:opacity-30 disabled:pointer-events-none shadow-xl
                ${isTradeMode ? 'bg-rose-600 border-rose-500 text-white' : 'bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500 hover:scale-105 active:scale-95'}`}
            >
              {isTradeMode ? <X size={12} className="md:w-[16px] md:h-[16px]" /> : <Handshake size={12} className="md:w-[16px] md:h-[16px]" />}
              <span className="hidden sm:inline">{isTradeMode ? 'Cancel Trade' : 'Propose Trade'}</span>
              <span className="sm:hidden">{isTradeMode ? 'Cancel' : 'Trade'}</span>
              {!isTradeMode && (
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              )}
            </button>
          </div>

          <div className="bg-slate-950/80 backdrop-blur-md p-2 md:p-3 rounded-xl flex flex-col items-end justify-center min-w-[100px] md:min-w-[150px] border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-3xl rounded-full -mr-12 -mt-12" />
            <div className="text-slate-500 text-[7px] md:text-[9px] font-black uppercase tracking-[0.3em] mb-0.5">Net Balance</div>
            <div className="flex items-center gap-1 text-emerald-400 font-mono text-xl md:text-3xl font-black tracking-tighter drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
              <span className="text-base md:text-lg opacity-60">$</span>{currentPlayer.money}
            </div>
            {gameState.settings.rules.vacationCash && (
              <div className="flex items-center gap-1 text-[7px] md:text-[8px] font-black uppercase text-amber-500 mt-0.5 md:mt-1 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                <Landmark size={8} /> POOL: ${gameState.taxPool}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col gap-4 relative min-h-0">

        {/* Auction overlay */}
        {gameState.phase === 'AUCTION' && gameState.auction && (
          <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-md rounded-2xl border border-indigo-500/30 shadow-[0_0_100px_rgba(79,70,229,0.4)] animate-fade-in flex flex-col items-center justify-center p-8 overflow-hidden">
            <div className="flex items-center gap-2 text-indigo-400 font-black tracking-[0.2em] uppercase text-xs mb-6">
              <Gavel size={20} className="animate-bounce" /> Public Auction
            </div>
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter text-center mb-8 drop-shadow-lg">
              {gameState.tiles[gameState.auction.tileId].name}
            </h2>

            <div className="flex flex-col items-center gap-4 mb-12">
              <div className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.3em]">Current Bid</div>
              <div className="text-8xl font-black text-emerald-400 font-mono tracking-tighter drop-shadow-[0_0_40px_rgba(52,211,153,0.3)]">
                ${gameState.auction.currentBid}
              </div>
              {gameState.auction.highestBidderId !== null && (
                <div className={`flex items-center gap-3 mt-6 px-6 py-3 rounded-2xl border transition-all duration-300 ${gameState.auction.highestBidderId === 0 ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800/80 border-white/10'}`}>
                  <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Highest Bidder</span>
                  <div className="flex items-center gap-3">
                    <Avatar
                      avatarId={gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.avatar || ''}
                      color={gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.color || ''}
                      className="w-6 h-6"
                    />
                    <span className={`text-lg font-black uppercase tracking-tight ${gameState.auction.highestBidderId === 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {gameState.players.find(p => p.id === gameState.auction?.highestBidderId)?.name}
                      {gameState.auction.highestBidderId === 0 && ' (YOU)'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="w-full max-w-md flex gap-6 mb-12">
              <button
                onClick={() => dispatch({ type: 'PLACE_BID', payload: { playerId: 0, amount: (gameState.auction?.currentBid || 0) + GAME_CONSTANTS.MIN_AUCTION_INCREMENT } })}
                disabled={gameState.players[0].money < (gameState.auction?.currentBid || 0) + GAME_CONSTANTS.MIN_AUCTION_INCREMENT || gameState.players[0].isBankrupt}
                className="flex-1 py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-xl transition-all shadow-2xl shadow-indigo-600/30 active:scale-95 disabled:opacity-30 flex flex-col items-center justify-center gap-1 group"
              >
                <span className="text-xs opacity-60 font-bold uppercase tracking-widest group-hover:opacity-100 transition-opacity">Min Bid</span>
                <span>+${GAME_CONSTANTS.MIN_AUCTION_INCREMENT}</span>
              </button>
              <button
                onClick={() => dispatch({ type: 'PLACE_BID', payload: { playerId: 0, amount: (gameState.auction?.currentBid || 0) + 100 } })}
                disabled={gameState.players[0].money < (gameState.auction?.currentBid || 0) + 100 || gameState.players[0].isBankrupt}
                className="flex-1 py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black text-xl transition-all shadow-2xl shadow-emerald-600/30 active:scale-95 disabled:opacity-30 flex flex-col items-center justify-center gap-1 group"
              >
                <span className="text-xs opacity-60 font-bold uppercase tracking-widest group-hover:opacity-100 transition-opacity">Aggressive</span>
                <span>+$100</span>
              </button>
            </div>

            <div className="w-full max-w-md flex flex-col gap-3 z-10">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em]">Time Remaining</span>
                <span className={`font-mono font-black text-3xl ${gameState.auction.timer <= 3 ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`}>
                  {gameState.auction.timer}s
                </span>
              </div>
              <div className="w-full bg-slate-800/50 rounded-full h-3 overflow-hidden border border-white/5">
                <div
                  className={`h-full transition-all duration-1000 ease-linear ${gameState.auction.timer <= 3 ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'}`}
                  style={{ width: `${(gameState.auction.timer / GAME_CONSTANTS.AUCTION_TIMER_SECONDS) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Trade UI or main action */}
        <div className="flex-1 flex flex-col justify-center items-center relative py-2 overflow-hidden">
          {isTradeMode ? (
            <div className="w-full h-full bg-[#0f172a]/95 rounded-2xl border border-indigo-500/30 shadow-[0_0_50px_rgba(79,70,229,0.15)] flex flex-col overflow-hidden animate-slide-up">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Negotiate with</span>
                  <div className="flex gap-2">
                    {gameState.players.filter(p => p.id !== 0 && !p.isBankrupt).map(p => (
                      <button
                        key={p.id}
                        onClick={() => { setTargetPlayerId(p.id); setTargetTileId(null); playSound('ui_click'); }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-2
                          ${targetPlayerId === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                      >
                        <Avatar avatarId={p.avatar} color={p.color} isBankrupt={p.isBankrupt} inJail={p.inJail} className="w-4 h-4" />
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-px bg-white/5 overflow-hidden">
                {/* Offer side */}
                <div className="bg-[#0f172a] p-4 flex flex-col gap-4 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Your Offer</h3>
                    <span className="text-[10px] font-bold text-slate-500">{selectedOfferPropertyIds.length} Assets</span>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Cash Amount</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">$</div>
                      <input
                        type="number"
                        value={offeredCash}
                        onChange={e => setOfferedCash(Math.min(gameState.players.find(p => p.id === 0)?.money || 0, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-7 pr-3 text-sm font-mono text-emerald-400 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Your Portfolio</label>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {myProperties.map(tile => (
                        <button
                          key={tile.id}
                          onClick={() => toggleOfferProperty(tile.id)}
                          className={`w-full p-2 rounded-lg border text-left flex items-center gap-3 transition-all
                            ${selectedOfferPropertyIds.includes(tile.id) ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'}`}
                        >
                          <div className={`w-1 h-6 rounded-full ${colorMap[tile.group]}`} />
                          <div className="flex-1 text-xs font-bold truncate">{tile.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">${tile.price}</div>
                          {selectedOfferPropertyIds.includes(tile.id) && <CheckCircle size={14} className="text-indigo-400 animate-in zoom-in duration-200" />}
                        </button>
                      ))}
                      {myProperties.length === 0 && (
                        <div className="text-center py-8 text-slate-600 text-xs italic">No tradeable assets</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Target side */}
                <div className="bg-[#0f172a] p-4 flex flex-col gap-4 overflow-hidden">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Target Request</h3>
                    {targetTileId !== null && <span className="text-[10px] font-bold text-amber-500">Selected</span>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Request Cash</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono">$</div>
                      <input
                        type="number"
                        value={requestedCash}
                        onChange={e => setRequestedCash(Math.min(gameState.players.find(p => p.id === targetPlayerId)?.money || 0, Math.max(0, parseInt(e.target.value) || 0)))}
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-7 pr-3 text-sm font-mono text-amber-400 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-2 overflow-hidden">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Opponent Assets</label>
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
                      {targetPlayerProperties.map(tile => (
                        <button
                          key={tile.id}
                          onClick={() => { setTargetTileId(tile.id); playSound('ui_click'); }}
                          className={`w-full p-2 rounded-lg border text-left flex items-center gap-3 transition-all
                            ${targetTileId === tile.id ? 'bg-amber-600/20 border-amber-500 text-white' : 'bg-black/20 border-white/5 text-slate-400 hover:border-white/10'}`}
                        >
                          <div className={`w-1 h-6 rounded-full ${colorMap[tile.group]}`} />
                          <div className="flex-1 text-xs font-bold truncate">{tile.name}</div>
                          <div className="text-[10px] font-mono text-slate-500">${tile.price}</div>
                          {targetTileId === tile.id && <CheckCircle size={14} className="text-amber-400 animate-in zoom-in duration-200" />}
                        </button>
                      ))}
                      {targetPlayerProperties.length === 0 && (
                        <div className="text-center py-8 text-slate-600 text-xs italic">No tradeable assets</div>
                      )}
                    </div>
                  </div>

                  {/* IMP-18: Removed trade value summary — just a submit button */}
                  <div className="mt-auto pt-3 border-t border-white/5">
                    <button
                      disabled={targetTileId === null && requestedCash === 0}
                      onClick={submitTrade}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                      Send Proposal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
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
                        <Dice value={gameState.dice[0]} isRolling={isRollingAnim} />
                        <Dice value={gameState.dice[1]} isRolling={isRollingAnim} />
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
            </>
          )}
        </div>

        {/* Protocol Feed & Player Status */}
        {!isTradeMode && (
          <div className="flex flex-col gap-3 mt-auto">
            {/* Player Status List - Now inside the inner board area */}
            <div className="flex justify-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {gameState.players.map(player => {
                const isActive = gameState.currentPlayerIndex === gameState.players.indexOf(player);
                return (
                  <motion.div
                    key={player.id}
                    whileHover={{ y: -2 }}
                    onClick={() => onViewPlayer(player.id)}
                    className={`
                      relative flex items-center gap-2 bg-slate-900/40 backdrop-blur-md border p-2 rounded-xl min-w-[120px] cursor-pointer transition-all duration-300
                      ${isActive ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/20' : 'border-white/5 hover:border-white/10'}
                      ${player.isBankrupt ? 'opacity-40 grayscale' : ''}
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator-inner"
                        className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] z-30"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    )}
                    
                    <Avatar
                      avatarId={player.avatar}
                      color={player.color}
                      isBankrupt={player.isBankrupt}
                      inJail={player.inJail}
                      className={`w-6 h-6 md:w-8 md:h-8 ${isActive ? 'ring-1 ring-indigo-500' : ''}`}
                    />
                    
                    <div className="flex flex-col min-w-0">
                      <span className={`text-[9px] font-black uppercase truncate ${isActive ? 'text-indigo-300' : 'text-slate-200'}`}>
                        {player.name}
                      </span>
                      <span className={`font-mono text-[10px] font-bold ${player.isBankrupt ? 'text-slate-600' : 'text-emerald-400'}`}>
                        ${player.money}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Protocol Feed */}
            <div className="h-[60px] md:h-[80px] bg-[#0f172a]/60 rounded-xl flex flex-col p-2 border border-white/5 overflow-hidden backdrop-blur-sm">
              <div className="flex justify-between items-center mb-1 text-[7px] md:text-[8px] font-black text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={8} className="text-indigo-400" />
                  <span>Protocol Feed</span>
                </div>
                <span className="font-mono text-indigo-400">T-{gameState.turnCount}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                {gameState.logs.map((log, i) => (
                  <div
                    key={i}
                    className={`text-[8px] md:text-[9px] font-bold leading-tight transition-opacity duration-500 ${i === 0 ? 'text-indigo-300 border-l border-indigo-500 pl-1.5 animate-pulse' : 'text-slate-500 pl-1.5 opacity-60'}`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};