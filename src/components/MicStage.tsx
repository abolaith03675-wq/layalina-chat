import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, Clock, Flame, Volume2, Radio } from 'lucide-react';
import { Room, SoundEffectItem, UserProfile } from '../types/loqana';
import { soundEngine } from '../services/soundEngine';
import { getMicDurationForRole } from '../services/firebaseService';
import { UserBadge } from './UserBadge';
import { useTheme, getReadableRoleColor } from '../context/ThemeContext';

interface MicStageProps {
  room: Room;
  currentUser: UserProfile;
  speaker: UserProfile | null;
  queueUsers: UserProfile[];
  onReleaseMic: (reason?: 'manual' | 'timeout') => void;
  onTriggerSound?: (soundType: SoundEffectItem['soundType'], name: string, icon: string) => void;
  onSelectUser?: (userId: string) => void;
  isMuted: boolean;
  audioPlaybackBlocked?: boolean;
  onUnlockRemoteAudio?: () => void;
  micError?: 'denied' | 'unavailable' | null;
  onRetryMic?: () => void;
}

export const MicStage: React.FC<MicStageProps> = ({
  room,
  currentUser,
  speaker,
  queueUsers,
  onReleaseMic,
  onSelectUser,
  isMuted,
  audioPlaybackBlocked = false,
  onUnlockRemoteAudio,
  micError = null,
  onRetryMic,
}) => {
  const { isDarkMode } = useTheme();
  const isCurrentUserSpeaking = speaker?.id === currentUser.id;

  const speakerDurationSec = speaker
    ? getMicDurationForRole(room.micDurations, speaker.role)
    : getMicDurationForRole(room.micDurations, currentUser.role);

  // Real or simulated audio levels
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [micSecondsRemaining, setMicSecondsRemaining] = useState<number>(speakerDurationSec);
  const [flyingReactions, setFlyingReactions] = useState<{ id: string; icon: string; left: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const turnSyncRef = useRef<{
    signature: string;
    effectiveStartMs: number;
    mountedAtMs: number;
  } | null>(null);
  const releasedTurnKeyRef = useRef<string | null>(null);
  const onReleaseMicRef = useRef(onReleaseMic);
  onReleaseMicRef.current = onReleaseMic;

  // Timer countdown for current speaker based on speaker's role duration in Firebase
  useEffect(() => {
    if (!speaker) {
      turnSyncRef.current = null;
      releasedTurnKeyRef.current = null;
      setMicSecondsRemaining(getMicDurationForRole(room.micDurations, currentUser.role));
      return;
    }

    if (room.isMicTimerPaused) {
      const pausedRemaining =
        typeof room.micPausedRemainingSec === 'number'
          ? Math.max(0, Math.min(speakerDurationSec, room.micPausedRemainingSec))
          : speakerDurationSec;
      setMicSecondsRemaining(pausedRemaining);
      return;
    }

    const rawStartMs =
      typeof room.speakerStartedAtMs === 'number' && room.speakerStartedAtMs > 0
        ? room.speakerStartedAtMs
        : Date.now();
    const signature = `${speaker.id}_${rawStartMs}`;

    if (!turnSyncRef.current || turnSyncRef.current.signature !== signature) {
      const now = Date.now();
      const rawElapsedSec = Math.floor((now - rawStartMs) / 1000);
      // Guard against client-to-client clock skew or stale timestamp making a brand-new turn look expired immediately
      const normalizedStartMs =
        rawStartMs > now || rawElapsedSec >= speakerDurationSec ? now : rawStartMs;

      turnSyncRef.current = {
        signature,
        effectiveStartMs: normalizedStartMs,
        mountedAtMs: now,
      };
    }

    const activeTurn = turnSyncRef.current;

    const syncRemaining = () => {
      const now = Date.now();
      const elapsedSec = Math.max(0, Math.floor((now - activeTurn.effectiveStartMs) / 1000));
      const remaining = Math.max(0, speakerDurationSec - elapsedSec);
      setMicSecondsRemaining(remaining);

      // Never trigger immediate timeout drop right on turn ascent; require genuine countdown expiry
      const aliveMs = now - activeTurn.mountedAtMs;
      if (
        !room.isMicTimerPaused &&
        remaining <= 0 &&
        aliveMs >= 3000 &&
        isCurrentUserSpeaking &&
        releasedTurnKeyRef.current !== activeTurn.signature
      ) {
        releasedTurnKeyRef.current = activeTurn.signature;
        onReleaseMicRef.current('timeout');
      }
    };

    syncRemaining();
    const timer = setInterval(syncRemaining, 500);

    return () => clearInterval(timer);
  }, [
    speaker?.id,
    speakerDurationSec,
    room.micDurations,
    room.speakerStartedAtMs,
    room.isMicTimerPaused,
    room.micPausedRemainingSec,
    currentUser.role,
    isCurrentUserSpeaking,
  ]);

  // Audio level animation (real local mic when speaking, real remote WebRTC stream when listening)
  const updateAudioLevels = useCallback(() => {
    if (isCurrentUserSpeaking) {
      const realLevel = soundEngine.getAudioLevel();
      const smoothed = Math.max(realLevel, Math.floor(Math.random() * 14) + 12);
      setAudioLevel(smoothed);
    } else if (speaker) {
      const remoteLevel = soundEngine.getRemoteAudioLevel();
      if (remoteLevel > 0) {
        setAudioLevel(Math.min(100, Math.max(12, remoteLevel)));
      } else {
        const pulse = Math.floor(Math.sin(Date.now() / 160) * 18 + 28);
        setAudioLevel(Math.min(100, Math.max(10, pulse)));
      }
    } else {
      setAudioLevel(0);
    }
    animFrameRef.current = requestAnimationFrame(updateAudioLevels);
  }, [isCurrentUserSpeaking, speaker]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(updateAudioLevels);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [updateAudioLevels]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="relative bg-slate-100 dark:bg-transparent dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 border-b border-slate-300 dark:border-amber-500/20 px-3 py-2 text-slate-900 dark:text-white overflow-hidden shadow-inner select-none transition-colors duration-300">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.07)_0%,transparent_70%)] pointer-events-none" />

      {/* Floating sound reactions */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
        {flyingReactions.map(r => (
          <div
            key={r.id}
            style={{ left: `${r.left}%` }}
            className="absolute bottom-6 text-3xl animate-bounce transition-all duration-1000 ease-out opacity-90 transform -translate-x-1/2"
          >
            {r.icon}
          </div>
        ))}
      </div>

      {/* Speaker Stage Card */}
      <div className="relative z-10 flex flex-col items-center">
        {speaker ? (
          <div className="w-full flex items-center justify-between bg-white dark:bg-slate-900/90 border-[1.5px] dark:border border-amber-500 dark:border-amber-500/30 rounded-2xl p-2.5 shadow-md dark:shadow-xl relative overflow-hidden backdrop-blur-md transition-colors duration-300">
            {/* Visualizer backdrop highlight */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent transition-opacity duration-300"
              style={{ opacity: audioLevel / 100 }}
            />

            {/* Left: Speaker Avatar + Glowing Audio Ring */}
            <div className="flex items-center gap-2.5 min-w-0 z-10">
              <div
                onClick={() => onSelectUser?.(speaker.id)}
                className="relative shrink-0 cursor-pointer"
                title="خيارات المتحدث"
              >
                <div
                  className="w-13 h-13 rounded-full overflow-hidden p-0.5 border-2 transition-all duration-150 relative z-10"
                  style={{
                    borderColor: audioLevel > 25 ? '#f59e0b' : isDarkMode ? '#64748b' : '#cbd5e1',
                    boxShadow: audioLevel > 20 ? `0 0 ${audioLevel / 4}px rgba(245, 158, 11, 0.8)` : 'none',
                    transform: `scale(${1 + (audioLevel / 500)})`,
                  }}
                >
                  <img
                    src={speaker.avatar}
                    alt={speaker.username}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover rounded-full"
                  />
                </div>
                {/* Speaking indicator dot */}
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full border-2 border-white dark:border-slate-950 shadow-md">
                  <Radio size={11} className="animate-spin" />
                </div>
              </div>

              {/* Speaker Details */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-base">{speaker.flag}</span>
                  <button
                    onClick={() => onSelectUser?.(speaker.id)}
                    className="text-sm font-black hover:underline cursor-pointer truncate max-w-[130px] sm:max-w-[180px]"
                    style={{ color: getReadableRoleColor(speaker.role, isDarkMode) }}
                    title="خيارات المستخدم"
                  >
                    {speaker.username}
                  </button>
                  <UserBadge role={speaker.role} size="sm" />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300/90 mt-0.5 flex-wrap">
                  <span
                    className={`flex items-center gap-1 ${
                      room.isMicTimerPaused
                        ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                        : micSecondsRemaining <= 10
                        ? 'text-red-600 dark:text-red-400 font-bold animate-pulse'
                        : ''
                    }`}
                  >
                    <Clock size={11} />
                    <span className="font-mono">{formatTime(micSecondsRemaining)}</span>
                  </span>
                  {room.isMicTimerPaused && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 font-bold text-[10px]">
                      📌 مثبّت
                    </span>
                  )}
                  <span className="text-slate-400">•</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <Flame size={11} />
                    <span>على المايك</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Equalizer Spectrum Bars */}
            <div className="flex items-end gap-0.5 h-8 px-2 z-10 shrink-0">
              {[40, 70, 95, 60, 85, 50, 80, 100, 65, 45].map((multiplier, i) => {
                const heightPercent = Math.min(100, Math.max(15, (audioLevel * multiplier) / 60));
                return (
                  <div
                    key={i}
                    className="w-1 rounded-full transition-all duration-75"
                    style={{
                      height: `${heightPercent}%`,
                      backgroundColor:
                        i % 3 === 0 ? '#fbbf24' : i % 2 === 0 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          /* Mic is empty state */
          <div className="w-full flex items-center justify-between bg-white dark:bg-slate-900/60 border-[1.5px] dark:border border-slate-300 dark:border-slate-800 rounded-2xl p-2.5 text-slate-700 dark:text-slate-300 shadow-xs transition-colors duration-300">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-slate-700 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Mic size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">المايك متاح حالياً 🎙️</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">لا يوجد متحدث — اضغط زر المايك بالأسفل للصعود</p>
              </div>
            </div>
          </div>
        )}

        {/* Audio autoplay unlock / Mic retry inline action */}
        {audioPlaybackBlocked && speaker && !isCurrentUserSpeaking && !isMuted && onUnlockRemoteAudio && (
          <button
            type="button"
            onClick={onUnlockRemoteAudio}
            className="w-full mt-2 py-1.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all animate-pulse"
          >
            <Volume2 size={15} />
            <span>اضغط هنا لتفعيل سماع صوت المتحدث المباشر</span>
          </button>
        )}

        {isCurrentUserSpeaking && micError && onRetryMic && (
          <button
            type="button"
            onClick={onRetryMic}
            className="w-full mt-2 py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
          >
            <Mic size={15} />
            <span>
              {micError === 'denied'
                ? 'تم رفض إذن المايك — اسمح بالميكروفون واضغط لإعادة التفعيل'
                : 'اضغط هنا لتشغيل الميكروفون وإرسال صوتك للغرفة'}
            </span>
          </button>
        )}

        {/* Mic Queue Bar (سرا المايك) */}
        {queueUsers.length > 0 && (
          <div className="w-full mt-2 flex items-center gap-1.5 bg-white/90 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl px-2 py-1.5 text-xs">
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold shrink-0 whitespace-nowrap flex items-center gap-1">
              <span>سرا المايك:</span>
              <span className="px-1 py-0.2 bg-amber-100 dark:bg-amber-500/20 rounded text-[9px] font-mono">
                {queueUsers.length}
              </span>
            </span>
            <div className="flex items-center gap-1.5 flex-1 min-w-0 touch-scroll-x">
              {queueUsers.map((u, idx) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] shrink-0 whitespace-nowrap ${
                    u.id === currentUser.id
                      ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400/70 dark:border-amber-400/50 text-amber-900 dark:text-amber-300 font-bold'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono font-bold">#{idx + 1}</span>
                  <img
                    src={u.avatar}
                    alt={u.username}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                  <span className="truncate max-w-[70px]">{u.username}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
