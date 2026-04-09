import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Trophy, Coins, LogOut, Calendar, Gamepad2, TrendingUp, Building2, Loader2 } from 'lucide-react';

interface Props {
  sessionData: { user: { id: string; name: string; email: string; image?: string } };
  onClose: () => void;
  onSignOut: () => void;
}

interface ProfileData {
  id: string; name: string; email: string; image?: string;
  coins: number; createdAt: string;
  stats: { gamesPlayed: number; gamesWon: number; totalEarnings: number; propertiesBought: number };
}

const ProfileModal: React.FC<Props> = ({ sessionData, onClose, onSignOut }) => {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/profile/${sessionData.user.id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { setProfile(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionData.user.id]);

  const winRate = profile?.stats.gamesPlayed
    ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
    : 0;

  const statItems = profile ? [
    { icon: Gamepad2, label: 'Games Played', value: profile.stats.gamesPlayed, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { icon: Trophy,   label: 'Wins',         value: profile.stats.gamesWon,     color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    { icon: TrendingUp, label: 'Win Rate',   value: `${winRate}%`,              color: 'text-green-400', bg: 'bg-green-500/10' },
    { icon: Building2,  label: 'Properties', value: profile.stats.propertiesBought, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ] : [];

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

      {/* Header with indigo gradient */}
      <div className="bg-gradient-to-br from-indigo-600/25 to-purple-600/15 px-6 pt-6 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-4">
          {sessionData.user.image ? (
            <img
              src={sessionData.user.image}
              className="h-14 w-14 rounded-full border-2 border-indigo-500/50 object-cover"
              alt=""
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shrink-0">
              {sessionData.user.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-black text-white leading-tight truncate">{sessionData.user.name}</h2>
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
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {statItems.map(({ icon: Icon, label, value, color, bg }) => (
                <div key={label} className={`${bg} border border-white/5 rounded-xl p-3 flex items-center gap-2.5`}>
                  <Icon className={`h-5 w-5 ${color} shrink-0`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500 leading-tight">{label}</p>
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
