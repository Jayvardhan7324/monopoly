import React from 'react';
import { ArrowLeft, UserCog, Ban, ExternalLink, Sparkles } from 'lucide-react';

interface Props {
  sessionData: { user: { id: string; name: string; email: string; image?: string } };
  onClose: () => void;
  onOpenProfile: () => void;
}

const SettingsPage: React.FC<Props> = ({ sessionData, onClose, onOpenProfile }) => {
  // Detect provider from email domain heuristic; Supabase stores it in user_metadata
  const provider = 'Google';

  return (
    <div className="w-full h-full flex flex-col bg-[#13131a] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center px-5 py-3.5 border-b border-white/5 shrink-0">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
        <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">
          <h1 className="text-2xl font-black text-white">Settings</h1>

          {/* My User */}
          <div className="bg-[#1a1a24] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">My User</p>
            </div>

            {/* Username & profile picture row */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <div className="flex items-start gap-3">
                <UserCog className="h-5 w-5 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Username &amp; profile picture</p>
                  <p className="text-xs text-slate-500 mt-0.5">Change how others see you</p>
                </div>
              </div>
              <button
                onClick={() => { onClose(); onOpenProfile(); }}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 border border-indigo-500/30 hover:border-indigo-500/60 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 rounded-lg px-3 py-1.5 transition-all shrink-0"
              >
                <ExternalLink className="h-3 w-3" /> Edit in Your Profile
              </button>
            </div>

            {/* Blocked users row */}
            <div className="flex items-start justify-between px-6 py-4">
              <div className="flex items-start gap-3">
                <Ban className="h-5 w-5 text-slate-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-white">Blocked users</p>
                  <p className="text-xs text-slate-500 mt-0.5">Restrict interactions with other players</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-right max-w-[200px] leading-relaxed shrink-0">
                No blocked users.<br />
                <span className="text-slate-600">To block a user, go to their profile and click &quot;Block&quot;.</span>
              </p>
            </div>
          </div>

          {/* Linked accounts */}
          <div className="bg-[#1a1a24] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Linked accounts</p>
            </div>

            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-3">
                {/* Google logo */}
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <div>
                  <p className="text-sm font-bold text-white">{provider}</p>
                  <p className="text-xs text-slate-500">As: {sessionData.user.name}</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1">
                Connected
              </span>
            </div>
          </div>

          {/* Coming soon */}
          <div className="bg-[#1a1a24] border border-white/5 rounded-2xl px-6 py-5 flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-slate-600 shrink-0" />
            <p className="text-sm text-slate-600">Additional settings coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
