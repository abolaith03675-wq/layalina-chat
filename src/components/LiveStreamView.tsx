import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Users,
  Shield,
  ShieldAlert,
  X,
  UserX,
  UserCheck,
  Search,
  Eye,
  Maximize2,
  Minimize2,
  Camera,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { LiveVideoStream, UserProfile, ROLE_HIERARCHY } from '../types/loqana';
import { UserBadge } from './UserBadge';

interface LiveStreamViewProps {
  stream: LiveVideoStream;
  currentUser: UserProfile;
  roomUsers: UserProfile[];
  streamMedia?: MediaStream | null;
  onEndStream: () => void;
  onToggleBlockUser: (userId: string) => void;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onCloseViewer?: () => void;
}

type CameraHardwareStatus = 'checking' | 'hardware_live' | 'denied' | 'busy' | 'unavailable';

export const LiveStreamView: React.FC<LiveStreamViewProps> = ({
  stream,
  currentUser,
  roomUsers,
  streamMedia,
  onEndStream,
  onToggleBlockUser,
  onToggleCamera,
  onToggleMute,
}) => {
  const isBroadcaster = stream.broadcasterId === currentUser.id;
  const isBlocked = stream.blockedUserIds.includes(currentUser.id);

  const [showManageModal, setShowManageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [streamDuration, setStreamDuration] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeMediaStream, setActiveMediaStream] = useState<MediaStream | null>(streamMedia || null);
  const [cameraStatus, setCameraStatus] = useState<CameraHardwareStatus>(
    streamMedia && streamMedia.getVideoTracks().length > 0 ? 'hardware_live' : 'checking'
  );
  const [cameraFeedback, setCameraFeedback] = useState<string | null>(null);
  const [isTestingCamera, setIsTestingCamera] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const playVideo = useCallback(() => {
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, []);

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el) {
        el.autoplay = true;
        el.playsInline = true;
        if (activeMediaStream && el.srcObject !== activeMediaStream) {
          el.srcObject = activeMediaStream;
        }
        playVideo();
      }
    },
    [activeMediaStream, playVideo]
  );

  // Check browser camera permission via navigator.permissions
  const checkCameraPermissionStatus = useCallback(async (): Promise<PermissionState | 'unsupported'> => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
        return result.state;
      }
    } catch {
      // Safari / Firefox may not support 'camera' name in permissions.query
    }
    return 'unsupported';
  }, []);

  // Synthesize visual live stream fallback ONLY if hardware camera cannot be accessed
  const createSyntheticStream = useCallback((name: string, avatarUrl: string): MediaStream => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    let frame = 0;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = avatarUrl;

    const render = () => {
      if (!ctx) return;
      frame++;

      const grad = ctx.createLinearGradient(0, 0, 640, 480);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#090d16');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 640, 480);

      ctx.strokeStyle = 'rgba(234, 179, 8, 0.15)';
      ctx.lineWidth = 1;
      for (let x = 0; x < 640; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 480);
        ctx.stroke();
      }
      for (let y = 0; y < 480; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(640, y);
        ctx.stroke();
      }

      const waveCount = 18;
      const barWidth = 14;
      for (let i = 0; i < waveCount; i++) {
        const barHeight =
          40 + Math.sin(frame * 0.1 + i * 0.5) * 35 + Math.cos(frame * 0.05 + i) * 20;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(239, 68, 68, 0.8)' : 'rgba(234, 179, 8, 0.8)';
        ctx.fillRect(190 + i * (barWidth + 6), 380 - barHeight, barWidth, barHeight);
      }

      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(320, 200, 85 + Math.sin(frame * 0.05) * 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, 220, 100, 200, 200);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(320, 200, 90 + Math.sin(frame * 0.05) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 5;
        ctx.stroke();
      }

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(20, 20, 110, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('🔴 LIVE CAM', 28, 42);

      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(20, 420, 320, 40);
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(`🎥 بث مباشر: ${name}`, 32, 446);

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return canvas.captureStream(30);
  }, []);

  // Acquire physical webcam with smart permissions fallback & Arabic error guidance
  const acquireHardwareCamera = useCallback(
    async (isManualTest = false) => {
      if (isManualTest) {
        setIsTestingCamera(true);
        setCameraFeedback(null);
      }

      const permState = await checkCameraPermissionStatus();
      if (permState === 'denied') {
        setCameraStatus('denied');
        setCameraFeedback(
          'تم رفض إذن الكاميرا في المتصفح. يرجى الضغط على أيقونة القفل بجانب رابط الموقع والسماح باستخدام الكاميرا ثم اضغط «اختبار الكاميرا».'
        );
        const fallback = createSyntheticStream(stream.broadcasterName, stream.broadcasterAvatar);
        localStreamRef.current = fallback;
        setActiveMediaStream(fallback);
        if (isManualTest) setIsTestingCamera(false);
        return;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraStatus('unavailable');
        setCameraFeedback('متصفحك أو نافذة المعاينة لا تدعم الوصول المباشر للكاميرا.');
        const fallback = createSyntheticStream(stream.broadcasterName, stream.broadcasterAvatar);
        localStreamRef.current = fallback;
        setActiveMediaStream(fallback);
        if (isManualTest) setIsTestingCamera(false);
        return;
      }

      try {
        let userStream: MediaStream;
        try {
          userStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            audio: true,
          });
        } catch {
          userStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          });
        }

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }

        localStreamRef.current = userStream;
        setActiveMediaStream(userStream);
        setCameraStatus('hardware_live');
        setCameraFeedback(isManualTest ? 'تم تشغيل الكاميرا الحقيقية بنجاح! 🎥' : null);

        if (videoRef.current) {
          videoRef.current.srcObject = userStream;
          playVideo();
        }
      } catch (err: unknown) {
        const errName = err instanceof DOMException ? err.name : '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setCameraStatus('denied');
          setCameraFeedback(
            'تم رفض إذن الكاميرا. اسمح للمتصفح بالوصول إلى الكاميرا من إعدادات الموقع أو نافذة المعاينة ثم أعد المحاولة.'
          );
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setCameraStatus('busy');
          setCameraFeedback(
            'الكاميرا مشغولة حالياً في تطبيق آخر (مثل Zoom أو تبويب آخر). أغلق التطبيق الآخر ثم اضغط «اختبار الكاميرا».'
          );
        } else {
          setCameraStatus('unavailable');
          setCameraFeedback(
            'تعذر العثور على كاميرا متصلة أو تعذر تشغيلها في وضع المعاينة الحالي.'
          );
        }

        const fallback = createSyntheticStream(stream.broadcasterName, stream.broadcasterAvatar);
        localStreamRef.current = fallback;
        setActiveMediaStream(fallback);
      } finally {
        if (isManualTest) {
          setIsTestingCamera(false);
        }
      }
    },
    [checkCameraPermissionStatus, createSyntheticStream, playVideo, stream.broadcasterAvatar, stream.broadcasterName]
  );

  useEffect(() => {
    if (streamMedia) {
      setActiveMediaStream(streamMedia);
      setCameraStatus('hardware_live');
      if (videoRef.current && videoRef.current.srcObject !== streamMedia) {
        videoRef.current.srcObject = streamMedia;
        playVideo();
      }
    }
  }, [streamMedia, playVideo]);

  useEffect(() => {
    if (isBroadcaster && !streamMedia) {
      acquireHardwareCamera(false);
    } else if (!isBroadcaster && !streamMedia) {
      // Viewers see the live broadcast preview canvas until WebRTC peer media is connected
      const viewerStream = createSyntheticStream(stream.broadcasterName, stream.broadcasterAvatar);
      localStreamRef.current = viewerStream;
      setActiveMediaStream(viewerStream);
      setCameraStatus('hardware_live');
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isBroadcaster, streamMedia, acquireHardwareCamera, createSyntheticStream, stream.broadcasterName, stream.broadcasterAvatar]);

  useEffect(() => {
    if (videoRef.current && activeMediaStream) {
      if (videoRef.current.srcObject !== activeMediaStream) {
        videoRef.current.srcObject = activeMediaStream;
      }
      playVideo();
    }
  }, [activeMediaStream, playVideo]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStreamDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filterableUsers = roomUsers.filter(
    u =>
      u.id !== stream.broadcasterId &&
      (u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ROLE_HIERARCHY[u.role]?.label.includes(searchQuery))
  );

  return (
    <>
      <div
        className={`w-full bg-slate-950 border-b border-amber-500/30 transition-all duration-300 relative overflow-hidden select-none shadow-xl ${
          isMinimized ? 'h-14' : 'h-60 sm:h-76'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent z-10 pointer-events-none" />

        {isBlocked ? (
          <div className="absolute inset-0 bg-gradient-to-b from-red-950/95 via-slate-950 to-black flex flex-col items-center justify-center p-4 text-center z-20">
            <div className="w-12 h-12 rounded-2xl bg-red-600/20 border-2 border-red-500/50 flex items-center justify-center text-red-400 mb-2 shadow-lg">
              <ShieldAlert size={26} className="animate-pulse" />
            </div>
            <h4 className="text-sm font-black text-red-300 mb-1">
              قام صاحب البث بحجب البث المباشر عنك 🚫
            </h4>
            <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
              عذراً، لا تمتلك الإذن لمشاهدة هذا البث المباشر حالياً بقرار من المُبث ({stream.broadcasterName}).
            </p>
          </div>
        ) : (
          <div className="absolute inset-0 bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={setVideoRef}
              autoPlay
              playsInline
              muted={isBroadcaster}
              onLoadedMetadata={playVideo}
              onCanPlay={playVideo}
              className={`w-full h-full object-cover transform -scale-x-100 transition-opacity duration-300 ${
                stream.isCameraActive ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {!stream.isCameraActive && (
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center text-center p-4 z-10 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-2">
                  <VideoOff size={22} />
                </div>
                <h4 className="text-xs font-bold text-slate-300">تم إيقاف الكاميرا مؤقتاً</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">الصوت والبث ما زالا مستمرين</p>
              </div>
            )}
          </div>
        )}

        {/* Top Floating Controls Bar */}
        <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between text-white text-xs">
          <div className="flex items-center gap-1.5 bg-black/65 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow-md">
            <span className="flex items-center gap-1 text-red-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-[10px] tracking-wider uppercase font-black">مباشر</span>
            </span>
            <span className="text-slate-400 font-mono text-[10px]">{formatDuration(streamDuration)}</span>
            <span className="text-slate-500">|</span>
            <span className="flex items-center gap-1 text-slate-300 font-mono text-[10px]">
              <Eye size={12} className="text-amber-400" />
              <span>{Math.max(1, roomUsers.length - stream.blockedUserIds.length)}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isBroadcaster && (
              <button
                onClick={() => setShowManageModal(true)}
                className="px-2 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-md"
                title="إدارة ومنع المشاهدين من البث المباشر"
              >
                <Users size={13} className="text-amber-400" />
                <span>إدارة المشاهدين</span>
                {stream.blockedUserIds.length > 0 && (
                  <span className="px-1 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-mono">
                    {stream.blockedUserIds.length}
                  </span>
                )}
              </button>
            )}

            {isBroadcaster ? (
              <button
                onClick={onEndStream}
                className="px-2.5 py-1 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-md shadow-red-950"
                title="إنهاء البث المباشر"
              >
                <X size={13} />
                <span>إنهاء البث</span>
              </button>
            ) : (
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 text-slate-300 hover:text-white"
                title={isMinimized ? 'تكبير البث' : 'تصغير البث'}
              >
                {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Permission / Busy Fallback Guidance Banner */}
        {isBroadcaster && !isMinimized && cameraFeedback && (
          <div
            className={`absolute top-11 left-2 right-2 z-20 px-2.5 py-1.5 rounded-xl border text-[11px] flex items-center justify-between gap-2 backdrop-blur-md shadow-lg text-right ${
              cameraStatus === 'hardware_live'
                ? 'bg-emerald-950/85 border-emerald-500/50 text-emerald-200'
                : 'bg-amber-950/90 border-amber-500/60 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {cameraStatus === 'hardware_live' ? (
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle size={14} className="text-amber-400 shrink-0" />
              )}
              <span className="leading-snug">{cameraFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setCameraFeedback(null)}
              className="text-slate-400 hover:text-white shrink-0 p-0.5"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Bottom Broadcaster Controls (Camera / Mute / Test Camera) */}
        {isBroadcaster && !isMinimized && (
          <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between text-white gap-2">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onToggleCamera}
                className={`p-1.5 rounded-full border transition-all active:scale-95 ${
                  stream.isCameraActive
                    ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-red-600/30 border-red-500 text-red-300 hover:bg-red-600/40'
                }`}
                title={stream.isCameraActive ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
              >
                {stream.isCameraActive ? <Video size={14} /> : <VideoOff size={14} />}
              </button>
              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded-full border transition-all active:scale-95 ${
                  !stream.isMuted
                    ? 'bg-slate-800/80 border-slate-700 text-slate-200 hover:bg-slate-700'
                    : 'bg-red-600/30 border-red-500 text-red-300 hover:bg-red-600/40'
                }`}
                title={stream.isMuted ? 'إلغاء كتم المايك في البث' : 'كتم المايك في البث'}
              >
                {stream.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
              </button>
              <button
                type="button"
                onClick={() => acquireHardwareCamera(true)}
                disabled={isTestingCamera}
                className="px-2.5 py-1 rounded-full bg-sky-600/85 hover:bg-sky-500 border border-sky-400/60 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-md disabled:opacity-60"
                title="التحقق من إذن الكاميرا وتجربة البث الحقيقي"
              >
                {isTestingCamera ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Camera size={12} />
                )}
                <span>اختبار الكاميرا</span>
              </button>
            </div>

            <span className="text-[10px] bg-black/65 backdrop-blur-md px-2 py-0.5 rounded-full text-slate-300 border border-white/10 truncate">
              {cameraStatus === 'hardware_live'
                ? '🎥 الكاميرا الحية مفعّلة'
                : cameraStatus === 'denied'
                ? '⚠️ إذن الكاميرا مرفوض'
                : cameraStatus === 'busy'
                ? '⚠️ الكاميرا مشغولة'
                : '📡 وضع البث الاحتياطي'}
            </span>
          </div>
        )}
      </div>

      {/* Broadcaster Viewer Management Modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 text-right">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm max-h-[85vh] flex flex-col text-white shadow-2xl overflow-hidden">
            <div className="p-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Shield size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-xs text-amber-300">
                    نظام إدارة ومنع المشاهدين من البث
                  </h3>
                  <span className="text-[10px] text-slate-400 block">
                    يمكنك تحديد ومنع أي شخص في الروم من مشاهدة بثك
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowManageModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 border-b border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>
                  المتواجدون في الروم: <strong>{Math.max(0, roomUsers.length - 1)}</strong>
                </span>
                <span className="text-red-400 font-bold">
                  الممنوعون من المشاهدة: {stream.blockedUserIds.length}
                </span>
              </div>

              <div className="relative flex items-center">
                <Search size={14} className="absolute right-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن عضو بالاسم أو الرتبة..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-right text-white placeholder:text-slate-500 outline-none focus:border-amber-500/60"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
              {filterableUsers.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  لا يوجد متواجدون يطابقون البحث
                </div>
              ) : (
                filterableUsers.map(user => {
                  const userIsBlocked = stream.blockedUserIds.includes(user.id);
                  return (
                    <div
                      key={user.id}
                      className={`p-2.5 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                        userIsBlocked
                          ? 'bg-red-950/30 border-red-500/40 text-red-200'
                          : 'bg-slate-800/60 border-slate-700/60 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={user.avatar}
                            alt={user.username}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-full object-cover border"
                            style={{ borderColor: ROLE_HIERARCHY[user.role]?.hex || '#94a3b8' }}
                          />
                          <span className="absolute -bottom-1 -left-1 text-[10px]">{user.flag}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className="text-xs font-black truncate max-w-[100px]"
                              style={{ color: ROLE_HIERARCHY[user.role]?.hex || '#fff' }}
                            >
                              {user.username}
                            </span>
                            <UserBadge role={user.role} size="sm" showLabel={false} />
                          </div>
                          <span className="text-[10px] text-slate-400 block truncate">
                            {userIsBlocked ? '🚫 ممنوع من المشاهدة' : '👁️ يشاهد البث حالياً'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onToggleBlockUser(user.id)}
                        className={`px-2.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all active:scale-95 shrink-0 ${
                          userIsBlocked
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                            : 'bg-red-600/80 hover:bg-red-600 text-white shadow-sm'
                        }`}
                      >
                        {userIsBlocked ? (
                          <>
                            <UserCheck size={13} />
                            <span>سماح بالمشاهدة</span>
                          </>
                        ) : (
                          <>
                            <UserX size={13} />
                            <span>منع من المشاهدة</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                يتم تطبيق حجب البث المباشر فوراً على شاشة العضو
              </span>
              <button
                onClick={() => setShowManageModal(false)}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
              >
                تم الإغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
