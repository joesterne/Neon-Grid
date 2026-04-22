import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { useAuth } from './FirebaseProvider';
import { GameRoom, Player, Direction, Obstacle } from '../types';
import { COLORS, INITIAL_POSITIONS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Users, Play, ArrowLeft, Map as MapIcon, ChevronDown, Check } from 'lucide-react';

interface Props {
  onJoinRoom: (id: string) => void;
  onBack: () => void;
}

interface ArenaTemplate {
  id: string;
  name: string;
  layout: Obstacle[];
}

const Lobby: React.FC<Props> = ({ onJoinRoom, onBack }) => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [arenas, setArenas] = useState<ArenaTemplate[]>([]);
  const [selectedArena, setSelectedArena] = useState<string>('default');
  const [showArenaSelect, setShowArenaSelect] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'rooms'), where('status', '==', 'waiting'));
    const unsub = onSnapshot(q, (snap) => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as GameRoom)));
    });

    const fetchArenas = async () => {
      try {
        const arenaSnap = await getDocs(query(collection(db, 'arenas'), where('isPublic', '==', true)));
        const arenaList = arenaSnap.docs.map(d => ({ id: d.id, name: d.data().name, layout: d.data().layout } as ArenaTemplate));
        setArenas([{ id: 'default', name: 'Standard_Grid', layout: [] }, ...arenaList]);
      } catch (err) {
        console.error("FAILED_TO_FETCH_ARENAS:", err);
        setArenas([{ id: 'default', name: 'Standard_Grid', layout: [] }]);
      }
    };
    fetchArenas();

    return () => unsub();
  }, []);

  const createRoom = async () => {
    if (!user) return;
    setIsCreating(true);
    try {
      const playerColors = [COLORS.CYAN, COLORS.MAGENTA, COLORS.YELLOW, COLORS.GREEN];
      const initialPlayer: Player = {
        uid: user.uid,
        name: user.displayName || 'Anonymous',
        color: playerColors[0],
        pos: { x: INITIAL_POSITIONS[0].x, y: INITIAL_POSITIONS[0].y },
        dir: INITIAL_POSITIONS[0].dir,
        trail: [],
        isAlive: true,
        score: 0
      };

      const docRef = await addDoc(collection(db, 'rooms'), {
        status: 'waiting',
        players: { [user.uid]: initialPlayer },
        arenaId: selectedArena,
        powerUps: [],
        createdAt: serverTimestamp()
      });
      onJoinRoom(docRef.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const joinRoom = async (roomId: string) => {
    if (!user) return;
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.players[user.uid]) {
      onJoinRoom(roomId);
      return;
    }

    const playerCount = Object.keys(room.players).length;
    if (playerCount >= 4) return;

    const playerColors = [COLORS.CYAN, COLORS.MAGENTA, COLORS.YELLOW, COLORS.GREEN];
    const newPlayer: Player = {
      uid: user.uid,
      name: user.displayName || 'Anonymous',
      color: playerColors[playerCount],
      pos: INITIAL_POSITIONS[playerCount] ? { x: INITIAL_POSITIONS[playerCount].x, y: INITIAL_POSITIONS[playerCount].y } : { x: 0, y: 0 },
      dir: INITIAL_POSITIONS[playerCount] ? INITIAL_POSITIONS[playerCount].dir : Direction.RIGHT,
      trail: [],
      isAlive: true,
      score: 0
    };

    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      [`players.${user.uid}`]: newPlayer,
      status: playerCount + 1 >= 2 ? 'playing' : 'waiting',
      timeLeft: playerCount + 1 >= 2 ? 120 : undefined
    });
    onJoinRoom(roomId);
  };

  return (
    <div className="h-full flex flex-col p-8 glass-panel relative">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[11px] uppercase tracking-[4px] text-white/50 font-sans">Multiplayer // Sector Nodes</h2>
        
        <div className="relative">
          <button 
            onClick={() => setShowArenaSelect(!showArenaSelect)}
            className="flex items-center gap-3 px-4 py-2 border border-white/10 bg-white/5 hover:bg-white/10 transition-all group"
          >
            <MapIcon size={14} className="text-neon-blue" />
            <span className="font-mono text-[10px] uppercase tracking-[2px] text-white/60">
              {arenas.find(a => a.id === selectedArena)?.name || 'Select_Arena'}
            </span>
            <ChevronDown size={14} className={`text-white/20 transition-transform ${showArenaSelect ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showArenaSelect && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full right-0 mt-2 w-64 bg-black border border-white/10 shadow-2xl z-50 p-2 space-y-1"
              >
                {arenas.map(arena => (
                  <button
                    key={arena.id}
                    onClick={() => {
                      setSelectedArena(arena.id);
                      setShowArenaSelect(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left font-mono text-[9px] uppercase tracking-widest transition-all ${
                      selectedArena === arena.id 
                        ? 'bg-neon-blue text-black' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span>{arena.name}</span>
                    {selectedArena === arena.id && <Check size={12} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto custom-scrollbar pr-4">
        {/* Create Card */}
        <button 
          onClick={createRoom}
          disabled={isCreating}
          className="h-48 border border-dashed border-neon-blue/30 bg-white/5 hover:bg-neon-blue/5 hover:border-neon-blue transition-all flex flex-col items-center justify-center gap-3 group"
        >
          <Plus size={24} className="text-neon-blue group-hover:scale-110 transition-transform" />
          <span className="font-mono text-[10px] uppercase tracking-[2px]">Initialize Node</span>
        </button>

        {rooms.map(room => (
          <div key={room.id} className="h-48 border border-white/10 bg-white/5 p-5 flex flex-col justify-between hover:border-neon-blue transition-all">
            <div>
              <div className="text-[10px] font-mono text-neon-blue/60 mb-3 tracking-widest uppercase">Node_{room.id.slice(0, 8)}</div>
              <div className="flex -space-x-1.5 mb-4">
                {Object.values(room.players).map(p => (
                   <div key={p.uid} className="w-8 h-8 rounded-full border border-black bg-white/10 flex items-center justify-center text-[10px] font-bold" style={{ borderColor: p.color }}>
                     {p.name[0]}
                   </div>
                ))}
              </div>
              <div className="text-[10px] font-mono text-white/50 flex items-center gap-2 uppercase">
                <Users size={12} />
                {Object.keys(room.players).length} / 4 Programs
              </div>
            </div>

            <button 
              onClick={() => joinRoom(room.id)}
              className="w-full py-2 bg-neon-blue/10 border border-neon-blue/50 text-neon-blue font-mono text-[10px] hover:bg-neon-blue hover:text-black transition-all uppercase tracking-widest"
            >
              Link Node
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Lobby;
