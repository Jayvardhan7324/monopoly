import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShoppingCart, Coins, Package, Check, Loader2, ArrowLeft, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '../ui/sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
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

const TYPE_COLORS: Record<string, string> = {
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
      toast.error(`Not enough coins! You need ${item.priceCoins - coins} more coins.`);
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
      toast.success(`Purchased ${item.name}!`);
    } catch {
      toast.error('Purchase failed');
    } finally {
      setPurchasing(null);
    }
  };

  const types = ['all', ...Array.from(new Set(items.map(i => i.type)))];
  const filtered = filterType === 'all' ? items : items.filter(i => i.type === filterType);

  return (
    <div className="bg-slate-950 text-white flex flex-col h-full">
      <Toaster richColors />

      {/* Header */}
      <header className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shrink-0">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <button onClick={onBack} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-indigo-400" />
            <span className="font-bold text-lg">Store</span>
          </div>
          <div className="ml-auto flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1">
            <Coins className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-300">{coins.toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 overflow-auto w-full">
        {/* Hero */}
        <div className="mb-8">
          <h2 className="text-2xl font-black mb-1">Customize Your Game</h2>
          <p className="text-slate-400 text-sm">Spend your coins on skins, avatars, and tokens.</p>
        </div>

        {/* Type filter */}
        <div className="flex gap-2 flex-wrap mb-6">
          {types.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filterType === t
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {t === 'all' ? 'All Items' : (TYPE_LABELS[t] ?? t)}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-slate-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No items available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((item, i) => {
              const owned = inventory.has(item.id);
              const busy = purchasing === item.id;
              const canAfford = coins >= item.priceCoins;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={`relative flex flex-col rounded-2xl border overflow-hidden transition-all ${
                    owned
                      ? 'border-indigo-500/50 bg-indigo-500/5'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  {/* Asset preview */}
                  <div className="aspect-square bg-slate-800 flex items-center justify-center overflow-hidden">
                    {item.assetUrl ? (
                      <img src={item.assetUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <Tag className="h-10 w-10 text-slate-600" />
                    )}
                  </div>

                  {/* Owned badge */}
                  {owned && (
                    <div className="absolute top-2 right-2 bg-indigo-600 rounded-full p-1">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <div>
                      <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${TYPE_COLORS[item.type] ?? TYPE_COLORS.misc}`}>
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      <p className="font-bold text-sm mt-1.5 leading-tight">{item.name}</p>
                      {item.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{item.description}</p>
                      )}
                    </div>

                    <div className="mt-auto">
                      {owned ? (
                        <div className="flex items-center gap-1 text-xs text-indigo-400 font-semibold">
                          <Check className="h-3 w-3" /> Owned
                        </div>
                      ) : (
                        <button
                          onClick={() => purchase(item)}
                          disabled={busy || !canAfford}
                          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {busy ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Coins className="h-3 w-3" />
                          )}
                          {item.priceCoins.toLocaleString()}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default StorePage;
