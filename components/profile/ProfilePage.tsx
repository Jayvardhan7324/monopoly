import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Trophy, Coins, LogOut, Calendar, Gamepad2,
  Loader2, Pencil, Check, X, Users, Star, ArrowLeft,
  Package, Clock, Camera,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../lib/auth-client';
import AvatarPickerModal from './AvatarPickerModal';

interface Props {
  sessionData: { user: { id: string; name: string; email: string; image?: string } };
  onClose: () => void;
  onSignOut: () => void;
  onOpenFriends?: () => void;
  onProfileUpdated?: (name: string, image?: string) => void;
}

interface ProfileData {
  id: string; name: string; email: string; image?: string;
  coins: number; createdAt: string; friendCount: number;
  stats: {
    gamesPlayed: number; gamesWon: number; gamesLost: number;
    totalEarnings: number; propertiesBought: number;
    peakPropertiesOwned: number; bankruptcies: number; totalTurns: number;
  };
}

interface Friend { id: string; name: string; image?: string; }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const years = Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  const months = Math.floor(diff / (1000 * 60 * 60 * 24 * 30));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (years >= 1) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months >= 1) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days >= 1) return `${days} day${days > 1 ? 's' : ''} ago`;
  return 'today';
}

function FriendAvatar({ image, name, size = 40 }: { image?: string; name: string; size?: number }) {
  const colors = ['#4338ca','#7c3aed','#b45309','#15803d','#0e7490','#be185d','#c2410c','#334155'];
  const bg = colors[(name.charCodeAt(0) ?? 0) % colors.length];
  const s = `${size}px`;
  if (image) return <img src={image} style={{ width: s, height: s }} className="rounded-full object-cover shrink-0" alt="" />;
  return (
    <div style={{ width: s, height: s, background: bg }} className="rounded-full flex items-center justify-center text-white font-black text-sm shrink-0">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

const ProfilePage: React.FC<Props> = ({ sessionData, onClose, onSignOut, onOpenFriends, onProfileUpdated }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(sessionData.user.name ?? '');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const loadProfile = useCallback(() => {
    setLoading(true);
    fetch(`/api/profile/${sessionData.user.id}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionData.user.id]);

  useEffect(() => {
    loadProfile();
    fetch('/api/friends', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { friends: [] })
      .then(data => setFriends(data.friends ?? []))
      .catch(() => {});
  }, [loadProfile]);

  useEffect(() => {
    const refreshProfile = (event: Event) => {
      const userId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
      if (!userId || userId === sessionData.user.id) loadProfile();
    };
    window.addEventListener('cashly:profile-updated', refreshProfile);
    window.addEventListener('focus', refreshProfile);
    return () => {
      window.removeEventListener('cashly:profile-updated', refreshProfile);
      window.removeEventListener('focus', refreshProfile);
    };
  }, [loadProfile, sessionData.user.id]);

  const currentImage = profile?.image ?? sessionData.user.image;
  const currentName = profile?.name ?? sessionData.user.name;

  const winRate = profile?.stats?.gamesPlayed
    ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
    : 0;

  const saveName = async () => {
    if (!editName.trim() || editName.trim() === currentName) { setEditing(false); return; }
    setSaving(true);
    try {
      const res = await authFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ name: editName.trim() }) });
      if (!res.ok) { toast.error('Failed to save name'); return; }
      setProfile(prev => prev ? { ...prev, name: editName.trim() } : prev);
      onProfileUpdated?.(editName.trim(), currentImage);
      toast.success('Name updated!');
      setEditing(false);
    } catch { toast.error('Failed to save'); } finally { setSaving(false); }
  };

  const saveAvatar = async (url: string) => {
    try {
      const res = await authFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ image: url }) });
      if (!res.ok) { toast.error('Failed to update picture'); return; }
      setProfile(prev => prev ? { ...prev, image: url } : prev);
      onProfileUpdated?.(currentName, url);
      toast.success('Profile picture updated!');
    } catch { toast.error('Failed to update picture'); }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#13131a] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-slate-500 hover:text-red-400 transition-colors text-sm font-medium"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        <div className="max-w-3xl mx-auto px-5 py-8 space-y-8">

          {/* ── Profile header ──────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <button
              onClick={() => setPickerOpen(true)}
              className="relative shrink-0 group/avatar"
              aria-label="Change profile picture"
            >
              {currentImage ? (
                <img src={currentImage} className="h-[90px] w-[90px] rounded-full object-cover border-4 border-slate-700/60 group-hover/avatar:border-indigo-500/60 transition-colors" alt="" />
              ) : (
                <div className="h-[90px] w-[90px] rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-3xl border-4 border-slate-700/60 group-hover/avatar:border-indigo-500/60 transition-colors">
                  {currentName?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
              <div className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-indigo-600 border-2 border-[#13131a] flex items-center justify-center group-hover/avatar:bg-indigo-500 transition-colors">
                <Pencil className="h-3 w-3 text-white" />
              </div>
            </button>

            {/* Name + email */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              {editing ? (
                <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
                    maxLength={40}
                    className="bg-slate-800 border border-indigo-500 rounded-lg px-3 py-1 text-2xl font-black text-white focus:outline-none w-full max-w-xs"
                  />
                  <button onClick={saveName} disabled={saving} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors shrink-0">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setEditing(false)} className="p-1.5 text-slate-500 hover:text-white rounded-lg shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1 group/name justify-center sm:justify-start">
                  <h1 className="text-2xl font-black text-white">{currentName}</h1>
                  <button
                    onClick={() => { setEditName(currentName); setEditing(true); }}
                    className="opacity-0 group-hover/name:opacity-100 p-1 text-slate-500 hover:text-indigo-400 rounded-md transition-all"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
              <p className="text-sm text-slate-500 mb-3">{sessionData.user.email}</p>
            </div>

            {/* Right: key stats */}
            {profile && (
              <div className="flex sm:flex-col gap-5 sm:gap-3 text-center sm:text-right shrink-0">
                <div>
                  <div className="flex items-center gap-1.5 justify-center sm:justify-end">
                    <Star className="h-4 w-4 text-amber-400" />
                    <span className="text-xl font-black text-white">{profile.coins.toLocaleString()}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Coins</p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 justify-center sm:justify-end">
                    <Trophy className="h-4 w-4 text-indigo-400" />
                    <span className="text-xl font-black text-white">{winRate}%</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wide">Win Rate</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Statistics ─────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-black text-white mb-4">Statistics</h2>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-slate-600" /></div>
            ) : profile ? (
              <div className="bg-[#1a1a24] border border-white/5 rounded-2xl divide-y divide-white/5">
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <Gamepad2 className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-300">Played <span className="font-bold text-white">{profile.stats.gamesPlayed}</span> games</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <Trophy className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-300">Won <span className="font-bold text-white">{profile.stats.gamesWon}</span> games</span>
                </div>
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-300">Joined <span className="font-bold text-white">{timeAgo(profile.createdAt)}</span></span>
                </div>
                <div className="flex items-center gap-3 px-5 py-3.5">
                  <Users className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-300">Has <span className="font-bold text-white">{profile.friendCount}</span> {profile.friendCount === 1 ? 'friend' : 'friends'}</span>
                </div>
                {profile.stats.gamesPlayed > 0 && (
                  <>
                    <div className="flex items-center gap-3 px-5 py-3.5">
                      <Coins className="h-4 w-4 text-slate-500 shrink-0" />
                      <span className="text-sm text-slate-300">Earned <span className="font-bold text-white">${(profile.stats.totalEarnings ?? 0).toLocaleString()}</span> total in-game</span>
                    </div>
                    <div className="px-5 py-3.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2 font-medium">
                        <span>Win rate</span>
                        <span className="text-white font-bold">{winRate}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                          initial={{ width: 0 }}
                          animate={{ width: `${winRate}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-slate-600 text-sm text-center py-6">Could not load statistics</p>
            )}
          </section>

          {/* ── Inventory ──────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-black text-white mb-4">Inventory</h2>
            <div className="bg-[#1a1a24] border border-white/5 rounded-2xl px-5 py-10 flex flex-col items-center gap-2">
              <Package className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-600">No items owned</p>
            </div>
          </section>

          {/* ── Friends ────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-black text-white">Friends</h2>
              {friends.length > 0 && (
                <button onClick={onOpenFriends} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                  Manage →
                </button>
              )}
            </div>
            {friends.length === 0 ? (
              <div className="bg-[#1a1a24] border border-white/5 rounded-2xl px-5 py-10 flex flex-col items-center gap-2">
                <Users className="h-8 w-8 text-slate-700" />
                <p className="text-sm text-slate-600">No friends yet</p>
                <button onClick={onOpenFriends} className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                  Find friends →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {friends.map(f => (
                  <div key={f.id} className="bg-[#1a1a24] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                    <FriendAvatar image={f.image} name={f.name} size={38} />
                    <span className="text-sm font-bold text-white truncate">{f.name}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Last games ─────────────────────────────────────── */}
          <section>
            <h2 className="text-base font-black text-white mb-1">Last games</h2>
            <p className="text-xs text-slate-600 mb-4">Game history tracking coming soon</p>
            <div className="bg-[#1a1a24] border border-white/5 rounded-2xl px-5 py-10 flex flex-col items-center gap-2">
              <Clock className="h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-600">No game history available yet</p>
            </div>
          </section>

          {/* Back button */}
          <div className="pb-4">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Back to lobby
            </button>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <AvatarPickerModal
          currentImage={currentImage}
          onSelect={saveAvatar}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
