import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, GameSettings } from '../lib/settings';
import { sounds } from '../lib/sounds';

const SettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<GameSettings>(getSettings());

  useEffect(() => {
    const handleUpdate = (e: any) => setSettings(e.detail);
    window.addEventListener('settings-updated', handleUpdate);
    return () => window.removeEventListener('settings-updated', handleUpdate);
  }, []);

  const handleChange = (updates: Partial<GameSettings>) => {
    saveSettings(updates);
    if (updates.masterVolume !== undefined) {
      sounds.setVolume(updates.masterVolume);
    }
  };

  return (
    <div className="h-full flex flex-col pt-8 overflow-y-auto custom-scrollbar pr-4 max-w-2xl">
      <div className="space-y-2 mb-8">
        <h2 className="text-4xl font-black italic tracking-tighter text-white uppercase">System Configurations</h2>
        <p className="font-mono text-sm text-neon-blue/60 leading-relaxed uppercase tracking-widest">
          Modify the Grid's operational parameters.
        </p>
      </div>

      <div className="space-y-8">
        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-sm font-mono text-neon-blue tracking-[4px] uppercase border-b border-neon-blue/20 pb-2">Simulation Difficulty</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-xs text-white/60 uppercase">
              <span>Easy</span>
              <span>Normal</span>
              <span>Hard</span>
            </div>
            <input 
              type="range" 
              min="0.5" 
              max="1.5" 
              step="0.5" 
              value={settings.difficulty}
              onChange={(e) => handleChange({ difficulty: parseFloat(e.target.value) })}
              className="w-full accent-neon-blue"
            />
            <p className="font-mono text-[10px] text-white/40 pt-2 uppercase">
              Adjusts AI processing speed and program density.
            </p>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-sm font-mono text-neon-magenta tracking-[4px] uppercase border-b border-neon-magenta/20 pb-2">Audio Systems</h3>
          
          <div className="space-y-2">
            <div className="flex justify-between font-mono text-xs text-white/60 uppercase">
              <span>Master Volume</span>
              <span>{Math.round(settings.masterVolume * 100)}%</span>
            </div>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={settings.masterVolume}
              onChange={(e) => handleChange({ masterVolume: parseFloat(e.target.value) })}
              className="w-full accent-neon-magenta"
            />
            <button 
                onClick={() => sounds.playSuccess()}
                className="mt-4 px-4 py-2 border border-white/10 hover:border-neon-magenta transition-all font-mono text-[10px] uppercase text-white/60 hover:text-white"
            >
                TEST AUDIO
            </button>
          </div>
        </div>

        <div className="glass-panel p-6 space-y-6">
          <h3 className="text-sm font-mono text-white tracking-[4px] uppercase border-b border-white/20 pb-2">Visual Processing</h3>
          
          <div className="space-y-4">
            <label className="flex items-center gap-4 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={settings.scanlines}
                onChange={(e) => handleChange({ scanlines: e.target.checked })}
                className="w-4 h-4 accent-neon-blue"
              />
              <span className="font-mono text-xs text-white/80 group-hover:text-white uppercase tracking-widest">Enable CRT Scanlines</span>
            </label>

            <label className="flex items-center gap-4 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={settings.gridGlow}
                onChange={(e) => handleChange({ gridGlow: e.target.checked })}
                className="w-4 h-4 accent-neon-blue"
              />
              <span className="font-mono text-xs text-white/80 group-hover:text-white uppercase tracking-widest">Enable Grid Luminescence</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
