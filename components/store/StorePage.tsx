import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Coins, Package, Check, Loader2, ArrowLeft, Sparkles, Tag, Grid3X3, User, Layout, Puzzle, ImageIcon, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '../ui/sonner';
import { authFetch } from '../../lib/auth-client';

interface StoreItem {
  id: string;
  name: string;
  description: string;
  type: string;
  priceCoins: number;
  assetUrl: string | null;
  active: boolean;
}

interface Props {
  onBack: () => void;
  userId?: string;
  onProfilePicEquipped?: (assetUrl: string | null) => void;
}

const TYPE_LABELS: Record<string, string> = {
  avatar: 'Avatar',
  board_skin: 'Board Skin',
  token: 'Token',
  profile_pic: 'Profile Pic',
  misc: 'Misc',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  avatar: <User size={12} />,
  board_skin: <Layout size={12} />,
  token: <Grid3X3 size={12} />,
  profile_pic: <ImageIcon size={12} />,
  misc: <Puzzle size={12} />,
};

const TYPE_GRADIENTS: Record<string, string> = {
  avatar: 'from-purple-500/20 to-purple-900/10 border-purple-500/25',
  board_skin: 'from-blue-500/20 to-blue-900/10 border-blue-500/25',
  token: 'from-amber-500/20 to-amber-900/10 border-amber-500/25',
  profile_pic: 'from-rose-500/20 to-rose-900/10 border-rose-500/25',
  misc: 'from-slate-500/20 to-slate-900/10 border-slate-500/25',
};

const TYPE_BADGE: Record<string, string> = {
  avatar: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  board_skin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  token: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  profile_pic: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  misc: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const StorePage: React.FC<Props> = ({ onBack, userId, onProfilePicEquipped }) => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [equippedItemId, setEquippedItemId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    loadStore();
  }, [userId]);

  const loadStore = async () => {
    setLoading(true);
    try {
      const [itemsRes, inventoryRes] = await Promise.all([
        fetch('/api/store/items'),
        userId ? fetch(`/api/store/inventory/${userId}`) : Promise.resolve(null),
      ]);

      const itemsData = await itemsRes.json();
      setItems(itemsData.items ?? []);

      if (inventoryRes) {
        const invData = await inventoryRes.json();
        setInventory(new Set(invData.itemIds ?? []));
        setCoins(invData.coins ?? 0);
        setEquippedItemId(invData.equippedAvatarItemId ?? null);
      }
    } catch {
      toast.error('Failed to load store');
    } finally {
      setLoading(false);
    }
  };

  const purchase = async (item: StoreItem) => {
    if (!userId) {
      toast.error('You must be logged in to purchase items');
      return;
    }
    if (inventory.has(item.id)) return;
    if (coins < item.priceCoins) {
      toast.error(`Need ${(item.priceCoins - coins).toLocaleString()} more coins`);
      return;
    }

    setPurchasing(item.id);
    try {
      const res = await authFetch('/api/store/purchase', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Purchase failed'); return; }
      setInventory(prev => new Set([...prev, item.id]));
      setCoins(data.coins);
      toast.success(`${item.name} unlocked!`);
    } catch {
      toast.error('Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const equip = async (item: StoreItem) => {
    if (!userId) return;
    const isAlreadyEquipped = equippedItemId === item.id;
    setEquipping(item.id);
    try {
      const res = await authFetch('/api/store/equip', {
        method: 'POST',
        body: JSON.stringify({ itemId: isAlreadyEquipped ? null : item.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Equip failed'); return; }
      const newEquipped = isAlreadyEquipped ? null : item.id;
      setEquippedItemId(newEquipped);
      onProfilePicEquipped?.(isAlreadyEquipped ? null : (item.assetUrl ?? null));
      toast.success(isAlreadyEquipped ? 'Profile pic removed' : `${item.name} equipped as profile pic!`);
    } catch {
      toast.error('Equip failed');
    } finally {
      setEquipping(null);
    }
  };

  const types: string[] = ['all', ...Array.from(new Set<string>(items.map(i => i.type)))];
  const filtered = filterType === 'all' ? items : items.filter(i => i.type === filterType);
  const featuredItems = items.filter(i => !inventory.has(i.id)).slice(0, 3);

  return (
    <div className="bg-[#080b14] text-white flex flex-col h-full min-h-0">
      <Toaster richColors />

      {/* Header */}
      <header className="sticky top-0 z-20 bg-[#080b14]/90 backdrop-blur-xl border-b border-white/5 shrink-0">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={onBack}
            aria-label="Back to game"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <ShoppingCart className="h-3.5 w-3.5 text-indigo-400" />
            </div>
            <span className="font-black text-base tracking-tight">Store</span>
          </div>
          {/* Coin balance */}
          <motion.div
            whileHover={{ scale: 1.04 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="ml-auto flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-yellow-500/20 border border-amber-400/30 rounded-full px-3 py-1.5 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
          >
            <Coins className="h-3.5 w-3.5 text-amber-300 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
            <span className="text-sm font-black text-amber-200 tabular-nums">{coins.toLocaleString()}</span>
            <span className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">coins</span>
          </motion.div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 overflow-auto w-full space-y-6">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-900/50 via-violet-900/30 to-slate-950 border border-indigo-500/20 p-5 sm:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(168,85,247,0.22),_transparent_60%)]" />
          <div className="absolute -top-8 -right-8 w-40 h-40 bg-indigo-500/10 blur-3xl rounded-full" />
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <motion.div
                  animate={{ rotate: [0, 18, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                >
                  <Sparkles className="h-4 w-4 text-indigo-300 drop-shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
                </motion.div>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-300">Cashly Store</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight mb-1 bg-gradient-to-r from-white to-indigo-200 bg-clip-text text-transparent">Customize Your Empire</h2>
              <p className="text-slate-400 text-xs sm:text-sm">Unlock avatars, board skins, and tokens with your coins.</p>
            </div>
            {!loading && items.length > 0 && (
              <div className="flex gap-2 shrink-0">
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center min-w-[68px]">
                  <div className="text-lg font-black text-indigo-300 tabular-nums leading-none">{inventory.size}</div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Owned</div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-center min-w-[68px]">
                  <div className="text-lg font-black text-white tabular-nums leading-none">{items.length}</div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Total</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Featured — only when not filtered and items exist */}
        {filterType === 'all' && !loading && featuredItems.length > 0 && (
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 mb-3">Featured</p>
            <div className="grid grid-cols-3 gap-3">
              {featuredItems.map((item, i) => {
                const busy = purchasing === item.id;
                const canAfford = coins >= item.priceCoins;
                const grad = TYPE_GRADIENTS[item.type] ?? TYPE_GRADIENTS.misc;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className={`relative rounded-xl border bg-gradient-to-br ${grad} overflow-hidden group cursor-pointer`}
                    onClick={() => purchase(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        purchase(item);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Buy ${item.name} for ${item.priceCoins.toLocaleString()} coins`}
                  >
                    <div className="aspect-square flex items-center justify-center bg-black/20 overflow-hidden">
                      {item.assetUrl ? (
                        <img src={item.assetUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <Tag className="h-8 w-8 text-slate-600" />
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="font-black text-xs leading-tight truncate">{item.name}</p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <Coins className="h-3 w-3 text-amber-400 shrink-0" />
                        <span className={`text-xs font-black tabular-nums ${canAfford ? 'text-amber-300' : 'text-slate-500'}`}>
                          {item.priceCoins.toLocaleString()}
                        </span>
                        {busy && <Loader2 className="h-3 w-3 animate-spin text-slate-400 ml-auto" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Type filter pills */}
        <div className="flex gap-2 flex-wrap">
          {types.map(t => {
            const icon = t === 'all' ? <Grid3X3 size={11} /> : (TYPE_ICONS as Record<string, React.ReactNode>)[t] ?? null;
            const count = t === 'all' ? items.length : items.filter(i => i.type === t).length;
            const isActive = filterType === t;
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                aria-pressed={isActive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all active:scale-95 ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-white/5 border-white/8 text-slate-400 hover:border-white/15 hover:text-white hover:bg-white/10'
                }`}
              >
                {icon}
                {t === 'all' ? 'All Items' : (TYPE_LABELS[t] ?? t)}
                <span className={`ml-0.5 text-[10px] tabular-nums px-1.5 py-px rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-white/8 text-slate-500'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-bold">No items here yet.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filtered.map((item, i) => {
                const owned = inventory.has(item.id);
                const busy = purchasing === item.id;
                const canAfford = coins >= item.priceCoins;

                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i * 0.02, type: 'spring', stiffness: 400, damping: 30 }}
                    whileHover={{ y: -4 }}
                    className={`relative flex flex-col rounded-xl border overflow-hidden transition-all group ${
                      owned
                        ? 'border-indigo-500/40 bg-indigo-500/5 shadow-md shadow-indigo-500/10'
                        : 'border-white/8 bg-white/3 hover:border-indigo-500/40 hover:bg-white/5 hover:shadow-lg hover:shadow-indigo-500/10'
                    }`}
                  >
                    {/* Asset preview */}
                    <div className="aspect-square bg-black/30 flex items-center justify-center overflow-hidden relative">
                      {item.assetUrl ? (
                        <img src={item.assetUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <Tag className="h-8 w-8 text-slate-700" />
                      )}
                      {/* Type badge */}
                      <span className={`absolute top-1.5 left-1.5 text-[9px] font-black border rounded-full px-1.5 py-0.5 flex items-center gap-1 ${(TYPE_BADGE as Record<string,string>)[item.type] ?? TYPE_BADGE.misc}`}>
                        {(TYPE_ICONS as Record<string, React.ReactNode>)[item.type]}
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      {owned && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center border border-indigo-400/30">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-2.5 flex flex-col gap-2 flex-1">
                      <div className="flex-1">
                        <p className="font-black text-xs leading-tight">{item.name}</p>
                        {item.description && (
                          <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-2">{item.description}</p>
                        )}
                      </div>

                      <div className="mt-auto">
                        {owned && item.type === 'profile_pic' ? (
                          <button
                            onClick={() => equip(item)}
                            disabled={equipping === item.id}
                            aria-label={equippedItemId === item.id ? `Unequip ${item.name}` : `Equip ${item.name}`}
                            className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                              equippedItemId === item.id
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/10'
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20'
                            }`}
                          >
                            {equipping === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : equippedItemId === item.id ? (
                              <><Zap className="h-3 w-3 fill-current" /> Equipped</>
                            ) : (
                              <><Zap className="h-3 w-3" /> Equip</>
                            )}
                          </button>
                        ) : owned ? (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-black">
                            <Check className="h-3 w-3" /> Owned
                          </div>
                        ) : (
                          <button
                            onClick={() => purchase(item)}
                            disabled={busy || !canAfford}
                            aria-label={`Buy ${item.name} for ${item.priceCoins.toLocaleString()} coins`}
                            className={`w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-black transition-all active:scale-95 ${
                              canAfford
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-md shadow-amber-500/20'
                                : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'
                            }`}
                          >
                            {busy ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Coins className="h-3 w-3 shrink-0" />
                                <span className="tabular-nums">{item.priceCoins.toLocaleString()}</span>
                              </>
                            )}
                          </button>
                        )}
                        </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        )}
      </main>
    </div>
  );
};

export default StorePage;
