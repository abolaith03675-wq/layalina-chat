import React, { useEffect } from 'react';
import { GiftItem } from '../types/loqana';
import { Sparkles } from 'lucide-react';

interface GiftOverlayProps {
  gift: GiftItem;
  senderName: string;
  recipientName: string;
  onFinished: () => void;
}

export const GiftOverlay: React.FC<GiftOverlayProps> = ({
  gift,
  senderName,
  recipientName,
  onFinished,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinished();
    }, 3800);
    return () => clearTimeout(timer);
  }, [onFinished]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Darkened glow backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-300" />

      {/* Radial Sunburst Rays */}
      <div className="absolute w-[450px] h-[450px] rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-300/30 to-amber-500/20 animate-spin blur-2xl opacity-75" />

      {/* Broadcast Marquee Banner */}
      <div className="relative z-10 w-full max-w-md bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-950 dark:via-slate-900 dark:to-amber-950 border-y-2 border-amber-500 dark:border-amber-400 py-2 px-4 shadow-2xl flex items-center justify-center gap-2 mb-6 animate-in slide-in-from-top duration-300">
        <Sparkles size={18} className="text-amber-500 dark:text-amber-400 animate-spin" />
        <p className="text-xs sm:text-sm font-bold text-center text-amber-800 dark:text-amber-200">
          <span className="text-amber-600 dark:text-amber-400">{senderName}</span>
          <span className="text-slate-900 dark:text-white"> أهدى </span>
          <span className="text-amber-600 dark:text-amber-400">{recipientName}</span>
          <span className="text-amber-700 dark:text-yellow-300"> «{gift.name}» </span>
        </p>
        <Sparkles size={18} className="text-amber-500 dark:text-amber-400 animate-spin" />
      </div>

      {/* Main Giant Gift Icon with floating animation */}
      <div className="relative z-10 flex flex-col items-center animate-gift-float">
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-b from-amber-400/25 to-white/10 dark:from-amber-400/20 dark:to-transparent border border-amber-400/60 dark:border-amber-400/40 flex items-center justify-center shadow-2xl shadow-amber-500/40 relative">
          <span className="text-7xl sm:text-8xl filter drop-shadow-[0_10px_20px_rgba(245,158,11,0.6)]">
            {gift.icon}
          </span>
        </div>

        <div className="mt-4 bg-white/95 dark:bg-slate-950/90 border border-amber-400/70 dark:border-amber-400/50 rounded-full px-5 py-1.5 shadow-xl">
          <span className="text-sm font-black text-amber-700 dark:text-amber-300 tracking-wide">
            {gift.name} 👑
          </span>
        </div>
      </div>
    </div>
  );
};
