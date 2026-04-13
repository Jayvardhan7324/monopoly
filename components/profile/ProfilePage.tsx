import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Trophy, Coins, LogOut, Calendar, Gamepad2, TrendingUp,
  Building2, Loader2, Pencil, Check, AlertCircle, Skull,
  X, ArrowLeft, Users, Star, Target, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase, authFetch } from '../../lib/auth-client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';

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

const StatCard: React.FC<{
  icon: React.ElementType; label: string; value: string | number;
  color: string; bg: string; border: string;
}> = ({ icon: Icon, label, value, color, bg, border }) => (
  <Card className={`${bg} ${border} border rounded-2xl`}>
    <CardContent className="p-4 flex flex-col gap-1.5">
      <div className={`w-8 h-8 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <p className="text-[11px] text-slate-500 font-semibold leading-tight mt-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </CardContent>
  </Card>
);

const ProfilePage: React.FC<Props> = ({ sessionData, onClose, onSignOut, onOpenFriends, onProfileUpdated }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(sessionData.user.name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
  const lossRate = profile?.stats?.gamesPlayed
    ? Math.round(((profile.stats.gamesLost ?? 0) / profile.stats.gamesPlayed) * 100)
    : 0;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${sessionData.user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) { toast.error('Upload failed: ' + error.message); return; }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl + `?t=${Date.now()}`;
      await authFetch('/api/profile', { method: 'PATCH', body: JSON.stringify({ image: publicUrl }) });
      setProfile(prev => prev ? { ...prev, image: publicUrl } : prev);
      onProfileUpdated?.(currentName, publicUrl);
      toast.success('Avatar updated!');
    } catch { toast.error('Upload failed'); } finally { setUploadingAvatar(false); }
  };

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

  const primaryStats = profile?.stats ? [
    { icon: Gamepad2,    label: 'Games Played',     value: profile.stats.gamesPlayed,    color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
    { icon: Trophy,      label: 'Wins',              value: profile.stats.gamesWon,       color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    { icon: AlertCircle, label: 'Losses',            value: profile.stats.gamesLost ?? 0, color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20' },
    { icon: Target,      label: 'Win Rate',          value: `${winRate}%`,                color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  ] : [];

  const secondaryStats = profile?.stats ? [
    { icon: Building2, label: 'Properties Bought', value: profile.stats.propertiesBought,       color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { icon: Star,      label: 'Peak Properties',   value: profile.stats.peakPropertiesOwned ?? 0, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    { icon: Skull,     label: 'Bankruptcies',      value: profile.stats.bankruptcies ?? 0,       color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    { icon: Zap,       label: 'Avg Turns / Game',  value: avgTurns,                              color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  ] : [];

  return (
    <div className="w-full h-full flex flex-col bg-slate-950 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <span className="text-sm font-black text-white tracking-wide">PROFILE</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 text-xs gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign Out
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        {/* Hero */}
        <div className="relative px-6 py-8 border-b border-slate-800">
          <div
            className="absolute inset-0 opacity-30"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.25) 0%, transparent 70%)' }}
          />
          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div
              className="relative shrink-0 group cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              {currentImage ? (
                <img
                  src={currentImage}
                  className="h-24 w-24 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-lg shadow-indigo-500/10"
                  alt=""
                />
              ) : (
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-3xl shadow-lg shadow-indigo-500/20">
                  {currentName?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploadingAvatar
                  ? <Loader2 className="h-6 w-6 text-white animate-spin" />
                  : <div className="flex flex-col items-center gap-1"><Pencil className="h-5 w-5 text-white" /><span className="text-[10px] text-white/80 font-bold">Change</span></div>
                }
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 text-center sm:text-left">
              {/* Name */}
              {editing ? (
                <div className="flex items-center gap-2 mb-2">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }}
                    maxLength={40}
                    className="bg-slate-800 border border-indigo-500 rounded-xl px-3 py-1.5 text-xl font-black text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-xs"
                  />
                  <button onClick={saveName} disabled={saving} className="p-2 text-emerald-400 hover:bg-emerald-500/20 rounded-xl transition-colors shrink-0">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => setEditing(false)} className="p-2 text-slate-500 hover:text-white rounded-xl transition-colors shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center sm:justify-start mb-2 group/name">
                  <h1 className="text-2xl font-black text-white truncate">{currentName}</h1>
                  <button
                    onClick={() => { setEditName(currentName); setEditing(true); }}
                    className="opacity-0 group-hover/name:opacity-100 p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all shrink-0"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <p className="text-sm text-slate-400 mb-3">{sessionData.user.email}</p>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                {profile && (
                  <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 gap-1.5 px-3 py-1 text-xs font-bold">
                    <Coins className="h-3 w-3" />
                    {profile.coins.toLocaleString()} coins
                  </Badge>
                )}
                {profile?.createdAt && (
                  <Badge className="bg-slate-800 text-slate-400 border border-slate-700 gap-1.5 px-3 py-1 text-xs font-medium">
                    <Calendar className="h-3 w-3" />
                    Joined {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </Badge>
                )}
                {profile !== null && (
                  <button
                    onClick={onOpenFriends}
                    className="inline-flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all rounded-full px-3 py-1 text-xs font-bold"
                  >
                    <Users className="h-3 w-3" />
                    {profile?.friendCount ?? 0} {(profile?.friendCount ?? 0) === 1 ? 'friend' : 'friends'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-6">
          <Tabs defaultValue="stats">
            <TabsList className="bg-slate-900 border border-slate-800 rounded-xl mb-6 w-full sm:w-auto">
              <TabsTrigger value="stats" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg text-sm font-bold px-6">
                Stats
              </TabsTrigger>
              <TabsTrigger value="earnings" className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-lg text-sm font-bold px-6">
                Earnings
              </TabsTrigger>
            </TabsList>

            {/* Stats tab */}
            <TabsContent value="stats" className="mt-0 space-y-6">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
                </div>
              ) : !profile ? (
                <p className="text-slate-500 text-center py-12">Could not load profile data</p>
              ) : (
                <>
                  {/* Win rate progress bar */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-slate-300">Win Rate</span>
                      <span className="text-xl font-black text-green-400">{winRate}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${winRate}%` }}
                        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-slate-500 font-medium">
                      <span>{profile.stats.gamesWon} wins</span>
                      <span>{profile.stats.gamesPlayed} total games</span>
                    </div>
                  </div>

                  {/* Primary stats */}
                  <div>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Game Record</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {primaryStats.map(s => <StatCard key={s.label} {...s} />)}
                    </div>
                  </div>

                  {/* Secondary stats */}
                  <div>
                    <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Property &amp; Turns</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {secondaryStats.map(s => <StatCard key={s.label} {...s} />)}
                    </div>
                  </div>

                  {/* Loss rate bar */}
                  {profile.stats.gamesPlayed > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-slate-300">Loss Rate</span>
                        <span className="text-xl font-black text-red-400">{lossRate}%</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-red-600 to-rose-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${lossRate}%` }}
                          transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Earnings tab */}
            <TabsContent value="earnings" className="mt-0">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-slate-600" />
                </div>
              ) : !profile ? (
                <p className="text-slate-500 text-center py-12">Could not load data</p>
              ) : (
                <div className="space-y-4">
                  <Card className="bg-slate-900 border-slate-800 rounded-2xl">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                        <TrendingUp className="h-6 w-6 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total In-Game Earnings</p>
                        <p className="text-3xl font-black text-amber-300">
                          ${(profile.stats.totalEarnings ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900 border-slate-800 rounded-2xl">
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center">
                        <Coins className="h-6 w-6 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Cashly Coins Balance</p>
                        <p className="text-3xl font-black text-amber-300">
                          {profile.coins.toLocaleString()}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {profile.stats.gamesPlayed > 0 && (
                    <Card className="bg-slate-900 border-slate-800 rounded-2xl">
                      <CardContent className="p-6">
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-4">Per-Game Average</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[11px] text-slate-500 mb-1">Avg Earnings / Game</p>
                            <p className="text-xl font-black text-white">
                              ${Math.round((profile.stats.totalEarnings ?? 0) / profile.stats.gamesPlayed).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-500 mb-1">Avg Properties / Game</p>
                            <p className="text-xl font-black text-white">
                              {(profile.stats.propertiesBought / profile.stats.gamesPlayed).toFixed(1)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
