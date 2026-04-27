import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, User, Sparkles, Shield, Cloud, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

interface AuthScreenProps {
  onGuest: () => void;
  onGoogle: () => void;
  isLoggingIn: boolean;
}

export function AuthScreen({ onGuest, onGoogle, isLoggingIn }: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      await onGoogle();
    } catch (err: any) {
      if (err.message?.includes('auth/unauthorized-domain')) {
        setError("Domain Access Required: This app's domain needs to be added to Firebase authorized domains. Please continue as Guest temporarily.");
      } else {
        setError(err.message || "Failed to sign in with Google");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center bg-[#0a0c10] p-4 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="card bg-white/5 backdrop-blur-3xl border border-white/10 p-8 rounded-[2.5rem] shadow-2xl space-y-8 overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20" />
              <Logo className="h-24 w-24 relative" />
            </motion.div>
            
            <div className="space-y-1">
              <h1 className="text-3xl font-black tracking-tighter text-white">
                TS <span className="text-amber-500">PRICE</span> MANAGER
              </h1>
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                Premium Inventory Intelligence
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white text-center">Welcome Back</h2>
              <p className="text-white/40 text-xs text-center px-4">
                Access your inventory data securely with real-time cloud sync.
              </p>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-xs font-medium"
              >
                <Shield size={16} />
                {error}
              </motion.div>
            )}

            <div className="space-y-3">
              <Button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full h-14 rounded-2xl bg-white text-black hover:bg-white/90 transition-all font-bold flex items-center justify-center gap-3"
              >
                {isLoggingIn ? (
                  <div className="h-5 w-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[#0a0c10] px-3 text-white/20 font-black tracking-widest">or</span>
                </div>
              </div>

              <button
                onClick={onGuest}
                className="group w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 transition-all font-bold flex items-center justify-center gap-3"
              >
                <User size={20} className="opacity-40 group-hover:opacity-100 transition-all" />
                Continue as Guest
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                <Cloud size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase text-white/30 tracking-tight">Data Policy</p>
                <p className="text-[11px] text-white/50 leading-tight">
                  Guest data is stored locally. Sign in with Google to sync across all devices.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-[10px] font-black uppercase tracking-[0.3em] text-white/20">
          Powered by AntiGravity Cloud Engine
        </p>
      </motion.div>
    </div>
  );
}
