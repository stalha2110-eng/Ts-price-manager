import React from 'react';
import { motion } from 'motion/react';
import { Layout, TrendingUp, DollarSign, Users, FileText, CheckCircle } from 'lucide-react';

export function AppSkeletonLoader({ theme }: { theme: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col overflow-hidden pb-20 select-none"
    >
      {/* 🚀 Dynamic Header Skeleton */}
      <header className="border-b border-[var(--border)] bg-[var(--card)]/50 backdrop-blur-md px-5 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {/* Logo Circle */}
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-500/10 to-amber-500/20 border border-amber-500/20 flex items-center justify-center animate-pulse">
            <Layout size={18} className="text-amber-500/50" />
          </div>
          <div className="space-y-1.5">
            {/* Store Name Title Skeleton */}
            <div className="h-4 w-32 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
            {/* Operating Mode Pill Skeleton */}
            <div className="h-3 w-20 bg-[var(--foreground)]/5 rounded-full animate-pulse" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Calendar / Date Pill */}
          <div className="h-7 w-24 bg-[var(--foreground)]/5 border border-[var(--border)] rounded-full animate-pulse hidden sm:block" />
          {/* Sync Status Pill */}
          <div className="h-7 w-32 bg-emerald-500/5 border border-emerald-500/10 text-emerald-500/60 rounded-full flex items-center gap-1.5 px-3 py-1 text-[9px] font-black uppercase tracking-wider animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Verifying Auth...</span>
          </div>
        </div>
      </header>

      {/* 📊 Main Content Skeleton Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-5 space-y-6">
        
        {/* Metric Overview Row (4 Columns Grid) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Today\'s Sales', icon: TrendingUp, color: 'text-amber-500' },
            { label: 'Net Profit', icon: DollarSign, color: 'text-emerald-500' },
            { label: 'Pending Udhar', icon: Users, color: 'text-rose-500' },
            { label: 'Invoices Issued', icon: FileText, color: 'text-blue-500' },
          ].map((item, idx) => (
            <div 
              key={idx} 
              className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden"
            >
              <div className="space-y-2 flex-1">
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-40 block">{item.label}</span>
                <div className="h-6 w-20 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
                <div className="h-3 w-14 bg-[var(--foreground)]/5 rounded-full animate-pulse" />
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--foreground)]/[0.03] text-[var(--foreground)]/20 animate-pulse">
                <item.icon size={18} className={item.color} style={{ opacity: 0.3 }} />
              </div>
              {/* Shimmer overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--foreground)]/[0.01] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
            </div>
          ))}
        </div>

        {/* Dynamic Bento Board Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Visual analytics chart card */}
          <div className="lg:col-span-2 bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 flex flex-col gap-5 shadow-sm min-h-[340px]">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="h-4 w-40 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
                <div className="h-3 w-28 bg-[var(--foreground)]/5 rounded-full animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-12 bg-[var(--foreground)]/5 rounded-lg animate-pulse" />
                <div className="h-6 w-12 bg-[var(--foreground)]/5 rounded-lg animate-pulse" />
              </div>
            </div>

            {/* Simulated Recharts Line Graph Area */}
            <div className="flex-1 w-full flex items-end gap-3 px-2 pt-6 relative border-b border-[var(--border)] pb-2 min-h-[180px]">
              {/* Vertical Y-axis grid line references */}
              <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-col justify-between pointer-events-none opacity-20">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="w-full border-t border-[var(--border)] border-dashed" />
                ))}
              </div>

              {/* Shimmering Bar Graph visualizers simulating historical stats */}
              {[35, 45, 60, 40, 75, 90, 50, 65, 80, 55, 70, 85].map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${val}%` }}
                    transition={{ delay: i * 0.05, duration: 0.8, ease: "easeOut" }}
                    className="w-full bg-gradient-to-t from-amber-500/5 to-amber-500/20 rounded-md border border-amber-500/10 relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--foreground)]/[0.02] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                  </motion.div>
                  <div className="h-2 w-4 bg-[var(--foreground)]/5 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Operations panel skeleton */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 flex flex-col gap-5 shadow-sm">
            <div className="space-y-1.5">
              <div className="h-4 w-32 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
              <div className="h-3 w-24 bg-[var(--foreground)]/5 rounded-full animate-pulse" />
            </div>

            {/* Quick Action Button items mimicking live dashboard shortcuts */}
            <div className="flex-1 flex flex-col gap-3 justify-center">
              {[1, 2, 3].map((num) => (
                <div 
                  key={num} 
                  className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--foreground)]/[0.01] flex items-center justify-between animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[var(--foreground)]/5 flex items-center justify-center text-amber-500/40">
                      <CheckCircle size={15} />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-3 w-24 bg-[var(--foreground)]/10 rounded animate-pulse" />
                      <div className="h-2 w-16 bg-[var(--foreground)]/5 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="w-5 h-5 rounded-full bg-[var(--foreground)]/5 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Transactions lists outline */}
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-3xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <div className="h-4 w-36 bg-[var(--foreground)]/10 rounded-lg animate-pulse" />
              <div className="h-3 w-28 bg-[var(--foreground)]/5 rounded-full animate-pulse" />
            </div>
            <div className="h-6 w-16 bg-[var(--foreground)]/5 rounded-lg animate-pulse" />
          </div>

          <div className="space-y-2">
            {[1, 2, 3].map((row) => (
              <div 
                key={row} 
                className="p-3 border-b border-[var(--border)]/60 flex items-center justify-between gap-4 last:border-0"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-[var(--foreground)]/5 animate-pulse" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 w-1/3 max-w-[200px] bg-[var(--foreground)]/10 rounded animate-pulse" />
                    <div className="h-2.5 w-1/4 max-w-[120px] bg-[var(--foreground)]/5 rounded animate-pulse" />
                  </div>
                </div>
                <div className="text-right space-y-1.5">
                  <div className="h-3 w-12 bg-[var(--foreground)]/10 rounded animate-pulse ml-auto" />
                  <div className="h-2 w-16 bg-[var(--foreground)]/5 rounded animate-pulse ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>

      {/* 📱 Bottom Navigation Bar Skeleton */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-xl py-3 px-6 flex items-center justify-around">
        {[1, 2, 3, 4, 5].map((tab) => (
          <div key={tab} className="flex flex-col items-center gap-1.5 cursor-pointer flex-1">
            <div className="w-5 h-5 rounded-full bg-[var(--foreground)]/[0.07] animate-pulse" />
            <div className="h-2 w-10 bg-[var(--foreground)]/5 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
