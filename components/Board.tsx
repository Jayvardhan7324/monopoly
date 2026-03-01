
import React, { useRef, useEffect, useState } from 'react';
import { GameState } from '../types';
import { Tile } from './Tile';

interface BoardProps {
  gameState: GameState;
  onTileClick: (id: number) => void;
  children?: React.ReactNode;
}

export const Board: React.FC<BoardProps> = ({ gameState, onTileClick, children }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [edgeRatio, setEdgeRatio] = useState(1.5);
  const [cornerRatio, setCornerRatio] = useState(2);
  const [tileGap, setTileGap] = useState(1.5);
  const [barHeight, setBarHeight] = useState(24);
  const [fontSize, setFontSize] = useState(8);
  const [boardPadding, setBoardPadding] = useState(1.5);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Base size is 600px
        const newScale = Math.max(0.1, entry.contentRect.width / 600);
        setScale(newScale);
      }
    });

    if (boardRef.current) {
      observer.observe(boardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getGridStyle = (index: number) => {
    if (index >= 0 && index <= 10) return { gridRow: 1, gridColumn: index + 1 };
    if (index >= 11 && index <= 19) return { gridRow: index - 10 + 1, gridColumn: 11 };
    if (index >= 20 && index <= 30) return { gridRow: 11, gridColumn: 11 - (index - 20) };
    if (index >= 31 && index <= 39) return { gridRow: 11 - (index - 30), gridColumn: 1 };
    return {};
  };

  return (
    <div 
      ref={boardRef}
      className="relative w-full max-w-[100vw] sm:max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-auto group-data-[layout=row]:h-full aspect-square p-2 bg-[#0c121d] rounded-2xl shadow-[0_50px_100px_rgba(0,0,0,0.9)] border border-white/5 mx-auto @container"
      style={{ 
        '--board-scale': scale,
        '--tile-gap': `${tileGap}px`,
        '--bar-height': `${barHeight}px`,
        '--font-size': `${fontSize}px`,
        '--board-padding': `${boardPadding}px`
      } as React.CSSProperties}
    >
      <div 
        className="w-full h-full grid bg-[#1a212e] rounded-lg overflow-hidden border border-slate-800 shadow-inner"
        style={{
          gap: 'var(--tile-gap)',
          padding: 'var(--board-padding)',
          gridTemplateColumns: `minmax(0, ${cornerRatio}fr) repeat(9, minmax(0, ${edgeRatio}fr)) minmax(0, ${cornerRatio}fr)`,
          gridTemplateRows: `minmax(0, ${cornerRatio}fr) repeat(9, minmax(0, ${edgeRatio}fr)) minmax(0, ${cornerRatio}fr)`
        }}
      >
        {/* Central Area for Controls/HUD */}
        <div className="col-start-2 col-end-11 row-start-2 row-end-11 bg-[#121721] relative flex flex-col overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2a303c_0%,_transparent_80%)] opacity-20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
            
            {/* Temporary Parameter Sliders */}
            <div className="absolute top-4 right-4 z-[100] bg-black/90 p-3 rounded-lg border border-white/10 flex flex-col gap-2 text-[9px] text-white backdrop-blur-md max-h-[80%] overflow-y-auto w-48 shadow-2xl">
              <div className="font-bold uppercase tracking-wider text-indigo-400 mb-1 border-b border-white/10 pb-1 flex justify-between items-center">
                <span>Board Tuning</span>
                <span className="text-[8px] opacity-50">v2</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Edge Ratio:</span>
                    <span className="font-mono text-indigo-300">{edgeRatio.toFixed(2)}</span>
                  </div>
                  <input type="range" min="0.5" max="3" step="0.05" value={edgeRatio} onChange={(e) => setEdgeRatio(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Corner Ratio:</span>
                    <span className="font-mono text-indigo-300">{cornerRatio.toFixed(2)}</span>
                  </div>
                  <input type="range" min="1" max="5" step="0.1" value={cornerRatio} onChange={(e) => setCornerRatio(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Tile Gap:</span>
                    <span className="font-mono text-indigo-300">{tileGap.toFixed(1)}px</span>
                  </div>
                  <input type="range" min="0" max="10" step="0.5" value={tileGap} onChange={(e) => setTileGap(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Board Padding:</span>
                    <span className="font-mono text-indigo-300">{boardPadding.toFixed(1)}px</span>
                  </div>
                  <input type="range" min="0" max="20" step="0.5" value={boardPadding} onChange={(e) => setBoardPadding(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Bar Height:</span>
                    <span className="font-mono text-indigo-300">{barHeight}px</span>
                  </div>
                  <input type="range" min="10" max="60" step="1" value={barHeight} onChange={(e) => setBarHeight(parseInt(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span>Font Size:</span>
                    <span className="font-mono text-indigo-300">{fontSize}px</span>
                  </div>
                  <input type="range" min="4" max="16" step="0.5" value={fontSize} onChange={(e) => setFontSize(parseFloat(e.target.value))} className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-white/10 text-[7px] text-slate-400 font-mono">
                E:{edgeRatio} C:{cornerRatio} G:{tileGap} P:{boardPadding} B:{barHeight} F:{fontSize}
              </div>
            </div>

            <div className="relative z-10 w-full h-full flex flex-col p-4">
                {children}
            </div>
        </div>

        {/* Tiles */}
        {gameState.tiles.map((tile) => {
          const playersHere = gameState.players.filter(p => p.position === tile.id);
          const currentPlayer = gameState.players[gameState.currentPlayerIndex];
          const isOwned = currentPlayer ? tile.ownerId === currentPlayer.id : false;
          
          // Check for monopoly
          let isMonopoly = false;
          if (tile.ownerId !== null && tile.type === 'PROPERTY') {
              const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
              isMonopoly = groupTiles.every(t => t.ownerId === tile.ownerId);
          }

          return (
            <div key={tile.id} style={getGridStyle(tile.id)} className="w-full h-full">
                <Tile 
                  tile={tile} 
                  players={playersHere} 
                  onClick={() => onTileClick(tile.id)}
                  isCurrent={currentPlayer?.position === tile.id}
                  isOwned={isOwned}
                  isMonopoly={isMonopoly}
                  taxPool={tile.name === 'Vacation' ? gameState.taxPool : undefined}
                />
            </div>
          );
        })}
      </div>
    </div>
  );
};
