import React from 'react';
import { Crown, Star, Shield, Gem, User, Globe } from 'lucide-react';
import { UserRole } from '../types/loqana';

interface UserBadgeProps {
  role: UserRole;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const UserBadge: React.FC<UserBadgeProps> = ({ role, showLabel = true, size = 'md' }) => {
  const getBadgeConfig = () => {
    switch (role) {
      case 'owner':
        return {
          label: 'الماستر',
          icon: Crown,
          bg: 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-400/60 shadow-red-900/50',
          textColor: 'text-red-400',
        };
      case 'vip':
        return {
          label: 'مميز V.I.P',
          icon: Gem,
          bg: 'bg-gradient-to-r from-pink-600 to-rose-500 text-white border-pink-400/60 shadow-pink-900/40',
          textColor: 'text-pink-400',
        };
      case 'admin':
        return {
          label: 'مشرف',
          icon: Shield,
          bg: 'bg-gradient-to-r from-yellow-400 to-amber-400 text-slate-950 border-yellow-200 shadow-amber-900/40 font-black',
          textColor: 'text-yellow-400',
        };
      case 'super_admin':
        return {
          label: 'سوبر أدمن',
          icon: Star,
          bg: 'bg-gradient-to-r from-emerald-600 to-green-600 text-white border-emerald-400/60 shadow-green-900/40',
          textColor: 'text-green-400',
        };
      case 'member':
        return {
          label: 'عضو',
          icon: User,
          bg: 'bg-gradient-to-r from-blue-600 to-cyan-700 text-white border-blue-400/60 shadow-blue-900/40',
          textColor: 'text-blue-400',
        };
      case 'guest':
      default:
        return {
          label: 'زائر',
          icon: Globe,
          bg: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
          textColor: 'text-slate-600 dark:text-slate-400',
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5 gap-1',
    md: 'text-xs px-2 py-0.5 gap-1.5',
    lg: 'text-sm px-2.5 py-1 gap-2',
  }[size];

  const iconSizes = {
    sm: 11,
    md: 13,
    lg: 15,
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-md border shadow-xs tracking-wide shrink-0 ${config.bg} ${sizeClasses}`}
    >
      <Icon size={iconSizes} className="shrink-0 animate-pulse" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
};
