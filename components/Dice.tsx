import React, { useEffect, useState } from 'react';

interface DiceProps {
  value: number;
  isRolling: boolean;
  size?: number;
}

export const Dice: React.FC<DiceProps> = ({ value, isRolling, size = 72 }) => {
  const [transform, setTransform] = useState('');

  useEffect(() => {
    if (isRolling) {
      setTransform('');
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
          transformOrigin: 'center',
        }}
      >
        <div
          className={`dice ${isRolling ? 'rolling' : ''}`}
          style={{ transform: !isRolling ? transform : undefined }}
        >
          {/* Inner sphere — fills the rounded corners so no black shows through */}
          <div className="dice-inner-sphere" />

          <div className="dice-face front">
            <span className="dice-dot center" />
          </div>
          <div className="dice-face up">
            <span className="dice-dot top-left" />
            <span className="dice-dot bottom-right" />
          </div>
          <div className="dice-face left">
            <span className="dice-dot top-left" />
            <span className="dice-dot top-right" />
            <span className="dice-dot bottom-left" />
            <span className="dice-dot bottom-right" />
          </div>
          <div className="dice-face right">
            <span className="dice-dot top-left" />
            <span className="dice-dot center" />
            <span className="dice-dot bottom-right" />
          </div>
          <div className="dice-face bottom">
            <span className="dice-dot top-left" />
            <span className="dice-dot top-right" />
            <span className="dice-dot center" />
            <span className="dice-dot bottom-left" />
            <span className="dice-dot bottom-right" />
          </div>
          <div className="dice-face back">
            <span className="dice-dot top-left" />
            <span className="dice-dot top-right" />
            <span className="dice-dot middle-left" />
            <span className="dice-dot middle-right" />
            <span className="dice-dot bottom-left" />
            <span className="dice-dot bottom-right" />
          </div>
        </div>
      </div>
    </div>
  );
};