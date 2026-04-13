import React, { useEffect, useState } from 'react';
import { ArrowLeft, UserCog, Ban, ExternalLink, Sparkles, Mail } from 'lucide-react';
import { supabase } from '../../lib/auth-client';

interface Props {
  sessionData: { user: { id: string; name: string; email: string; image?: string } };
  onClose: () => void;
  onOpenProfile: () => void;
}

interface Identity { provider: string; }

function ProviderIcon({ provider }: { provider: string }) {
  if (provider === 'google') return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
  if (provider === 'github') return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
  if (provider === 'discord') return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="#5865F2">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.015.04.037.05a19.909 19.909 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
    </svg>
  );
  if (provider === 'email') return <Mail className="h-5 w-5 shrink-0 text-slate-400" />;
  return <div className="h-5 w-5 shrink-0 rounded-full bg-slate-600 flex items-center justify-center text-[10px] font-black text-white">{provider[0]?.toUpperCase()}</div>;
}

const SettingsPage: React.FC<Props> = ({ sessionData, onClose, onOpenProfile }) => {
  const [identities, setIdentities] = useState<Identity[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const raw = (data?.user?.identities ?? []) as any[];
      setIdentities(raw.map(i => ({ provider: i.provider ?? 'email' })));
    });
  }, []);

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

          {/* Linked accounts — real data from Supabase auth */}
          <div className="bg-[#1a1a24] border border-white/5 rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/5">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Linked accounts</p>
            </div>

            {identities.length === 0 ? (
              <div className="px-6 py-4 text-sm text-slate-600">No linked accounts found.</div>
            ) : (
              identities.map(identity => (
                <div key={identity.provider} className="flex items-center justify-between px-6 py-4 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <ProviderIcon provider={identity.provider} />
                    <div>
                      <p className="text-sm font-bold text-white capitalize">{identity.provider}</p>
                      <p className="text-xs text-slate-500">As: {sessionData.user.name}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1">
                    Connected
                  </span>
                </div>
              ))
            )}
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
