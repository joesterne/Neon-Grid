import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Clock, Swords, Database } from 'lucide-react';

interface Props {
  onBack: () => void;
}

type Metric = 'wins' | 'longestSurvivalTime' | 'totalGames';

const Leaderboard: React.FC<Props> = ({ onBack }) => {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [activeMetric, setActiveMetric] = useState<Metric>('wins');

  useEffect(() => {
    const q = query(
      collection(db, 'users'),
      orderBy(activeMetric, 'desc'),
      limit(15)
    );
    const unsub = onSnapshot(q, (snap) => {
      setLeaders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [activeMetric]);

  const getMetricLabel = (metric: Metric) => {
    switch (metric) {
      case 'wins': return 'COMBAT WINS';
      case 'longestSurvivalTime': return 'SURVIVAL (SEC)';
      case 'totalGames': return 'TOTAL OPS';
    }
  };

  const getMetricValue = (player: any, metric: Metric) => {
    switch (metric) {
      case 'wins': return player.wins || 0;
      case 'longestSurvivalTime': return player.longestSurvivalTime ? `${player.longestSurvivalTime}s` : '--';
      case 'totalGames': return player.totalGames || 0;
    }
  };

  return (
    <div className="h-full flex flex-col glass-panel p-8 relative">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[11px] uppercase tracking-[4px] text-white/50 font-sans flex items-center gap-2">
          <Database size={14} className="text-neon-blue" />
          Data Bank // Global Metrics
        </h2>
      </div>

      <div className="flex gap-4 mb-6 border-b border-white/10 pb-4">
        <TabButton 
          icon={<Trophy size={14} />} 
          label="Top Combatants" 
          active={activeMetric === 'wins'} 
          onClick={() => setActiveMetric('wins')} 
          color="magenta"
        />
        <TabButton 
          icon={<Clock size={14} />} 
          label="Survival Records" 
          active={activeMetric === 'longestSurvivalTime'} 
          onClick={() => setActiveMetric('longestSurvivalTime')} 
          color="yellow"
        />
        <TabButton 
          icon={<Swords size={14} />} 
          label="Most Active" 
          active={activeMetric === 'totalGames'} 
          onClick={() => setActiveMetric('totalGames')} 
          color="blue"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 pb-12">
        <div className="flex justify-between items-center px-4 py-2 mb-2 text-[9px] font-mono tracking-widest text-white/30 uppercase border-b border-white/5">
          <span>Rank // Program ID</span>
          <span>{getMetricLabel(activeMetric)}</span>
        </div>
        
        <AnimatePresence mode="popLayout">
          {leaders.map((player, index) => (
            <motion.div 
              key={`${player.id}-${activeMetric}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
              className={`flex items-center justify-between py-3 px-4 mb-2 group ${index === 0 ? 'bg-white/10 border-l-2 border-white' : index === 1 ? 'bg-white/5 border-l-2 border-white/60' : index === 2 ? 'bg-white/5 border-l-2 border-white/30' : 'bg-transparent border-l-2 border-transparent hover:bg-white/5'} font-mono text-sm transition-colors`}
            >
              <div className="flex items-center gap-6">
                <span className={`w-6 text-[10px] tracking-wider ${index === 0 ? 'text-neon-magenta font-bold' : index === 1 ? 'text-yellow-400' : index === 2 ? 'text-neon-blue' : 'text-white/40'}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className={`uppercase tracking-wider ${index < 3 ? 'text-white' : 'text-white/70'}`}>
                  {player.displayName || 'PROGRAM_' + player.id.slice(0, 4)}
                </span>
              </div>
              <span className={`tracking-widest ${index === 0 ? 'text-neon-magenta text-lg font-bold' : index === 1 ? 'text-yellow-400' : index === 2 ? 'text-neon-blue' : 'text-white/50 text-xs'}`}>
                {getMetricValue(player, activeMetric)}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {leaders.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-20 text-center flex flex-col items-center gap-4 italic font-mono opacity-40 text-xs">
            <div className="w-8 h-8 border-2 border-neon-blue/40 border-t-neon-blue rounded-full animate-spin" />
            Scanning grid for high-integrity nodes...
          </motion.div>
        )}
      </div>
    </div>
  );
};

const TabButton = ({ icon, label, active, onClick, color }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void, color: 'magenta' | 'yellow' | 'blue' }) => {
  const colorMap = {
    magenta: 'border-neon-magenta text-neon-magenta bg-neon-magenta/10 shadow-[0_0_15px_rgba(255,0,255,0.2)]',
    yellow: 'border-yellow-400 text-yellow-400 bg-yellow-400/10 shadow-[0_0_15px_rgba(250,204,21,0.2)]',
    blue: 'border-neon-blue text-neon-blue bg-neon-blue/10 shadow-[0_0_15px_rgba(0,210,255,0.2)]'
  };

  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 border font-mono text-[9px] uppercase tracking-[2px] transition-all
        ${active ? colorMap[color] : 'border-white/10 text-white/40 hover:border-white/30 hover:bg-white/5'}`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default Leaderboard;
