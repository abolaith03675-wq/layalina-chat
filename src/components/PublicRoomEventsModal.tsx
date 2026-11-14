import React, { useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  Gift,
  Globe,
  Link2,
  LogIn,
  LogOut,
  Search,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Unlink,
  UserX,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { RoomLogAction, RoomLogEntry, UserProfile, isMasterRole, isRoomAdminRole } from '../types/loqana';
import { UserBadge } from './UserBadge';
import { useTheme, getReadableRoleColor } from '../context/ThemeContext';

export interface RoomLogPresentation {
  label: string;
  iconBg: string;
  badgeClass: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}

export function getRoomLogPresentation(action: RoomLogAction): RoomLogPresentation {
  switch (action) {
    case 'enter':
      return {
        label: 'دخل الروم',
        iconBg: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
        badgeClass:
          'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30',
        Icon: LogIn,
      };
    case 'leave':
      return {
        label: 'غادر الروم',
        iconBg: 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
        badgeClass:
          'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        Icon: LogOut,
      };
    case 'kicked':
      return {
        label: 'طرد من الغرفة',
        iconBg: 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400',
        badgeClass:
          'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-500/30',
        Icon: UserX,
      };
    case 'ban_ip':
      return {
        label: 'حظر آي بي (IP)',
        iconBg: 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400',
        badgeClass:
          'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/30',
        Icon: Globe,
      };
    case 'ban_device':
      return {
        label: 'حظر جهاز (Device)',
        iconBg: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        badgeClass:
          'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/30',
        Icon: Smartphone,
      };
    case 'ban_both':
      return {
        label: 'حظر شامل (IP + جهاز)',
        iconBg: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
        badgeClass:
          'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
        Icon: Ban,
      };
    case 'banned':
      return {
        label: 'حظر من الغرفة',
        iconBg: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400',
        badgeClass:
          'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30',
        Icon: Ban,
      };
    case 'unbanned':
      return {
        label: 'فك الحظر',
        iconBg: 'bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400',
        badgeClass:
          'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-500/30',
        Icon: ShieldCheck,
      };
    case 'bind':
      return {
        label: 'ربط حساب',
        iconBg: 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400',
        badgeClass:
          'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
        Icon: Link2,
      };
    case 'unbind':
      return {
        label: 'فك الربط',
        iconBg: 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
        badgeClass:
          'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
        Icon: Unlink,
      };
    case 'gift':
      return {
        label: 'إرسال هدية',
        iconBg: 'bg-pink-100 dark:bg-pink-500/20 text-pink-600 dark:text-pink-400',
        badgeClass:
          'bg-pink-50 dark:bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-500/30',
        Icon: Gift,
      };
    case 'mute':
      return {
        label: 'كتم عضو',
        iconBg: 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
        badgeClass:
          'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30',
        Icon: VolumeX,
      };
    case 'unmute':
      return {
        label: 'إلغاء الكتم',
        iconBg: 'bg-lime-100 dark:bg-lime-500/20 text-lime-700 dark:text-lime-400',
        badgeClass:
          'bg-lime-50 dark:bg-lime-500/15 text-lime-700 dark:text-lime-300 border-lime-200 dark:border-lime-500/30',
        Icon: Volume2,
      };
    case 'admin':
    default:
      return {
        label: 'تنبيه إداري',
        iconBg: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',
        badgeClass:
          'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
        Icon: ShieldAlert,
      };
  }
}

interface PublicRoomEventsModalProps {
  roomName: string;
  currentUser: UserProfile;
  roomLogs: RoomLogEntry[];
  onClose: () => void;
}

type EventsFilter = 'all' | 'entry_exit' | 'bans_kicks' | 'bind_admin' | 'gifts';

const BAN_KICK_ACTIONS = new Set<RoomLogAction>([
  'kicked',
  'banned',
  'ban_ip',
  'ban_device',
  'ban_both',
  'unbanned',
]);

const BIND_ADMIN_ACTIONS = new Set<RoomLogAction>([
  'bind',
  'unbind',
  'mute',
  'unmute',
  'admin',
]);

export const PublicRoomEventsModal: React.FC<PublicRoomEventsModalProps> = ({
  roomName,
  currentUser,
  roomLogs,
  onClose,
}) => {
  const { isDarkMode } = useTheme();
  const [filter, setFilter] = useState<EventsFilter>('all');
  const [search, setSearch] = useState('');

  const canSeeDeviceMeta = isMasterRole(currentUser.role) || isRoomAdminRole(currentUser.role);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roomLogs.filter(log => {
      if (q) {
        const nameMatch = (log.username || '').toLowerCase().includes(q);
        const detailMatch = (log.details || '').toLowerCase().includes(q);
        if (!nameMatch && !detailMatch) return false;
      }
      if (filter === 'entry_exit') return log.action === 'enter' || log.action === 'leave';
      if (filter === 'bans_kicks') return BAN_KICK_ACTIONS.has(log.action);
      if (filter === 'bind_admin') return BIND_ADMIN_ACTIONS.has(log.action);
      if (filter === 'gifts') return log.action === 'gift';
      return true;
    });
  }, [roomLogs, filter, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 dark:bg-black/75 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border-[1.5px] dark:border border-slate-200 dark:border-amber-500/30 rounded-3xl w-full max-w-md h-[84vh] flex flex-col text-slate-900 dark:text-white shadow-2xl overflow-hidden text-right animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-l from-amber-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center shadow-md shrink-0">
              <Activity size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                سجل الأحداث العام المباشر
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {roomName} • متاح لحظياً لجميع المتواجدين
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
            title="إغلاق"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search & Filter Strip */}
        <div className="p-3 bg-slate-50/80 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
          <div className="relative flex items-center">
            <Search size={14} className="absolute right-3 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحث بالاسم أو نوع الحدث..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-amber-500 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 touch-scroll-x py-0.5">
            {[
              { id: 'all', label: `الكل (${roomLogs.length})` },
              { id: 'bans_kicks', label: 'حظر وطرد' },
              { id: 'bind_admin', label: 'ربط وإدارة' },
              { id: 'gifts', label: 'هدايا' },
              { id: 'entry_exit', label: 'دخول وخروج' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as EventsFilter)}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold shrink-0 whitespace-nowrap transition-all ${
                  filter === tab.id
                    ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chronological Feed */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              لا توجد أحداث مسجلة تطابق البحث أو الفلتر الحالي.
            </div>
          ) : (
            filteredLogs.map(log => {
              const { label, iconBg, badgeClass, Icon } = getRoomLogPresentation(log.action);
              return (
                <div
                  key={log.id}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2 transition-colors"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs">{log.userFlag}</span>
                        <span
                          className="font-black text-xs truncate max-w-[130px]"
                          style={{ color: getReadableRoleColor(log.userRole, isDarkMode) }}
                        >
                          {log.username}
                        </span>
                        <UserBadge role={log.userRole} size="sm" showLabel={false} />
                        <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold border ${badgeClass}`}>
                          {label}
                        </span>
                      </div>
                      {log.details && (
                        <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-snug">
                          {log.details}
                        </p>
                      )}
                      {canSeeDeviceMeta && (log.ipAddress || log.deviceId) && (
                        <div className="text-[9px] font-mono text-slate-500 dark:text-slate-500 flex items-center gap-2 flex-wrap pt-0.5">
                          {log.ipAddress && (
                            <span className="inline-flex items-center gap-0.5">
                              <Globe size={9} /> {log.ipAddress}
                            </span>
                          )}
                          {log.deviceId && (
                            <span className="inline-flex items-center gap-0.5">
                              <Smartphone size={9} /> {log.deviceId}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                    {log.timestamp}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
