import React from 'react';
import { 
  ShoppingCart, 
  Tag, 
  ClipboardList, 
  Bell
} from 'lucide-react';
import { cn } from '../lib/utils';

export const Logo = ({ className, simplified = false }: { className?: string, simplified?: boolean }) => {
  return (
    <div className={cn("relative group select-none flex items-center justify-center", className)}>
      {/* Outer App Icon Container */}
      <div className="relative w-full h-full p-[4%] bg-white/5 rounded-[22%] shadow-2xl overflow-hidden backdrop-blur-sm border border-white/10 ring-1 ring-white/20 flex flex-col items-center justify-center">
        
        {/* Glossy Background Layer */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0a0f1d] to-black" />
        
        {/* Radial Lighting / Glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.15),transparent_70%)]" />
        
        {/* Gold Border Frame */}
        <div className="absolute inset-0 rounded-[22%] border-[1.5px] border-[#d4af37]/40 pointer-events-none shadow-[inset_0_0_15px_rgba(212,175,55,0.2)]" />

        <div className="relative w-full h-full flex flex-col items-center justify-center">
          
          {/* Growth Ring & Arrow Swoosh (shrunken for header) */}
          <div className={cn("absolute w-[80%] h-[80%] pointer-events-none", simplified ? "top-[10%]" : "top-[15%]")}>
             <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                <defs>
                   <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8a6e2f" />
                      <stop offset="50%" stopColor="#f9f295" />
                      <stop offset="100%" stopColor="#8a6e2f" />
                   </linearGradient>
                </defs>
                <path 
                  d="M 20,80 A 40,40 0 1 1 85,25" 
                  fill="none" 
                  stroke="url(#goldGrad)" 
                  strokeWidth="4" 
                  strokeLinecap="round"
                />
                <path d="M 85,25 L 88,15 L 78,20" fill="url(#goldGrad)" />
             </svg>
          </div>

          {/* TS Initials - Scaled by container via CSS text size or manual adjust */}
          <div className="relative flex items-center justify-center gap-0.5 z-10 transition-transform group-hover:scale-105 duration-500">
             <span className="text-[min(2.8rem,10vw)] sm:text-[min(3rem,12vw)] font-black italic tracking-tighter leading-none" 
                   style={{ 
                     background: 'linear-gradient(135deg, #8a6e2f 0%, #f9f295 50%, #d4af37 100%)',
                     WebkitBackgroundClip: 'text',
                     WebkitTextFillColor: 'transparent',
                     filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                   }}>
                T
             </span>
             <span className="text-[min(2.8rem,10vw)] sm:text-[min(3rem,12vw)] font-black italic tracking-tighter leading-none" 
                   style={{ 
                     background: 'linear-gradient(135deg, #444 0%, #eee 50%, #888 100%)',
                     WebkitBackgroundClip: 'text',
                     WebkitTextFillColor: 'transparent',
                     filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'
                   }}>
                S
             </span>
          </div>

          {/* Label Text - Only if not too tiny */}
          {!simplified && (
            <div className="flex flex-col items-center mt-1 z-10">
               <span className="text-[min(0.7rem,2.5vw)] font-black tracking-[0.1em]"
                     style={{ 
                       background: 'linear-gradient(135deg, #ccc 0%, #fff 50%, #999 100%)',
                       WebkitBackgroundClip: 'text',
                       WebkitTextFillColor: 'transparent'
                     }}>
                  PRICE
               </span>
               <span className="text-[min(0.45rem,1.5vw)] font-black tracking-[0.35em] uppercase text-[#d4af37]">
                  MANAGER
               </span>
            </div>
          )}

          {/* Bottom Icons (Full mode only) */}
          {!simplified && (
            <div className="absolute bottom-[10%] w-[70%] flex items-center justify-between opacity-60">
               <ShoppingCart size={10} className="text-[#d4af37]" />
               <div className="flex items-center gap-[1px]">
                  <Tag size={10} className="text-[#d4af37]" />
               </div>
               <Bell size={10} className="text-[#d4af37]" />
            </div>
          )}

        </div>
      </div>
      
      {/* Gloss reflection overlay */}
      <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-t-[22%]" />
    </div>
  );
};
