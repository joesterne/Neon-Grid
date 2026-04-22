import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Cpu, Database, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth } from './FirebaseProvider';

interface Props {
  onBack: () => void;
}

const StoryMode: React.FC<Props> = ({ onBack }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<{ id: number; text: string; sender: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [chapter, setChapter] = useState(1);

  const fetchNextChapter = async () => {
    setLoading(true);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    
    try {
      const prompt = `You are the Master Control Program (MCP) from a Tron-like universe. 
      Generate a short, transmission-style log for Chapter ${chapter} of the user's escape from the Grid. 
      The user is named ${user?.displayName || 'User'}. 
      Keep it technical, cold, and immersive. Use words like "cycles", "derez", "programs", "subroutines".
      Maximum 3 sentences.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text || "SYSTEM ERROR: Transmission lost.";
      setLogs(prev => [...prev, { id: Date.now(), text, sender: 'MASTER_CONTROL' }]);
      setChapter(prev => prev + 1);
    } catch (e) {
      console.error(e);
      setLogs(prev => [...prev, { id: Date.now(), text: "INSUFFICIENT CLEARANCE. ACCESS DENIED.", sender: 'KERNEL_ERROR' }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (logs.length === 0) fetchNextChapter();
  }, []);

  return (
    <div className="h-full flex flex-col p-8 glass-panel relative">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[11px] uppercase tracking-[4px] text-white/50 font-sans">Story Mode // Grid Chronicles</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-4">
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-5 border-l-2 ${log.sender === 'MASTER_CONTROL' ? 'border-neon-magenta bg-neon-magenta/5 text-neon-magenta' : 'border-red-500/30 bg-red-500/5 text-red-100'} rounded-sm glass-panel backdrop-blur-sm`}
            >
              <div className="flex items-center gap-2 mb-2 text-[8px] font-mono tracking-widest opacity-60 uppercase">
                {log.sender === 'MASTER_CONTROL' ? <Cpu size={12} /> : <Database size={12} />}
                {log.sender} // {log.id.toString().slice(-4)}
              </div>
              <p className="font-mono text-xs leading-relaxed opacity-80">
                {log.text}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {loading && (
          <div className="flex gap-2 p-4 animate-pulse">
            <div className="w-1.5 h-1.5 bg-neon-magenta rounded-full" />
            <div className="w-1.5 h-1.5 bg-neon-magenta rounded-full" />
            <div className="w-1.5 h-1.5 bg-neon-magenta rounded-full" />
          </div>
        )}
      </div>

      <div className="mt-8">
        <button 
          onClick={fetchNextChapter}
          disabled={loading}
          className="w-full py-3 border border-neon-magenta/40 text-neon-magenta font-mono text-[10px] hover:bg-neon-magenta/10 hover:border-neon-magenta transition-all flex items-center justify-center gap-2 uppercase tracking-[3px]"
        >
          {loading ? 'Processing Transmission...' : 'Proceed to Next Sector'}
        </button>
      </div>
    </div>
  );
};

export default StoryMode;
