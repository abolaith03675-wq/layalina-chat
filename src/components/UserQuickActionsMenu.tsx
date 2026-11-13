import React, { useState } from 'react';
import {
  VolumeX,
  Volume2,
  Ban,
  UserX,
  Link2,
  Globe,
  Gift,
  X,
  Shield,
  ShieldAlert,
  Smartphone,
  Check,
  MessageSquare,
  Lock,
  MicOff,
  Eraser,
  Trash2,
  RotateCcw,
  Pin,
  Flag,
} from 'lucide-react';
import { UserProfile, ROLE_HIERARCHY } from '../types/loqana';
import { UserBadge } from './UserBadge';

interface UserQuickActionsMenuProps {
  targetUser: UserProfile;
  currentUser: UserProfile;
  onClose: () => void;
  onMute: (target: UserProfile) => void;
  onBan: (target: UserProfile) => void;
  onKick: (target: UserProfile) => void;
  onBind: (target: UserProfile) => void;
  onSendGift: (target: UserProfile) => void;
  onOpenPrivateChat?: (target: UserProfile) => void;
  onRevokeMic?: (target: UserProfile) => void;
  speakerId?: string | null;
  isMicTimerPaused?: boolean;
  onRenewMicTime?: (target: UserProfile) => void;
  onToggleFreezeMicTime?: (target: UserProfile) => void;
  onClearMyChat?: () => void;
  onClearAllChat?: () => void;
  isTargetBlocked?: boolean;
  onToggleBlockUser?: (target: UserProfile) => void;
  onReportUser?: (target: UserProfile, reason: string, details: string, alsoBlock: boolean) => Promise<void> | void;
}

export const UserQuickActionsMenu: React.FC<UserQuickActionsMenuProps> = ({
  targetUser,
  currentUser,
  onClose,
  onMute,
  onBan,
  onKick,
  onBind,
  onSendGift,
  onOpenPrivateChat,
  onRevokeMic,
  speakerId,
  isMicTimerPaused = false,
  onRenewMicTime,
  onToggleFreezeMicTime,
  onClearMyChat,
  onClearAllChat,
  isTargetBlocked = false,
  onToggleBlockUser,
  onReportUser,
}) => {
  const [showIpDetails, setShowIpDetails] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportReason, setReportReason] = useState('ألفاظ مسيئة أو سب');
  const [reportDetails, setReportDetails] = useState('');
  const [alsoBlockOnReport, setAlsoBlockOnReport] = useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const isSelf = targetUser.id === currentUser.id;

  const REPORT_REASONS = [
    'ألفاظ مسيئة أو سب',
    'تحرش أو إزعاج',
    'سبام أو روابط مزعجة',
    'محتوى غير لائق',
    'انتحال شخصية',
  ];

  const handleSubmitReport = async () => {
    if (!onReportUser || isSubmittingReport) return;
    setIsSubmittingReport(true);
    try {
      await onReportUser(targetUser, reportReason, reportDetails.trim(), alsoBlockOnReport);
      onClose();
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Check administrative staff status (Master, VIP, Admin, Super Admin)
  const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);

  // Check hierarchy weights
  const myLevel = ROLE_HIERARCHY[currentUser.role]?.level || 1;
  const targetLevel = ROLE_HIERARCHY[targetUser.role]?.level || 1;
  const hasHigherRank = myLevel > targetLevel;

  // Permissions according to user role
  const canMute = hasHigherRank && myLevel >= 2; // Member and above
  const canKick = hasHigherRank && myLevel >= 3; // Super Admin and above
  const canBan = hasHigherRank && myLevel >= 4; // Admin and above (Master, VIP, Admin)
  const canBind = hasHigherRank && myLevel >= 2; // Member and above
  const canViewIp = hasHigherRank && myLevel >= 3; // Super Admin and above

  // Simulated IP & Device if not set
  const ipAddress = targetUser.ipAddress || `185.${(targetUser.username.length * 17) % 250}.44.${(targetUser.level * 9) % 250}`;
  const deviceId = targetUser.deviceId || `DEV-${targetUser.id.slice(-6).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-sm max-h-[92vh] overflow-hidden text-white shadow-2xl flex flex-col text-right">
        {/* Header with Target User Details */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img
                src={targetUser.avatar}
                alt={targetUser.username}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2"
                style={{ borderColor: ROLE_HIERARCHY[targetUser.role].hex }}
              />
              <span className="absolute -bottom-1 -left-1 text-xs">{targetUser.flag}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-xs font-black truncate max-w-[130px]"
                  style={{ color: ROLE_HIERARCHY[targetUser.role].hex }}
                >
                  {targetUser.username}
                </span>
                <UserBadge role={targetUser.role} size="sm" />
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[180px]">
                {targetUser.mood || 'متواجد في الروم'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* IP and Device Inspector Bar (when toggled) */}
        {showIpDetails && (
          <div className="bg-slate-950 p-3 border-b border-slate-800 text-xs space-y-2 animate-in slide-in-from-top duration-150">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1 text-sky-400 font-bold">
                <Globe size={13} />
                <span>معلومات الاتصال والجهاز:</span>
              </span>
              <button
                onClick={() => setShowIpDetails(false)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 space-y-1 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500 font-sans">عنوان IP:</span>
                <span className="text-amber-300 font-bold">{ipAddress}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500 font-sans">معرف الجهاز:</span>
                <span className="text-emerald-400">{deviceId}</span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
        {/* Action Grid (The 6 Defined Quick Actions) */}
        <div className="p-3 grid grid-cols-2 gap-2 text-xs">
          {/* 1. Mute (كتم) */}
          <button
            disabled={!canMute}
            onClick={() => {
              onMute(targetUser);
              onClose();
            }}
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
              canMute
                ? targetUser.isMuted
                  ? 'bg-amber-950/60 border-amber-500/50 text-amber-300 hover:bg-amber-900/60'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                : 'opacity-40 bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              {targetUser.isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </div>
            <div className="min-w-0">
              <span className="font-bold block truncate">
                {targetUser.isMuted ? 'إلغاء الكتم' : '1. كتم (Mute)'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {canMute ? 'منع الكتابة والمايك' : 'صلاحية غير كافية'}
              </span>
            </div>
          </button>

          {/* 2. Ban (حظر IP والجهاز) */}
          <button
            disabled={!canBan}
            onClick={() => {
              onBan(targetUser);
              onClose();
            }}
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
              canBan
                ? 'bg-red-950/40 hover:bg-red-900/50 border-red-500/40 text-red-200'
                : 'opacity-40 bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
              <Ban size={16} />
            </div>
            <div className="min-w-0">
              <span className="font-bold block truncate">2. حظر (Ban IP)</span>
              <span className="text-[10px] text-slate-400 block truncate">
                {canBan ? 'حظر الجهاز والآيبي' : 'يتطلب رتبة مشرف فأعلى'}
              </span>
            </div>
          </button>

          {/* 3. Kick (طرد من الغرفة) */}
          <button
            disabled={!canKick}
            onClick={() => {
              onKick(targetUser);
              onClose();
            }}
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
              canKick
                ? 'bg-orange-950/40 hover:bg-orange-900/50 border-orange-500/40 text-orange-200'
                : 'opacity-40 bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
              <UserX size={16} />
            </div>
            <div className="min-w-0">
              <span className="font-bold block truncate">3. طرد (Kick)</span>
              <span className="text-[10px] text-slate-400 block truncate">
                {canKick ? 'إخراج فوري للوبي' : 'يتطلب سوبر أدمن فأعلى'}
              </span>
            </div>
          </button>

          {/* 4. Bind / Follow (ربط المستخدم) */}
          <button
            disabled={!canBind}
            onClick={() => {
              onBind(targetUser);
              onClose();
            }}
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
              canBind
                ? targetUser.isBound
                  ? 'bg-purple-950/60 border-purple-500/50 text-purple-200'
                  : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                : 'opacity-40 bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Link2 size={16} />
            </div>
            <div className="min-w-0">
              <span className="font-bold block truncate">
                {targetUser.isBound ? 'فك الربط' : '4. ربط (Bind)'}
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {canBind ? 'متابعة حركات المستخدم' : 'صلاحية غير كافية'}
              </span>
            </div>
          </button>

          {/* 5. View IP (عرض IP المستخدم) */}
          <button
            disabled={!canViewIp}
            onClick={() => setShowIpDetails(!showIpDetails)}
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
              canViewIp
                ? 'bg-sky-950/40 hover:bg-sky-900/50 border-sky-500/40 text-sky-200'
                : 'opacity-40 bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Globe size={16} />
            </div>
            <div className="min-w-0">
              <span className="font-bold block truncate">5. عرض IP</span>
              <span className="text-[10px] text-slate-400 block truncate">
                {canViewIp ? 'كشف عنوان الشبكة' : 'يتطلب سوبر أدمن فأعلى'}
              </span>
            </div>
          </button>

          {/* 6. Send Gift (إرسال هدية) */}
          <button
            onClick={() => {
              onSendGift(targetUser);
              onClose();
            }}
            className="p-2.5 rounded-2xl border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 flex items-center gap-2 transition-all active:scale-95 text-right"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
              <Gift size={16} />
            </div>
            <div className="min-w-0">
              <span className="font-bold block truncate">6. إرسال هدية</span>
              <span className="text-[10px] text-amber-300/80 block truncate">
                إهداء كوينز وهدايا ملكية
              </span>
            </div>
          </button>

          {/* 7. Private Chat (مراسلة خاصة) */}
          {onOpenPrivateChat && (
            <button
              onClick={() => {
                onOpenPrivateChat(targetUser);
                if (!targetUser.isPrivateChatLocked) {
                  onClose();
                }
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right col-span-2 ${
                targetUser.isPrivateChatLocked
                  ? 'border-red-500/40 bg-red-950/30 hover:bg-red-900/40 text-red-300'
                  : 'border-blue-500/40 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                targetUser.isPrivateChatLocked ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
              }`}>
                {targetUser.isPrivateChatLocked ? <Lock size={16} /> : <MessageSquare size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold block truncate">
                  {targetUser.isPrivateChatLocked ? 'الخاص مقفل 🔒' : 'مراسلة خاصة (PM)'}
                </span>
                <span className={`text-[10px] block truncate ${
                  targetUser.isPrivateChatLocked ? 'text-red-400' : 'text-blue-300/80'
                }`}>
                  {targetUser.isPrivateChatLocked
                    ? 'هذا المستخدم قام بقفل الرسائل الخاصة حالياً'
                    : 'بدء محادثة ثنائية مشفرة'}
                </span>
              </div>
            </button>
          )}

          {/* 8, 9, 10. سحب المايك + تجديد الوقت + تثبيت الوقت (ظاهرة لجميع أصحاب صلاحية سحب المايك) */}
          {isStaff && (
            <>
              <button
                onClick={() => {
                  onRevokeMic?.(targetUser);
                  onClose();
                }}
                className="p-2.5 rounded-2xl border border-rose-500/50 bg-rose-950/40 hover:bg-rose-900/50 text-rose-200 flex items-center gap-2 transition-all active:scale-95 text-right col-span-2 shadow-xs group"
                title="إنزال العضو وسحب المايك منه فوراً"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-500/25 text-rose-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <MicOff size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold block truncate text-rose-200">
                      سحب المايك (Revoke Mic)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                      إداري
                    </span>
                  </div>
                  <span className="text-[10px] text-rose-300/80 block truncate mt-0.5">
                    إنزال العضو من المايك وسحب التحدث منه فوراً
                  </span>
                </div>
              </button>

              <button
                onClick={() => {
                  onRenewMicTime?.(targetUser);
                  onClose();
                }}
                className="p-2.5 rounded-2xl border border-amber-500/40 bg-amber-950/35 hover:bg-amber-900/45 text-amber-200 flex items-center gap-2 transition-all active:scale-95 text-right"
                title="إعادة ضبط العداد التنازلي للمتحدث ليبدأ بالمدة الكاملة لرتبته"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                  <RotateCcw size={16} />
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate">تجديد الوقت</span>
                  <span className="text-[10px] text-amber-300/80 block truncate">
                    إعادة العداد من جديد
                  </span>
                </div>
              </button>

              <button
                onClick={() => {
                  onToggleFreezeMicTime?.(targetUser);
                  onClose();
                }}
                className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
                  isMicTimerPaused
                    ? 'border-emerald-500/60 bg-emerald-950/50 hover:bg-emerald-900/55 text-emerald-200'
                    : 'border-slate-700/80 bg-slate-800/80 hover:bg-slate-800 text-slate-200'
                }`}
                title={
                  isMicTimerPaused
                    ? 'استئناف العداد التنازلي من حيث توقف'
                    : 'إيقاف العداد التنازلي تماماً وتثبيت المتحدث'
                }
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isMicTimerPaused
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : 'bg-sky-500/20 text-sky-300'
                  }`}
                >
                  <Pin size={16} className={isMicTimerPaused ? 'fill-emerald-300/30' : ''} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-bold block truncate">
                      {isMicTimerPaused ? 'إلغاء تثبيت الوقت' : 'تثبيت الوقت'}
                    </span>
                    {isMicTimerPaused && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shrink-0">
                        مثبّت
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {isMicTimerPaused ? 'استئناف العداد التنازلي' : 'إيقاف العداد مؤقتاً'}
                  </span>
                </div>
              </button>
            </>
          )}
        </div>

        {/* خيار الإبلاغ والحظر للسلامة (متاح لجميع المستخدمين لأي عضو آخر) */}
        {!isSelf && (onReportUser || onToggleBlockUser) && (
          <div className="px-3 pb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowReportPanel(prev => !prev)}
                className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
                  showReportPanel
                    ? 'bg-red-950/70 border-red-500/70 text-red-200'
                    : 'bg-red-950/35 hover:bg-red-950/60 border-red-500/40 text-red-200'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                  <Flag size={15} />
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate text-xs text-red-300">
                    إبلاغ / حظر
                  </span>
                  <span className="text-[9px] text-slate-400 block truncate">
                    الإبلاغ عن إساءة
                  </span>
                </div>
              </button>

              {onToggleBlockUser && (
                <button
                  type="button"
                  onClick={() => {
                    onToggleBlockUser(targetUser);
                    onClose();
                  }}
                  className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
                    isTargetBlocked
                      ? 'bg-emerald-950/40 hover:bg-emerald-900/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isTargetBlocked
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    <Ban size={15} />
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold block truncate text-xs">
                      {isTargetBlocked ? 'إلغاء الحظر' : 'حظر المستخدم'}
                    </span>
                    <span className="text-[9px] text-slate-400 block truncate">
                      {isTargetBlocked ? 'إظهار رسائله مجدداً' : 'إخفاء رسائله عندي'}
                    </span>
                  </div>
                </button>
              )}
            </div>

            {showReportPanel && onReportUser && (
              <div className="p-3 rounded-2xl bg-slate-950/90 border border-red-500/40 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-red-300 flex items-center gap-1.5">
                    <ShieldAlert size={13} className="text-red-400" />
                    <span>تقديم بلاغ ضد «{targetUser.username}»</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowReportPanel(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    ✕
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {REPORT_REASONS.map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setReportReason(reason)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all ${
                        reportReason === reason
                          ? 'bg-red-600/80 border-red-400 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-red-500/40'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  maxLength={300}
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="تفاصيل إضافية عن المخالفة (اختياري)..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-red-400 rounded-xl px-2.5 py-1.5 text-[11px] text-white outline-none resize-none placeholder:text-slate-500"
                />

                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={alsoBlockOnReport}
                    onChange={e => setAlsoBlockOnReport(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-900 text-red-500 focus:ring-red-500"
                  />
                  <span>حظر هذا المستخدم وإخفاء رسائله عندي فوراً</span>
                </label>

                <button
                  type="button"
                  disabled={isSubmittingReport}
                  onClick={handleSubmitReport}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <Flag size={13} />
                  <span>{isSubmittingReport ? 'جاري إرسال البلاغ...' : 'إرسال البلاغ للإدارة'}</span>
                </button>
              </div>
            )}
          </div>
        )}
        </div>

        {/* خيارات مسح شاشة المحادثة (Clear Chat) */}
        <div className="px-3 pb-3 pt-2 border-t border-slate-800 bg-slate-950/40 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Eraser size={13} />
              <span>خيارات مسح شاشة المحادثة (Clear Chat):</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 1. مسح شاشتي فقط (متاح لجميع المستخدمين بما فيهم الزائر) */}
            <button
              onClick={() => {
                onClearMyChat?.();
                onClose();
              }}
              className="p-2.5 rounded-2xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 flex items-center gap-2 transition-all active:scale-95 text-right shadow-xs group"
              title="مسح رسائل الشات على جهازك أنت فقط دون التأثير على الآخرين"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-700/80 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Eraser size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold block truncate text-xs text-slate-200">
                  مسح شاشتي فقط
                </span>
                <span className="text-[9px] text-slate-400 block truncate">
                  (محلي لجهازك فقط)
                </span>
              </div>
            </button>

            {/* 2. مسح شاشة الروم للكل (محصور فقط لمن يمتلك رتبة في الغرفة) */}
            {currentUser.role !== 'guest' ? (
              <button
                onClick={() => {
                  onClearAllChat?.();
                  onClose();
                }}
                className="p-2.5 rounded-2xl border border-amber-500/50 bg-gradient-to-r from-amber-950/50 to-red-950/40 hover:from-amber-900/60 hover:to-red-900/50 text-amber-200 flex items-center gap-2 transition-all active:scale-95 text-right shadow-xs group"
                title="مسح شاشة الروم لجميع المتواجدين (خاص بالرتب)"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/25 text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Trash2 size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold block truncate text-xs text-amber-300">
                      مسح شاشة الروم
                    </span>
                    <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                      للكل
                    </span>
                  </div>
                  <span className="text-[9px] text-amber-300/80 block truncate">
                    حذف الشات للجميع 👑
                  </span>
                </div>
              </button>
            ) : (
              <div
                className="p-2.5 rounded-2xl border border-slate-800 bg-slate-900/40 text-slate-600 flex items-center gap-2 text-right opacity-50 cursor-not-allowed"
                title="مسح شاشة الروم للكل محصور فقط بأصحاب الرتب"
              >
                <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-600 flex items-center justify-center shrink-0">
                  <Lock size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold block truncate text-xs text-slate-500">
                    مسح شاشة الروم
                  </span>
                  <span className="text-[9px] text-slate-600 block truncate">
                    خاص بأصحاب الرتب فقط
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Hierarchy note */}
        <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
          <span>رتبتك: <strong className={ROLE_HIERARCHY[currentUser.role].color}>{ROLE_HIERARCHY[currentUser.role].label}</strong></span>
          <span>{hasHigherRank ? 'لديك صلاحيات على هذا العضو' : 'لا يمكنك إدارة مستخدم مساوٍ أو أعلى منك'}</span>
        </div>
      </div>
    </div>
  );
};
