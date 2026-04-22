import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Rect, Line, Group } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Save, 
  Trash2, 
  Square, 
  MousePointer2, 
  Eraser, 
  Eye, 
  Box, 
  Zap,
  Info,
  CheckCircle2,
  AlertTriangle,
  Play
} from 'lucide-react';
import { useAuth } from './FirebaseProvider';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { GRID_SIZE, CANVAS_SIZE, COLORS } from '../constants';
import { Obstacle } from '../types';
import LocalDemo from './LocalDemo';

interface Props {
  onBack: () => void;
}

type EditorTool = 'select' | 'place' | 'erase';
type TileType = 'wall' | 'destructible';

const ArenaEditor: React.FC<Props> = ({ onBack }) => {
  const { user, unlockAchievement } = useAuth();
  const [arenaName, setArenaName] = useState('UNNAMED_ARENA_01');
  const [tool, setTool] = useState<EditorTool>('place');
  const [tileType, setTileType] = useState<TileType>('wall');
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [pulse, setPulse] = useState(1);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [scale, setScale] = useState(1);

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        // Pad slightly to avoid border overlap
        const padding = 20;
        const availableWidth = clientWidth - padding;
        const availableHeight = clientHeight - padding;
        const s = Math.min(availableWidth / CANVAS_SIZE, availableHeight / CANVAS_SIZE);
        setScale(Math.max(0.1, s));
      }
    };

    window.addEventListener('resize', updateScale);
    updateScale();
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  useEffect(() => {
    let frame: number;
    const animate = (time: number) => {
      // Slower, more subtle pulse for material verification
      setPulse(0.85 + Math.sin(time / 400) * 0.15);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleTileAction = useCallback((e: any) => {
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    // Grid snapping with scale correction
    const x = pointerPos.x / scale;
    const y = pointerPos.y / scale;
    const gridX = Math.floor(x / GRID_SIZE);
    const gridY = Math.floor(y / GRID_SIZE);

    if (tool === 'place') {
      // Check if tile already exists
      const exists = obstacles.some(o => o.x === gridX && o.y === gridY);
      if (!exists) {
        setObstacles(prev => [...prev, {
          type: tileType,
          x: gridX,
          y: gridY,
          width: 1,
          height: 1
        }]);
      }
    } else if (tool === 'erase') {
      setObstacles(prev => prev.filter(o => o.x !== gridX || o.y !== gridY));
    }
  }, [tool, tileType, obstacles]);

  const saveArena = async () => {
    if (!user) {
      setMessage({ text: 'GUEST_PROFILE_RESTRICTED: Please link your program identity.', type: 'error' });
      return;
    }

    if (obstacles.length === 0) {
      setMessage({ text: 'CONSTRUCTION_ERROR: No structures detected in simulation buffer.', type: 'error' });
      return;
    }

    setIsSaving(true);
    setMessage({ text: 'UPLOADING_GRID_DATA...', type: 'info' });

    try {
      await addDoc(collection(db, 'arenas'), {
        name: arenaName,
        creatorId: user.uid,
        layout: obstacles,
        isPublic: true,
        createdAt: serverTimestamp()
      });
      unlockAchievement('arena_designer');
      setMessage({ text: 'PROTOCOL_SYNC_COMPLETE: Arena archived successfully.', type: 'success' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setMessage({ text: 'SYNC_FAILURE: ' + err.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const clearGrid = () => {
    if (window.confirm('PURGE_ALL_DATA: Execute complete grid wipe?')) {
      setObstacles([]);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-6">
      <AnimatePresence>
        {isDemo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-[100] bg-bg-deep p-8"
          >
            <LocalDemo obstacles={obstacles} onBack={() => setIsDemo(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 text-neon-blue hover:text-white font-mono text-xs group transition-all"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            RETURN_TO_HUB
          </button>
          <div className="h-8 w-[1px] bg-white/10" />
          <h2 className="text-3xl font-black italic tracking-tighter text-white uppercase italic">
            Arena <span className="text-neon-blue">Architect</span>
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <input 
            type="text" 
            value={arenaName}
            onChange={(e) => setArenaName(e.target.value.toUpperCase().replace(/ /g, '_'))}
            className="bg-black/40 border border-white/10 px-4 py-2 font-mono text-xs text-neon-blue focus:outline-none focus:border-neon-blue/50 w-64 tracking-widest"
          />
          <button 
            onClick={saveArena}
            disabled={isSaving}
            className={`flex items-center gap-2 px-6 py-2 font-mono text-xs uppercase tracking-widest transition-all ${
              isSaving 
                ? 'bg-white/5 text-white/20 cursor-not-allowed' 
                : 'bg-neon-blue text-black hover:bg-white font-black italic'
            }`}
          >
            <Save size={14} />
            {isSaving ? 'UPLOADING...' : 'ARCHIVE_DATA'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Toolbox */}
        <div className="w-64 space-y-4 overflow-y-auto custom-scrollbar pr-2">
          <div className="glass-panel p-4 space-y-4">
            <div className="text-[10px] text-white/40 uppercase tracking-[2px] font-bold">Design Protocols</div>
            
            <div className="grid grid-cols-2 gap-2">
              <ToolButton 
                active={tool === 'place'} 
                onClick={() => setTool('place')}
                icon={<Box size={16} />}
                label="CONSTRUCT"
              />
              <ToolButton 
                active={tool === 'erase'} 
                onClick={() => setTool('erase')}
                icon={<Eraser size={16} />}
                label="DE-RES"
              />
              <ToolButton 
                active={tool === 'select'} 
                onClick={() => setTool('select')}
                icon={<MousePointer2 size={16} />}
                label="SELECT"
              />
              <ToolButton 
                active={false} 
                onClick={() => setIsDemo(true)}
                icon={<Play size={16} />}
                label="TEST_SIM"
                highlight
              />
              <ToolButton 
                active={false} 
                onClick={clearGrid}
                icon={<Trash2 size={16} />}
                label="PURGE"
                danger
              />
            </div>
          </div>

          <AnimatePresence>
            {tool === 'place' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="glass-panel p-4 space-y-4"
              >
                <div className="text-[10px] text-white/40 uppercase tracking-[2px] font-bold">Material Selection</div>
                <div className="space-y-2">
                  <MaterialOption 
                    active={tileType === 'wall'} 
                    onClick={() => setTileType('wall')}
                    color={COLORS.CYAN}
                    label="PERMANENT_WALL"
                    desc="Indestructible light barrier."
                  />
                  <MaterialOption 
                    active={tileType === 'destructible'} 
                    onClick={() => setTileType('destructible')}
                    color={COLORS.MAGENTA}
                    label="FRAGILE_NODE"
                    desc="Breaks on collision."
                    pulseValue={pulse}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-panel p-4">
             <div className="text-[10px] text-white/40 uppercase tracking-[2px] font-bold mb-3">Simulation Info</div>
             <div className="space-y-2 font-mono text-[9px] text-white/60">
               <div className="flex justify-between">
                 <span>ACTIVE_ENTITIES:</span>
                 <span className="text-neon-blue">{obstacles.length}</span>
               </div>
               <div className="flex justify-between">
                 <span>GRID_SCALE:</span>
                 <span>40x40</span>
               </div>
               <div className="flex justify-between">
                 <span>SECTOR:</span>
                 <span>7G-ARCHITECT</span>
               </div>
             </div>
          </div>

          {message && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`p-4 border font-mono text-[9px] uppercase tracking-widest leading-loose ${
                message.type === 'success' ? 'bg-green-500/10 border-green-500/40 text-green-400' :
                message.type === 'error' ? 'bg-red-500/10 border-red-500/40 text-red-400' :
                'bg-neon-blue/10 border-neon-blue/40 text-neon-blue'
              }`}
            >
              <div className="flex items-start gap-2">
                {message.type === 'success' ? <CheckCircle2 size={12} className="mt-1" /> :
                 message.type === 'error' ? <AlertTriangle size={12} className="mt-1" /> :
                 <Info size={12} className="mt-1" />}
                <span>{message.text}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Workspace */}
        <div 
          ref={containerRef}
          className="flex-1 bg-black/40 border border-white/5 relative flex items-center justify-center overflow-hidden custom-scrollbar"
        >
          <div 
            className="relative shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            style={{ 
              width: CANVAS_SIZE * scale, 
              height: CANVAS_SIZE * scale 
            }}
          >
            <Stage 
              width={CANVAS_SIZE * scale} 
              height={CANVAS_SIZE * scale} 
              scaleX={scale}
              scaleY={scale}
              onMouseDown={handleTileAction}
              onMouseMove={(e) => {
                if (e.evt.buttons === 1) handleTileAction(e);
              }}
              ref={stageRef}
            >
              <Layer>
                {/* Grid Lines */}
                {Array.from({ length: 41 }).map((_, i) => (
                  <React.Fragment key={i}>
                    <Line
                      points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_SIZE]}
                      stroke={COLORS.GRID}
                      strokeWidth={1}
                      opacity={0.15}
                    />
                    <Line
                      points={[0, i * GRID_SIZE, CANVAS_SIZE, i * GRID_SIZE]}
                      stroke={COLORS.GRID}
                      strokeWidth={1}
                      opacity={0.15}
                    />
                  </React.Fragment>
                ))}

                {/* Obstacles */}
                {obstacles.map((obs, idx) => (
                  <Group key={idx}>
                    <Rect
                      x={obs.x * GRID_SIZE}
                      y={obs.y * GRID_SIZE}
                      width={GRID_SIZE}
                      height={GRID_SIZE}
                      fill={obs.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                      opacity={obs.type === 'wall' ? 0.8 : 0.4 + 0.4 * pulse}
                      stroke={obs.type === 'wall' ? '#000' : '#fff'}
                      strokeWidth={1}
                      shadowColor={obs.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                      shadowBlur={obs.type === 'wall' ? 10 : 30 * pulse}
                      shadowOpacity={obs.type === 'wall' ? 0.5 : 0.4 + 0.4 * pulse}
                    />
                    {obs.type === 'destructible' && (
                      <Rect
                        x={obs.x * GRID_SIZE + GRID_SIZE * 0.5}
                        y={obs.y * GRID_SIZE + GRID_SIZE * 0.5}
                        width={GRID_SIZE * 0.5}
                        height={GRID_SIZE * 0.5}
                        offsetX={GRID_SIZE * 0.25}
                        offsetY={GRID_SIZE * 0.25}
                        scaleX={0.8 + 0.4 * (pulse - 0.7)}
                        scaleY={0.8 + 0.4 * (pulse - 0.7)}
                        fill="white"
                        opacity={0.3 + 0.5 * pulse}
                        cornerRadius={1}
                        shadowColor="white"
                        shadowBlur={10 * pulse}
                        shadowOpacity={0.8}
                      />
                    )}
                  </Group>
                ))}
              </Layer>
            </Stage>

            {/* Editor Overlay Info */}
            <div className="absolute top-4 left-4 font-mono text-[10px] text-white/20 uppercase tracking-[4px] pointer-events-none">
              Workspace_Simulation_Live
            </div>
            <div className="absolute bottom-4 right-4 flex gap-4 pointer-events-none opacity-20">
              <div className="flex items-center gap-2 font-mono text-[8px] uppercase">
                <div className="w-2 h-2 bg-neon-blue" /> Permanent
              </div>
              <div className="flex items-center gap-2 font-mono text-[8px] uppercase">
                <div className="w-2 h-2 bg-neon-magenta" /> Destructible
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface ToolBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  highlight?: boolean;
}

const ToolButton = ({ active, onClick, icon, label, danger, highlight }: ToolBtnProps) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-3 border transition-all gap-2 group ${
      active 
        ? 'bg-neon-blue border-neon-blue text-black font-bold' 
        : highlight
          ? 'bg-neon-magenta/10 border-neon-magenta text-neon-magenta hover:bg-neon-magenta hover:text-black hover:font-bold'
          : danger 
            ? 'bg-white/5 border-red-500/20 text-red-500/60 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
            : 'bg-white/5 border-white/10 text-white/40 hover:border-neon-blue/40 hover:text-neon-blue'
    }`}
  >
    {icon}
    <span className="text-[8px] tracking-[1px] uppercase">{label}</span>
  </button>
);

interface MaterialProps {
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
  desc: string;
  pulseValue?: number;
}

const MaterialOption = ({ active, onClick, color, label, desc, pulseValue }: MaterialProps) => (
  <button 
    onClick={onClick}
    className={`w-full p-3 text-left border transition-all ${
      active ? 'bg-white/10 border-white/40' : 'bg-transparent border-white/5 opacity-40 hover:opacity-80'
    }`}
  >
    <div className="flex items-center gap-2 mb-1">
      <div 
        className="w-3 h-3 transition-shadow" 
        style={{ 
          backgroundColor: color, 
          boxShadow: `0 0 ${pulseValue ? 15 * pulseValue : 10}px ${color}`,
          opacity: pulseValue ? 0.6 + 0.4 * pulseValue : 1
        }} 
      />
      <div className="font-mono text-[10px] text-white tracking-widest uppercase">{label}</div>
    </div>
    <div className="font-mono text-[8px] text-white/40 leading-tight uppercase whitespace-pre-wrap break-words">{desc}</div>
  </button>
);

export default ArenaEditor;
