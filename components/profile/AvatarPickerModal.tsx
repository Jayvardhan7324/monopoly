import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';

const AVATARS = [
  { id: 'cat',      emoji: '🐱', bg: '#4338ca' },
  { id: 'dog',      emoji: '🐶', bg: '#7c3aed' },
  { id: 'fox',      emoji: '🦊', bg: '#b45309' },
  { id: 'wolf',     emoji: '🐺', bg: '#475569' },
  { id: 'rabbit',   emoji: '🐰', bg: '#be185d' },
  { id: 'bear',     emoji: '🐻', bg: '#78350f' },
  { id: 'panda',    emoji: '🐼', bg: '#1e293b' },
  { id: 'lion',     emoji: '🦁', bg: '#b45309' },
  { id: 'tiger',    emoji: '🐯', bg: '#c2410c' },
  { id: 'frog',     emoji: '🐸', bg: '#15803d' },
  { id: 'penguin',  emoji: '🐧', bg: '#0e7490' },
  { id: 'unicorn',  emoji: '🦄', bg: '#9333ea' },
  { id: 'cow',      emoji: '🐮', bg: '#0f766e' },
  { id: 'pig',      emoji: '🐷', bg: '#db2777' },
  { id: 'raccoon',  emoji: '🦝', bg: '#64748b' },
  { id: 'koala',    emoji: '🐨', bg: '#334155' },
  { id: 'octopus',  emoji: '🐙', bg: '#6d28d9' },
  { id: 'butterfly',emoji: '🦋', bg: '#0369a1' },
  { id: 'dolphin',  emoji: '🐬', bg: '#0891b2' },
  { id: 'crab',     emoji: '🦀', bg: '#b91c1c' },
];

export function emojiAvatarUrl(emoji: string, bg: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='50' fill='${bg}'/><text x='50' y='72' font-size='56' text-anchor='middle' dominant-baseline='auto'>${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface Props {
  currentImage?: string;
  onSelect: (url: string) => void;
  onClose: () => void;
}

const AvatarPickerModal: React.FC<Props> = ({ currentImage, onSelect, onClose }) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSave = () => {
    if (!selected) return;
    const av = AVATARS.find(a => a.id === selected);
    if (!av) return;
    onSelect(emojiAvatarUrl(av.emoji, av.bg));
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ scale: 0.95, y: 12 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 12 }}
          className="bg-[#1a1a24] border border-slate-700/60 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-black text-white text-base">Change profile picture</h3>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2.5 mb-5">
            {AVATARS.map(av => {
              const isSelected = selected === av.id;
              return (
                <button
                  key={av.id}
                  onClick={() => setSelected(av.id)}
                  className={`relative aspect-square rounded-full overflow-hidden transition-all hover:scale-110 ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#1a1a24] scale-105' : ''}`}
                >
                  <img
                    src={emojiAvatarUrl(av.emoji, av.bg)}
                    className="w-full h-full object-cover"
                    alt={av.id}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-indigo-500/30 flex items-center justify-center">
                      <Check size={14} className="text-white drop-shadow" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSave}
            disabled={!selected}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Check size={15} /> Save changes
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AvatarPickerModal;
