import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Coins, Package, Check, Loader2, ArrowLeft, Sparkles, Tag, Grid3X3, User, Layout, Puzzle } from 'lucide-react';
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
}

const TYPE_LABELS: Record<string, string> = {
  avatar: 'Avatar',
  board_skin: 'Board Skin',
  token: 'Token',
  misc: 'Misc',
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  avatar: <User size={12} />,
  board_skin: <Layout size={12} />,
  token: <Grid3X3 size={12} />,
  misc: <Puzzle size={12} />,
};

const TYPE_GRADIENTS: Record<string, string> = {
  avatar: 'from-purple-500/20 to-purple-900/10 border-purple-500/25',
  board_skin: 'from-blue-500/20 to-blue-900/10 border-blue-500/25',
  token: 'from-amber-500/20 to-amber-900/10 border-amber-500/25',
  misc: 'from-slate-500/20 to-slate-900/10 border-slate-500/25',
};

const TYPE_BADGE: Record<string, string> = {
  avatar: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  board_skin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  token: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  misc: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const StorePage: React.FC<Props> = ({ onBack, userId }) => {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [inventory, setInventory] = useState<Set<string>>(new Set());
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
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
          <div className="ml-auto flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-sm font-black text-amber-300 tabular-nums">{coins.toLocaleString()}</span>
            <span className="text-[10px] text-amber-500/70 font-bold">coins</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 flex-1 overflow-auto w-full space-y-6">
        {/* Hero */}
        <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-900/40 via-slate-900/60 to-slate-950 border border-indigo-500/15 p-5">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.15),_transparent_60%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Cashly Store</span>
            </div>
            <h2 className="text-xl font-black tracking-tight mb-0.5">Customize Your Empire</h2>
            <p className="text-slate-400 text-xs">Unlock avatars, board skins, and tokens with your coins.</p>
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
            return (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                  filterType === t
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-white/5 border-white/8 text-slate-400 hover:border-white/15 hover:text-white'
                }`}
              >
                {icon}
                {t === 'all' ? 'All Items' : (TYPE_LABELS[t] ?? t)}
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
                    className={`relative flex flex-col rounded-xl border overflow-hidden transition-all group ${
                      owned
                        ? 'border-indigo-500/40 bg-indigo-500/5'
                        : 'border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5'
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
                        {owned ? (
                          <div className="flex items-center gap-1 text-[10px] text-indigo-400 font-black">
                            <Check className="h-3 w-3" /> Owned
                          </div>
                        ) : (
                          <button
                            onClick={() => purchase(item)}
                            disabled={busy || !canAfford}
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
