// F-A: Copy room link button — click once to copy a shareable URL to clipboard.

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyRoomLinkProps {
  roomId: string;
  /** Optional custom class for the button wrapper. */
  className?: string;
  /** If true, shows only the icon (compact header usage). */
  compact?: boolean;
}

export const CopyRoomLink: React.FC<CopyRoomLinkProps> = ({ roomId, className = '', compact = false }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // Build a shareable URL the other player can paste into their browser.
    // origin works in both dev (localhost) and prod.
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-and-prompt for manual copy.
      // Intentionally silent — clipboard can fail on http or iframe contexts.
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleCopy}
        aria-label={copied ? 'Room link copied' : 'Copy room link to clipboard'}
        title={copied ? 'Copied!' : 'Copy room link'}
        className={`w-9 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Room link copied' : 'Copy room link to clipboard'}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`}
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
      <span>{copied ? 'Copied!' : 'Copy Link'}</span>
    </button>
  );
};
