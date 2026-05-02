import React, { useState } from 'react';
import { Tile, TileType, Player, ColorGroup } from '../types';
import { X, ArrowUpCircle, Banknote, Landmark, Home, Building2, AlertTriangle, AlertCircle, Unlock, MapPin, WalletCards, TrendingUp } from 'lucide-react';
import { Avatar } from './Avatar';
import { motion, AnimatePresence } from 'motion/react';
import { GAME_CONSTANTS } from '../constants';
import { Card, CardContent, CardHeader } from './ui/card';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

interface PropertyModalProps {
  tile: Tile;
  owner?: Player;
  onClose: () => void;
  onUpgrade?: () => void;
  canUpgrade: boolean;
  currentPlayer?: Player;
  myProperties?: Tile[];
  onMortgage?: () => void;
  onUnmortgage?: () => void;
  onSell?: () => void;
  onDowngrade?: () => void;
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
  tile, owner, onClose, onUpgrade, canUpgrade, currentPlayer, myProperties, onMortgage, onUnmortgage, onSell, onDowngrade,
}) => {
  const [showSellConfirm, setShowSellConfirm] = useState(false);

  const isProperty = tile.type === TileType.PROPERTY;
  const isMine = owner?.id === currentPlayer?.id;
  const groupTiles = myProperties?.filter(t => t.group === tile.group) ?? [];
  const canBuildHere = canUpgrade &&
    isMine &&
    isProperty &&
    !tile.isMortgaged &&
    tile.buildingCount < 5 &&
    !!currentPlayer &&
    currentPlayer.money >= tile.houseCost &&
    groupTiles.length > 0 &&
    groupTiles.every(t => t.ownerId === currentPlayer.id) &&
    !groupTiles.some(t => t.isMortgaged);
  const mortgageValue = Math.floor(tile.price * GAME_CONSTANTS.MORTGAGE_RATE);
  const unmortgageCost = Math.floor(mortgageValue * GAME_CONSTANTS.UNMORTGAGE_FEE);
  const sellValue = Math.floor(tile.price * GAME_CONSTANTS.SELL_RATE);
  const ownedSet = myProperties ?? [];
  const railroadRent = [25, 50, 100, 200];
  const ownedRailroads = owner ? ownedSet.filter(t => t.ownerId === owner.id && t.type === TileType.RAILROAD).length : 1;
  const ownedUtilities = owner ? ownedSet.filter(t => t.ownerId === owner.id && t.type === TileType.UTILITY).length : 1;
  const activeRentLabel = tile.type === TileType.RAILROAD
    ? `$${railroadRent[Math.max(0, Math.min(ownedRailroads - 1, railroadRent.length - 1))]}`
    : tile.type === TileType.UTILITY
      ? `${ownedUtilities >= 2 ? '10x' : '4x'} dice`
      : `$${tile.rent[tile.buildingCount] ?? tile.rent[0] ?? 0}`;
  const districtName = tile.group !== ColorGroup.NONE ? tile.group.replace('_', ' ') : tile.type;
  const countryFlag = tile.countryCode ? `https://flagcdn.com/w80/${tile.countryCode}.png` : null;

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
    onClose();
  };

  // UX-2: Escape to close, focus trap, scroll lock.
  const modalRef = useModalAccessibility<HTMLDivElement>({ isOpen: true, onClose: handleClose });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="property-modal-title"
    >
      <motion.div
        ref={modalRef}
        initial={{ scale: 0.95, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        // Portrait: narrower & taller
        className="w-full max-w-[330px] max-h-[88vh] flex flex-col outline-none"
        onClick={e => e.stopPropagation()}
      >
        <Card className="bg-slate-900 border-slate-800 overflow-hidden flex flex-col max-h-[88vh] shadow-2xl shadow-black/50">
          {/* Coloured Header Banner */}
          <CardHeader className={`${colorMap[tile.group]} p-0 shrink-0 relative overflow-hidden`}>
            <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            <div className="p-5 pr-12 relative z-10 min-h-[118px] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {countryFlag && (
                    <img src={countryFlag} alt="" className="w-7 h-5 object-cover rounded-[3px] border border-white/30 shadow-md" />
                  )}
                  <span className="text-white/70 text-[9px] font-black uppercase tracking-[0.22em]">
                    {districtName} district
                  </span>
                </div>
                <h2 id="property-modal-title" className="text-2xl font-black text-white drop-shadow-md uppercase tracking-tight leading-none">{tile.name}</h2>
              </div>
              <div className="mt-3 flex items-center gap-2 text-white/70 text-[10px] font-bold uppercase tracking-widest">
                <MapPin size={12} />
                <span>City deed</span>
              </div>
            </div>
            {/* UX-3: 44x44 tap target via invisible padding; visible icon stays small. */}
            <button
              onClick={handleClose}
              aria-label="Close property details"
              className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center text-white/70 hover:text-white transition-colors z-20 group/close focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-bl-xl"
            >
              <span className="inline-flex w-6 h-6 rounded-full bg-black/30 hover:bg-black/50 items-center justify-center transition-transform duration-200 group-hover/close:rotate-90">
                <X size={14} />
              </span>
            </button>
          </CardHeader>

          <CardContent className="p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
            {/* Owner / Price Row */}
            <div className="grid grid-cols-[1fr_auto] gap-3 items-stretch">
              <div className="rounded-xl border border-slate-800 bg-slate-950/45 p-3 min-w-0">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Portfolio Owner</span>
                {owner ? (
                  <div className="flex items-center gap-1.5">
                    {owner.profileImage ? (
                      <img src={owner.profileImage} alt="" className="w-6 h-6 rounded-full object-cover border border-white/10" />
                    ) : (
                      <Avatar avatarId={owner.avatarId} color={owner.color} isBankrupt={owner.isBankrupt} inJail={owner.inJail} className="w-6 h-6" />
                    )}
                    <span className="font-bold text-xs truncate">{owner.name}</span>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-slate-300 border-emerald-500/30 bg-emerald-500/10 py-1 px-2 rounded-full">Market Available</Badge>
                )}
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-right min-w-[96px]">
                <span className="text-[8px] font-bold text-emerald-200/60 uppercase tracking-wider block">List Price</span>
                <span className="font-mono text-2xl font-black text-emerald-300">${tile.price}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-2">
                <WalletCards size={13} className="text-emerald-400 mb-1" />
                <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Active Rent</p>
                <p className="font-mono text-sm font-black text-white">{activeRentLabel}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-2">
                <Landmark size={13} className="text-sky-400 mb-1" />
                <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Mortgage</p>
                <p className="font-mono text-sm font-black text-white">${mortgageValue}</p>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-2">
                <TrendingUp size={13} className="text-amber-400 mb-1" />
                <p className="text-[8px] uppercase tracking-wider text-slate-500 font-bold">Build Cost</p>
                <p className="font-mono text-sm font-black text-white">${tile.houseCost || 0}</p>
              </div>
            </div>

            {/* Rent Table */}
            <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Rent Ladder</span>
                {tile.isMortgaged && <span className="text-[9px] font-bold text-rose-400">Mortgaged</span>}
              </div>
              {!tile.isMortgaged && isProperty ? (
                <div className="text-[11px] flex flex-col gap-1">
                  <div className={`flex justify-between items-center px-2 rounded-md ${tile.buildingCount === 0 ? 'text-white font-bold bg-white/8 py-1' : 'text-slate-400 py-0.5'}`}>
                    <span>Base Rent</span>
                    <span className="font-mono">${tile.rent[0]}</span>
                  </div>
                  {isProperty && [1, 2, 3, 4, 5].map(lvl => (
                    <div
                      key={lvl}
                      className={`flex justify-between items-center px-2 rounded-md ${tile.buildingCount === lvl ? 'text-white font-bold bg-white/8 py-1' : 'text-slate-400 py-0.5'} ${lvl === 5 ? 'mt-1 pt-1 border-t border-white/5' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        {lvl < 5
                          ? <Home size={10} className={tile.buildingCount === lvl ? 'text-emerald-400' : 'text-slate-600'} />
                          : <Building2 size={10} className={tile.buildingCount === lvl ? 'text-rose-400' : 'text-slate-600'} />
                        }
                        <span>{getLevelLabel(lvl)}</span>
                      </div>
                      <span className={`font-mono ${lvl === 5 ? 'text-rose-400' : ''}`}>${tile.rent[lvl]}</span>
                    </div>
                  ))}
                </div>
              ) : tile.isMortgaged ? (
                <div className="text-center py-3 text-rose-500 text-[10px] font-bold flex items-center justify-center gap-1.5">
                  <AlertCircle size={12} /> Revenue streams suspended
                </div>
              ) : (
                <div className="text-[11px] flex flex-col gap-1">
                  {tile.type === TileType.RAILROAD ? railroadRent.map((rent, idx) => (
                    <div key={idx} className={`flex justify-between items-center px-2 rounded-md ${ownedRailroads === idx + 1 ? 'text-white font-bold bg-white/8 py-1' : 'text-slate-400 py-0.5'}`}>
                      <span>{idx + 1} Railroad{idx === 0 ? '' : 's'}</span>
                      <span className="font-mono">${rent}</span>
                    </div>
                  )) : (
                    <>
                      <div className={`flex justify-between items-center px-2 rounded-md ${ownedUtilities < 2 ? 'text-white font-bold bg-white/8 py-1' : 'text-slate-400 py-0.5'}`}>
                        <span>1 Utility</span>
                        <span className="font-mono">4x dice</span>
                      </div>
                      <div className={`flex justify-between items-center px-2 rounded-md ${ownedUtilities >= 2 ? 'text-white font-bold bg-white/8 py-1' : 'text-slate-400 py-0.5'}`}>
                        <span>2 Utilities</span>
                        <span className="font-mono">10x dice</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <Separator className="bg-slate-800" />

            {/* Action Panel */}
            <div className="space-y-2">
              {canBuildHere && (
                <Button
                  onClick={onUpgrade}
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs shadow-lg shadow-indigo-600/20"
                >
                  <ArrowUpCircle size={14} /> {tile.buildingCount === 4 ? 'Build Hotel' : 'Build Estate'} (-${tile.houseCost})
                </Button>
              )}
              {isMine && isProperty && tile.buildingCount > 0 && onDowngrade && (
                <Button
                  onClick={onDowngrade}
                  size="sm"
                  variant="outline"
                  className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]"
                >
                  <Home size={11} /> Sell Building (+${Math.floor(tile.houseCost * 0.5)})
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

            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};
