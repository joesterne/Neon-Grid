import React from 'react';
import { motion } from 'motion/react';
import { ACHIEVEMENTS } from '../lib/achievements';
import * as Icons from 'lucide-react';
import { useAuth } from './FirebaseProvider';

const AchievementsDisplay: React.FC = () => {
  const { profile } = useAuth();
  const unlockedIds = profile?.achievements || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {ACHIEVEMENTS.map((achievement) => {
        const isUnlocked = unlockedIds.includes(achievement.id);
        const IconComponent = (Icons as any)[achievement.icon] || Icons.Award;

        return (
          <motion.div
            key={achievement.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel p-4 border flex items-start gap-4 transition-all ${
              isUnlocked 
                ? 'border-neon-blue/40 bg-neon-blue/5' 
                : 'border-white/5 bg-black/40 opacity-40'
            }`}
          >
            <div className={`p-3 rounded-sm border ${
              isUnlocked 
                ? 'border-neon-blue text-neon-blue shadow-[0_0_15px_rgba(0,210,255,0.3)]' 
                : 'border-white/10 text-white/20'
            }`}>
              <IconComponent size={24} strokeWidth={isUnlocked ? 2.5 : 1} />
            </div>
            
            <div className="space-y-1 flex-1 min-w-0 pt-0.5">
              <div className="flex items-start gap-2 flex-wrap">
                <span className={`font-mono text-xs uppercase tracking-widest break-all whitespace-normal ${
                  isUnlocked ? 'text-white' : 'text-white/40'
                }`}>
                  {achievement.title}
                </span>
                {isUnlocked && (
                  <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-bold shrink-0 mt-0.5 ${
                    achievement.rarity === 'legendary' ? 'border-yellow-500 text-yellow-500' :
                    achievement.rarity === 'epic' ? 'border-neon-magenta text-neon-magenta' :
                    achievement.rarity === 'rare' ? 'border-neon-blue text-neon-blue' :
                    'border-white/20 text-white/60'
                  }`}>
                    {achievement.rarity.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="font-mono text-[9px] text-white/40 leading-tight uppercase break-all whitespace-normal">
                {isUnlocked ? achievement.description : '??_LOCKED_PROTOCOL_??'}
              </p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default AchievementsDisplay;
