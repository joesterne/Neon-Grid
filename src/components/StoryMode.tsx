import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { Terminal, Cpu, Database, ChevronRight, ArrowLeft } from 'lucide-react';
import { useAuth } from './FirebaseProvider';

interface Props {
  onBack: () => void;
}

const StoryMode: React.FC<Props> = ({ onBack }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<{ id: number; text: string; sender: string }[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [chapter, setChapter] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, loading, choices]);

  const fetchNextChapter = async (userChoice?: string) => {
    setLoading(true);
    setChoices([]);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
    
    try {
      if (userChoice) {
         setLogs(prev => [...prev, { id: Date.now(), text: `> EXECUTE COMMAND: ${userChoice}`, sender: 'USER_INPUT' }]);
      }

      const prompt = `You are the Master Control Program (MCP) from a Tron-like universe. 
      Generate a short, transmission-style log for Chapter ${chapter} of the user's escape from the Grid. 
      The user is named ${user?.displayName || 'User'}. 
      ${userChoice ? `The user previously chose to: "${userChoice}". Continue the story narrative realistically based on that action.` : ''}
      Keep it technical, cold, and immersive. Use words like "cycles", "derez", "programs", "subroutines".
      Maximum 3 sentences. After your log, provide 2-3 logical paths or terminal actions the user can take next.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              log: { type: Type.STRING, description: "The narrative log from the Master Control." },
              choices: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "2 or 3 short actions the user can take."
              }
            },
            required: ["log", "choices"]
          }
        }
      });

      let text = "SYSTEM ERROR: Transmission lost.";
      let newChoices: string[] = [];

      try {
        const jsonStr = response.text?.trim() || "{}";
        const data = JSON.parse(jsonStr);
        if (data.log) text = data.log;
        if (data.choices) newChoices = data.choices;
      } catch (err) {
        console.error("Failed to parse JSON response", err);
      }

      setLogs(prev => [...prev, { id: Date.now() + 1, text, sender: 'MASTER_CONTROL' }]);
      setChoices(newChoices);
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
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack} 
            className="flex items-center gap-2 text-neon-blue hover:text-white font-mono text-xs group transition-all"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            RETURN
          </button>
          <div className="h-8 w-[1px] bg-white/10" />
          <h2 className="text-[11px] uppercase tracking-[4px] text-white/50 font-sans">Story Mode // Grid Chronicles</h2>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-4 pb-4">
        <AnimatePresence>
          {logs.map((log) => (
            <motion.div 
              key={log.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-5 border-l-2 ${
                log.sender === 'MASTER_CONTROL' ? 'border-neon-magenta bg-neon-magenta/5 text-neon-magenta' 
                : log.sender === 'USER_INPUT' ? 'border-neon-blue bg-neon-blue/5 text-neon-blue'
                : 'border-red-500/30 bg-red-500/5 text-red-100'} rounded-sm glass-panel backdrop-blur-sm`}
            >
              <div className="flex items-center gap-2 mb-2 text-[8px] font-mono tracking-widest opacity-60 uppercase">
                {log.sender === 'MASTER_CONTROL' ? <Cpu size={12} /> : log.sender === 'USER_INPUT' ? <Terminal size={12} /> : <Database size={12} />}
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

      <div className="mt-8 space-y-3 shrink-0">
         {choices.length > 0 && !loading && (
           <div className="grid grid-cols-1 gap-3">
             {choices.map((choice, i) => (
               <button
                 key={i}
                 onClick={() => fetchNextChapter(choice)}
                 disabled={loading}
                 className="w-full text-left p-4 border border-neon-blue/30 text-neon-blue font-mono text-[10px] hover:bg-neon-blue/10 hover:border-neon-blue transition-all flex items-center gap-3 uppercase tracking-[2px] group bg-black/40"
               >
                  <ChevronRight size={14} className="flex-shrink-0 group-hover:translate-x-1 transition-transform" />
                  <span className="leading-tight">{choice}</span>
               </button>
             ))}
           </div>
         )}
         
         {!loading && choices.length === 0 && chapter === 1 && (
            <button 
              onClick={() => fetchNextChapter()}
              disabled={loading}
              className="w-full py-3 border border-neon-magenta/40 text-neon-magenta font-mono text-[10px] hover:bg-neon-magenta/10 hover:border-neon-magenta transition-all flex items-center justify-center gap-2 uppercase tracking-[3px]"
            >
              Establish Connection
            </button>
         )}
      </div>
    </div>
  );
};

export default StoryMode;

