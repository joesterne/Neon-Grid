import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Group, Circle, Text } from 'react-konva';
import { useAuth } from './FirebaseProvider';
import { Direction, Point, Player, Obstacle } from '../types';
import { GRID_SIZE, COLORS, CANVAS_SIZE } from '../constants';
import { getNextPosition, checkCollision, isValidDirectionChange } from '../lib/gameLogic';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { sounds } from '../lib/sounds';

interface Props {
  onBack: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

const TICK_RATE = 120; // Slightly slower for tutorial

enum TutorialStep {
  INIT = 0,
  MOVE = 1,
  TRAIL_WARNING = 2,
  BREAK_NODE = 3,
  AVOID_WALL = 4,
  COMPLETE = 5
}

const TutorialMode: React.FC<Props> = ({ onBack }) => {
  const { profile } = useAuth();
  const [player, setPlayer] = useState<Player>({
    uid: 'local-test',
    name: profile?.displayName || 'NEW_PROGRAM',
    color: '#00d2ff', // Neon blue
    pos: { x: 5, y: 10 },
    dir: Direction.RIGHT,
    trail: [],
    isAlive: true,
    score: 0
  });

  const [status, setStatus] = useState<'playing' | 'finished'>('playing');
  const [localDir, setLocalDir] = useState<Direction>(Direction.RIGHT);
  const inputQueueRef = useRef<Direction[]>([]);
  const [_trigger, setTrigger] = useState(0);
  const [glowPulse, setGlowPulse] = useState(1);
  const [activeObstacles, setActiveObstacles] = useState<Obstacle[]>([]);
  const [pulse, setPulse] = useState(1);
  const [scale, setScale] = useState(1);
  
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(TutorialStep.INIT);
  const [stepTimer, setStepTimer] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const padding = 160; 
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

  const particlesRef = useRef<Particle[]>([]);
  const lastTickTimeRef = useRef<number>(Date.now());
  const requestRef = useRef<number>(0);

  // Animation and Interpolation refs
  const visualPosRef = useRef<{ current: Point, prev: Point }>({ prev: { x: 5, y: 10 }, current: { x: 5, y: 10 } });
  const visualRotRef = useRef<{ rotation: number, prevRotation: number }>({ rotation: 0, prevRotation: 0 });

  const getRotation = (dir: Direction) => {
    switch(dir) {
      case Direction.UP: return 270;
      case Direction.DOWN: return 90;
      case Direction.LEFT: return 180;
      case Direction.RIGHT: return 0;
      default: return 0;
    }
  };

  const spawnExplosion = (gridX: number, gridY: number, color: string) => {
    const centerX = gridX * GRID_SIZE + GRID_SIZE / 2;
    const centerY = gridY * GRID_SIZE + GRID_SIZE / 2;
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particlesRef.current.push({
            id: Math.random(), x: centerX, y: centerY, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            life: 1.0, color: color, size: Math.random() * 5 + 2
        });
    }
  };

  const restartTutorial = () => {
    setPlayer({
      uid: 'local-test', name: profile?.displayName || 'NEW_PROGRAM', color: '#00d2ff',
      pos: { x: 5, y: 10 }, dir: Direction.RIGHT, trail: [], isAlive: true, score: 0
    });
    setLocalDir(Direction.RIGHT);
    inputQueueRef.current = [];
    setActiveObstacles([]);
    setStatus('playing');
    visualPosRef.current = { prev: { x: 5, y: 10 }, current: { x: 5, y: 10 } };
    visualRotRef.current = { rotation: 0, prevRotation: 0 };
    lastTickTimeRef.current = Date.now();
    setTutorialStep(TutorialStep.INIT);
    setStepTimer(0);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      let nextDir: Direction | null = null;
      switch (e.key.toLowerCase()) {
        case 'arrowup': case 'w': nextDir = Direction.UP; break;
        case 'arrowdown': case 's': nextDir = Direction.DOWN; break;
        case 'arrowleft': case 'a': nextDir = Direction.LEFT; break;
        case 'arrowright': case 'd': nextDir = Direction.RIGHT; break;
      }

      if (nextDir && status === 'playing') {
        if (tutorialStep === TutorialStep.INIT) {
          setTutorialStep(TutorialStep.MOVE);
        }
        setLocalDir(prev => {
          if (isValidDirectionChange(prev, nextDir!) && nextDir !== prev) {
            if (inputQueueRef.current.length < 2) inputQueueRef.current.push(nextDir!);
            return nextDir!;
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, tutorialStep]);

  const tick = useCallback(() => {
    if (status !== 'playing' || !player.isAlive) return;

    let currentMoveDir = localDir;
    if (inputQueueRef.current.length > 0) {
      currentMoveDir = inputQueueRef.current.shift()!;
    }

    const nextPos = getNextPosition(player.pos, currentMoveDir);
    const { collision, hitObstacleIndex } = checkCollision(nextPos, player.trail, activeObstacles);

    if (hitObstacleIndex !== -1) {
      const hitObstacle = activeObstacles[hitObstacleIndex];
      if (hitObstacle.type === 'destructible') {
        setActiveObstacles(prev => prev.filter((_, i) => i !== hitObstacleIndex));
        spawnExplosion(nextPos.x, nextPos.y, COLORS.MAGENTA);
        sounds.playExplosion(0, 1);
        if (tutorialStep === TutorialStep.BREAK_NODE) {
          setTutorialStep(TutorialStep.AVOID_WALL);
          setStepTimer(0);
        }
      }
    }

    if (collision) {
      sounds.playImpact();
      setPlayer(prev => ({ ...prev, isAlive: false }));
      setStatus('finished');
      return;
    }

    const { x: nextX, y: nextY } = nextPos;

    setPlayer(prev => ({
      ...prev, pos: { x: nextX, y: nextY }, dir: currentMoveDir, trail: [...prev.trail, prev.pos]
    }));

    visualPosRef.current.prev = { ...visualPosRef.current.current };
    visualPosRef.current.current = { x: nextX, y: nextY };
    visualRotRef.current.prevRotation = visualRotRef.current.rotation;
    visualRotRef.current.rotation = getRotation(currentMoveDir);

    lastTickTimeRef.current = Date.now();
    sounds.playMove();

    // Tutorial Progression Logic
    if (tutorialStep === TutorialStep.MOVE) {
      setStepTimer(prev => prev + 1);
      if (stepTimer > 30) {
        setTutorialStep(TutorialStep.TRAIL_WARNING);
        setStepTimer(0);
      }
    } else if (tutorialStep === TutorialStep.TRAIL_WARNING) {
      setStepTimer(prev => prev + 1);
      if (stepTimer > 50) {
        setTutorialStep(TutorialStep.BREAK_NODE);
        setStepTimer(0);
        // Spawn a target
        setActiveObstacles([{ x: nextX + (currentMoveDir === Direction.RIGHT ? 10 : currentMoveDir === Direction.LEFT ? -10 : 0), y: nextY + (currentMoveDir === Direction.DOWN ? 10 : currentMoveDir === Direction.UP ? -10 : 0), type: 'destructible', width: 1, height: 1 }]);
      }
    } else if (tutorialStep === TutorialStep.AVOID_WALL) {
      setStepTimer(prev => prev + 1);
      if (stepTimer === 1) {
        // Spawn solid walls
        setActiveObstacles([{ x: nextX + 10, y: nextY, type: 'wall', width: 1, height: 1 }, { x: nextX - 10, y: nextY, type: 'wall', width: 1, height: 1 }, { x: nextX, y: nextY + 10, type: 'wall', width: 1, height: 1 }, { x: nextX, y: nextY - 10, type: 'wall', width: 1, height: 1 }]);
      }
      if (stepTimer > 80) {
        setTutorialStep(TutorialStep.COMPLETE);
        setStepTimer(0);
      }
    }

  }, [player, localDir, status, activeObstacles, tutorialStep, stepTimer]);

  const animate = useCallback((time: number) => {
    setGlowPulse(0.8 + Math.sin(time / 200) * 0.2);
    setPulse(0.85 + Math.sin(time / 400) * 0.15);

    particlesRef.current = particlesRef.current
      .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, life: p.life - 0.015, size: p.size * 0.99 }))
      .filter(p => p.life > 0);

    if (status === 'playing' && player.isAlive) {
      const centerX = visualPosRef.current.current.x * GRID_SIZE + GRID_SIZE / 2;
      const centerY = visualPosRef.current.current.y * GRID_SIZE + GRID_SIZE / 2;
      
      if (Math.random() > 0.5) {
        particlesRef.current.push({
          id: Math.random(), x: centerX + (Math.random() - 0.5) * 5, y: centerY + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 1.5, vy: (Math.random() - 0.5) * 1.5, life: 1.0, color: player.color, size: Math.random() * 4 + 1
        });
      }
    }

    setTrigger(prev => prev + 1);
    requestRef.current = requestAnimationFrame(animate);
  }, [status, player.isAlive, player.color]);

  useEffect(() => {
    if (status === 'playing') timerRef.current = setInterval(tick, TICK_RATE);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, tick]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const now = Date.now();
  const t = Math.min(1, (now - lastTickTimeRef.current) / TICK_RATE);
  const vX = visualPosRef.current.prev.x + (visualPosRef.current.current.x - visualPosRef.current.prev.x) * t;
  const vY = visualPosRef.current.prev.y + (visualPosRef.current.current.y - visualPosRef.current.prev.y) * t;

  let diff = visualRotRef.current.rotation - visualRotRef.current.prevRotation;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const vRot = visualRotRef.current.prevRotation + diff * t;

  const messages = {
    [TutorialStep.INIT]: "Press WASD to Initiate Navigation",
    [TutorialStep.MOVE]: "Excellent. Navigate your Light Cycle.",
    [TutorialStep.TRAIL_WARNING]: "WARNING: Crossing your own trail will result in immediate Derez.",
    [TutorialStep.BREAK_NODE]: "Target identified. Ram the Magenta Node to shatter it.",
    [TutorialStep.AVOID_WALL]: "EVASIVE MANEUVERS: Avoid Cyan Solid Matter Walls.",
    [TutorialStep.COMPLETE]: "CALIBRATION COMPLETE. You are ready for the core system."
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center h-full relative glass-panel p-8">
      <div className="absolute top-4 left-4 flex gap-6 items-center z-20">
        <button onClick={onBack} className="flex items-center gap-2 text-neon-blue hover:text-white font-mono text-xs group transition-all">
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          EXIT_TUTORIAL
        </button>
        <div className="h-4 w-[1px] bg-white/10" />
        <div className="font-mono text-[10px] tracking-[4px] text-white/40 uppercase">
          Mode: <span className="text-neon-blue">TRAINING_SIMULATION</span>
        </div>
      </div>

      <div className="mb-4 text-center mt-8 z-20 h-16 flex items-center justify-center w-full max-w-2xl bg-black/40 border border-neon-blue/30 rounded-md">
        <motion.div
           key={tutorialStep}
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           className={`font-mono text-lg tracking-[2px] uppercase ${tutorialStep === TutorialStep.TRAIL_WARNING || tutorialStep === TutorialStep.AVOID_WALL ? 'text-neon-magenta' : 'text-neon-blue'}`}
        >
          {messages[tutorialStep]}
        </motion.div>
      </div>

      <div 
        className="relative border border-neon-blue/20 bg-black/80 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-1000"
        style={{ width: CANVAS_SIZE * scale, height: CANVAS_SIZE * scale, opacity: status === 'finished' ? 0.3 : 1 }}
      >
        <Stage width={CANVAS_SIZE * scale} height={CANVAS_SIZE * scale} scaleX={scale} scaleY={scale} ref={stageRef}>
          <Layer>
            {/* Grid */}
            {Array.from({ length: 41 }).map((_, i) => (
              <React.Fragment key={i}>
                <Line points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_SIZE]} stroke={COLORS.GRID} strokeWidth={1} opacity={0.3} />
                <Line points={[0, i * GRID_SIZE, CANVAS_SIZE, i * GRID_SIZE]} stroke={COLORS.GRID} strokeWidth={1} opacity={0.3} />
              </React.Fragment>
            ))}

            {activeObstacles.map((o, i) => (
              <Group key={`obs-${i}`}>
                <Rect
                  x={o.x * GRID_SIZE} y={o.y * GRID_SIZE} width={GRID_SIZE} height={GRID_SIZE}
                  fill={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  opacity={o.type === 'wall' ? 0.6 : 0.4 + 0.4 * pulse}
                  stroke={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA} strokeWidth={1}
                  shadowColor={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  shadowBlur={o.type === 'wall' ? 10 : 30 * pulse}
                />
                {o.type === 'destructible' && (
                  <Rect
                    x={o.x * GRID_SIZE + GRID_SIZE * 0.5} y={o.y * GRID_SIZE + GRID_SIZE * 0.5}
                    width={GRID_SIZE * 0.5} height={GRID_SIZE * 0.5} offsetX={GRID_SIZE * 0.25} offsetY={GRID_SIZE * 0.25}
                    scaleX={0.8 + 0.4 * (pulse - 0.7)} scaleY={0.8 + 0.4 * (pulse - 0.7)}
                    fill="white" opacity={0.3 + 0.5 * pulse} cornerRadius={1}
                    shadowColor="white" shadowBlur={10 * pulse} shadowOpacity={0.8}
                  />
                )}
              </Group>
            ))}

            {particlesRef.current.map(p => (
               <Circle key={p.id} x={p.x} y={p.y} radius={p.size} fill={p.color} opacity={p.life} shadowColor={p.color} shadowBlur={5} />
            ))}

            <Line
              points={[
                ...player.trail.flatMap(pt => [pt.x * GRID_SIZE + GRID_SIZE/2, pt.y * GRID_SIZE + GRID_SIZE/2]),
                vX * GRID_SIZE + GRID_SIZE/2, vY * GRID_SIZE + GRID_SIZE/2
              ]}
              stroke={player.color} strokeWidth={4} lineJoin="round" opacity={player.isAlive ? 0.9 : 0.3}
            />
            
            {player.isAlive && (
              <Group x={vX * GRID_SIZE + GRID_SIZE/2} y={vY * GRID_SIZE + GRID_SIZE/2} rotation={vRot}>
                <Rect x={-GRID_SIZE/2} y={-GRID_SIZE/2} width={GRID_SIZE} height={GRID_SIZE} fill={player.color} shadowColor={player.color} shadowBlur={20} cornerRadius={2} />
                <Rect x={0} y={-GRID_SIZE/4} width={GRID_SIZE/2} height={GRID_SIZE/2} fill="white" cornerRadius={1} />
              </Group>
            )}
          </Layer>
        </Stage>

        <AnimatePresence>
          {status === 'finished' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center z-50">
              <div className="text-4xl font-black mb-4 tracking-tighter text-neon-magenta italic">SIMULATION_ABORTED</div>
              <div className="font-mono text-white/60 mb-8 uppercase tracking-widest text-xs">You crashed into solid matter. Avoid walls and trails.</div>
              <button onClick={restartTutorial} className="px-8 py-3 bg-neon-blue text-black font-black italic tracking-widest hover:bg-white transition-all uppercase flex items-center gap-2">
                <RefreshCcw size={16} /> RE_INITIALIZE TEST
              </button>
            </motion.div>
          )}

          {tutorialStep === TutorialStep.COMPLETE && status === 'playing' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center z-50">
              <CheckCircle2 className="text-neon-blue w-20 h-20 mb-6 drop-shadow-[0_0_15px_rgba(0,210,255,0.5)]" />
              <div className="text-4xl font-black mb-4 tracking-tighter text-white italic">TRAINING COMPLETE</div>
              <div className="font-mono text-neon-blue mb-8 uppercase tracking-widest text-xs">You are now cleared for Grid Arena entry.</div>
              <button onClick={onBack} className="px-8 py-4 bg-neon-magenta text-black font-black italic tracking-widest hover:bg-white transition-all uppercase text-xl drop-shadow-[0_0_15px_rgba(255,0,255,0.3)]">
                ENTER MAIN HUB
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex gap-8 opacity-70">
        <div className="flex flex-col items-center gap-2">
           <div className="font-mono text-[10px] uppercase">Navigation</div>
           <div className="flex gap-1">
             <div className={`w-8 h-8 border flex items-center justify-center rounded-sm ${localDir === Direction.UP ? 'bg-neon-blue text-black border-neon-blue' : 'border-cyan-500/30'}`}>W</div>
           </div>
           <div className="flex gap-1">
             <div className={`w-8 h-8 border flex items-center justify-center rounded-sm ${localDir === Direction.LEFT ? 'bg-neon-blue text-black border-neon-blue' : 'border-cyan-500/30'}`}>A</div>
             <div className={`w-8 h-8 border flex items-center justify-center rounded-sm ${localDir === Direction.DOWN ? 'bg-neon-blue text-black border-neon-blue' : 'border-cyan-500/30'}`}>S</div>
             <div className={`w-8 h-8 border flex items-center justify-center rounded-sm ${localDir === Direction.RIGHT ? 'bg-neon-blue text-black border-neon-blue' : 'border-cyan-500/30'}`}>D</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialMode;
