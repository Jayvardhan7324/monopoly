import React from 'react';
import { motion } from 'motion/react';
import { Home, Dices, MapPinned } from 'lucide-react';

interface Props {
  onGoHome: () => void;
}

export default function NotFoundPage({ onGoHome }: Props) {
  return (
    <div className="min-h-screen bg-[#0d1118] flex items-center justify-center overflow-hidden relative px-6">
      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 grid w-full max-w-4xl gap-8 md:grid-cols-[1fr_1.1fr] md:items-center"
      >
        <div className="mx-auto grid size-[260px] grid-cols-4 grid-rows-4 gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-3 shadow-2xl shadow-black/30 md:size-[320px]">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-lg border flex items-center justify-center ${
                i === 10
                  ? 'border-amber-300/60 bg-amber-300/15 text-amber-200'
                  : i % 5 === 0
                    ? 'border-indigo-400/40 bg-indigo-400/10 text-indigo-200'
                    : 'border-slate-800 bg-slate-900/70 text-slate-600'
              }`}
            >
              {i === 10 ? <MapPinned className="size-5" /> : i === 15 ? <Dices className="size-4" /> : null}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
          <span className="text-8xl font-black text-white/10 select-none leading-none tracking-tight">
            404
          </span>
          <h1 className="text-3xl font-black text-white sm:text-4xl">
            Landed on the wrong square
          </h1>
          <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
            That route is not on the board. Head back to the lobby, pick a room, and keep the game moving.
          </p>
          <button
            onClick={onGoHome}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95 transition-all duration-150 font-black shadow-lg shadow-amber-400/15"
          >
            <Home className="size-4" />
            Back to home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
