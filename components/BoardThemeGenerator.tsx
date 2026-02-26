import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Image, Sparkles, Loader2, Check, AlertCircle, Settings2 } from 'lucide-react';
import { Tile } from '../types';

interface BoardThemeGeneratorProps {
  tiles: Tile[];
  onImagesGenerated: (images: Record<number, string>) => void;
}

type ImageSize = '1K' | '2K' | '4K';

export const BoardThemeGenerator: React.FC<BoardThemeGeneratorProps> = ({ tiles, onImagesGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<ImageSize>('1K');
  const [showSettings, setShowSettings] = useState(false);

  const checkApiKey = async () => {
    // @ts-ignore
    if (!(await window.aistudio.hasSelectedApiKey())) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      return false;
    }
    return true;
  };

  const generateTheme = async () => {
    setError(null);
    const hasKey = await checkApiKey();
    if (!hasKey) return;

    setIsGenerating(true);
    setProgress(0);

    const propertyTiles = tiles.filter(t => t.price > 0);
    const generatedImages: Record<number, string> = {};
    
    try {
      for (let i = 0; i < propertyTiles.length; i++) {
        const tile = propertyTiles[i];
        
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: {
              parts: [
                {
                  text: `A high-quality, cinematic, architectural or landscape photograph of ${tile.name}, representing a property in a luxury board game. Style: Vibrant, professional photography, 8k resolution.`,
                },
              ],
            },
            config: {
              imageConfig: {
                aspectRatio: "1:1",
                imageSize: imageSize
              },
            },
          });

          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              const base64EncodeString = part.inlineData.data;
              generatedImages[tile.id] = `data:image/png;base64,${base64EncodeString}`;
              break;
            }
          }
        } catch (err: any) {
          console.error(`Failed to generate image for ${tile.name}:`, err);
          if (err.message?.includes("Requested entity was not found")) {
            // @ts-ignore
            await window.aistudio.openSelectKey();
            throw new Error("API Key issue. Please re-select your key.");
          }
        }

        setProgress(Math.round(((i + 1) / propertyTiles.length) * 100));
      }

      onImagesGenerated(generatedImages);
    } catch (err: any) {
      setError(err.message || "Failed to generate theme. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">AI Theme Generator</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Powered by Gemini 3 Pro</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
            title="Settings"
          >
            <Settings2 size={18} />
          </button>
          
          <button
            onClick={generateTheme}
            disabled={isGenerating}
            className={`
              px-4 py-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2
              ${isGenerating 
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-95'}
            `}
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating {progress}%
              </>
            ) : (
              <>
                <Image size={14} />
                Generate Assets
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 bg-slate-900/50 border border-white/5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Image Resolution</span>
                <div className="flex bg-slate-950 p-1 rounded-lg border border-white/5">
                  {(['1K', '2K', '4K'] as ImageSize[]).map(size => (
                    <button
                      key={size}
                      onClick={() => setImageSize(size)}
                      className={`
                        px-3 py-1 rounded-md text-[10px] font-black transition-all
                        ${imageSize === size ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}
                      `}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[9px] text-slate-500 italic">Higher resolutions take longer to generate and require more credits.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-3 text-rose-400"
        >
          <AlertCircle size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">{error}</span>
        </motion.div>
      )}

      {progress === 100 && !isGenerating && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400"
        >
          <Check size={16} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Theme generated successfully!</span>
        </motion.div>
      )}
    </div>
  );
};
