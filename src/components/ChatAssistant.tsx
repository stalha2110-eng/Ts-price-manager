import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Mic, 
  Sparkles, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  FileDown, 
  EyeOff, 
  Eye,
  RefreshCw
} from 'lucide-react';
import { processChatCommand } from '../services/geminiService';

interface Message {
  role: 'user' | 'model';
  content: string;
}

interface ChatAssistantProps {
  items: any[];
  onAddItem: (data: any) => void;
  onUpdateItem: (id: string, updates: any) => void;
  onDeleteItem: (id: string) => void;
  onAddNote: (data: any) => void;
  onExport: () => void;
  onToggleBuying: () => void;
  showBuyingPrice: boolean;
  precision: number;
  t: any;
}

export const ChatAssistant: React.FC<ChatAssistantProps> = ({
  items,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onAddNote,
  onExport,
  onToggleBuying,
  showBuyingPrice,
  precision,
  t
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Namaste! I am TS Assistant. How can I help you manage your business today? (English, Hindi, Marathi support)" }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [unreadCount, setUnreadCount] = useState(1);
  const [conversations, setConversations] = useState<Message[][]>([]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
  };

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || input;
    if (!text.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await processChatCommand(text, messages);
      
      const aiMessage: Message = { role: 'model', content: result.reply };
      setMessages(prev => [...prev, aiMessage]);

      // Perform App Action based on AI intent
      if (result.action !== "NONE") {
        executeAction(result.action, result.data);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: "Network fluctuation detected. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const closeChat = () => {
    // Save to history on close if there's a conversation
    if (messages.length > 1) {
      setConversations(prev => [messages, ...prev].slice(0, 5));
    }
    setIsOpen(false);
  };

  const executeAction = (action: string, data: any) => {
    switch (action) {
      case "ADD_ITEM":
        if (data && data.name) {
          onAddItem({
            name: data.name,
            retailPrice: data.retailPrice || 0,
            wholesalePrice: data.wholesalePrice || 0,
            buyingPrice: data.buyingPrice || 0,
            unit: data.unit || 'KG',
            categoryId: 'general',
            quantity: 0,
            translations: { en: data.name, hi: '', mr: '', 'hi-en': '' },
            history: []
          });
        }
        break;
      case "SEARCH":
        // This is handled by UI filter locally, we just reply
        break;
      case "ADD_NOTE":
        if (data && data.noteTitle) {
          onAddNote({
            title: data.noteTitle,
            description: data.noteDesc || '',
            category: 'General',
            priority: 'Normal'
          });
        }
        break;
      case "EXPORT":
        onExport();
        break;
      case "HIDE_BUYING":
      case "SHOW_BUYING":
        onToggleBuying();
        break;
      case "DELETE_ITEM":
        if (data && data.id) {
          onDeleteItem(data.id);
        } else if (data && data.name) {
          const item = items.find(i => i.name.toLowerCase().includes(data.name.toLowerCase()));
          if (item) onDeleteItem(item.id);
        }
        break;
      case "EDIT_ITEM":
        if (data && (data.id || data.name)) {
          const targetId = data.id || items.find(i => i.name.toLowerCase().includes(data.name.toLowerCase()))?.id;
          if (targetId) {
            onUpdateItem(targetId, {
              retailPrice: data.retailPrice,
              wholesalePrice: data.wholesalePrice,
              buyingPrice: data.buyingPrice,
              unit: data.unit
            });
          }
        }
        break;
    }
  };

  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice input not supported in this browser.");
      return;
    }
    
    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'hi-IN'; // Default to Hindi, captures Marathi/English well too
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };
    recognition.start();
  };

  const getDynamicSuggestions = () => {
    const list: { label: string; icon: React.ReactNode }[] = [];
    
    // 1. Contextual Item Actions
    if (items.length > 0) {
      // Pick a random recent item to suggest editing or searching
      const randomItem = items[Math.floor(Math.random() * items.length)];
      list.push({ label: `Search ${randomItem.name}`, icon: <Search size={14} /> });
      list.push({ label: `Update price of ${randomItem.name}`, icon: <Edit3 size={14} /> });
    } else {
      list.push({ label: "Add Kaju -> kg -> 800 -> 750 -> 700", icon: <Plus size={14} /> });
      list.push({ label: "Add Badam -> kg -> 950 -> 900 -> 850", icon: <Plus size={14} /> });
    }

    // 2. Toggle Buying Price Suggestion
    if (showBuyingPrice) {
      list.push({ label: "Hide buying price", icon: <EyeOff size={14} /> });
    } else {
      list.push({ label: "Show buying price", icon: <Eye size={14} /> });
    }

    // 3. Always relevant actions
    list.push({ label: "Add business note", icon: <Plus size={14} /> });
    list.push({ label: "Export all data", icon: <FileDown size={14} /> });

    return list;
  };

  const suggestions = getDynamicSuggestions();

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleOpen}
        className="fixed left-6 bottom-32 z-[100] w-14 h-14 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-full shadow-[0_0_30px_rgba(79,70,229,0.4)] border border-white/20 flex items-center justify-center text-white cursor-pointer overflow-hidden group"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.2),transparent)]" />
        <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-[var(--background)] flex items-center justify-center text-[10px] font-black animate-bounce shadow-lg">
            {unreadCount}
          </div>
        )}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -100, scale: 0.9 }}
            className="fixed left-6 bottom-24 sm:bottom-32 z-[101] w-[calc(100vw-3rem)] sm:w-[400px] h-[600px] max-h-[75vh] bg-slate-950/95 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden ring-1 ring-white/20"
          >
            {/* Header */}
            <div className="p-5 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/20">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h4 className="text-sm font-black tracking-tight text-white m-0 leading-none">TS AI Assistant</h4>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                     <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Live Status
                  </span>
                </div>
              </div>
              <button 
                onClick={closeChat}
                className="w-10 h-10 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors text-white/40 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl text-xs font-bold leading-relaxed shadow-lg ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none border border-white/10' 
                      : 'bg-white/5 text-slate-300 rounded-tl-none border border-white/5'
                  }`}>
                    {m.content}
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 flex gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="px-5 py-3 border-t border-white/5 overflow-x-auto whitespace-nowrap scrollbar-hide flex gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s.label)}
                  className="bg-white/5 hover:bg-white/10 text-[9px] font-black uppercase tracking-widest text-slate-400 py-2 px-3 rounded-lg border border-white/5 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap"
                >
                  {s.icon} {s.label}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="p-5 border-t border-white/5 bg-slate-900/30">
              <div className="relative flex items-center gap-2">
                <button 
                  onClick={toggleVoice}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isListening 
                      ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30' 
                      : 'bg-white/5 hover:bg-white/10 text-slate-400'
                  }`}
                >
                  <Mic size={18} />
                </button>
                <input 
                  type="text"
                  placeholder="Ask something (Hindi/Marathi ok)..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all shadow-inner"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                />
                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-xl flex items-center justify-center text-white transition-all shadow-lg active:scale-95"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
