import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, UserPlus, Search, Check, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../lib/auth-client';
import { Skeleton } from '../ui/skeleton';

interface Friend {
  id: string;
  name: string;
  image?: string;
}

interface FriendRequest {
  friendshipId: string;
  user?: Friend;
}

interface Props {
  onClose: () => void;
  userId: string;
}

function Avatar({ user }: { user?: Friend }) {
  if (!user) return null;
  return user.image ? (
    <img src={user.image} className="h-9 w-9 rounded-full object-cover border border-slate-700 shrink-0" alt="" />
  ) : (
    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
      {user.name?.[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

type Tab = 'friends' | 'requests' | 'search';

const FriendsPanel: React.FC<Props> = ({ onClose, userId }) => {
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  useEffect(() => { loadFriends(); loadRequests(); }, [userId]);

  const loadFriends = async () => {
    try {
      const res = await authFetch('/api/friends');
      const data = await res.json();
      setFriends(data.friends ?? []);
    } catch { /* silent */ }
  };

  const loadRequests = async () => {
    try {
      const res = await authFetch('/api/friends/requests');
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch { /* silent */ }
  };

  const doSearch = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setLoading(true);
    try {
      const res = await authFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const sendRequest = async (addresseeId: string) => {
    setActing(addresseeId);
    try {
      const res = await authFetch('/api/friends/request', { method: 'POST', body: JSON.stringify({ addresseeId }) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success('Friend request sent!');
      setSearchResults(prev => prev.filter(u => u.id !== addresseeId));
    } catch { toast.error('Failed'); } finally { setActing(null); }
  };

  const respond = async (friendshipId: string, status: 'accepted' | 'declined') => {
    setActing(friendshipId);
    try {
      await authFetch('/api/friends/respond', { method: 'POST', body: JSON.stringify({ friendshipId, status }) });
      setRequests(prev => prev.filter(r => r.friendshipId !== friendshipId));
      if (status === 'accepted') { toast.success('Friend added!'); loadFriends(); }
    } catch { toast.error('Failed'); } finally { setActing(null); }
  };

  const removeFriend = async (friendId: string) => {
    setActing(friendId);
    try {
      await authFetch(`/api/friends/${friendId}`, { method: 'DELETE' });
      setFriends(prev => prev.filter(f => f.id !== friendId));
      toast.success('Friend removed');
    } catch { toast.error('Failed'); } finally { setActing(null); }
  };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'friends', label: 'Friends', badge: friends.length },
    { key: 'requests', label: 'Requests', badge: requests.length || undefined },
    { key: 'search', label: 'Add' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ type: 'spring', damping: 28, stiffness: 350 }}
      className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-slate-800">
        <Users className="h-5 w-5 text-indigo-400 shrink-0" />
        <span className="font-black text-white text-base flex-1">Friends</span>
        <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 pt-3 pb-0">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`text-[10px] font-black rounded-full px-1.5 py-0.5 ${tab === t.key ? 'bg-white/20' : 'bg-slate-700'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="p-5 space-y-2 min-h-[200px] max-h-[360px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {tab === 'friends' && (
            <motion.div key="friends" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {friends.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No friends yet — use Add to find players.</p>
              ) : friends.map(f => (
                <div key={f.id} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5">
                  <Avatar user={f} />
                  <span className="flex-1 text-sm font-semibold text-white truncate">{f.name}</span>
                  <button
                    onClick={() => removeFriend(f.id)}
                    disabled={acting === f.id}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    title="Remove friend"
                  >
                    <UserX className={`h-4 w-4 ${acting === f.id ? 'opacity-50' : ''}`} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'requests' && (
            <motion.div key="requests" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {requests.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">No pending requests.</p>
              ) : requests.map(r => (
                <div key={r.friendshipId} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5">
                  <Avatar user={r.user} />
                  <span className="flex-1 text-sm font-semibold text-white truncate">{r.user?.name ?? '?'}</span>
                  <button
                    onClick={() => respond(r.friendshipId, 'accepted')}
                    disabled={!!acting}
                    className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                    title="Accept"
                  >
                    <Check className={`h-4 w-4 ${acting === r.friendshipId ? 'opacity-50' : ''}`} />
                  </button>
                  <button
                    onClick={() => respond(r.friendshipId, 'declined')}
                    disabled={!!acting}
                    className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    title="Decline"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'search' && (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={searchQ}
                  onChange={e => doSearch(e.target.value)}
                  placeholder="Search by username…"
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              {loading && (
                <div className="flex flex-col gap-2 py-2">
                  {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl bg-slate-800" />)}
                </div>
              )}
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-3 py-2.5">
                  <Avatar user={u} />
                  <span className="flex-1 text-sm font-semibold text-white truncate">{u.name}</span>
                  <button
                    onClick={() => sendRequest(u.id)}
                    disabled={acting === u.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                  >
                    <UserPlus className={`h-3 w-3 ${acting === u.id ? 'opacity-50' : ''}`} />
                    Add
                  </button>
                </div>
              ))}
              {searchQ.length >= 2 && !loading && searchResults.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No players found.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default FriendsPanel;
