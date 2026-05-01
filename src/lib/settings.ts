export interface GameSettings {
  difficulty: number; // 0.5 = Easy, 1.0 = Normal, 1.5 = Hard
  masterVolume: number; // 0.0 to 1.0
  scanlines: boolean;
  gridGlow: boolean;
}

const defaultSettings: GameSettings = {
  difficulty: 1.0,
  masterVolume: 0.3,
  scanlines: true,
  gridGlow: true,
};

export const getSettings = (): GameSettings => {
  try {
    const stored = localStorage.getItem('gridStrikeSettings');
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch (e) {}
  return { ...defaultSettings };
};

export const saveSettings = (settings: Partial<GameSettings>) => {
  const current = getSettings();
  const next = { ...current, ...settings };
  localStorage.setItem('gridStrikeSettings', JSON.stringify(next));
  
  // Trigger a custom event so React components can update
  window.dispatchEvent(new CustomEvent('settings-updated', { detail: next }));
};
