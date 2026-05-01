import React, { useState } from 'react';
import { FirebaseProvider, useAuth } from './components/FirebaseProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, Play, Edit3, Award, Settings, BookOpen, LogIn, Loader2 } from 'lucide-react';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

// Component imports (to be created)
import GameArena from './components/GameArena';
import Lobby from './components/Lobby';
import ArenaEditor from './components/ArenaEditor';
import StoryMode from './components/StoryMode';
import Leaderboard from './components/Leaderboard';
import FPSMode from './components/FPSMode';
import TutorialMode from './components/TutorialMode';
import AchievementsDisplay from './components/AchievementsDisplay';
import LocalDemo from './components/LocalDemo';
import SavedArenas from './components/SavedArenas';

import SettingsPanel from './components/SettingsPanel';
import { getSettings } from './lib/settings';
import { sounds } from './lib/sounds';

const AppContent = () => {
  const { user, profile, loading, isConfigured, isBypassed, bypassAuth } = useAuth();
  const [view, setView] = useState<'menu' | 'lobby' | 'game' | 'editor' | 'story' | 'leaderboard' | 'fps' | 'tutorial' | 'saved' | 'settings'>('menu');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [sharedArenaId, setSharedArenaId] = useState<string | null>(null);
  const [quickLaunchMode, setQuickLaunchMode] = useState<'story' | 'lobby' | 'fps' | 'tutorial'>('tutorial');
  const [coreIntegrity, setCoreIntegrity] = useState(98.2);
  const [isTurboActive, setIsTurboActive] = useState(true);

  // Global settings state
  const [settings, setSettings] = useState(() => {
    const s = getSettings();
    sounds.setVolume(s.masterVolume);
    return s;
  });

  React.useEffect(() => {
    const handleUpdate = (e: any) => setSettings(e.detail);
    window.addEventListener('settings-updated', handleUpdate);
    return () => window.removeEventListener('settings-updated', handleUpdate);
  }, []);

  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const arenaParam = params.get('arena');
    if (arenaParam) {
      setSharedArenaId(arenaParam);
      setQuickLaunchMode('fps');
    }

    const interval = setInterval(() => {
      setCoreIntegrity((prev) => {
        // Randomly fluctuate between 85.0 and 99.9
        const change = (Math.random() - 0.5) * 1.5;
        const next = prev + change;
        return Math.max(85.0, Math.min(99.9, next));
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const login = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/invalid-credential') {
        setAuthError(`
          PROJECT_MISMATCH: The Client Secret in your Firebase Console does not match your Google Cloud Project.
          
          FIX PROTOCOL:
          1. Go to Firebase Console > Authentication > Sign-in method.
          2. EITHER: Fix Google by updating the 'Web client secret'.
          3. OR: Enable 'Email/Password' as a fail-safe backup.
          
          USE EMAIL AUTH BELOW TO BYPASS GOOGLE ERRORS.
        `);
      } else {
        setAuthError(error.message || "UNABLE TO ESTABLISH LINK WITH THE GRID.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Email Auth Error:", error);
      setAuthError(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loginGuest = async () => {
    try {
      setIsAuthLoading(true);
      setAuthError(null);
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error("Guest Login Error:", error);
      if (error.code === 'auth/admin-restricted-operation') {
        setAuthError(`
          ANONYMOUS AUTH DISABLED: The Guest Login protocol is currently locked at the system level.
          
          FIX PROTOCOL:
          1. Go to Firebase Console > Authentication > Sign-in method.
          2. Click 'Add new provider'.
          3. Select 'Anonymous' and click 'Enable'.
          4. Save changes and attempt guest entry again.
        `);
      } else {
        setAuthError("GUEST PROTOCOL FAILED. PLEASE ENSURE ANONYMOUS AUTH IS ENABLED IN FIREBASE.");
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const loginSimulation = () => {
    // This allows the user to see the UI even if Firebase is broken
    // Note: Database features won't work correctly in this mode
    setAuthError(null);
    console.warn("ENTERING LOCAL SIMULATION MODE - Cloud features disabled.");
    bypassAuth();
  };

  if (loading) return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center">
      <div className="text-neon-blue font-mono animate-pulse tracking-[4px] text-xs">SYNCHRONIZING WITH THE GRID...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-deep text-white font-sans selection:bg-neon-blue/30 overflow-hidden relative">
      {(!isConfigured && !isBypassed) && (
        <div className="absolute inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-8 text-center overscroll-none">
          <div className="max-w-md space-y-6">
            <h2 className="text-4xl font-black text-neon-magenta italic uppercase">Security Breach</h2>
            <p className="font-mono text-xs text-white/60 leading-relaxed uppercase tracking-[2px]">
              The Grid requires authentication credentials to synchronize.
            </p>
            <div className="bg-white/5 border border-white/10 p-6 text-left space-y-4 font-mono text-[10px]">
              <p className="text-neon-blue">Action Required:</p>
              <ol className="list-decimal list-inside space-y-2 opacity-80">
                <li>Open the <span className="text-white">Settings</span> menu (top right)</li>
                <li>Go to the <span className="text-white">Secrets</span> panel</li>
                <li>Add all VITE_FIREBASE_* variables from your local config</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {settings.scanlines && <div className="scanlines" />}
      
      {/* The Digital Grid Background */}
      <div className={`grid-background pointer-events-none opacity-40 ${settings.gridGlow ? '' : 'no-glow'}`}>
        <div className="grid-floor" />
      </div>
      
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="relative z-50 flex flex-col items-center justify-center min-h-screen p-4"
          >
            <div className="text-center space-y-2 mb-12">
              <h1 className="text-7xl md:text-9xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-neon-blue to-blue-900 drop-shadow-[0_0_20px_rgba(0,210,255,0.6)] italic">
                GRID-STRIKE
              </h1>
              <div className="font-mono text-neon-blue tracking-[8px] uppercase text-xs opacity-70">Neon Combat System</div>
            </div>

            <div className="flex flex-col gap-4 w-full max-w-sm relative">
              {isAuthLoading && (
                <div className="absolute inset-[-1.5rem] z-10 flex items-center justify-center bg-bg-deep/80 backdrop-blur-sm border border-neon-blue/30 rounded-lg">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-neon-blue animate-spin" />
                    <span className="font-mono text-[10px] text-neon-blue tracking-[4px] uppercase animate-pulse">Establishing Link...</span>
                  </div>
                </div>
              )}
              <button 
                onClick={login}
                disabled={isAuthLoading}
                className="group relative px-6 py-4 bg-white/5 border border-neon-blue/40 hover:border-neon-blue hover:bg-neon-blue/10 transition-all backdrop-blur-sm"
              >
                <div className="flex items-center justify-center gap-4">
                  <LogIn size={20} className="text-neon-blue group-hover:translate-x-1 transition-transform" />
                  <span className="font-mono text-lg tracking-[0.4em] text-white">INITIALIZE_LINK</span>
                </div>
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono"><span className="bg-bg-deep px-2 text-white/20">or authenticate via email</span></div>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-3">
                <input 
                  type="email" placeholder="PROGRAM_EMAIL" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 px-4 py-2 font-mono text-[10px] text-white focus:border-neon-blue outline-none"
                />
                <input 
                  type="password" placeholder="ACCESS_KEY" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 px-4 py-2 font-mono text-[10px] text-white focus:border-neon-blue outline-none"
                />
                <div className="flex gap-2">
                  <button type="submit" onClick={() => setIsSignUp(false)} className="flex-1 py-2 bg-white/10 border border-white/20 font-mono text-[10px] uppercase hover:bg-white/20 transition-all">Link</button>
                  <button type="submit" onClick={() => setIsSignUp(true)} className="flex-1 py-2 border border-white/10 font-mono text-[10px] uppercase text-white/40 hover:text-white transition-all">Construct</button>
                </div>
              </form>

              <button 
                onClick={loginGuest}
                className="mt-4 font-mono text-[10px] text-white/40 hover:text-white transition-colors tracking-[0.3em] uppercase w-full"
              >
                Join as Guest (Restricted Mode)
              </button>
            </div>

            {authError && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 max-w-md p-6 bg-neon-magenta/10 border border-neon-magenta/30 text-neon-magenta font-mono text-[10px] text-center uppercase tracking-widest leading-relaxed space-y-4"
              >
                <p className="font-bold underline">Critical System Alert:</p>
                <p>{authError}</p>
                <div className="pt-4 flex flex-col gap-2 text-[9px] opacity-70 normal-case tracking-normal text-white">
                  <p>How to fix this in your Firebase Console:</p>
                  <a 
                    href={`https://console.firebase.google.com/project/${auth?.app?.options?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || '_'}/authentication/providers`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline hover:text-neon-blue transition-colors"
                  >
                    1. Enable Anonymous / Google Auth →
                  </a>
                  <button 
                    onClick={loginSimulation}
                    className="mt-2 py-2 border border-neon-blue/40 text-neon-blue hover:bg-neon-blue/10 transition-colors uppercase tracking-[2px] font-bold"
                  >
                    Bypass Authentication (Local Simulation) →
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-10 flex flex-col">
            {/* HUD Header */}
            <header className="flex items-start justify-between p-8 pt-10">
              <div className="flex gap-12 items-start">
                <div className="border-l-4 border-neon-blue pl-4 space-y-1">
                  <h1 className="text-[10px] uppercase tracking-[4px] text-neon-blue drop-shadow-[0_0_10px_rgba(0,210,255,0.6)]">The Grid // Sector 7G</h1>
                  <div className="font-mono text-sm text-white/80 drop-shadow-[0_0_10px_rgba(0,210,255,0.6)]">SYS_VER: 2.0.4.88-BETA</div>
                </div>

                <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2 rounded-sm backdrop-blur-md">
                  <div className="h-10 w-10 rounded-full border border-neon-blue/40 overflow-hidden bg-bg-deep shrink-0">
                    <img src={profile?.photoURL || `https://picsum.photos/seed/${user?.uid}/200/200`} alt="Avatar" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-neon-blue/60 uppercase tracking-widest">Authorized Program</span>
                    <span className="font-mono text-sm text-white uppercase truncate max-w-[150px]">{profile?.displayName || user?.displayName || 'GUEST_PROG'}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-6 items-start">
                <div className="glass-panel px-6 py-3 text-right">
                  <div className="text-[10px] opacity-50 uppercase mb-1 tracking-wider text-neon-blue drop-shadow-[0_0_10px_rgba(0,210,255,0.6)]">Core Integrity</div>
                  <div className="font-mono text-2xl neon-text-blue drop-shadow-[0_0_10px_rgba(0,210,255,0.6)]">{coreIntegrity.toFixed(1)}%</div>
                </div>
                <button 
                  onClick={() => signOut(auth)}
                  className="px-4 py-2 text-[10px] font-mono border border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/10 rounded-sm transition-all mt-2"
                >
                  TERMINATE_SESSION
                </button>
              </div>
            </header>

            {/* Side Menu */}
            <nav className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 w-52 z-20">
              <NavButton active={view === 'menu'} label="User Hub" onClick={() => setView('menu')} />
              <NavButton active={view === 'story'} label="Story Mode" onClick={() => setView('story')} />
              <NavButton active={view === 'lobby'} label="Arena Battle" onClick={() => setView('lobby')} />
              <NavButton active={view === 'fps'} label="Grid Recon" onClick={() => setView('fps')} />
              <NavButton active={view === 'editor'} label="Grid Editor" onClick={() => setView('editor')} />
              <NavButton active={view === 'saved'} label="Archived Arrays" onClick={() => setView('saved')} />
              <NavButton active={view === 'leaderboard'} label="Data Bank" onClick={() => setView('leaderboard')} />
              <NavButton active={view === 'settings'} label="Settings" onClick={() => setView('settings')} />
            </nav>

            {/* Power-ups HUD (Bottom Right) */}
            <div className="absolute bottom-8 right-8 flex gap-3 z-20">
              <PowerUpIcon 
                active={isTurboActive} 
                label="TURBO" 
                value={isTurboActive ? "READY" : "OFF"} 
                onClick={() => setIsTurboActive(!isTurboActive)} 
              />
              <PowerUpIcon label="PHASE" value="0%" />
              <PowerUpIcon label="DISC" value="LOCKED" />
            </div>

            {/* Content Area */}
            <main className="flex-1 relative overflow-hidden">
              <div className="h-full w-full max-w-[calc(100%-250px)] ml-8 pb-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={view}
                    initial={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 1.02, filter: 'blur(10px)' }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="h-full w-full"
                  >
                    {view === 'menu' && (
                      <div className="h-full flex flex-col overflow-y-auto custom-scrollbar pr-4">
                        <div className="max-w-3xl space-y-8 py-8 w-full">
                          <div className="space-y-2">
                            <h2 className="text-5xl font-black italic tracking-tighter text-white uppercase italic">Welcome {profile?.displayName?.split(' ')[0] || 'Program'}</h2>
                            <p className="font-mono text-sm text-neon-blue/60 leading-relaxed uppercase tracking-widest">
                              Authorized access granted to Sector 7G. Your identity has been verified. Current combat record: <span className="text-neon-magenta">{profile?.wins || 0}</span> confirmed eliminations.
                            </p>
                          </div>
                          
                          <div className="flex gap-8 border-t border-white/5 pt-8">
                            <div>
                              <div className="text-[10px] text-white/40 uppercase tracking-[2px] mb-1">Global Rank</div>
                              <div className="font-mono text-xl text-white">#--</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-white/40 uppercase tracking-[2px] mb-1">Grid Sync</div>
                              <div className="font-mono text-xl text-white">ESTABLISHED</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-white/40 uppercase tracking-[2px] mb-1">Sector</div>
                              <div className="font-mono text-xl text-white">7G-ALPHA</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-white/5 pt-8">
                            <div className="bg-white/5 p-4 border border-white/10 rounded-sm">
                              <div className="text-[9px] text-white/40 uppercase tracking-[2px] mb-2">Total Wins</div>
                              <div className="font-mono text-2xl text-neon-magenta">{profile?.wins || 0}</div>
                            </div>
                            <div className="bg-white/5 p-4 border border-white/10 rounded-sm">
                              <div className="text-[9px] text-white/40 uppercase tracking-[2px] mb-2">Total Games</div>
                              <div className="font-mono text-2xl text-white">{profile?.totalGames || 0}</div>
                            </div>
                            <div className="bg-white/5 p-4 border border-white/10 rounded-sm">
                              <div className="text-[9px] text-white/40 uppercase tracking-[2px] mb-2">Fastest Win</div>
                              <div className="font-mono text-2xl text-neon-blue">{profile?.fastestGame ? `${profile.fastestGame}s` : '--'}</div>
                            </div>
                            <div className="bg-white/5 p-4 border border-white/10 rounded-sm">
                              <div className="text-[9px] text-white/40 uppercase tracking-[2px] mb-2">Longest Survived</div>
                              <div className="font-mono text-2xl text-yellow-500">{profile?.longestSurvivalTime ? `${profile.longestSurvivalTime}s` : '--'}</div>
                            </div>
                          </div>

                          <div className="pt-8 space-y-4">
                            <h3 className="text-xs font-mono text-neon-blue uppercase tracking-[4px] border-b border-neon-blue/20 pb-2">Quick_Launch_Protocols</h3>
                            <div className="flex gap-4">
                              <button 
                                onClick={() => setQuickLaunchMode('tutorial')}
                                className={`flex-1 py-4 font-mono text-[10px] uppercase transition-all border ${quickLaunchMode === 'tutorial' ? 'border-green-400 bg-green-400/20 text-white shadow-[0_0_15px_rgba(74,222,128,0.2)]' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                              >
                                Training Sim
                              </button>
                              <button 
                                onClick={() => setQuickLaunchMode('story')}
                                className={`flex-1 py-4 font-mono text-[10px] uppercase transition-all border ${quickLaunchMode === 'story' ? 'border-neon-magenta bg-neon-magenta/20 text-white shadow-[0_0_15px_rgba(255,0,255,0.2)]' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                              >
                                Story Mode
                              </button>
                              <button 
                                onClick={() => setQuickLaunchMode('lobby')}
                                className={`flex-1 py-4 font-mono text-[10px] uppercase transition-all border ${quickLaunchMode === 'lobby' ? 'border-neon-blue bg-neon-blue/20 text-white shadow-[0_0_15px_rgba(0,210,255,0.2)]' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                              >
                                Arena Battle
                              </button>
                              <button 
                                onClick={() => setQuickLaunchMode('fps')}
                                className={`flex-1 py-4 font-mono text-[10px] uppercase transition-all border ${quickLaunchMode === 'fps' ? 'border-yellow-500 bg-yellow-500/20 text-white shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                              >
                                FPS Recon
                              </button>
                            </div>
                            <button 
                              onClick={() => setView(quickLaunchMode)}
                              className={`w-full py-4 text-black font-black italic text-lg uppercase transition-all ${quickLaunchMode === 'tutorial' ? 'bg-green-400 hover:bg-white' : quickLaunchMode === 'story' ? 'bg-neon-magenta hover:bg-white' : quickLaunchMode === 'lobby' ? 'bg-neon-blue hover:bg-white' : 'bg-yellow-500 hover:bg-white'}`}
                            >
                              INITIALIZE_{quickLaunchMode}
                            </button>
                          </div>

                          <div className="pt-8 space-y-4">
                            <h3 className="text-xs font-mono text-neon-blue uppercase tracking-[4px] border-b border-neon-blue/20 pb-2">Achievement_Ledger</h3>
                            <AchievementsDisplay />
                          </div>
                        </div>
                      </div>
                    )}

                    {view === 'lobby' && <Lobby onJoinRoom={(id) => { setActiveRoomId(id); setView('game'); }} onBack={() => setView('menu')} />}
                    {view === 'game' && activeRoomId && <GameArena roomId={activeRoomId} onQuit={() => setView('menu')} />}
                    {view === 'editor' && <ArenaEditor onBack={() => setView('menu')} />}
                    {view === 'story' && <StoryMode onBack={() => setView('menu')} />}
                    {view === 'leaderboard' && <Leaderboard onBack={() => setView('menu')} />}
                    {view === 'fps' && <FPSMode onBack={() => setView('menu')} initialObstacles={undefined} arenaId={sharedArenaId || undefined} />}
                    {view === 'tutorial' && <TutorialMode onBack={() => setView('menu')} />}
                    {view === 'saved' && <SavedArenas onBack={() => setView('menu')} onPlayArena={(id) => { setSharedArenaId(id); setView('fps'); }} />}
                    {view === 'settings' && (
                      <SettingsPanel />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const NavButton = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
  <button onClick={onClick} className={`menu-item-strike ${active ? 'active' : ''}`}>
    {label}
  </button>
);

const PowerUpIcon = ({ active, label, value, onClick }: { active?: boolean; label: string; value: string; onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className={`w-14 h-14 border flex flex-col items-center justify-center text-[8px] font-mono leading-tight tracking-tighter glass-panel text-center transition-all ${
      onClick ? 'cursor-pointer hover:bg-white/5' : 'cursor-default'
    } ${
      active 
        ? 'border-neon-magenta text-neon-magenta shadow-[0_0_10px_rgba(255,0,255,0.3)]' 
        : 'border-white/10 text-white/40'
    }`}
  >
    <div className="font-bold">{label}</div>
    <div className="opacity-70">{value}</div>
  </button>
);

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}
