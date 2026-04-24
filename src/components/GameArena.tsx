import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Stage, Layer, Rect, Line, Group, Circle } from 'react-konva';
import { useAuth } from './FirebaseProvider';
import { db } from '../firebase';
import { doc, onSnapshot, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { Direction, Point, Player, GameRoom, Obstacle } from '../types';
import { GRID_SIZE, TICK_RATE, COLORS, INITIAL_POSITIONS, CANVAS_SIZE } from '../constants';
import { getNextPosition, checkCollision, isValidDirectionChange } from '../lib/gameLogic';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, XCircle, ChevronLeft } from 'lucide-react';
import { sounds } from '../lib/sounds';

interface Props {
  roomId: string;
  onQuit: () => void;
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

const GameArena: React.FC<Props> = ({ roomId, onQuit }) => {
  const { user, profile, unlockAchievement, recordGameStats } = useAuth();
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [localDir, setLocalDir] = useState<Direction>(Direction.RIGHT);
  const [scale, setScale] = useState(1);

  const gameStartTimeRef = useRef<number | null>(null);
  const statsRecordedRef = useRef<boolean>(false);

  const inputQueueRef = useRef<Direction[]>([]);
  const [_trigger, setTrigger] = useState(0);
  const [glowPulse, setGlowPulse] = useState(1);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const padding = 100;
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
  const prevObstaclesRef = useRef<Obstacle[] | undefined>(undefined);

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
    
    // Multi-layered particle burst
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 8;
      particlesRef.current.push({
        id: Math.random(),
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: color,
        size: Math.random() * 6 + 2
      });
    }

    // Add some white "flash" particles
    for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 12;
        particlesRef.current.push({
          id: Math.random(),
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.8,
          color: '#ffffff',
          size: Math.random() * 3 + 1
        });
      }
  };
  
  // Player visual position and rotation interpolation refs
  const visualPositionsRef = useRef<Record<string, { current: Point, prev: Point }>>({});
  const visualStateRef = useRef<Record<string, { rotation: number, prevRotation: number }>>({});

  const aliveRef = useRef<Record<string, boolean>>({});

  // Sync with Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as GameRoom;
        
        // Detect disappeared obstacles for explosion effects
        if (prevObstaclesRef.current && data.obstacles) {
          const vanished = prevObstaclesRef.current.filter(po => 
            !data.obstacles!.some(o => o.x === po.x && o.y === po.y)
          );
          vanished.forEach(v => {
            spawnExplosion(v.x, v.y, v.type === 'destructible' ? COLORS.MAGENTA : COLORS.CYAN);
            if (v.type === 'destructible') {
              const me = user ? data.players[user.uid] : null;
              let occlusion = getOcclusion(v.x, v.y);
              let volume = 1;
              
              if (me) {
                const dx = v.x - me.pos.x;
                const dy = v.y - me.pos.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                // Factor distance into occlusion (muffling) independently of obstacle raycast
                const distMuffle = Math.min(dist / 60, 0.5);
                occlusion = Math.min(occlusion + distMuffle, 0.9);
                // Volume attenuation
                volume = Math.max(0.05, 1 - dist / 50);
              }
              
              sounds.playExplosion(occlusion, volume); 
            }
          });
        }
        prevObstaclesRef.current = data.obstacles;

        // Check for explosions (players who just died)
        Object.entries(data.players).forEach(([uid, p]) => {
          if (!p.isAlive && aliveRef.current[uid] === true && uid !== user?.uid) {
            const me = user ? data.players[user.uid] : null;
            let occlusion = getOcclusion(p.pos.x, p.pos.y);
            let volume = 1;

            if (me) {
              const dx = p.pos.x - me.pos.x;
              const dy = p.pos.y - me.pos.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const distMuffle = Math.min(dist / 60, 0.5);
              occlusion = Math.min(occlusion + distMuffle, 0.9);
              volume = Math.max(0.05, 1 - dist / 50);
            }

            sounds.playExplosion(occlusion, volume);
          }
          aliveRef.current[uid] = p.isAlive;
        });

        setRoom(data);
        lastTickTimeRef.current = Date.now();

        // Load arena obstacles if they are missing and we are the host
        if (data.status === 'playing' && !data.obstacles && data.arenaId) {
          const pArr = Object.values(data.players);
          const isHost = pArr[0]?.uid === user?.uid;
          
          if (isHost) {
            const loadArena = async () => {
              let arenaLayout = [];
              if (data.arenaId !== 'default') {
                const arenaDoc = await getDoc(doc(db, 'arenas', data.arenaId));
                if (arenaDoc.exists()) {
                  const fullLayout = arenaDoc.data().layout || [];
                  arenaLayout = fullLayout.filter((o: any) => (o.level || 1) === 1);
                }
              }
              const roomRef = doc(db, 'rooms', roomId);
              updateDoc(roomRef, { obstacles: arenaLayout });
            };
            loadArena();
          }
        }
        
        // Update previous and current positions for interpolation
        Object.entries(data.players).forEach(([uid, p]) => {
          if (!visualPositionsRef.current[uid]) {
            visualPositionsRef.current[uid] = { prev: { ...p.pos }, current: { ...p.pos } };
          } else {
            visualPositionsRef.current[uid].prev = { ...visualPositionsRef.current[uid].current };
            visualPositionsRef.current[uid].current = { ...p.pos };
          }
          
          if (!visualStateRef.current[uid]) {
            const rot = getRotation(p.dir);
            visualStateRef.current[uid] = { rotation: rot, prevRotation: rot };
          } else {
            visualStateRef.current[uid].prevRotation = visualStateRef.current[uid].rotation;
            visualStateRef.current[uid].rotation = getRotation(p.dir);
          }
        });

        if (data.status === 'playing' && !gameStartTimeRef.current) {
          gameStartTimeRef.current = Date.now();
        }

        // If game is over, stop local loop
        if (data.status === 'finished') {
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    });
    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId]);

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

      if (nextDir) {
        setLocalDir(prev => {
          if (isValidDirectionChange(prev, nextDir!) && nextDir !== prev) {
            // Buffer the input for the next tick
            if (inputQueueRef.current.length < 2) {
              inputQueueRef.current.push(nextDir);
            }
            return nextDir;
          }
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getOcclusion = (sourceX: number, sourceY: number) => {
    if (!user || !room) return 0;
    const me = room.players[user.uid];
    if (!me) return 0;

    // Simple 2D raycast: count trails between me and source
    const dx = sourceX - me.pos.x;
    const dy = sourceY - me.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return 0;

    let occlusion = 0;
    const steps = Math.floor(dist);
    for (let i = 1; i < steps; i++) {
      const checkX = Math.round(me.pos.x + (dx / dist) * i);
      const checkY = Math.round(me.pos.y + (dy / dist) * i);
      
      // Check if this grid cell has a trail
      const hasTrail = Object.values(room.players).some(p => 
        p.trail.some(t => t.x === checkX && t.y === checkY)
      );
      
      if (hasTrail) occlusion += 0.3;
    }
    
    return Math.min(occlusion, 0.9);
  };

  // Game Loop (Local Authority for local player)
  const tick = useCallback(async () => {
    if (!room || room.status !== 'playing' || !user) return;
    
    const roomRef = doc(db, 'rooms', roomId);
    const pArr = Object.values(room.players);
    const isHost = pArr[0]?.uid === user?.uid;

    if (isHost && room.status === 'playing' && room.timeLeft !== undefined && room.timeLeft > 0) {
      if (Math.floor(Date.now() / 1000) > Math.floor(lastTickTimeRef.current / 1000)) {
        updateDoc(roomRef, {
          timeLeft: room.timeLeft - 1
        });
      }
    }

    if (isHost && room.status === 'playing' && room.timeLeft === 0) {
      await updateDoc(roomRef, { status: 'finished' });
    }

    const me = room.players[user.uid];
    if (!me || !me.isAlive) return;

    // Use queued input if available
    let currentMoveDir = localDir;
    if (inputQueueRef.current.length > 0) {
      currentMoveDir = inputQueueRef.current.shift()!;
    }

    const nextPos = getNextPosition(me.pos, currentMoveDir);
    const { x: nextX, y: nextY } = nextPos;

    // Collect all trail points from all players
    const allTrailPoints = Object.values(room.players).flatMap(p => [...p.trail, p.pos]);
    const { collision: baseCollision, hitObstacleIndex } = checkCollision(nextPos, allTrailPoints, room.obstacles || []);
    
    let collision = baseCollision;

    if (hitObstacleIndex !== -1) {
      const hitObstacle = room.obstacles![hitObstacleIndex];
      // If destructible, remove it from the grid
      if (hitObstacle.type === 'destructible') {
        collision = false; // Override collision for destructibles (allows passing through)
        const newObstacles = [...room.obstacles!];
        newObstacles.splice(hitObstacleIndex, 1);
        updateDoc(roomRef, { obstacles: newObstacles });
        spawnExplosion(nextX, nextY, COLORS.MAGENTA);
      } else {
        collision = true;
      }
    }

    if (collision) {
      sounds.playImpact();
      await updateDoc(roomRef, {
        [`players.${user.uid}.isAlive`]: false
      });
      return;
    }

    // Update position and trail
    await updateDoc(roomRef, {
      [`players.${user.uid}.pos`]: { x: nextX, y: nextY },
      [`players.${user.uid}.dir`]: currentMoveDir,
      [`players.${user.uid}.trail`]: arrayUnion(me.pos)
    });

    sounds.playMove();
  }, [room, user, localDir, roomId]);

  // Visual Effects Loop (Animation)
  const animate = useCallback((time: number) => {
    // Subtle pulse for fragile nodes (aligned with editor material logic)
    setGlowPulse(0.85 + Math.sin(time / 400) * 0.15);

    // Update Particles
    particlesRef.current = particlesRef.current
      .map(p => ({
        ...p,
        x: p.x + p.vx,
        y: p.y + p.vy,
        life: p.life - 0.015,
        size: p.size * 0.99
      }))
      .filter(p => p.life > 0);

    // Spawn particles & Update Visual State
    if (room?.status === 'playing') {
      const now = Date.now();
      const t = Math.min(1, (now - lastTickTimeRef.current) / TICK_RATE);

      Object.values(room.players).forEach(p => {
        if (!p.isAlive) return;

        // Initialize or update visual state
        if (!visualStateRef.current[p.uid]) {
          visualStateRef.current[p.uid] = { 
            rotation: getRotation(p.dir),
            prevRotation: getRotation(p.dir)
          };
        }

        const state = visualStateRef.current[p.uid];
        const targetRot = getRotation(p.dir);
        
        // Handle rotation shortest path wrap-around
        let diff = targetRot - state.prevRotation;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        const currentRot = state.prevRotation + diff * t;
        const visualX = p.pos.x; // Use tick-based target for particle spawn
        const visualY = p.pos.y; 
        
        const spawnCount = Math.random() > 0.5 ? 2 : 1;
        for(let i = 0; i < spawnCount; i++) {
          const centerX = visualX * GRID_SIZE + GRID_SIZE / 2;
          const centerY = visualY * GRID_SIZE + GRID_SIZE / 2;
          
          const newParticle: Particle = {
            id: Math.random(),
            x: centerX + (Math.random() - 0.5) * 5,
            y: centerY + (Math.random() - 0.5) * 5,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            life: 1.0,
            color: p.color,
            size: Math.random() * 4 + 1
          };
          
          if (particlesRef.current.length < 500) {
            particlesRef.current.push(newParticle);
          }
        }
      });
    }

    setTrigger(prev => prev + 1);
    requestRef.current = requestAnimationFrame(animate);
  }, [room]);

  useEffect(() => {
    if (room?.status === 'playing' && !timerRef.current) {
      timerRef.current = setInterval(tick, TICK_RATE);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [room?.status, tick]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  const playersArr = room ? Object.values(room.players) : [];
  const alivePlayers = playersArr.filter(p => p.isAlive);
  const isGameOver = room ? (room.status === 'finished' || (room.status === 'playing' && alivePlayers.length <= 1)) : false;
  const winner = isGameOver ? (alivePlayers[0]?.name || room?.winner || 'NONE') : null;

  useEffect(() => {
    if (isGameOver && winner && winner === profile?.displayName && unlockAchievement) {
      unlockAchievement('first_win');
    }
    
    if (isGameOver && !statsRecordedRef.current && room?.status === 'playing') {
      const timeElapsed = gameStartTimeRef.current ? Math.floor((Date.now() - gameStartTimeRef.current) / 1000) : 0;
      const didWin = winner === profile?.displayName;
      if (recordGameStats) {
        recordGameStats(didWin, timeElapsed);
      }
      statsRecordedRef.current = true;
    }
  }, [isGameOver, winner, profile?.displayName, unlockAchievement, recordGameStats, room?.status]);

  useEffect(() => {
    if (room && isGameOver && room.status !== 'finished') {
      const roomRef = doc(db, 'rooms', roomId);
      updateDoc(roomRef, { 
        status: 'finished',
        winner: winner || 'NONE'
      });
    }
  }, [isGameOver, room?.status, roomId, winner, room]);

  useEffect(() => {
    if (isGameOver) {
      sounds.playGameOver();
    }
  }, [isGameOver]);

  if (!room) return null;

  const restartGame = async () => {
    const roomRef = doc(db, 'rooms', roomId);
    const resetPlayers: Record<string, Player> = {};
    const playerColors = [COLORS.CYAN, COLORS.MAGENTA, COLORS.YELLOW, COLORS.GREEN];
    
    playersArr.forEach((p, i) => {
      resetPlayers[p.uid] = {
        ...p,
        isAlive: true,
        pos: INITIAL_POSITIONS[i] ? { x: INITIAL_POSITIONS[i].x, y: INITIAL_POSITIONS[i].y } : { x: 0, y: 0 },
        dir: INITIAL_POSITIONS[i] ? INITIAL_POSITIONS[i].dir : Direction.RIGHT,
        trail: []
      };
    });

    // Re-load obstacles from arena if it's a custom one
    let arenaLayout = [];
    if (room.arenaId !== 'default') {
      const arenaDoc = await getDoc(doc(db, 'arenas', room.arenaId));
      if (arenaDoc.exists()) {
        arenaLayout = arenaDoc.data().layout || [];
      }
    }

    gameStartTimeRef.current = Date.now();
    statsRecordedRef.current = false;

    await updateDoc(roomRef, {
      status: 'playing',
      players: resetPlayers,
      obstacles: arenaLayout,
      timeLeft: 120,
      winner: null
    });
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center h-full relative glass-panel">
      <div className="absolute top-4 left-4 flex gap-4 items-center z-20">
        <div className="font-mono text-[10px] tracking-[2px] text-white/40 uppercase">
          Node_Link: <span className="text-neon-blue">{roomId.slice(0, 8)}</span>
        </div>
        <div className="h-4 w-[1px] bg-white/10 mx-2" />
        <div className="font-mono text-[10px] tracking-[2px] text-white/40 uppercase">
          Logic_Sync: <span className={room?.timeLeft && room.timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-neon-magenta'}>
            {room?.timeLeft !== undefined ? `${Math.floor(room.timeLeft / 60)}:${(room.timeLeft % 60).toString().padStart(2, '0')}` : '00:00'}
          </span>
        </div>
      </div>

      <div className="absolute top-4 right-4 flex flex-col gap-1 items-end z-20">
        {playersArr.map(p => (
          <div key={p.uid} className={`flex items-center gap-2 font-mono text-[9px] uppercase tracking-wider ${p.isAlive ? 'text-white' : 'line-through opacity-30 italic'}`}>
            <div className="w-2 h-2" style={{ backgroundColor: p.color, boxShadow: `0 0 5px ${p.color}` }} />
            <span>{p.name.slice(0, 10)} {p.uid === user?.uid ? '(LOCAL)' : ''}</span>
          </div>
        ))}
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
            {/* Ambient Background Glow */}
            <Rect 
                x={0} 
                y={0} 
                width={CANVAS_SIZE} 
                height={CANVAS_SIZE} 
                fill="black" 
                opacity={0.1}
                shadowColor="rgba(0, 210, 255, 0.2)"
                shadowBlur={30 + 15 * Math.sin(glowPulse * 8)}
            />

            {/* Grid */}
            {Array.from({ length: 41 }).map((_, i) => {
              const lineOpacity = 0.1 + (Math.sin(i * 0.2 + glowPulse * 4) * 0.1 + 0.1);
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

            {/* Arena Obstacles */}
            {room.obstacles?.map((o, i) => (
              <Group key={`obs-${i}`}>
                <Rect
                  x={o.x * GRID_SIZE}
                  y={o.y * GRID_SIZE}
                  width={GRID_SIZE}
                  height={GRID_SIZE}
                  fill={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  opacity={o.type === 'wall' ? 0.6 : 0.4 + 0.4 * glowPulse}
                  stroke={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  strokeWidth={1}
                  shadowColor={o.type === 'wall' ? COLORS.CYAN : COLORS.MAGENTA}
                  shadowBlur={o.type === 'wall' ? 10 : 30 * glowPulse}
                  shadowOpacity={o.type === 'wall' ? 0.5 : 0.4 + 0.4 * glowPulse}
                />
                {o.type === 'destructible' && (
                  <Rect
                    x={o.x * GRID_SIZE + GRID_SIZE * 0.5}
                    y={o.y * GRID_SIZE + GRID_SIZE * 0.5}
                    width={GRID_SIZE * 0.5}
                    height={GRID_SIZE * 0.5}
                    offsetX={GRID_SIZE * 0.25}
                    offsetY={GRID_SIZE * 0.25}
                    scaleX={0.8 + 0.4 * (glowPulse - 0.7)}
                    scaleY={0.8 + 0.4 * (glowPulse - 0.7)}
                    fill="white"
                    opacity={0.3 + 0.5 * glowPulse}
                    cornerRadius={1}
                    shadowColor="white"
                    shadowBlur={10 * glowPulse}
                    shadowOpacity={0.8}
                  />
                )}
              </Group>
            ))}

            {/* Particles */}
            {particlesRef.current.map(p => (
              <Circle
                key={p.id}
                x={p.x}
                y={p.y}
                radius={p.size}
                fill={p.color}
                opacity={p.life}
                shadowColor={p.color}
                shadowBlur={5}
              />
            ))}

            {/* Players and Trails */}
            {playersArr.map(p => {
              const now = Date.now();
              const t = Math.min(1, (now - lastTickTimeRef.current) / TICK_RATE);
              
              // Position Interpolation
              let vPos = visualPositionsRef.current[p.uid];
              if (!vPos) {
                 vPos = { prev: p.pos, current: p.pos };
                 visualPositionsRef.current[p.uid] = vPos;
              }
              const visualX = vPos.prev.x + (vPos.current.x - vPos.prev.x) * t;
              const visualY = vPos.prev.y + (vPos.current.y - vPos.prev.y) * t;

              // Rotation Interpolation
              const targetRot = getRotation(p.dir);
              const prevRot = getRotation(p.trail.length > 0 ? Direction.RIGHT : p.dir); // Simplified fallback
              
              // More robust rotation tracking
              const state = visualStateRef.current[p.uid];
              let currentRot = targetRot;
              
              if (state) {
                let diff = targetRot - state.prevRotation;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                currentRot = state.prevRotation + diff * t;
              }

              return (
                <Group key={p.uid}>
                  {/* Glow Layer */}
                  <Line
                    points={[
                      ...p.trail.flatMap(pt => [pt.x * GRID_SIZE + GRID_SIZE/2, pt.y * GRID_SIZE + GRID_SIZE/2]),
                      visualX * GRID_SIZE + GRID_SIZE/2, visualY * GRID_SIZE + GRID_SIZE/2
                    ]}
                    stroke={p.color}
                    strokeWidth={12}
                    lineJoin="round"
                    opacity={p.isAlive ? 0.15 * glowPulse : 0.05}
                    shadowColor={p.color}
                    shadowBlur={25}
                  />
                  <Line
                    points={[
                      ...p.trail.flatMap(pt => [pt.x * GRID_SIZE + GRID_SIZE/2, pt.y * GRID_SIZE + GRID_SIZE/2]),
                      visualX * GRID_SIZE + GRID_SIZE/2, visualY * GRID_SIZE + GRID_SIZE/2
                    ]}
                    stroke={p.color}
                    strokeWidth={6}
                    lineJoin="round"
                    opacity={p.isAlive ? 0.3 * glowPulse : 0.1}
                    shadowColor={p.color}
                    shadowBlur={10}
                  />
                  {/* Main Trail */}
                  <Line
                    points={[
                      ...p.trail.flatMap(pt => [pt.x * GRID_SIZE + GRID_SIZE/2, pt.y * GRID_SIZE + GRID_SIZE/2]),
                      visualX * GRID_SIZE + GRID_SIZE/2, visualY * GRID_SIZE + GRID_SIZE/2
                    ]}
                    stroke={p.color}
                    strokeWidth={4}
                    lineJoin="round"
                    opacity={p.isAlive ? 0.9 : 0.3}
                  />
                  
                  {/* Head with Smooth Rotation */}
                  {p.isAlive && (
                    <Group 
                      x={visualX * GRID_SIZE + GRID_SIZE/2} 
                      y={visualY * GRID_SIZE + GRID_SIZE/2}
                      rotation={currentRot}
                      offsetX={0}
                      offsetY={0}
                    >
                      {/* Trail "Connector" to smooth the gap during interpolation */}
                      <Rect
                        x={-GRID_SIZE/2}
                        y={-GRID_SIZE/2}
                        width={GRID_SIZE}
                        height={GRID_SIZE}
                        fill={p.color}
                        shadowColor={p.color}
                        shadowBlur={20}
                        shadowOpacity={1}
                        cornerRadius={2}
                      />
                      {/* Core Eye / Visual Front */}
                      <Rect
                        x={0}
                        y={-GRID_SIZE/4}
                        width={GRID_SIZE/2}
                        height={GRID_SIZE/2}
                        fill="white"
                        cornerRadius={1}
                      />
                      {/* Directional Accent */}
                      <Rect
                        x={GRID_SIZE/4}
                        y={-1}
                        width={GRID_SIZE/4}
                        height={2}
                        fill="black"
                        opacity={0.5}
                      />
                    </Group>
                  )}
                </Group>
              );
            })}
          </Layer>
        </Stage>

        {/* HUD Notifications */}
        <AnimatePresence>
          {room.status === 'waiting' && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="text-3xl font-black mb-4">WAITING FOR CHALLENGERS...</div>
              <div className="font-mono text-cyan-200/60 mb-8">System synchronization required for initiative.</div>
              <div className="flex gap-2">
                {playersArr.map((_, i) => (
                   <div key={i} className="w-4 h-4 bg-cyan-500 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </motion.div>
          )}

          {isGameOver && (
             <motion.div 
               initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }}
               className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center z-50"
             >
               <Trophy size={80} className="text-yellow-400 mb-6 drop-shadow-[0_0_20px_rgba(250,204,21,0.5)]" />
               <div className="text-5xl font-black mb-2 tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-b from-white to-white/40">SIMULATION COMPLETE</div>
               <div className="text-2xl font-mono text-yellow-400 mb-8 whitespace-nowrap uppercase tracking-widest">
                 Winner: <span className="text-white drop-shadow-[0_0_10px_white]">{winner}</span>
               </div>
               
               <div className="flex gap-4">
                 <button 
                   onClick={restartGame}
                   className="px-8 py-3 bg-neon-blue text-black font-black italic tracking-widest hover:bg-white transition-all uppercase"
                 >
                   RE-INITIALIZE Simulation
                 </button>
                 <button 
                   onClick={onQuit}
                   className="px-8 py-3 border border-white/20 text-white font-mono tracking-widest hover:bg-white/10 transition-all uppercase"
                 >
                   RETURN TO HUB
                 </button>
               </div>
             </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex gap-8">
        <div className="flex flex-col items-center gap-2 opacity-40">
           <div className="font-mono text-[10px] uppercase">Navigation</div>
           <div className="flex gap-1">
             <div className="w-8 h-8 border border-cyan-500 flex items-center justify-center rounded-sm">W</div>
           </div>
           <div className="flex gap-1">
             <div className="w-8 h-8 border border-cyan-500 flex items-center justify-center rounded-sm">A</div>
             <div className="w-8 h-8 border border-cyan-500 flex items-center justify-center rounded-sm">S</div>
             <div className="w-8 h-8 border border-cyan-500 flex items-center justify-center rounded-sm">D</div>
           </div>
        </div>
        <div className="flex flex-col justify-center max-w-xs italic text-cyan-300/40 text-xs">
          "The Grid. A digital frontier. I tried to picture clusters of information as they moved through the computer. Ships, motorcycles..."
        </div>
      </div>
    </div>
  );
};

export default GameArena;
