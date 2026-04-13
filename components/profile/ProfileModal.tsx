import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trophy, Coins, LogOut, Calendar, Gamepad2, TrendingUp, Building2, Loader2, Pencil, Check, AlertCircle, Skull } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../lib/auth-client';

interface Props {
  sessionData: { user: { id: string; name: string; email: string; image?: string } };
  onClose: () => void;
  onSignOut: () => void;
  onProfileUpdated?: (name: string, image?: string) => void;
}

interface ProfileData {
  id: string; name: string; email: string; image?: string;
  coins: number; createdAt: string;
  stats: {
    gamesPlayed: number; gamesWon: number; gamesLost: number;
    totalEarnings: number; propertiesBought: number;
    peakPropertiesOwned: number; bankruptcies: number; totalTurns: number;
  };
}

const ProfileModal: React.FC<Props> = ({ sessionData, onClose, onSignOut, onProfileUpdated }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(sessionData.user.name ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/profile/${sessionData.user.id}`, { credentials: 'include' })
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json(); })
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionData.user.id]);

  const currentImage = profile?.image ?? sessionData.user.image;
  const currentName = profile?.name ?? sessionData.user.name;

  const winRate = profile?.stats?.gamesPlayed
    ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
    : 0;
  const avgTurns = profile?.stats?.gamesPlayed
    ? Math.round((profile.stats.totalTurns ?? 0) / profile.stats.gamesPlayed)
    : 0;

  const statItems = profile?.stats ? [
    { icon: Gamepad2,   label: 'Games Played',    value: profile.stats.gamesPlayed,         color: 'text-blue-400',   bg: 'bg-blue-500/10' },
    { icon: Trophy,     label: 'Wins',             value: profile.stats.gamesWon,            color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { icon: AlertCircle,label: 'Losses',           value: profile.stats.gamesLost ?? 0,      color: 'text-red-400',    bg: 'bg-red-500/10' },
    { icon: TrendingUp, label: 'Win Rate',         value: `${winRate}%`,                     color: 'text-green-400',  bg: 'bg-green-500/10' },
    { icon: Building2,  label: 'Properties Bought',value: profile.stats.propertiesBought,    color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { icon: Building2,  label: 'Peak Properties',  value: profile.stats.peakPropertiesOwned ?? 0, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { icon: Skull,      label: 'Bankruptcies',     value: profile.stats.bankruptcies ?? 0,   color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { icon: TrendingUp, label: 'Avg Turns/Game',   value: avgTurns,                          color: 'text-cyan-400',   bg: 'bg-cyan-500/10' },
  ] : [];

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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ type: 'spring', damping: 28, stiffness: 350 }}
      className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors z-10"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600/25 to-purple-600/15 px-6 pt-6 pb-5 border-b border-slate-800">
        <div className="flex items-start gap-4">
          {/* Avatar — edit via Profile page */}
          <div className="relative shrink-0">
            {currentImage ? (
              <img src={currentImage} className="h-14 w-14 rounded-full border-2 border-indigo-500/50 object-cover" alt="" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">
                {currentName?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
          </div>

          {/* Name + email */}
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2 mt-0.5">
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
                  maxLength={40}
                  className="flex-1 bg-slate-800 border border-indigo-500 rounded-lg px-2 py-1 text-sm font-bold text-white focus:outline-none"
                />
                <button onClick={saveName} disabled={saving} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => setEditing(false)} className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/name">
                <h2 className="text-lg font-black text-white leading-tight truncate">{currentName}</h2>
                <button onClick={() => { setEditName(currentName); setEditing(true); }} className="opacity-0 group-hover/name:opacity-100 p-1 text-slate-500 hover:text-indigo-400 transition-all">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <p className="text-sm text-slate-400 truncate">{sessionData.user.email}</p>
            {profile && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Coins className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-sm font-bold text-amber-300">{profile.coins.toLocaleString()} coins</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : profile ? (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Game Stats</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {statItems.map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className={`${bg} border border-white/5 rounded-xl p-3 flex items-center gap-2.5`}>
                  <Icon className={`h-4 w-4 ${color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
                    <p className="font-bold text-white text-sm">{value}</p>
                  </div>
                </div>
              ))}
            </div>
            {profile.createdAt && (
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mb-4">
                <Calendar className="h-3 w-3" />
                Joined {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500 text-center py-4 mb-4">Could not load profile data</p>
        )}

        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 text-sm font-medium transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </motion.div>
  );
};

export default ProfileModal;
