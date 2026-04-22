import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Shield, Zap, ChevronLeft } from 'lucide-react';
import { FPSController, FPSStats, WEAPONS } from '../lib/FPSController';

interface Props {
  onBack: () => void;
}

const FPSMode: React.FC<Props> = ({ onBack }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<FPSController | null>(null);
  const [stats, setStats] = useState<FPSStats>({ 
    score: 0, 
    ammo: 30, 
    maxAmmo: 30,
    isLocked: false, 
    isReloading: false,
    activeWeapon: 0,
    unlockedWeapons: [true, false, false, false]
  });

  useEffect(() => {
    if (!containerRef.current) return;
    
    const controller = new FPSController(containerRef.current, (newStats) => {
      setStats(newStats);
    });
    
    controllerRef.current = controller;

    return () => {
      controller.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none">
      <div ref={containerRef} className="w-full h-full cursor-crosshair" />

      {/* Crosshair */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
        {stats.isReloading ? (
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/20 border-t-neon-magenta rounded-full animate-spin" />
            <span className="absolute text-[8px] font-mono text-neon-magenta uppercase tracking-widest mt-20">Recycling</span>
          </div>
        ) : (
          <Crosshair className="text-neon-blue opacity-50" size={32} />
        )}
      </div>

      {/* HUD Bottom */}
      <div className="absolute bottom-8 left-8 right-8 flex justify-between items-end z-40 pointer-events-none">
        <div className="space-y-4">
          <div className="glass-panel p-4 flex gap-4 items-center">
             <div className="w-12 h-12 bg-neon-blue/20 flex items-center justify-center">
               <Shield className="text-neon-blue" />
             </div>
             <div>
               <div className="text-[10px] uppercase opacity-50 font-mono">Shield Integrity</div>
               <div className="h-1 w-32 bg-white/10 mt-1">
                 <div className="h-full bg-neon-blue w-[85%]" />
               </div>
             </div>
          </div>
          <div className="glass-panel p-4 flex gap-4 items-center">
             <div className="w-12 h-12 bg-neon-magenta/20 flex items-center justify-center">
               <Zap className={`transition-all ${stats.ammo > 0 ? 'text-neon-magenta' : 'text-red-500 animate-pulse'}`} />
             </div>
             <div>
                <div className="text-[10px] uppercase opacity-50 font-mono">Active Array: {WEAPONS[stats.activeWeapon]?.name || 'Discharge'}</div>
                <div className={`font-mono tracking-widest uppercase ${stats.isReloading ? 'text-neon-magenta animate-pulse' : stats.ammo > 0 ? 'text-white' : 'text-red-500'}`}>
                  {stats.isReloading ? 'RECYCLING...' : stats.ammo > 0 ? `${stats.ammo.toString().padStart(3, '0')} / ${stats.maxAmmo.toString().padStart(3, '0')}` : 'Depleted'}
                </div>
             </div>
          </div>
          <div className="glass-panel p-3 flex gap-2 items-center">
            {WEAPONS.map((w, index) => {
               const isActive = stats.activeWeapon === index;
               const isUnlocked = stats.unlockedWeapons[index];
               return (
                 <div key={w.id} className={`w-10 h-10 border ${isActive ? 'border-neon-magenta bg-neon-magenta/10' : isUnlocked ? 'border-neon-blue/50 bg-neon-blue/5' : 'border-white/5 opacity-30'} flex flex-col items-center justify-center`}>
                    <div className="text-[8px] font-mono opacity-50">{index + 1}</div>
                    <div className={`text-xs font-bold ${isActive ? 'text-neon-magenta text-shadow-neon-magenta' : isUnlocked ? 'text-neon-blue' : 'text-white/20'}`}>
                      {w.id.toUpperCase()}
                    </div>
                 </div>
               );
            })}
          </div>
        </div>

        <div className="text-right glass-panel p-6">
           <div className="text-[10px] uppercase opacity-50 font-mono mb-2">Eliminated Programs</div>
           <div className="text-5xl font-black italic neon-text-blue">{stats.score.toString().padStart(3, '0')}</div>
        </div>
      </div>

      {/* Instructions Overlay */}
      <AnimatePresence>
        {!stats.isLocked && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-[100] text-center p-8"
          >
            <div className="mb-12 border-l-4 border-neon-blue pl-6 text-left">
               <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-2">RECON_INITIATED</h2>
               <p className="font-mono text-xs text-neon-blue/60 tracking-widest">GRID SECTOR: 0xFF. EXPLORATION AUTHORIZED.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-8 max-w-lg mb-12 font-mono text-xs uppercase tracking-[3px]">
               <div className="space-y-2">
                 <div className="text-white">WASD</div>
                 <div className="text-white/40">Translation</div>
               </div>
               <div className="space-y-2">
                 <div className="text-white">Mouse</div>
                 <div className="text-white/40">Orientation</div>
               </div>
               <div className="space-y-2">
                 <div className="text-white">Click</div>
                 <div className="text-white/40">Discharge</div>
               </div>
               <div className="space-y-2">
                 <div className="text-white">R</div>
                 <div className="text-white/40">Recycle Core</div>
               </div>
               <div className="space-y-2">
                 <div className="text-white">1 - 4</div>
                 <div className="text-white/40">Switch Array</div>
               </div>
               <div className="space-y-2">
                 <div className="text-white">Space</div>
                 <div className="text-white/40">Ascend</div>
               </div>
               <div className="space-y-2">
                 <div className="text-white">Esc</div>
                 <div className="text-white/40">Exit Link</div>
               </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => containerRef.current?.requestPointerLock()}
                className="px-12 py-4 bg-neon-blue text-black font-black italic text-lg hover:bg-white transition-all pointer-events-auto"
              >
                INITIALIZE_FPS_LINK
              </button>
              <button 
                onClick={onBack}
                className="px-12 py-4 border border-white/20 text-white font-mono text-sm hover:bg-white/10 transition-all pointer-events-auto"
              >
                GO_BACK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FPSMode;
