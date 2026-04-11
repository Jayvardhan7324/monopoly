import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ColorGroup, Tile } from '../types';

interface SetCompleteAnimationProps {
  group: ColorGroup;
  tiles: Tile[];
  ownerName: string;
  ownerColor: string;
  onDone: () => void;
}

const groupColorMap: Record<ColorGroup, { bg: string; border: string; text: string }> = {
  [ColorGroup.BROWN]:     { bg: '#78350f', border: '#92400e', text: '#fcd34d' },
  [ColorGroup.LIGHT_BLUE]:{ bg: '#0e7490', border: '#0891b2', text: '#e0f2fe' },
  [ColorGroup.PINK]:      { bg: '#a21caf', border: '#c026d3', text: '#fce7f3' },
  [ColorGroup.ORANGE]:    { bg: '#c2410c', border: '#ea580c', text: '#fff7ed' },
  [ColorGroup.RED]:       { bg: '#b91c1c', border: '#dc2626', text: '#fee2e2' },
  [ColorGroup.YELLOW]:    { bg: '#a16207', border: '#ca8a04', text: '#fef9c3' },
  [ColorGroup.GREEN]:     { bg: '#15803d', border: '#16a34a', text: '#dcfce7' },
  [ColorGroup.DARK_BLUE]: { bg: '#1d4ed8', border: '#2563eb', text: '#eff6ff' },
  [ColorGroup.NONE]:      { bg: '#374151', border: '#4b5563', text: '#f9fafb' },
};

export const SetCompleteAnimation: React.FC<SetCompleteAnimationProps> = ({
  group, tiles, ownerName, ownerColor, onDone,
}) => {
  const colors = groupColorMap[group];
  const groupLabel = group.replace('_', ' ');

  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <AnimatePresence>
      <motion.div
        key="set-complete-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
      >
        {/* Dark vignette */}
        <div className="absolute inset-0 bg-black/40" />

        <motion.div
          initial={{ scale: 0.7, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          className="relative flex flex-col items-center gap-4 px-8 py-6 rounded-2xl border-2 shadow-2xl"
          style={{ background: colors.bg, borderColor: colors.border, maxWidth: 380 }}
        >
          {/* Glow ring */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{ boxShadow: [`0 0 30px ${colors.border}88`, `0 0 60px ${colors.border}cc`, `0 0 30px ${colors.border}88`] }}
            transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
          />

          {/* Player dot */}
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border-2 border-white/50" style={{ background: ownerColor }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: colors.text, opacity: 0.8 }}>
              {ownerName}
            </span>
          </div>

          {/* Headline */}
          <motion.div
            className="text-center"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
          >
            <div className="text-3xl font-black uppercase tracking-tight leading-none" style={{ color: colors.text }}>
              {groupLabel}
            </div>
            <div className="text-sm font-black uppercase tracking-[0.3em] mt-1" style={{ color: colors.text, opacity: 0.75 }}>
              Monopoly!
            </div>
          </motion.div>

          {/* Tile name chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {tiles.map((tile, i) => (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.1 }}
                className="px-3 py-1 rounded-full text-xs font-bold border"
                style={{ background: `${colors.border}55`, borderColor: colors.border, color: colors.text }}
              >
                {tile.name}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
