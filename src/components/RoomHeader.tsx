import React, { useState, useRef } from 'react';
import {
  Crown,
  Volume2,
  VolumeX,
  Users,
  ChevronRight,
  Info,
  ShieldAlert,
  Sparkles,
  Settings,
  Camera,
  Image as ImageIcon,
  Video,
  VideoOff,
  Radio,
  ClipboardList,
  Activity,
} from 'lucide-react';
import { Room, UserProfile, LiveVideoStream } from '../types/loqana';

interface RoomHeaderProps {
  room: Room;
  currentUser: UserProfile;
  canViewReports?: boolean;
  onLeaveRoom: () => void;
  onOpenUsers: () => void;
  onOpenPublicEvents?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenMasterPanel?: (tab?: 'ranks' | 'registry' | 'bans' | 'logs' | 'reports' | 'settings') => void;
  onSendImage?: (imageUrl: string) => void;
  onRankWarning?: (message: string) => void;
  activeVideoStream?: LiveVideoStream | null;
  onToggleLiveStream?: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  currentUser,
  canViewReports = false,
  onLeaveRoom,
  onOpenUsers,
  onOpenPublicEvents,
  isMuted,
  onToggleMute,
  onOpenMasterPanel,
  onSendImage,
  onRankWarning,
  activeVideoStream,
  onToggleLiveStream,
}) => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Ranked users: owner, vip, admin, super_admin, member (only guest is unranked visitor)
  const isRankedUser = currentUser.role !== 'guest';

  // Live Video Streaming handler (خاص بأصحاب الرتب)
  const handleLiveStreamClick = () => {
    if (!isRankedUser) {
      onRankWarning?.('هذه الميزة مخصصة لأصحاب الرتب فقط');
      return;
    }
    onToggleLiveStream?.();
  };

  const handleFileClick = () => {
    if (!isRankedUser) {
      onRankWarning?.('هذه الميزة مخصصة لأصحاب الرتب فقط');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSendImage?.(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <>
      <header className="relative z-20 bg-white/95 dark:bg-transparent dark:bg-gradient-to-b dark:from-slate-900/95 dark:via-slate-900/90 dark:to-slate-950/90 backdrop-blur-md border-b border-amber-500/30 dark:border-amber-500/20 px-3 py-2.5 flex items-center justify-between text-slate-900 dark:text-white shadow-sm dark:shadow-lg transition-colors duration-300">
        {/* Left: Exit/Back & Room Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onLeaveRoom}
            className="p-1.5 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all flex items-center justify-center shrink-0"
            title="مغادرة الروم والعودة للغرف"
          >
            <ChevronRight size={22} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg shrink-0">{room.flag}</span>
              <h1 className={`text-sm truncate max-w-[170px] sm:max-w-[240px] ${
                room.isGoldName
                  ? 'text-amber-600 dark:text-yellow-400 font-black drop-shadow-xs dark:drop-shadow-[0_1px_4px_rgba(234,179,8,0.7)]'
                  : 'text-slate-900 dark:text-white font-bold'
              }`}>
                {room.name}
              </h1>
              {room.isGoldName && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-transparent dark:bg-gradient-to-r dark:from-yellow-500/25 dark:to-amber-500/25 text-amber-800 dark:text-yellow-300 border border-amber-400 dark:border-yellow-400/50 font-bold flex items-center gap-0.5">
                  <Sparkles size={9} className="text-amber-600 dark:text-yellow-400" />
                  <span>ذهبي</span>
                </span>
              )}
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                #{room.code}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              <span className="truncate flex items-center gap-1.5">
                <span className="text-amber-600 dark:text-amber-400">👑 الماستر:</span>
                <span className="text-red-600 dark:text-red-500 font-black tracking-wide drop-shadow-xs dark:drop-shadow-[0_1px_2px_rgba(239,68,68,0.4)]">
                  {room.ownerName}
                </span>
                {room.masterPinCode && (
                  <span className="text-[9px] bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700/60 px-1 rounded font-mono">
                    PIN: {room.masterPinCode}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Top-Left / Actions Cluster */}
        <div className="flex items-center gap-1.5 touch-scroll-x max-w-[56%] sm:max-w-none shrink-0 py-0.5">
          {/* Hidden File Input for Device Files Upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* 1. Live Video Streaming Button (بث فيديو مباشر - خاص بأصحاب الرتب) */}
          <button
            onClick={handleLiveStreamClick}
            className={`p-2 rounded-full border transition-all active:scale-95 flex items-center gap-1 shrink-0 ${
              activeVideoStream
                ? activeVideoStream.broadcasterId === currentUser.id
                  ? 'bg-red-100 dark:bg-red-600/30 border-red-400 dark:border-red-500/80 text-red-700 dark:text-red-300 shadow-md dark:shadow-red-950 animate-pulse'
                  : 'bg-amber-100 dark:bg-amber-500/25 border-amber-400 text-amber-800 dark:text-amber-300 shadow-md'
                : isRankedUser
                ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 border-rose-200 dark:border-rose-500/40 text-rose-600 dark:text-rose-300 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title={
              activeVideoStream
                ? activeVideoStream.broadcasterId === currentUser.id
                  ? 'أنت تبث الآن مباشرة بالفيديو (انقر للإدارة)'
                  : `مشاهدة بث ${activeVideoStream.broadcasterName} المباشر`
                : isRankedUser
                ? 'بدء بث فيديو مباشر في الروم (خاص بالرتب)'
                : 'بث فيديو مباشر (مخصص لأصحاب الرتب فقط)'
            }
          >
            <Video size={15} className={activeVideoStream?.broadcasterId === currentUser.id ? 'text-red-600 dark:text-red-400' : ''} />
            {activeVideoStream && (
              <span className="text-[10px] font-black hidden sm:inline">
                {activeVideoStream.broadcasterId === currentUser.id ? 'بثك المباشر' : 'مباشر'}
              </span>
            )}
          </button>

          {/* 2. Device Photos / File Upload Button (خاص بأصحاب الرتب) */}
          <button
            onClick={handleFileClick}
            className={`p-2 rounded-full border transition-all active:scale-95 flex items-center justify-center shrink-0 ${
              isRankedUser
                ? 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/15 dark:hover:bg-sky-500/25 border-sky-200 dark:border-sky-500/40 text-sky-600 dark:text-sky-300 shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
            title={isRankedUser ? 'إرسال صورة من ملفات الهاتف' : 'إرسال صورة من ملفات الهاتف (مخصص لأصحاب الرتب فقط)'}
          >
            <ImageIcon size={15} />
          </button>

          {/* Occupants Counter */}
          <button
            onClick={onOpenUsers}
            className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-full px-2.5 py-1 text-xs text-slate-700 dark:text-slate-200 active:scale-95 transition-all shrink-0 whitespace-nowrap"
            title="عرض قائمة المتواجدين"
          >
            <Users size={13} className="text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-700 dark:text-amber-300">{room.occupantsCount}</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-full border transition-all active:scale-95 shrink-0 ${
              isMuted
                ? 'bg-red-50 dark:bg-red-500/20 border-red-200 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/30'
                : 'bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={isMuted ? 'إلغاء كتم الصوت' : 'كتم صوت الروم'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Master Control Panel Button (Room Master) OR Supervisor Reports Button (Permitted Ranked Users) */}
          {currentUser.role === 'owner' && onOpenMasterPanel ? (
            <button
              onClick={() => onOpenMasterPanel('ranks')}
              className="p-1.5 px-2 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 border border-amber-400/50 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-red-900/30 active:scale-95 transition-all shrink-0 whitespace-nowrap"
              title="لوحة تحكم ماستر الروم"
            >
              <Crown size={14} className="text-yellow-300 animate-pulse" />
              <span className="hidden sm:inline">لوحة الماستر</span>
            </button>
          ) : (
            canViewReports &&
            onOpenMasterPanel && (
              <button
                onClick={() => onOpenMasterPanel('reports')}
                className="p-1.5 px-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 border border-amber-400/60 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md active:scale-95 transition-all shrink-0 whitespace-nowrap"
                title="تقارير المشرفين (صلاحية ممنوحة من الماستر)"
              >
                <ClipboardList size={14} />
                <span className="hidden sm:inline">التقارير</span>
              </button>
            )
          )}

          {/* Public Room Events Log Button (Visible to ALL occupants including guests) */}
          {onOpenPublicEvents && (
            <button
              onClick={onOpenPublicEvents}
              className="p-2 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300 active:scale-95 transition-all shrink-0 flex items-center gap-1"
              title="سجل الأحداث العام المباشر"
            >
              <Activity size={15} />
              <span className="hidden sm:inline text-[10px] font-bold">الأحداث</span>
            </button>
          )}

          {/* Room Info */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition-all shrink-0"
            title="معلومات وقوانين الروم"
          >
            <Info size={15} />
          </button>
        </div>
      </header>

      {/* Room Welcome & Live Broadcast Ticker Bar (شريط التنبيهات والأحداث) */}
      <div
        onClick={onOpenPublicEvents}
        role={onOpenPublicEvents ? 'button' : undefined}
        tabIndex={onOpenPublicEvents ? 0 : undefined}
        onKeyDown={e => {
          if (onOpenPublicEvents && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            onOpenPublicEvents();
          }
        }}
        className={`bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-500/20 px-3 py-1 text-[11px] text-amber-800 dark:text-amber-200/90 flex items-center justify-between gap-2 overflow-hidden transition-colors duration-300 ${
          onOpenPublicEvents ? 'cursor-pointer hover:bg-amber-100/80 dark:hover:bg-amber-950/60' : ''
        }`}
        title={onOpenPublicEvents ? 'انقر لفتح سجل الأحداث العام المباشر' : undefined}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Sparkles size={12} className="text-amber-600 dark:text-amber-400 shrink-0 animate-spin" />
          <p className="truncate text-right font-medium">
            {room.lastBroadcastEvent?.message
              ? `${room.lastBroadcastEvent.title}: ${room.lastBroadcastEvent.message}`
              : room.welcomeMessage}
          </p>
        </div>
        {onOpenPublicEvents && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 shrink-0">
            سجل الأحداث
          </span>
        )}
      </div>

      {/* Room Rules & Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-sm p-4 text-slate-900 dark:text-white shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200 transition-colors duration-300">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{room.flag}</span>
                <h3 className="font-bold text-sm text-amber-700 dark:text-amber-400">{room.name}</h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <div>
                <span className="text-slate-500 dark:text-slate-400 block mb-1">وصف الروم:</span>
                <p className="bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 leading-relaxed">
                  {room.description}
                </p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400 block mb-1">رسالة الترحيب:</span>
                <p className="bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20 leading-relaxed">
                  {room.welcomeMessage}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold mb-1">
                  <ShieldAlert size={14} />
                  <span>قوانين دردشة اليالي الصوتية:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400 text-[11px]">
                  <li>احترام جميع المتواجدين والإدارة</li>
                  <li>عدم استخدام ألفاظ خارجة أو التعدي على المايك</li>
                  <li>الالتزام بوقت المايك (3 دقائق) وإفساح المجال للآخرين</li>
                  <li>يمنع الإعلان عن روابط أو غرف أخرى</li>
                </ul>
              </div>

              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full mt-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
              >
                فهمت وقبول القوانين
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
