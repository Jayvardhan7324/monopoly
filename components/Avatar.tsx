
import React from 'react';
import { 
  Skull, User, Bot, Ghost, Gamepad2, Zap, Smile, Lock,
  Cat, Dog, Bird, Rocket, Star, Heart, Coffee, Pizza, Music, Camera, Car
} from 'lucide-react';

interface AvatarProps {
  avatarId: string;
  color: string;
  className?: string;
  isBankrupt?: boolean;
  inJail?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({ avatarId, color, className = "w-6 h-6", isBankrupt, inJail }) => {
  const getAvatarIcon = () => {
    const props = { size: "60%", strokeWidth: 2.5, className: "text-white drop-shadow-md" };
    switch (avatarId) {
      case 'human': return <User {...props} />;
      case 'bot_0': return <Bot {...props} />;
      case 'bot_1': return <Ghost {...props} />;
      case 'bot_2': return <Gamepad2 {...props} />;
      case 'bot_3': return <Zap {...props} />;
      case 'cat': return <Cat {...props} />;
      case 'dog': return <Dog {...props} />;
      case 'bird': return <Bird {...props} />;
      case 'rocket': return <Rocket {...props} />;
      case 'star': return <Star {...props} />;
      case 'heart': return <Heart {...props} />;
      case 'coffee': return <Coffee {...props} />;
      case 'pizza': return <Pizza {...props} />;
      case 'music': return <Music {...props} />;
      case 'camera': return <Camera {...props} />;
      case 'car': return <Car {...props} />;
      default: return <Smile {...props} />;
    }
  };

  return (
    <div 
      className={`
        ${className} rounded-full border-2 shadow-lg flex items-center justify-center transition-all transform hover:scale-110 relative overflow-hidden
        ${isBankrupt ? 'grayscale opacity-60 bg-slate-900 border-slate-700' : 'border-white/20'}
      `}
      style={{ backgroundColor: isBankrupt ? undefined : color }}
    >
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/20 pointer-events-none" />
        
        {/* Main Icon */}
        {getAvatarIcon()}
        
        {/* Bankrupt Indicator */}
        {isBankrupt && (
            <>
                <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(0,0,0,0.2)_2px,rgba(0,0,0,0.2)_4px)] opacity-30"></div>
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-slate-800 rounded-full border border-white/50 flex items-center justify-center shadow-sm z-10">
                    <Skull size="70%" className="text-slate-400" strokeWidth={2.5} />
                </div>
            </>
        )}

        {/* Jail Indicator */}
        {inJail && !isBankrupt && (
            <>
                <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-rose-600 rounded-full border border-white flex items-center justify-center shadow-sm z-10">
                    <Lock size="70%" className="text-white" strokeWidth={3} />
                </div>
                <div className="absolute inset-0 bg-black/20 pointer-events-none">
                    <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_20%,rgba(0,0,0,0.3)_20%,rgba(0,0,0,0.3)_25%)] opacity-30"></div>
                </div>
            </>
        )}
    </div>
  );
};
