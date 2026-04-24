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
import FPSMode from './FPSMode';

interface Props {
  onBack: () => void;
}

type EditorTool = 'select' | 'place' | 'erase';
type TileType = 'wall' | 'destructible';

const ArenaEditor: React.FC<Props> = ({ onBack }) => {
  const { user, unlockAchievement } = useAuth();
  const [arenaName, setArenaName] = useState('UNNAMED_ARENA_01');
  const [nameError, setNameError] = useState<string | null>(null);
  const [tool, setTool] = useState<EditorTool>('place');
  const [tileType, setTileType] = useState<TileType>('wall');
  const [currentLevel, setCurrentLevel] = useState(1);
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [dragStartGrid, setDragStartGrid] = useState<{ x: number; y: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [isFPSDemo, setIsFPSDemo] = useState(false);
  const [pulse, setPulse] = useState(1);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [stageDimensions, setStageDimensions] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/ /g, '_');
    
    if (val.length > 30) {
      setNameError('Maximum 30 characters allowed.');
      return;
    }
    
    if (val !== '' && !/^[A-Z0-9_]+$/.test(val)) {
      setNameError('Only alphanumeric characters and underscores allowed.');
      return;
    }
    
    setNameError(null);
    setArenaName(val);
  };

  useEffect(() => {
    let mounted = true;
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (mounted) setStageDimensions({ width: clientWidth, height: clientHeight });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    if (containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      const padding = 20;
      const availableWidth = clientWidth - padding;
      const availableHeight = clientHeight - padding;
      const s = Math.min(availableWidth / CANVAS_SIZE, availableHeight / CANVAS_SIZE);
      const initialScale = Math.max(0.1, s);
      setScale(initialScale);
      setPosition({
        x: (clientWidth - CANVAS_SIZE * initialScale) / 2,
        y: (clientHeight - CANVAS_SIZE * initialScale) / 2,
      });
    }

    return () => {
      mounted = false;
      window.removeEventListener('resize', updateDimensions);
    };
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
    // Only place tiles on left click, not panning
    if (e.evt.button === 1 || isPanning) return;

    const stage = e.target.getStage();
    const pointerPos = stage.getRelativePointerPosition(); // Gives unscaled coordinates based on stage pos/scale!
    if (!pointerPos) return;

    // Grid snapping
    const gridX = Math.floor(pointerPos.x / GRID_SIZE);
    const gridY = Math.floor(pointerPos.y / GRID_SIZE);

    // Ensure we are inside bounds
    if (gridX < 0 || gridY < 0 || gridX >= 40 || gridY >= 40) return;

    if (tool === 'place') {
      const exists = obstacles.some(o => o.x === gridX && o.y === gridY && (o.level || 1) === currentLevel);
      if (!exists) {
        setObstacles(prev => [...prev, {
          type: tileType,
          x: gridX,
          y: gridY,
          width: 1,
          height: 1,
          level: currentLevel
        }]);
      }
    } else if (tool === 'erase') {
      setObstacles(prev => prev.filter(o => !(o.x === gridX && o.y === gridY && (o.level || 1) === currentLevel)));
      setSelectedIndices([]); // Reset selection if we erase
    }
  }, [tool, tileType, obstacles, isPanning, currentLevel]);

  const handleMouseDown = useCallback((e: any) => {
    if (e.evt.button === 1) { // Middle click to pan
      e.evt.preventDefault();
      setIsPanning(true);
      const stage = e.target.getStage();
      lastPointerRef.current = stage.getPointerPosition();
      return;
    }

    if (tool === 'select') {
      const stage = e.target.getStage();
      const pointerPos = stage.getRelativePointerPosition();
      if (!pointerPos) return;

      const gridX = Math.floor(pointerPos.x / GRID_SIZE);
      const gridY = Math.floor(pointerPos.y / GRID_SIZE);

      // Check if clicked on an obstacle
      const clickedIdx = obstacles.findIndex(o => o.x === gridX && o.y === gridY && (o.level || 1) === currentLevel);

      if (e.evt.shiftKey) {
        if (clickedIdx !== -1) {
          setSelectedIndices(prev => 
            prev.includes(clickedIdx) ? prev.filter(i => i !== clickedIdx) : [...prev, clickedIdx]
          );
        }
      } else {
        if (clickedIdx !== -1) {
          if (!selectedIndices.includes(clickedIdx)) {
            setSelectedIndices([clickedIdx]);
          }
          setDragStartGrid({ x: gridX, y: gridY });
        } else {
          setSelectedIndices([]);
          setSelectionBox({ start: pointerPos, end: pointerPos });
        }
      }
      return;
    }

    handleTileAction(e);
  }, [handleTileAction, tool, currentLevel, obstacles, selectedIndices]);

  const handleMouseMove = useCallback((e: any) => {
    const stage = e.target.getStage();
    const pointerPos = stage.getPointerPosition();
    const relativePos = stage.getRelativePointerPosition();

    if (isPanning) {
      e.evt.preventDefault();
      if (!pointerPos) return;

      const dx = pointerPos.x - lastPointerRef.current.x;
      const dy = pointerPos.y - lastPointerRef.current.y;
      
      setPosition(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPointerRef.current = pointerPos;
    } else if (selectionBox) {
      if (!relativePos) return;
      setSelectionBox(prev => ({ ...prev!, end: relativePos }));
    } else if (dragStartGrid && relativePos && selectedIndices.length > 0) {
      const gridX = Math.floor(relativePos.x / GRID_SIZE);
      const gridY = Math.floor(relativePos.y / GRID_SIZE);
      const dx = gridX - dragStartGrid.x;
      const dy = gridY - dragStartGrid.y;

      if (dx !== 0 || dy !== 0) {
        setObstacles(prev => {
          const next = [...prev];
          selectedIndices.forEach(idx => {
            const o = next[idx];
            const nx = o.x + dx;
            const ny = o.y + dy;
            // Bound check for moves
            if (nx >= 0 && nx < 40 && ny >= 0 && ny < 40) {
              next[idx] = { ...o, x: nx, y: ny };
            }
          });
          return next;
        });
        setDragStartGrid({ x: gridX, y: gridY });
      }
    } else if (e.evt.buttons === 1) {
      handleTileAction(e);
    }
  }, [isPanning, handleTileAction, selectionBox, dragStartGrid, selectedIndices]);

  const handleMouseUp = useCallback((e: any) => {
    if (e.evt.button === 1) {
      setIsPanning(false);
      return;
    }

    if (selectionBox) {
      const x1 = Math.min(selectionBox.start.x, selectionBox.end.x);
      const y1 = Math.min(selectionBox.start.y, selectionBox.end.y);
      const x2 = Math.max(selectionBox.start.x, selectionBox.end.x);
      const y2 = Math.max(selectionBox.start.y, selectionBox.end.y);

      const newlySelected: number[] = [];
      obstacles.forEach((o, idx) => {
        if ((o.level || 1) === currentLevel) {
          const ox = o.x * GRID_SIZE + GRID_SIZE / 2;
          const oy = o.y * GRID_SIZE + GRID_SIZE / 2;
          if (ox >= x1 && ox <= x2 && oy >= y1 && oy <= y2) {
            newlySelected.push(idx);
          }
        }
      });

      setSelectedIndices(prev => Array.from(new Set([...prev, ...newlySelected])));
      setSelectionBox(null);
    }

    setDragStartGrid(null);
  }, [selectionBox, currentLevel, obstacles]);

  const handleWheel = useCallback((e: any) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const scaleBy = 1.1;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const newScale = e.evt.deltaY < 0 ? Math.min(oldScale * scaleBy, 8) : Math.max(oldScale / scaleBy, 0.1);

    setScale(newScale);
    setPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, []);

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

  const deleteSelected = () => {
    if (selectedIndices.length === 0) return;
    setObstacles(prev => prev.filter((_, idx) => !selectedIndices.includes(idx)));
    setSelectedIndices([]);
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
            <LocalDemo obstacles={obstacles.filter(o => (o.level || 1) === currentLevel)} onBack={() => setIsDemo(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFPSDemo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-[100] bg-black"
          >
            <FPSMode onBack={() => setIsFPSDemo(false)} initialObstacles={obstacles} />
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

        <div className="flex items-center gap-4 relative">
          <div className="relative">
            <input 
              type="text" 
              value={arenaName}
              onChange={handleNameChange}
              className={`bg-black/40 border px-4 py-2 font-mono text-xs text-neon-blue focus:outline-none w-64 tracking-widest ${
                nameError ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-neon-blue/50'
              }`}
            />
            <AnimatePresence>
              {nameError && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  className="absolute top-full left-0 mt-1 text-[10px] text-red-500 font-mono tracking-wider w-80 z-10"
                >
                  <AlertTriangle size={10} className="inline mr-1 -mt-0.5" />
                  {nameError}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
                tooltip="Place obstacles and build the arena layout"
              />
              <ToolButton 
                active={tool === 'erase'} 
                onClick={() => setTool('erase')}
                icon={<Eraser size={16} />}
                label="DE-RES"
                tooltip="Remove obstacles from the grid"
              />
              <ToolButton 
                active={tool === 'select'} 
                onClick={() => setTool('select')}
                icon={<MousePointer2 size={16} />}
                label="SELECT"
                tooltip="Select and modify existing obstacles"
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
                onClick={() => setIsFPSDemo(true)}
                icon={<Eye size={16} />}
                label="FPS_TEST"
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

          <AnimatePresence>
            {tool === 'select' && selectedIndices.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="glass-panel p-4 space-y-4"
              >
                <div className="text-[10px] text-white/40 uppercase tracking-[2px] font-bold">Selection Management</div>
                <div className="space-y-2">
                  <div className="font-mono text-[9px] text-neon-blue uppercase">
                    Entities Selected: {selectedIndices.length}
                  </div>
                  <button 
                    onClick={deleteSelected}
                    className="w-full py-2 border border-red-500/40 text-red-500 font-mono text-[9px] hover:bg-red-500/20 transition-all uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <Trash2 size={12} />
                    ERASE_SELECTION
                  </button>
                  <button 
                    onClick={() => setSelectedIndices([])}
                    className="w-full py-2 border border-white/10 text-white/40 font-mono text-[9px] hover:bg-white/5 transition-all uppercase tracking-widest"
                  >
                    CANCEL_SELECTION
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-panel p-4 space-y-4">
             <div className="text-[10px] text-white/40 uppercase tracking-[2px] font-bold">Z-Axis Architecture</div>
             <div className="flex items-center justify-between border border-white/10 p-2">
               <button 
                 onClick={() => setCurrentLevel(Math.max(1, currentLevel - 1))}
                 className="px-3 py-1 font-mono hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                 disabled={currentLevel === 1}
               >
                 -
               </button>
               <span className="font-mono text-xs text-neon-blue font-bold tracking-widest">
                 FLOOR {currentLevel}
               </span>
               <button 
                 onClick={() => setCurrentLevel(Math.min(10, currentLevel + 1))}
                 className="px-3 py-1 font-mono hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                 disabled={currentLevel === 10}
               >
                 +
               </button>
             </div>
          </div>

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
               <div className="flex justify-between">
                 <span>Z-INDEX:</span>
                 <span>L{currentLevel}</span>
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
          className="flex-1 bg-black/40 border border-white/5 relative overflow-hidden custom-scrollbar"
        >
          <Stage 
            width={stageDimensions.width} 
            height={stageDimensions.height} 
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            ref={stageRef}
            className={isPanning ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'}
            onContextMenu={(e) => {
              // Prevent context menu from appearing when panning with middle or right click
              e.evt.preventDefault();
            }}
          >
            <Layer>
              {/* Bounds visualizer with ambient glow pulse */}
              <Rect 
                x={0} 
                y={0} 
                width={CANVAS_SIZE} 
                height={CANVAS_SIZE} 
                fill="black" 
                opacity={0.4}
                stroke={COLORS.CYAN}
                strokeWidth={2}
                shadowColor="rgba(0, 210, 255, 0.4)"
                shadowBlur={50 + 20 * Math.sin(pulse * 5)}
              />

              {/* Grid Lines */}
              {Array.from({ length: 41 }).map((_, i) => {
                // Wave effect across the grid using pulse + index
                const lineOpacity = 0.05 + (Math.sin(i * 0.3 + pulse * 10) * 0.05 + 0.05);
                
                return (
                 <React.Fragment key={i}>
                  <Line
                    points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_SIZE]}
                    stroke={COLORS.GRID}
                    strokeWidth={1}
                    opacity={lineOpacity}
                  />
                  <Line
                    points={[0, i * GRID_SIZE, CANVAS_SIZE, i * GRID_SIZE]}
                    stroke={COLORS.GRID}
                    strokeWidth={1}
                    opacity={lineOpacity}
                  />
                 </React.Fragment>
                );
              })}

                {/* Obstacles */}
                {obstacles.map((obs, idx) => {
                  const obsLevel = obs.level || 1;
                  const isCurrentLevel = obsLevel === currentLevel;
                  const isBelowLevel = obsLevel === currentLevel - 1;
                  const isSelected = selectedIndices.includes(idx);

                  if (!isCurrentLevel && !isBelowLevel) return null;
                  
                  const baseOpacity = isCurrentLevel ? 1 : 0.2;

                  return (
                    <Group key={idx} opacity={baseOpacity}>
                      <Rect
                        x={obs.x * GRID_SIZE}
                        y={obs.y * GRID_SIZE}
                        width={GRID_SIZE}
                        height={GRID_SIZE}
                        fill={obs.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                        opacity={obs.type === 'wall' ? 0.8 : 0.4 + 0.4 * pulse}
                        stroke={isSelected ? '#fff' : (obs.type === 'wall' ? '#000' : '#fff')}
                        strokeWidth={isSelected ? 2 : 1}
                        shadowColor={isSelected ? '#fff' : (obs.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA)}
                        shadowBlur={isSelected ? 15 : (obs.type === 'wall' ? 10 : 30 * pulse)}
                        shadowOpacity={isSelected ? 1 : (obs.type === 'wall' ? 0.5 : 0.4 + 0.4 * pulse)}
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
                  );
                })}

                {/* Selection Box */}
                {selectionBox && (
                  <Rect
                    x={Math.min(selectionBox.start.x, selectionBox.end.x)}
                    y={Math.min(selectionBox.start.y, selectionBox.end.y)}
                    width={Math.abs(selectionBox.end.x - selectionBox.start.x)}
                    height={Math.abs(selectionBox.end.y - selectionBox.start.y)}
                    fill="rgba(0, 210, 255, 0.1)"
                    stroke={COLORS.CYAN}
                    strokeWidth={1}
                    dash={[5, 5]}
                  />
                )}
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
  );
};

interface ToolBtnProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  highlight?: boolean;
  tooltip?: string;
}

const ToolButton = ({ active, onClick, icon, label, danger, highlight, tooltip }: ToolBtnProps) => (
  <button 
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center p-3 border transition-all gap-2 group ${
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
    {tooltip && (
      <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] bg-black/90 border border-neon-blue/40 text-neon-blue text-[10px] p-2 w-32 whitespace-normal text-center leading-relaxed tracking-widest backdrop-blur-md">
        {tooltip}
      </div>
    )}
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
