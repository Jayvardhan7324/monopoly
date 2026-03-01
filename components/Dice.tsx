import React from 'react';
import { motion } from 'motion/react';

interface DiceProps {
  value: number;
  isRolling: boolean;
  size?: number;
}

export const Dice: React.FC<DiceProps> = ({ value, isRolling, size = 64 }) => {
  const dotPositions = [
    [], // 0
    [4], // 1
    [0, 8], // 2
    [0, 4, 8], // 3
    [0, 2, 6, 8], // 4
    [0, 2, 4, 6, 8], // 5
    [0, 2, 3, 5, 6, 8], // 6
  ];

  const dots = dotPositions[value] || [];

  return (
    <motion.div
      animate={isRolling ? {
        rotate: [0, 90, 180, 270, 360],
        scale: [1, 1.1, 1],
      } : {}}
      transition={isRolling ? {
        duration: 0.5,
        repeat: Infinity,
        ease: "linear"
      } : {}}
      className="bg-white rounded-xl shadow-lg flex items-center justify-center relative border-2 border-slate-200"
      style={{ width: size, height: size }}
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-1 w-[70%] h-[70%]">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="flex items-center justify-center">
            {dots.includes(i) && (
              <div className="w-full h-full bg-slate-900 rounded-full" />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
