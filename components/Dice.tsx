import React, { useEffect, useState } from 'react';

interface DiceProps {
  value: number;
  isRolling: boolean;
  size?: number;
}

const perFace = [
  [-0.1, 0.3, -1],    // 1
  [-0.1, 0.6, -0.4],  // 2
  [-0.85, -0.42, 0.73], // 3
  [-0.8, 0.3, -0.75], // 4
  [0.3, 0.45, 0.9],   // 5
  [-0.16, 0.6, 0.18]  // 6
];

export const Dice: React.FC<DiceProps> = ({ value, isRolling, size = 72 }) => {
  const [transform, setTransform] = useState('');

  useEffect(() => {
    if (isRolling) {
      setTransform(''); // Let animation handle it
    } else {
      switch (value) {
        case 1: setTransform('rotateX(0deg) rotateY(0deg)'); break;
        case 2: setTransform('rotateX(-90deg) rotateY(0deg)'); break;
        case 3: setTransform('rotateX(0deg) rotateY(-90deg)'); break;
        case 4: setTransform('rotateX(0deg) rotateY(90deg)'); break;
        case 5: setTransform('rotateX(90deg) rotateY(0deg)'); break;
        case 6: setTransform('rotateX(180deg) rotateY(0deg)'); break;
        default: setTransform('rotateX(0deg) rotateY(0deg)'); break;
      }
    }
  }, [value, isRolling]);

  const scale = size / 100;

  return (
    <div className="dice-wrap" style={{ width: size, height: size }}>
      <div 
        className="dice-scaler" 
        style={{ 
          width: 100, 
          height: 100, 
          transform: `scale(${scale})`, 
          transformOrigin: 'center' 
        }}
      >
        <div 
          className={`dice ${isRolling ? 'rolling' : ''}`}
          style={{ transform: !isRolling ? transform : undefined }}
        >
          <div className="dice-face front">
             <span className="dice-dot center"></span>
          </div>
          <div className="dice-face up">
             <span className="dice-dot top-left"></span>
             <span className="dice-dot bottom-right"></span>
          </div>
          <div className="dice-face left">
             <span className="dice-dot top-left"></span>
             <span className="dice-dot top-right"></span>
             <span className="dice-dot bottom-left"></span>
             <span className="dice-dot bottom-right"></span>
          </div>
          <div className="dice-face right">
             <span className="dice-dot top-left"></span>
             <span className="dice-dot center"></span>
             <span className="dice-dot bottom-right"></span>
          </div>
          <div className="dice-face bottom">
             <span className="dice-dot top-left"></span>
             <span className="dice-dot top-right"></span>
             <span className="dice-dot center"></span>
             <span className="dice-dot bottom-left"></span>
             <span className="dice-dot bottom-right"></span>
          </div>
          <div className="dice-face back">
             <span className="dice-dot top-left"></span>
             <span className="dice-dot top-right"></span>
             <span className="dice-dot middle-left"></span>
             <span className="dice-dot middle-right"></span>
             <span className="dice-dot bottom-left"></span>
             <span className="dice-dot bottom-right"></span>
          </div>
        </div>
      </div>
    </div>
  );
};
