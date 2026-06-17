// F-D: Rules reference modal — shows rent tables, mortgage %, jail fees.
// Opens from any screen via a prop/state flag.

import React from 'react';
import { motion } from 'motion/react';
import { X, BookOpen } from 'lucide-react';
import { GAME_CONSTANTS } from '../constants';
import { useModalAccessibility } from '../hooks/useModalAccessibility';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  const modalRef = useModalAccessibility<HTMLDivElement>({ isOpen: true, onClose });

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <motion.div
        ref={modalRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-[#0f172a] border border-indigo-500/30 rounded-2xl w-full max-w-[420px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl outline-none"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-indigo-500/20 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 id="rules-modal-title" className="text-lg font-black text-white uppercase tracking-tight leading-tight">House Rules</h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Quick reference</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close rules"
            className="w-11 h-11 -m-1.5 rounded-full hover:bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          >
            <span className="inline-flex w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
              <X size={14} />
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          <Section title="Getting Started">
            <Row label="Starting cash" value="$1,500" />
            <Row label="Go bonus" value={`$${GAME_CONSTANTS.GO_BONUS}`} />
            <Row label="Board tiles" value="40" />
          </Section>

          <Section title="Jail">
            <Row label="Jail fine" value={`$${GAME_CONSTANTS.JAIL_FINE}`} />
            <Row label="Max jail turns" value={`${GAME_CONSTANTS.MAX_JAIL_TURNS}`} />
            <Row label="Doubles → jail" value={`${GAME_CONSTANTS.MAX_DOUBLES_BEFORE_JAIL} in a row`} />
            <Row label="Get Out of Jail Free" value="Hold / trade / use" />
          </Section>

          <Section title="Property">
            <Row label="Mortgage payout" value={`${GAME_CONSTANTS.MORTGAGE_RATE * 100}% of price`} />
            <Row label="Unmortgage cost" value={`${GAME_CONSTANTS.UNMORTGAGE_FEE * 100}% of mortgage`} />
            <Row label="Sell back to bank" value={`${GAME_CONSTANTS.SELL_RATE * 100}% of price`} />
            <Row label="Even-build" value="1 building max difference" />
          </Section>

          <Section title="Auction">
            <Row label="Timer" value={`${GAME_CONSTANTS.AUCTION_TIMER_SECONDS}s`} />
            <Row label="Min bid increment" value={`$${GAME_CONSTANTS.MIN_AUCTION_INCREMENT}`} />
            <Row label="Triggered when" value="Player declines to buy" />
          </Section>

          <Section title="Tax tiles">
            <Row label="Income Tax" value={`$${GAME_CONSTANTS.INCOME_TAX_AMOUNT}`} />
            <Row label="Luxury Tax" value={`$${GAME_CONSTANTS.LUXURY_TAX_AMOUNT}`} />
          </Section>

          <Section title="Rent multipliers">
            <Row label="Full color group" value="2× base (no buildings)" />
            <Row label="1 railroad owned" value="$25" />
            <Row label="4 railroads owned" value="$200" />
            <Row label="1 utility" value="4× dice roll" />
            <Row label="2 utilities" value="10× dice roll" />
          </Section>
        </div>
      </motion.div>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section role="region" aria-label={title} className="bg-slate-950/40 rounded-xl border border-slate-800 p-3">
    <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">{title}</h3>
    <div className="space-y-1">{children}</div>
  </section>
);

const Row: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between items-center text-[11px]">
    <span className="text-slate-400">{label}</span>
    <span className="font-mono font-bold text-white">{value}</span>
  </div>
);
