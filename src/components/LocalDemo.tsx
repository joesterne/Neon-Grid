import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Group, Circle } from 'react-konva';
import { useAuth } from './FirebaseProvider';
import { Direction, Point, Player, Obstacle } from '../types';
import { GRID_SIZE, COLORS, INITIAL_POSITIONS, CANVAS_SIZE } from '../constants';
import { getNextPosition, checkCollision, isValidDirectionChange } from '../lib/gameLogic';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, RefreshCcw, ArrowLeft } from 'lucide-react';
import { sounds } from '../lib/sounds';

interface Props {
  obstacles: Obstacle[];
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

const TICK_RATE = 100; // Local demo can be slightly faster or same

const LocalDemo: React.FC<Props> = ({ obstacles, onBack }) => {
  const { profile } = useAuth();
  const [player, setPlayer] = useState<Player>({
    uid: 'local-test',
    name: profile?.displayName || 'SIM_AVATAR',
    color: COLORS.CYAN,
    pos: { x: 5, y: 5 },
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
  const [activeObstacles, setActiveObstacles] = useState<Obstacle[]>(obstacles);
  const [pulse, setPulse] = useState(1);
  const [scale, setScale] = useState(1);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const padding = 120; // Extra padding for LocalDemo UI
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
  const visualPosRef = useRef<{ current: Point, prev: Point }>({ prev: { x: 5, y: 5 }, current: { x: 5, y: 5 } });
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
            id: Math.random(),
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: color,
            size: Math.random() * 5 + 2
        });
    }
  };

  const restartDemo = () => {
    setPlayer({
      uid: 'local-test',
      name: profile?.displayName || 'SIM_AVATAR',
      color: COLORS.CYAN,
      pos: { x: 5, y: 5 },
      dir: Direction.RIGHT,
      trail: [],
      isAlive: true,
      score: 0
    });
    setLocalDir(Direction.RIGHT);
    inputQueueRef.current = [];
    setActiveObstacles(obstacles);
    setStatus('playing');
    visualPosRef.current = { prev: { x: 5, y: 5 }, current: { x: 5, y: 5 } };
    const rot = getRotation(Direction.RIGHT);
    visualRotRef.current = { rotation: rot, prevRotation: rot };
    lastTickTimeRef.current = Date.now();
  };

  // Input Handling
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
        setLocalDir(prev => {
          if (isValidDirectionChange(prev, nextDir!) && nextDir !== prev) {
            if (inputQueueRef.current.length < 2) {
              inputQueueRef.current.push(nextDir!);
            }
            return nextDir!;
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  // Tick Logic
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
      // Destructible logic
      if (hitObstacle.type === 'destructible') {
        setActiveObstacles(prev => {
          const next = [...prev];
          next.splice(hitObstacleIndex, 1);
          return next;
        });
        spawnExplosion(nextPos.x, nextPos.y, COLORS.MAGENTA);
        sounds.playExplosion(0, 1);
      }
    }

    if (collision) {
      sounds.playImpact();
      setPlayer(prev => ({ ...prev, isAlive: false }));
      setStatus('finished');
      return;
    }

    const { x: nextX, y: nextY } = nextPos;

    // Update Player
    setPlayer(prev => ({
      ...prev,
      pos: { x: nextX, y: nextY },
      dir: currentMoveDir,
      trail: [...prev.trail, prev.pos]
    }));

    // Update Interpolation
    visualPosRef.current.prev = { ...visualPosRef.current.current };
    visualPosRef.current.current = { x: nextX, y: nextY };
    
    visualRotRef.current.prevRotation = visualRotRef.current.rotation;
    visualRotRef.current.rotation = getRotation(currentMoveDir);

    lastTickTimeRef.current = Date.now();
    sounds.playMove();
  }, [player, localDir, status, activeObstacles]);

  // Animation Loop
  const animate = useCallback((time: number) => {
    setGlowPulse(0.8 + Math.sin(time / 200) * 0.2);
    setPulse(0.85 + Math.sin(time / 400) * 0.15);

    particlesRef.current = particlesRef.current
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - 0.015,
        size: p.size * 0.99
      }))
      .filter(p => p.life > 0);

    if (status === 'playing' && player.isAlive) {
      const centerX = visualPosRef.current.current.x * GRID_SIZE + GRID_SIZE / 2;
      const centerY = visualPosRef.current.current.y * GRID_SIZE + GRID_SIZE / 2;
      
      if (Math.random() > 0.5) {
        particlesRef.current.push({
          id: Math.random(),
          x: centerX + (Math.random() - 0.5) * 5,
          y: centerY + (Math.random() - 0.5) * 5,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1.0,
          color: player.color,
          size: Math.random() * 4 + 1
        });
      }
    }

    setTrigger(prev => prev + 1);
    requestRef.current = requestAnimationFrame(animate);
  }, [status, player.isAlive, player.color]);

  useEffect(() => {
    if (status === 'playing') {
      timerRef.current = setInterval(tick, TICK_RATE);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, tick]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  // Visual position for rendering
  const now = Date.now();
  const t = Math.min(1, (now - lastTickTimeRef.current) / TICK_RATE);
  const vX = visualPosRef.current.prev.x + (visualPosRef.current.current.x - visualPosRef.current.prev.x) * t;
  const vY = visualPosRef.current.prev.y + (visualPosRef.current.current.y - visualPosRef.current.prev.y) * t;

  let diff = visualRotRef.current.rotation - visualRotRef.current.prevRotation;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const vRot = visualRotRef.current.prevRotation + diff * t;

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center h-full relative glass-panel p-8">
      <div className="absolute top-4 left-4 flex gap-6 items-center z-20">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-neon-blue hover:text-white font-mono text-xs group transition-all"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          EXIT_SIMULATION
        </button>
        <div className="h-4 w-[1px] bg-white/10" />
        <div className="font-mono text-[10px] tracking-[4px] text-white/40 uppercase">
          Mode: <span className="text-neon-magenta">LOCAL_TEST_ENVIRONMENT</span>
        </div>
      </div>

      <div 
        className="relative border border-neon-blue/20 bg-black/80 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center"
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
          ref={stageRef}
        >
          <Layer>
            {/* Grid */}
            {Array.from({ length: 41 }).map((_, i) => (
              <React.Fragment key={i}>
                <Line points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_SIZE]} stroke={COLORS.GRID} strokeWidth={1} opacity={0.3} />
                <Line points={[0, i * GRID_SIZE, CANVAS_SIZE, i * GRID_SIZE]} stroke={COLORS.GRID} strokeWidth={1} opacity={0.3} />
              </React.Fragment>
            ))}

            {/* Obstacles */}
            {activeObstacles.map((o, i) => (
              <Group key={`obs-${i}`}>
                <Rect
                  x={o.x * GRID_SIZE} y={o.y * GRID_SIZE}
                  width={GRID_SIZE} height={GRID_SIZE}
                  fill={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  opacity={o.type === 'wall' ? 0.6 : 0.4 + 0.4 * pulse}
                  stroke={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  strokeWidth={1}
                  shadowColor={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  shadowBlur={o.type === 'wall' ? 10 : 30 * pulse}
                  shadowOpacity={o.type === 'wall' ? 0.5 : 0.4 + 0.4 * pulse}
                />
                {o.type === 'destructible' && (
                  <Rect
                    x={o.x * GRID_SIZE + GRID_SIZE * 0.5}
                    y={o.y * GRID_SIZE + GRID_SIZE * 0.5}
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

            {/* Particles */}
            {particlesRef.current.map(p => (
              <Circle key={p.id} x={p.x} y={p.y} radius={p.size} fill={p.color} opacity={p.life} shadowColor={p.color} shadowBlur={5} />
            ))}

            {/* Player Trail */}
            <Line
              points={[
                ...player.trail.flatMap(pt => [pt.x * GRID_SIZE + GRID_SIZE/2, pt.y * GRID_SIZE + GRID_SIZE/2]),
                vX * GRID_SIZE + GRID_SIZE/2, vY * GRID_SIZE + GRID_SIZE/2
              ]}
              stroke={player.color} strokeWidth={4} lineJoin="round" opacity={player.isAlive ? 0.9 : 0.3}
            />
            
            {/* Player Head */}
            {player.isAlive && (
              <Group x={vX * GRID_SIZE + GRID_SIZE/2} y={vY * GRID_SIZE + GRID_SIZE/2} rotation={vRot}>
                <Rect x={-GRID_SIZE/2} y={-GRID_SIZE/2} width={GRID_SIZE} height={GRID_SIZE} fill={player.color} shadowColor={player.color} shadowBlur={20} cornerRadius={2} />
                <Rect x={0} y={-GRID_SIZE/4} width={GRID_SIZE/2} height={GRID_SIZE/2} fill="white" cornerRadius={1} />
              </Group>
            )}
          </Layer>
        </Stage>
      </div>

      <AnimatePresence>
        {status === 'finished' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50 backdrop-blur-sm"
          >
            <div className="max-w-xl w-full glass-panel p-12 flex flex-col items-center">
              <div className="text-4xl sm:text-5xl font-black mb-4 tracking-tighter text-neon-magenta italic">SIMULATION_ABORTED</div>
              <div className="font-mono text-white/60 mb-10 uppercase tracking-widest text-sm text-center">Collision detected in primary logic path. <br/><span className="text-neon-cyan opacity-80 mt-2 block">Structural adjustments required.</span></div>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <button 
                  onClick={restartDemo}
                  className="px-8 py-3 bg-neon-blue text-black font-black italic tracking-widest hover:bg-white transition-all uppercase flex items-center gap-2"
                >
                  <RefreshCcw size={16} /> RE_INITIALIZE
                </button>
                <button 
                  onClick={onBack}
                  className="px-8 py-3 border border-white/20 text-white font-mono tracking-widest hover:bg-white/10 transition-all uppercase"
                >
                  EXIT_WORKBENCH
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="font-mono text-[10px] text-white/40 uppercase tracking-[4px]">Simulation_Controls: WASD // ARROWS</div>
        <p className="max-w-md text-center text-xs text-cyan-300/40 italic">
          Verify movement physics and structural integrity before committing to the main grid archive.
        </p>
      </div>
    </div>
  );
};

export default LocalDemo;
