import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Clock, UserCheck, Flame, Volume2, Radio } from 'lucide-react';
import { Room, SoundEffectItem, UserProfile, ROLE_HIERARCHY } from '../types/loqana';
import { soundEngine } from '../services/soundEngine';
import { getMicDurationForRole } from '../services/firebaseService';
import { UserBadge } from './UserBadge';

interface MicStageProps {
  room: Room;
  currentUser: UserProfile;
  speaker: UserProfile | null;
  queueUsers: UserProfile[];
  onTakeMic: () => void;
  onReleaseMic: (reason?: 'manual' | 'timeout') => void;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  onTriggerSound?: (soundType: SoundEffectItem['soundType'], name: string, icon: string) => void;
  onSelectUser?: (userId: string) => void;
  isMuted: boolean;
  isMicTransitioning?: boolean;
}

export const MicStage: React.FC<MicStageProps> = ({
  room,
  currentUser,
  speaker,
  queueUsers,
  onTakeMic,
  onReleaseMic,
  onJoinQueue,
  onLeaveQueue,
  onSelectUser,
  isMuted,
  isMicTransitioning = false,
}) => {
  const isCurrentUserSpeaking = speaker?.id === currentUser.id;
  const userQueueIndex = queueUsers.findIndex(u => u.id === currentUser.id);
  const isInQueue = userQueueIndex !== -1;

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

  // Audio level animation (real mic when user speaks, or simulated dynamic voice bars when bots speak)
  const updateAudioLevels = useCallback(() => {
    if (isCurrentUserSpeaking) {
      const realLevel = soundEngine.getAudioLevel();
      // Ensure smooth visual even if mic is quiet
      const smoothed = Math.max(realLevel, Math.floor(Math.random() * 25) + 15);
      setAudioLevel(smoothed);
    } else if (speaker) {
      // Dynamic simulated speech cadence
      const pulse = Math.floor(Math.sin(Date.now() / 140) * 35 + 50 + Math.random() * 25);
      setAudioLevel(Math.min(100, Math.max(10, pulse)));
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
    <div className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-b border-amber-500/20 px-3 py-2 text-white overflow-hidden shadow-inner select-none">
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
          <div className="w-full flex items-center justify-between bg-slate-900/90 border border-amber-500/30 rounded-2xl p-2.5 shadow-xl relative overflow-hidden backdrop-blur-md">
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
                    borderColor: audioLevel > 25 ? '#f59e0b' : '#64748b',
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
                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-1 rounded-full border-2 border-slate-950 shadow-md">
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
                    style={{ color: ROLE_HIERARCHY[speaker.role]?.hex || '#ef4444' }}
                    title="خيارات المستخدم"
                  >
                    {speaker.username}
                  </button>
                  <UserBadge role={speaker.role} size="sm" />
                </div>

                <div className="flex items-center gap-2 text-[11px] text-amber-300/90 mt-0.5 flex-wrap">
                  <span
                    className={`flex items-center gap-1 ${
                      room.isMicTimerPaused
                        ? 'text-emerald-300 font-bold'
                        : micSecondsRemaining <= 10
                        ? 'text-red-400 font-bold animate-pulse'
                        : ''
                    }`}
                  >
                    <Clock size={11} />
                    <span className="font-mono">{formatTime(micSecondsRemaining)}</span>
                  </span>
                  {room.isMicTimerPaused && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[10px]">
                      📌 مثبّت
                    </span>
                  )}
                  <span className="text-slate-400">•</span>
                  <span className="flex items-center gap-1 text-emerald-400">
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
          <div className="w-full flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-2xl p-2.5 text-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
                <Mic size={18} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">المايك متاح حالياً 🎙️</p>
                <p className="text-[11px] text-slate-400">لا يوجد متحدث على المايك، تفضل بالصعود</p>
              </div>
            </div>
          </div>
        )}

        {/* Mic Control Main Button */}
        <div className="w-full mt-2 flex items-center gap-2">
          {currentUser.isMuted ? (
            <div className="flex-1 py-2 px-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-300 font-bold text-xs text-center flex items-center justify-center gap-1.5">
              <MicOff size={15} />
              <span>أنت مكتوم حالياً في هذه الغرفة ولا يمكنك التحدث بالمايك</span>
            </div>
          ) : isCurrentUserSpeaking ? (
            <button
              key="btn-release-mic"
              type="button"
              disabled={isMicTransitioning}
              onClick={() => onReleaseMic('manual')}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-red-900/40 active:scale-98 transition-all border border-red-400/40 disabled:opacity-70"
            >
              <MicOff size={15} />
              <span>أنت على المايك (اضغط لتسليم المايك)</span>
            </button>
          ) : isInQueue ? (
            <button
              key="btn-leave-queue"
              type="button"
              onClick={onLeaveQueue}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all border border-yellow-300"
            >
              <UserCheck size={15} />
              <span>أنت في السرا (دورك: #{userQueueIndex + 1}) - إلغاء الطلب</span>
            </button>
          ) : room.isMicLocked && currentUser.role !== 'owner' && currentUser.role !== 'vip' && currentUser.role !== 'admin' && currentUser.role !== 'super_admin' ? (
            <div className="flex-1 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-bold text-xs text-center flex items-center justify-center gap-1.5">
              <span>🔒 المايك مقفل حالياً ومخصص للإدارة فقط</span>
            </div>
          ) : !speaker ? (
            <button
              key="btn-take-mic"
              type="button"
              disabled={isMicTransitioning}
              onClick={onTakeMic}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/25 active:scale-98 transition-all border border-amber-300 glow-gold disabled:opacity-70"
            >
              <Mic size={16} className="text-slate-950 animate-pulse" />
              <span>أخذ المايك المباشر 🎙️</span>
            </button>
          ) : (
            <button
              key="btn-join-queue"
              type="button"
              onClick={onJoinQueue}
              className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 border border-amber-500/30 active:scale-98 transition-all"
            >
              <Mic size={15} />
              <span>طلب المايك (حجز دور في السرا)</span>
            </button>
          )}
        </div>

        {/* Mic Queue Bar (سرا المايك) */}
        {queueUsers.length > 0 && (
          <div className="w-full mt-2 flex items-center gap-1.5 bg-slate-950/70 border border-slate-800/80 rounded-xl px-2 py-1 overflow-x-auto text-xs scrollbar-none">
            <span className="text-[10px] text-amber-400 font-bold shrink-0 flex items-center gap-1">
              <span>سرا المايك:</span>
              <span className="px-1 py-0.2 bg-amber-500/20 rounded text-[9px] font-mono">
                {queueUsers.length}
              </span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {queueUsers.map((u, idx) => (
                <div
                  key={u.id}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[11px] shrink-0 ${
                    u.id === currentUser.id
                      ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 font-bold'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <span className="text-[9px] text-amber-400 font-mono font-bold">#{idx + 1}</span>
                  <img
                    src={u.avatar}
                    alt={u.username}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 rounded-full object-cover"
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
