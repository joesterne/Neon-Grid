import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './FirebaseProvider';
import { motion } from 'motion/react';
import { Share2, Trash2, Play } from 'lucide-react';

interface Props {
  onBack: () => void;
  onPlayArena: (arenaId: string) => void;
}

export default function SavedArenas({ onBack, onPlayArena }: Props) {
  const { user } = useAuth();
  const [arenas, setArenas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadArenas();
    }
  }, [user]);

  const loadArenas = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'arenas'), where('creatorId', '==', user?.uid));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setArenas(data);
    } catch (e) {
      console.error("Failed to load arenas", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("PURGE_PROTOCOL_INITIATED: Verify deletion of arena?")) {
      await deleteDoc(doc(db, 'arenas', id));
      setArenas(prev => prev.filter(a => a.id !== id));
    }
  };

  const [shareMsg, setShareMsg] = useState<{ id: string, text: string } | null>(null);

  const handleShare = async (id: string, name: string) => {
    const url = `${window.location.origin}?arena=${id}`;
    
    const fallbackCopy = () => {
      navigator.clipboard.writeText(url).then(() => {
        setShareMsg({ id, text: 'COPIED TO CLIPBOARD' });
        setTimeout(() => setShareMsg(null), 3000);
      }).catch(() => {
        window.open(`https://twitter.com/intent/tweet?text=Check out my custom Neon Grid arena!&url=${encodeURIComponent(url)}`, '_blank');
      });
    };

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Play my arena: ${name}`,
          text: 'Check out this Neon Grid arena I built!',
          url: url
        });
      } catch (e: any) {
        if (e.name !== 'AbortError' && !e.message?.includes('canceled')) {
          fallbackCopy();
        }
      }
    } else {
      fallbackCopy();
    }
  };

  return (
    <div className="absolute inset-0 bg-black flex flex-col p-8 z-20">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-4xl font-black text-neon-blue uppercase tracking-widest italic drop-shadow-[0_0_10px_rgba(0,210,255,0.6)]">Archived Arrays</h1>
          <div className="font-mono text-neon-blue/60 tracking-[4px] uppercase text-xs mt-1">Local Configuration Storage // {arenas.length} Segments</div>
        </div>
        <button 
          onClick={onBack}
          className="border border-neon-blue/30 text-neon-blue hover:bg-neon-blue/10 px-6 py-2 font-mono text-[10px] uppercase tracking-widest transition-all"
        >
          RETURN_TO_HUB
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar flex flex-col gap-4">
        {loading ? (
          <div className="text-neon-blue font-mono uppercase tracking-widest">LOADING_DATA_BANKS...</div>
        ) : arenas.length === 0 ? (
          <div className="text-white/40 font-mono text-sm uppercase tracking-widest border border-white/10 p-12 text-center bg-white/5 backdrop-blur-sm">
            NO_ARCHIVES_DETECTED. INITIATE GRID EDITOR TO CONSTRUCT.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {arenas.map(arena => (
              <motion.div 
                key={arena.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-6 border border-white/10 hover:border-neon-blue/50 transition-all flex flex-col relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-xl font-bold text-white mb-2 uppercase z-10">{arena.name || 'UNNAMED_SECTOR'}</h3>
                <div className="text-[10px] font-mono text-white/40 mb-6 z-10">Created: {arena.createdAt ? new Date(arena.createdAt.seconds * 1000).toLocaleDateString() : 'UNKNOWN'}</div>
                
                <div className="flex gap-2 mt-auto z-10">
                  <button 
                    onClick={() => onPlayArena(arena.id)}
                    className="flex-1 py-2 bg-neon-blue/10 hover:bg-neon-blue/20 text-neon-blue border border-neon-blue/30 font-mono text-[10px] uppercase tracking-widest flex justify-center items-center gap-2 transition-all"
                  >
                    <Play size={14} /> ENGAGE
                  </button>
                  <button 
                    onClick={() => handleShare(arena.id, arena.name)}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-mono text-[10px] uppercase tracking-widest flex justify-center items-center transition-all relative"
                    title="Share Array"
                  >
                    <Share2 size={14} />
                    {shareMsg?.id === arena.id && (
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-neon-blue text-black px-2 py-1 whitespace-nowrap z-50 rounded-sm">
                        {shareMsg.text}
                      </span>
                    )}
                  </button>
                  <button 
                    onClick={() => handleDelete(arena.id)}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 font-mono text-[10px] uppercase tracking-widest flex justify-center items-center transition-all"
                    title="Purge Data"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
