import React, { useState } from 'react';
import { Player, Tile, ColorGroup, TileType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, ArrowRightLeft, Coins } from 'lucide-react';
import { Avatar } from './Avatar';

interface CreateTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
  tiles: Tile[];
  myPlayerId: number;
  onTrade: (offerCash: number, offerPropertyIds: number[], targetTileId: number | null, requestCash: number, targetPlayerId: number) => void;
}

const colorMap: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]: '#92400e',
  [ColorGroup.LIGHT_BLUE]: '#0891b2',
  [ColorGroup.PINK]: '#c026d3',
  [ColorGroup.ORANGE]: '#ea580c',
  [ColorGroup.RED]: '#b91c1c',
  [ColorGroup.YELLOW]: '#ca8a04',
  [ColorGroup.GREEN]: '#047857',
  [ColorGroup.DARK_BLUE]: '#1e40af',
  [ColorGroup.NONE]: '#475569',
};

function FlagImg({ countryCode, name }: { countryCode?: string; name: string }) {
  if (!countryCode) return <span className="text-base leading-none">🏠</span>;
  return (
    <img
      src={`https://flagcdn.com/w40/${countryCode}.png`}
      srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
      alt={countryCode}
      className="w-5 h-3.5 object-cover rounded-sm shrink-0"
    />
  );
}

function PropertyRow({
  tile,
  selected,
  onClick,
  dimmed,
}: {
  tile: Tile;
  selected: boolean;
  onClick: () => void;
  dimmed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={dimmed}
      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all border ${
        selected
          ? 'bg-indigo-500/20 border-indigo-500/60 shadow-sm shadow-indigo-500/20'
          : dimmed
          ? 'bg-slate-800/30 border-slate-800/40 opacity-40 cursor-not-allowed'
          : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800 hover:border-slate-600'
      }`}
    >
      <FlagImg countryCode={tile.countryCode} name={tile.name} />
      <span className={`flex-1 text-[11px] font-bold uppercase truncate ${selected ? 'text-indigo-200' : 'text-slate-300'}`}>
        {tile.name}
      </span>
      <span className={`text-[10px] font-mono shrink-0 ${selected ? 'text-indigo-300' : 'text-slate-500'}`}>
        ${tile.price}
      </span>
    </button>
  );
}

export const CreateTradeModal: React.FC<CreateTradeModalProps> = ({
  isOpen, onClose, players, tiles, myPlayerId, onTrade
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [targetPlayerId, setTargetPlayerId] = useState<number | null>(null);
  const [targetTileId, setTargetTileId] = useState<number | null>(null);
  const [offerCash, setOfferCash] = useState(0);
  const [requestCash, setRequestCash] = useState(0);
  const [offerPropertyIds, setOfferPropertyIds] = useState<number[]>([]);

  if (!isOpen) return null;

  const myPlayer = players.find(p => p.id === myPlayerId)!;
  const targetPlayer = players.find(p => p.id === targetPlayerId);
  const opponents = players.filter(p => !p.isBankrupt && p.id !== myPlayerId);

  // All my non-mortgaged tradeable properties (no building restriction — server only blocks mortgaged)
  const myProperties = tiles.filter(t =>
    t.ownerId === myPlayerId &&
    !t.isMortgaged &&
    (t.type === TileType.PROPERTY || t.type === TileType.RAILROAD || t.type === TileType.UTILITY)
  );

  const theirProperties = targetPlayer
    ? tiles.filter(t =>
        t.ownerId === targetPlayerId &&
        !t.isMortgaged &&
        (t.type === TileType.PROPERTY || t.type === TileType.RAILROAD || t.type === TileType.UTILITY)
      )
    : [];

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
    if (targetPlayerId === null) return;
    onTrade(offerCash, offerPropertyIds, targetTileId, requestCash, targetPlayerId);
    handleClose();
  };

  const toggleOfferProperty = (id: number) => {
    setOfferPropertyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const hasOffer = offerCash > 0 || offerPropertyIds.length > 0;
  const hasRequest = requestCash > 0 || targetTileId !== null;
  const canSend = targetPlayerId !== null && (hasOffer || hasRequest);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-[520px] bg-[#0f172a] border border-indigo-500/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-300 tracking-widest uppercase">
            Create a trade
          </h2>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors group/close"
          >
            <span className="inline-flex transition-transform duration-200 group-hover/close:rotate-90">
              <X size={14} />
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Pick partner ── */}
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="p-4 space-y-2">
                {opponents.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs italic py-6">No opponents available.</p>
                ) : (
                  opponents.map(p => {
                    const count = tiles.filter(t => t.ownerId === p.id && !t.isMortgaged).length;
                    return (
                      <button
                        key={p.id}
                        onClick={() => { setTargetPlayerId(p.id); setStep(2); }}
                        className="w-full bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 transition-colors"
                      >
                        <Avatar avatarId={p.avatarId} color={p.color} className="w-9 h-9" />
                        <div className="text-left flex-1 min-w-0">
                          <div className="text-sm font-bold text-white uppercase truncate">{p.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-widest">
                            {count > 0 ? `${count} tradeable properties` : 'cash trade only'}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </motion.div>
            )}

            {/* ── Step 2: Side-by-side offer builder ── */}
            {step === 2 && targetPlayer && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="flex items-start gap-0 relative">

                  {/* ── MY SIDE ── */}
                  <div className="flex-1 p-4 space-y-3 min-w-0">
                    {/* Player header */}
                    <div className="flex items-center gap-2">
                      <Avatar avatarId={myPlayer.avatarId} color={myPlayer.color} className="w-8 h-8" />
                      <span className="text-sm font-black text-white uppercase truncate">{myPlayer.name}</span>
                    </div>

                    {/* Cash slider */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">0</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{myPlayer.money}</span>
                      </div>
                      <input
                        type="range" min={0} max={myPlayer.money} step={50} value={offerCash}
                        onChange={e => setOfferCash(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-center">
                        <span className="bg-indigo-600 text-white text-[11px] font-black px-3 py-0.5 rounded-full">{offerCash} $</span>
                      </div>
                    </div>

                    {/* My properties */}
                    <div className="space-y-1.5">
                      {myProperties.length === 0 ? (
                        <p className="text-[10px] text-slate-600 italic text-center py-2">No tradeable properties</p>
                      ) : (
                        myProperties.map(prop => (
                          <PropertyRow
                            key={prop.id}
                            tile={prop}
                            selected={offerPropertyIds.includes(prop.id)}
                            onClick={() => toggleOfferProperty(prop.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>

                  {/* ── CENTER DIVIDER ── */}
                  <div className="flex flex-col items-center pt-10 px-1 shrink-0">
                    <div className="w-px bg-slate-700/60 h-full absolute top-0 bottom-0" />
                    <div className="relative z-10 w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
                      <ArrowRightLeft size={14} className="text-slate-400" />
                    </div>
                  </div>

                  {/* ── THEIR SIDE ── */}
                  <div className="flex-1 p-4 space-y-3 min-w-0">
                    {/* Player header */}
                    <div className="flex items-center gap-2">
                      <Avatar avatarId={targetPlayer.avatarId} color={targetPlayer.color} className="w-8 h-8" />
                      <span className="text-sm font-black text-white uppercase truncate">{targetPlayer.name}</span>
                    </div>

                    {/* Cash slider (request cash from them) */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">0</span>
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{targetPlayer.money}</span>
                      </div>
                      <input
                        type="range" min={0} max={targetPlayer.money} step={50} value={requestCash}
                        onChange={e => setRequestCash(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-center">
                        <span className="bg-indigo-600 text-white text-[11px] font-black px-3 py-0.5 rounded-full">{requestCash} $</span>
                      </div>
                    </div>

                    {/* Their properties — single select */}
                    <div className="space-y-1.5">
                      {theirProperties.length === 0 ? (
                        <p className="text-[10px] text-slate-600 italic text-center py-2">No tradeable properties</p>
                      ) : (
                        theirProperties.map(prop => (
                          <PropertyRow
                            key={prop.id}
                            tile={prop}
                            selected={targetTileId === prop.id}
                            onClick={() => setTargetTileId(prev => prev === prop.id ? null : prop.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-3 bg-black/40 border-t border-white/5 flex items-center gap-2">
          {step === 2 ? (
            <button onClick={() => setStep(1)} className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95">
              Back
            </button>
          ) : (
            <button onClick={handleClose} className="py-3 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-black uppercase tracking-widest text-[10px] transition-all active:scale-95">
              Cancel
            </button>
          )}

          {step === 2 ? (
            <button
              onClick={submitTrade}
              disabled={!canSend}
              className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest text-[11px] transition-all shadow-lg shadow-indigo-600/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <ArrowRightLeft size={13} />
              Send trade
            </button>
          ) : (
            <button disabled className="flex-1 py-3 rounded-xl bg-slate-800 opacity-40 text-slate-500 font-black uppercase tracking-widest text-[10px]">
              Next
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
