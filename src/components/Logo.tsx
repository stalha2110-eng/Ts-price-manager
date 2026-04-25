import React from 'react';
import { 
  ShoppingCart, 
  Tag, 
  ClipboardList, 
  Bell
} from 'lucide-react';

export const Logo = ({ className }: { className?: string }) => {
  return (
    <div className={`relative ${className} group select-none`}>
      {/* Outer App Icon Container */}
      <div className="relative w-full h-full p-[4%] bg-white/5 rounded-[22%] shadow-2xl overflow-hidden backdrop-blur-sm border border-white/10 ring-1 ring-white/20">
        
        {/* Glossy Background Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-black" />
        
        {/* Radial Lighting / Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.15),transparent_70%)]" />
        <div className="absolute -inset-full bg-[conic-gradient(from_0deg,transparent_0deg,rgba(255,215,0,0.03)_180deg,transparent_360deg)] animate-[spin_10s_linear_infinity]" />
        
        {/* Gold Border Frame */}
        <div className="absolute inset-0 rounded-[22%] border-[1.5px] border-[#d4af37]/40 pointer-events-none shadow-[inset_0_0_15px_rgba(212,175,55,0.2)]" />
        <div className="absolute inset-[3%] rounded-[19%] border-[0.5px] border-[#d4af37]/20 pointer-events-none" />

        <div className="relative h-full w-full flex flex-col items-center justify-center pt-2">
          
          {/* Growth Ring & Arrow Swoosh */}
          <div className="absolute top-[15%] w-[75%] h-[75%] pointer-events-none">
             <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                <defs>
                   <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8a6e2f" />
                      <stop offset="25%" stopColor="#d4af37" />
                      <stop offset="50%" stopColor="#f9f295" />
                      <stop offset="75%" stopColor="#d4af37" />
                      <stop offset="100%" stopColor="#8a6e2f" />
                   </linearGradient>
                   <filter id="shadow">
                      <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.5" />
                   </filter>
                </defs>
                {/* Swoosh Circle */}
                <path 
                  d="M 20,80 A 40,40 0 1 1 85,25" 
                  fill="none" 
                  stroke="url(#goldGrad)" 
                  strokeWidth="3" 
                  strokeLinecap="round"
                  className="drop-shadow-lg"
                />
                {/* Arrow head */}
                <path 
                  d="M 85,25 L 88,15 L 78,20" 
                  fill="url(#goldGrad)" 
                  className="drop-shadow-lg"
                />
             </svg>
          </div>

          {/* TS Initials */}
          <div className="relative flex items-center justify-center gap-0.5 mt-[-10%]">
             <span className="text-[2.2rem] sm:text-[2.6rem] font-black italic tracking-tighter leading-none" 
                   style={{ 
                     background: 'linear-gradient(135deg, #8a6e2f 0%, #f9f295 50%, #d4af37 100%)',
                     WebkitBackgroundClip: 'text',
                     WebkitTextFillColor: 'transparent',
                     filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 2px rgba(212,175,55,0.3))'
                   }}>
                T
             </span>
             <span className="text-[2.2rem] sm:text-[2.6rem] font-black italic tracking-tighter leading-none" 
                   style={{ 
                     background: 'linear-gradient(135deg, #444 0%, #eee 50%, #888 100%)',
                     WebkitBackgroundClip: 'text',
                     WebkitTextFillColor: 'transparent',
                     filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5)) drop-shadow(0 0 2px rgba(255,255,255,0.3))'
                   }}>
                S
             </span>

             {/* Bar Charts (small) */}
             <div className="absolute right-[-20%] bottom-0 flex items-end gap-[1px]">
                {[3, 5, 4, 7, 9].map((h, i) => (
                  <div key={i} className="w-[2px] bg-gradient-to-t from-[#8a6e2f] to-[#f9f295]" style={{ height: `${h}px` }} />
                ))}
             </div>
          </div>

          {/* Label Text */}
          <div className="flex flex-col items-center mt-1">
             <span className="text-[0.6rem] sm:text-[0.7rem] font-black tracking-[0.1em]"
                   style={{ 
                     background: 'linear-gradient(135deg, #ccc 0%, #fff 50%, #999 100%)',
                     WebkitBackgroundClip: 'text',
                     WebkitTextFillColor: 'transparent'
                   }}>
                PRICE
             </span>
             <span className="text-[0.35rem] sm:text-[0.4rem] font-black tracking-[0.35em] uppercase text-[#d4af37]">
                MANAGER
             </span>
          </div>

          {/* Bottom Icons */}
          <div className="absolute bottom-[8%] w-[70%] flex items-center justify-between opacity-60">
             <ShoppingCart size={8} className="text-[#d4af37]" />
             <div className="flex items-center gap-[1px]">
                <Tag size={8} className="text-[#d4af37]" />
                <span className="text-[5px] font-bold text-[#d4af37]">₹</span>
             </div>
             <ClipboardList size={8} className="text-[#d4af37]" />
             <Bell size={8} className="text-[#d4af37]" />
          </div>

        </div>
      </div>
      
      {/* Gloss reflection overlay */}
      <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[22%]" />
    </div>
  );
};
