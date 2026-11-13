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
} from 'lucide-react';
import { Room, UserProfile, LiveVideoStream } from '../types/loqana';

interface RoomHeaderProps {
  room: Room;
  currentUser: UserProfile;
  onLeaveRoom: () => void;
  onOpenUsers: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenMasterPanel?: () => void;
  onSendImage?: (imageUrl: string) => void;
  onRankWarning?: (message: string) => void;
  activeVideoStream?: LiveVideoStream | null;
  onToggleLiveStream?: () => void;
}

export const RoomHeader: React.FC<RoomHeaderProps> = ({
  room,
  currentUser,
  onLeaveRoom,
  onOpenUsers,
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
      <header className="relative z-20 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/90 backdrop-blur-md border-b border-amber-500/20 px-3 py-2.5 flex items-center justify-between text-white shadow-lg">
        {/* Left: Exit/Back & Room Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onLeaveRoom}
            className="p-1.5 -mr-1 rounded-lg hover:bg-white/10 active:scale-95 text-slate-300 hover:text-white transition-all flex items-center justify-center shrink-0"
            title="مغادرة الروم والعودة للغرف"
          >
            <ChevronRight size={22} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-lg shrink-0">{room.flag}</span>
              <h1 className={`text-sm truncate max-w-[170px] sm:max-w-[240px] ${
                room.isGoldName
                  ? 'text-yellow-400 font-black drop-shadow-[0_1px_4px_rgba(234,179,8,0.7)]'
                  : 'text-white font-bold'
              }`}>
                {room.name}
              </h1>
              {room.isGoldName && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-400/40 font-bold flex items-center gap-0.5">
                  <Sparkles size={9} />
                  <span>ذهبي</span>
                </span>
              )}
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                #{room.code}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span className="truncate flex items-center gap-1.5">
                <span className="text-amber-400">👑 الماستر:</span>
                <span className="text-red-500 font-black tracking-wide drop-shadow-[0_1px_2px_rgba(239,68,68,0.4)]">
                  {room.ownerName}
                </span>
                {room.masterPinCode && (
                  <span className="text-[9px] bg-red-950/80 text-red-300 border border-red-700/60 px-1 rounded font-mono">
                    PIN: {room.masterPinCode}
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Top-Left / Actions Cluster */}
        <div className="flex items-center gap-1.5 shrink-0">
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
                  ? 'bg-red-600/30 border-red-500/80 text-red-300 shadow-md shadow-red-950 animate-pulse'
                  : 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-md'
                : isRankedUser
                ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300 shadow-xs'
                : 'bg-slate-800/70 border-slate-700/80 text-slate-400 hover:text-slate-200'
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
            <Video size={15} className={activeVideoStream?.broadcasterId === currentUser.id ? 'text-red-400' : ''} />
            {activeVideoStream && (
              <span className="text-[10px] font-black hidden sm:inline">
                {activeVideoStream.broadcasterId === currentUser.id ? 'بثك المباشر' : 'مباشر'}
              </span>
            )}
          </button>

          {/* 2. Device Photos / File Upload Button (خاص بأصحاب الرتب) */}
          <button
            onClick={handleFileClick}
            className={`p-2 rounded-full border transition-all active:scale-95 flex items-center justify-center ${
              isRankedUser
                ? 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-300 shadow-xs'
                : 'bg-slate-800/70 border-slate-700/80 text-slate-400 hover:text-slate-200'
            }`}
            title={isRankedUser ? 'إرسال صورة من ملفات الهاتف' : 'إرسال صورة من ملفات الهاتف (مخصص لأصحاب الرتب فقط)'}
          >
            <ImageIcon size={15} />
          </button>

          {/* Occupants Counter */}
          <button
            onClick={onOpenUsers}
            className="flex items-center gap-1 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-full px-2.5 py-1 text-xs text-slate-200 active:scale-95 transition-all"
            title="عرض قائمة المتواجدين"
          >
            <Users size={13} className="text-amber-400" />
            <span className="font-semibold text-amber-300">{room.occupantsCount}</span>
          </button>

          {/* Sound Mute Toggle */}
          <button
            onClick={onToggleMute}
            className={`p-2 rounded-full border transition-all active:scale-95 ${
              isMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
            title={isMuted ? 'إلغاء كتم الصوت' : 'كتم صوت الروم'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          {/* Master Control Panel Button (Only visible to Room Master) */}
          {currentUser.role === 'owner' && onOpenMasterPanel && (
            <button
              onClick={onOpenMasterPanel}
              className="p-1.5 px-2 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 border border-amber-400/50 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-red-900/40 active:scale-95 transition-all"
              title="لوحة تحكم ماستر الروم"
            >
              <Crown size={14} className="text-yellow-300 animate-pulse" />
              <span className="hidden sm:inline">لوحة الماستر</span>
            </button>
          )}

          {/* Room Info */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-2 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition-all"
            title="معلومات وقوانين الروم"
          >
            <Info size={15} />
          </button>
        </div>
      </header>

      {/* Room Welcome Marquee banner */}
      <div className="bg-amber-950/40 border-b border-amber-500/20 px-3 py-1 text-[11px] text-amber-200/90 flex items-center gap-1.5 overflow-hidden">
        <Sparkles size={12} className="text-amber-400 shrink-0 animate-spin" />
        <p className="truncate text-right">{room.welcomeMessage}</p>
      </div>

      {/* Room Rules & Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-4 text-white shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{room.flag}</span>
                <h3 className="font-bold text-sm text-amber-400">{room.name}</h3>
              </div>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div>
                <span className="text-slate-400 block mb-1">وصف الروم:</span>
                <p className="bg-slate-800/70 p-2.5 rounded-lg border border-slate-700/60 leading-relaxed">
                  {room.description}
                </p>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">رسالة الترحيب:</span>
                <p className="bg-amber-950/30 text-amber-200 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed">
                  {room.welcomeMessage}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-1">
                  <ShieldAlert size={14} />
                  <span>قوانين دردشة اليالي الصوتية:</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px]">
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
