import React from 'react';
import { Player, Tile, ColorGroup } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, Landmark, Home, Building2, ShieldAlert } from 'lucide-react';
import { Avatar } from './Avatar';

interface PlayerPortfolioModalProps {
  player: Player;
  tiles: Tile[];
  onClose: () => void;
}

const colorMap: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]: 'bg-amber-900',
  [ColorGroup.LIGHT_BLUE]: 'bg-sky-400',
  [ColorGroup.PINK]: 'bg-pink-500',
  [ColorGroup.ORANGE]: 'bg-orange-500',
  [ColorGroup.RED]: 'bg-red-600',
  [ColorGroup.YELLOW]: 'bg-yellow-500',
  [ColorGroup.GREEN]: 'bg-emerald-600',
  [ColorGroup.DARK_BLUE]: 'bg-blue-700',
  [ColorGroup.NONE]: 'bg-slate-700',
};

export const PlayerPortfolioModal: React.FC<PlayerPortfolioModalProps> = ({ player, tiles, onClose }) => {
  const ownedTiles = tiles.filter(t => t.ownerId === player.id);
  
  // Group by color
  const groupedTiles = ownedTiles.reduce((acc, tile) => {
    const group = tile.group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(tile);
    return acc;
  }, {} as Record<ColorGroup, Tile[]>);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-500/10 to-transparent">
          <div className="flex items-center gap-4">
            <Avatar avatarId={player.avatar} color={player.color} className="w-12 h-12 shadow-lg" />
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                {player.name}'s Portfolio
                {player.isBot && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30">AI</span>
                    {player.personality && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase font-black tracking-tighter">
                        {player.personality}
                      </span>
                    )}
                  </div>
                )}
              </h2>
              <p className="text-emerald-400 font-mono font-bold text-lg">${player.money}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10">
          {ownedTiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500 gap-4">
              <Landmark size={48} strokeWidth={1} />
              <p className="font-bold uppercase tracking-widest text-sm">No properties owned yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(Object.entries(groupedTiles) as [ColorGroup, Tile[]][]).map(([group, groupTiles]) => (
                <div key={group} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${colorMap[group as ColorGroup]}`} />
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {group === 'NONE' ? 'Utilities & Rails' : `${group} Group`}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {groupTiles.map(tile => (
                      <div
                        key={tile.id}
                        className={`bg-white/5 border border-white/5 rounded-xl p-3 flex items-center justify-between transition-all hover:bg-white/10 ${tile.isMortgaged ? 'opacity-50 grayscale' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${colorMap[tile.group]}`} />
                          <div>
                            <div className="text-xs font-bold text-white uppercase">{tile.name}</div>
                            {tile.isMortgaged ? (
                              <div className="flex items-center gap-1 text-[8px] text-rose-400 font-black uppercase">
                                <ShieldAlert size={8} /> Mortgaged
                              </div>
                            ) : (
                              <div className="flex gap-0.5 mt-1">
                                {[...Array(tile.buildingCount)].map((_, i) => (
                                  i === 4 ? (
                                    <Building2 key={i} size={10} className="text-rose-500" fill="currentColor" />
                                  ) : (
                                    <Home key={i} size={10} className="text-emerald-500" fill="currentColor" />
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-mono font-bold text-slate-400">${tile.price}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-black/20 border-t border-white/5 text-center">
          <p className="text-[10px] text-slate-600 uppercase font-black tracking-widest">
            Total Assets: {ownedTiles.length} Properties
          </p>
        </div>
      </motion.div>
    </div>
  );
};
