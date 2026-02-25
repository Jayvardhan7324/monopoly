
import React, { useState } from 'react';
import { GameState } from '../types';
import { getAIAdvice } from '../services/geminiService';
import { Sparkles, Bot } from 'lucide-react';

export const AIAdvisor: React.FC<{ gameState: GameState }> = ({ gameState }) => {
  const [advice, setAdvice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    setLoading(true);
    const result = await getAIAdvice(gameState);
    setAdvice(result);
    setLoading(false);
  };

  return (
    <div className="h-full bg-slate-900/80 backdrop-blur-md rounded-xl p-4 flex flex-col border border-indigo-500/30 shadow-lg relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
        
        <div className="flex justify-between items-center mb-3 relative z-10">
            <h3 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles size={14} className="text-indigo-400" /> Strategist
            </h3>
            <button 
                onClick={handleAsk}
                disabled={loading || gameState.currentPlayerIndex !== 0}
                className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-full shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold tracking-wide"
            >
                {loading ? 'Thinking...' : 'ANALYZE'}
            </button>
        </div>
        
        <div className="flex-1 bg-black/40 rounded-lg p-3 overflow-y-auto text-xs text-indigo-100/80 leading-relaxed shadow-inner scrollbar-thin relative border border-white/5">
            {advice ? (
                <div className="animate-fade-in">
                    <p className="italic">"{advice}"</p>
                </div>
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-400/30 text-center p-2">
                    <Bot size={24} className="mb-2 opacity-50"/>
                    <span className="text-[10px]">AI Strategic Advice</span>
                </div>
            )}
        </div>
    </div>
  );
};
