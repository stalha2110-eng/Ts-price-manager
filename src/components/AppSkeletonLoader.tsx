import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, Loader2, CheckCircle2, Cpu } from 'lucide-react';

export function AppSkeletonLoader({ theme }: { theme: string }) {
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  const statuses = [
    { text: 'Verifying credentials...', sub: 'Establishing secure token handshake / टोकन सत्यापन' },
    { text: 'Syncing local catalog...', sub: 'Fetching latest product database / डेटाबेस सिंक्रनाइज़ेशन' },
    { text: 'Setting up workspace...', sub: 'Configuring custom user preferences / कार्यक्षेत्र सेटअप' },
    { text: 'Finalizing secure vault...', sub: 'Encrypting session assets / सत्र सुरक्षा पूर्ण' }
  ];

  // Animate progress smoothly and hyper-fast for prime responsiveness
  useEffect(() => {
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 50) return prev + Math.floor(Math.random() * 12) + 8; // Ultra-fast start
        if (prev < 85) return prev + Math.floor(Math.random() * 8) + 4;  // Fast mid
        if (prev < 99) return prev + 2;                                 // Quick end
        return prev;
      });
    }, 25);

    return () => clearInterval(progressTimer);
  }, []);

  // Sync status text changes with progress
  useEffect(() => {
    if (progress >= 85) {
      setStatusIdx(3);
    } else if (progress >= 55) {
      setStatusIdx(2);
    } else if (progress >= 25) {
      setStatusIdx(1);
    } else {
      setStatusIdx(0);
    }
  }, [progress]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#050811] text-white select-none overflow-hidden"
    >
      {/* 🌌 High-fidelity Dynamic Ambient Orbs */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-amber-500/10 to-blue-500/5 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute -bottom-10 left-1/4 w-[350px] h-[350px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid Pattern overlay for tech aesthetic */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />

      {/* 📦 Master Card Glassmorphic container */}
      <motion.div 
        initial={{ y: 15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
        className="relative flex flex-col items-center max-w-sm w-full mx-auto px-8 py-10 rounded-3xl border border-white/[0.06] bg-[#0c1222]/65 backdrop-blur-xl shadow-2xl z-10 text-center"
      >
        {/* Subtle top glossy shine border */}
        <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />

        {/* 🎡 Premium Glowing Loader Core */}
        <div className="relative w-28 h-28 flex items-center justify-center mb-6">
          
          {/* Pulsing Outer Aura */}
          <div className="absolute inset-0 rounded-full bg-amber-500/5 animate-ping duration-[3000ms]" />
          
          {/* Subtle Outer Dashed Ring */}
          <div className="absolute inset-1 rounded-full border-2 border-dashed border-white/[0.04] animate-[spin_30s_linear_infinite]" />
          
          {/* Dual Concentric Spinning Rings */}
          <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="glow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#eab308" />
              </linearGradient>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="#ffffff"
              strokeWidth="1.5"
              fill="transparent"
              className="opacity-[0.03]"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="url(#glow-grad)"
              strokeWidth="3.5"
              fill="transparent"
              strokeDasharray="276"
              strokeDashoffset={276 - (276 * progress) / 100}
              strokeLinecap="round"
              className="transition-all duration-300 ease-out"
            />
          </svg>

          {/* Core Embedded Shield/Gear Element */}
          <motion.div 
            animate={{ 
              scale: [0.97, 1.03, 0.97],
            }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-b from-[#111930] to-[#0a1020] border border-amber-500/20 flex flex-col items-center justify-center relative z-10 shadow-lg"
          >
            <Shield size={24} className="text-amber-500" />
            <Sparkles size={11} className="absolute top-2 right-2 text-yellow-300 animate-pulse" />
            
            {/* Live Progress Number Counter */}
            <span className="absolute bottom-1.5 text-[9px] font-mono tracking-wider font-extrabold text-amber-500/90">
              {progress}%
            </span>
          </motion.div>
        </div>

        {/* 📝 Brand & App Header */}
        <h3 className="font-display text-sm font-black uppercase tracking-[0.25em] text-white/90 mb-1">
          Vyapaar Premium
        </h3>
        <p className="text-[10px] font-mono tracking-widest text-amber-500/80 uppercase font-bold mb-6">
          Intelligent Digital Register
        </p>

        {/* Status indicator list representing loaded submodules */}
        <div className="w-full space-y-2 mb-8 bg-black/15 p-3.5 rounded-2xl border border-white/[0.03] text-left">
          {statuses.map((status, idx) => {
            const isCompleted = idx < statusIdx;
            const isActive = idx === statusIdx;
            return (
              <div 
                key={idx} 
                className={`flex items-center gap-2.5 transition-all duration-300 ${
                  isCompleted ? 'opacity-100' : isActive ? 'opacity-100' : 'opacity-25'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                ) : isActive ? (
                  <Loader2 size={13} className="animate-spin text-amber-500 shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center shrink-0">
                    <div className="w-1 h-1 rounded-full bg-white/20" />
                  </div>
                )}
                <span className={`text-[10.5px] font-semibold leading-none ${
                  isActive ? 'text-amber-300 font-bold' : isCompleted ? 'text-gray-300' : 'text-gray-500'
                }`}>
                  {status.text.split('...')[0]}
                </span>
              </div>
            );
          })}
        </div>

        {/* ⚙️ Smooth Transitioning Highlight text */}
        <div className="h-11 flex flex-col justify-center w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={statusIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="space-y-1"
            >
              <h4 className="text-[11.5px] font-bold text-gray-200">
                {statuses[statusIdx].text}
              </h4>
              <p className="text-[9.5px] text-gray-400 font-medium leading-none">
                {statuses[statusIdx].sub}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Linear Track Loader Indicator */}
        <div className="w-full h-1 bg-white/[0.04] rounded-full overflow-hidden mt-5 relative">
          <motion.div 
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeOut" }}
            className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          />
        </div>
      </motion.div>

      {/* 🔒 Footer Security Credentials */}
      <div className="absolute bottom-8 text-center text-[10px] text-white/35 flex items-center gap-2 uppercase tracking-[0.18em] font-black">
        <Cpu size={12} className="text-emerald-500 animate-pulse shrink-0" />
        <span>End-To-End AES 256 Encrypted Workspace</span>
      </div>
    </motion.div>
  );
}
