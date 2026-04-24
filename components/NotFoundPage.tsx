import React from 'react';
import { motion } from 'motion/react';
import { Home, Dices } from 'lucide-react';

interface Props {
  onGoHome: () => void;
}

export default function NotFoundPage({ onGoHome }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden relative">
      {/* background glow */}
      <div className="pointer-events-none fixed left-1/2 top-0 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-indigo-500/30 via-violet-500/15 to-transparent blur-3xl rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
      >
        {/* dice icon */}
        <motion.div
          animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5, ease: 'easeInOut' }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40"
        >
          <Dices className="w-10 h-10 text-white" />
        </motion.div>

        {/* big 404 */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-8xl font-black text-white/10 select-none leading-none tracking-tighter">
            404
          </span>
          <h1 className="text-2xl font-bold text-white -mt-3">
            Landed on the wrong square
          </h1>
          <p className="text-slate-400 text-sm max-w-xs mt-1">
            This page doesn't exist. Roll back to home and try again.
          </p>
        </div>

        {/* go home button */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all duration-150 text-white font-semibold shadow-lg shadow-indigo-500/30"
        >
          <Home className="w-4 h-4" />
          Back to home
        </button>
      </motion.div>
    </div>
  );
}
