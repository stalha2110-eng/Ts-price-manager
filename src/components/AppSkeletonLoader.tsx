import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, Loader2 } from 'lucide-react';

export function AppSkeletonLoader({ theme }: { theme: string }) {
  const [statusIdx, setStatusIdx] = useState(0);

  const statuses = [
    { text: 'Verifying credentials...', sub: 'Establishing secure token handshake / टोकन सत्यापन' },
    { text: 'Syncing local catalog...', sub: 'Fetching latest product database / डेटाबेस सिंक्रनाइज़ेशन' },
    { text: 'Setting up workspace...', sub: 'Configuring custom user preferences / कार्यक्षेत्र सेटअप' },
    { text: 'Finalizing secure vault...', sub: 'Encrypting session assets / सत्र सुरक्षा पूर्ण' }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((prev) => (prev + 1) % statuses.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [statuses.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#070b13] text-white select-none overflow-hidden"
    >
      {/* 🌌 Atmospheric Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* 📦 Core Loader Container */}
      <div className="relative flex flex-col items-center max-w-sm px-6 text-center z-10">
        
        {/* 🎡 Outer Dynamic Circle Rings */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-8">
          
          {/* Subtle Outer Ring Background */}
          <div className="absolute inset-0 rounded-full border-4 border-dashed border-white/[0.03] animate-[spin_40s_linear_infinite]" />
          
          {/* Dynamic Spinning Gradient Ring */}
          <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#d97706" stopOpacity="1" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="1" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="url(#loader-grad)"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray="276"
              strokeDashoffset="75"
              strokeLinecap="round"
              className="animate-[spin_1.5s_cubic-bezier(0.4,0,0.2,1)_infinite]"
            />
          </svg>

          {/* Core Central Icon Floating */}
          <motion.div 
            animate={{ 
              scale: [0.95, 1.05, 0.95],
              boxShadow: ["0 0 15px rgba(217, 119, 6, 0.15)", "0 0 25px rgba(217, 119, 6, 0.3)", "0 0 15px rgba(217, 119, 6, 0.15)"]
            }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
            className="w-16 h-16 rounded-2xl bg-[#0d1527] border border-amber-500/25 flex items-center justify-center relative z-10"
          >
            <Shield size={26} className="text-amber-500" />
            <Sparkles size={12} className="absolute top-2.5 right-2.5 text-blue-400 animate-pulse" />
          </motion.div>
        </div>

        {/* 📝 Brand Title */}
        <h3 className="text-sm font-black uppercase tracking-[0.25em] text-white/50 mb-1">
          Vyapaar Premium
        </h3>
        <p className="text-[10px] font-medium tracking-wider text-amber-500/80 mb-8 uppercase">
          Intelligent Digital Register
        </p>

        {/* ⚙️ Smooth Transitioning Status Text */}
        <div className="h-16 flex flex-col justify-center w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={statusIdx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="space-y-1.5"
            >
              <h4 className="text-sm font-bold text-white flex items-center justify-center gap-2">
                <Loader2 size={13} className="animate-spin text-amber-500" />
                {statuses[statusIdx].text}
              </h4>
              <p className="text-[11px] text-gray-400 leading-normal max-w-[280px] mx-auto font-medium">
                {statuses[statusIdx].sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom Loading Progress Bar indicator */}
        <div className="w-48 h-1 bg-white/[0.04] rounded-full overflow-hidden mt-6 relative">
          <motion.div 
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            className="absolute top-0 bottom-0 w-24 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
          />
        </div>

      </div>

      {/* 🔒 Footer Security Badges */}
      <div className="absolute bottom-8 text-center text-[10px] text-white/20 flex items-center gap-2 uppercase tracking-widest font-black">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/35 animate-ping" />
        <span>End-To-End AES 256 Encrypted Workspace</span>
      </div>
    </motion.div>
  );
}
