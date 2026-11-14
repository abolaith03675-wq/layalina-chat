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
  ShieldAlert,
  Check,
  MessageSquare,
  Lock,
  MicOff,
  Eraser,
  Trash2,
  RotateCcw,
  Pin,
  Flag,
  Smartphone,
} from 'lucide-react';
import {
  BanType,
  BannedUserEntry,
  UserProfile,
  ROLE_HIERARCHY,
  normalizeUserRole,
  isMasterRole,
  isRoomAdminRole,
  canModerateTarget,
} from '../types/loqana';
import { UserBadge } from './UserBadge';
import { useTheme, getReadableRoleColor } from '../context/ThemeContext';

interface UserQuickActionsMenuProps {
  targetUser: UserProfile;
  currentUser: UserProfile;
  activeBanEntry?: BannedUserEntry | null;
  onClose: () => void;
  onMute: (target: UserProfile) => void;
  onBan: (target: UserProfile, initialType?: BanType) => void;
  onUnban?: (banEntry: BannedUserEntry, target: UserProfile) => void;
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
  isGeneralMaster?: boolean;
}

export const UserQuickActionsMenu: React.FC<UserQuickActionsMenuProps> = ({
  targetUser,
  currentUser,
  activeBanEntry = null,
  onClose,
  onMute,
  onBan,
  onUnban,
  onKick,
  onBind,
  onSendGift,
  onOpenPrivateChat,
  onRevokeMic,
  isMicTimerPaused = false,
  onRenewMicTime,
  onToggleFreezeMicTime,
  onClearMyChat,
  onClearAllChat,
  isTargetBlocked = false,
  onToggleBlockUser,
  onReportUser,
  isGeneralMaster = false,
}) => {
  const { isDarkMode } = useTheme();
  const [showIpDetails, setShowIpDetails] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportReason, setReportReason] = useState('ألفاظ مسيئة أو سب');
  const [reportDetails, setReportDetails] = useState('');
  const [alsoBlockOnReport, setAlsoBlockOnReport] = useState(true);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Normalize roles accurately (supports English & Arabic aliases)
  const myRole = normalizeUserRole(currentUser.role);
  const targetRole = normalizeUserRole(targetUser.role);
  const isSelf = targetUser.id === currentUser.id;
  // General Master override: never grants Master power if session explicitly entered as guest
  const isMaster = isMasterRole(myRole) || (Boolean(isGeneralMaster) && myRole !== 'guest');
  const hasRoomRank = myRole !== 'guest' || isMaster;
  const isAdminStaff = isMaster || isRoomAdminRole(myRole);

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

  // Hierarchy check with absolute General Master bypass
  const hasHigherRank = canModerateTarget(myRole, targetRole, {
    isSelf,
    isGeneralMaster: isMaster,
  });

  // Strict role & hierarchy permissions for each control (General Master unlocks all)
  const canMute = hasHigherRank;
  const canKick = hasHigherRank;
  const canBan = hasHigherRank;
  const canBind = hasHigherRank;
  const canViewIp = hasHigherRank;
  const canRevokeMicTarget = isMaster || (isAdminStaff && (isSelf || hasHigherRank));
  const modLockReason = isMaster
    ? 'صلاحية الماستر المطلقة'
    : isSelf
    ? 'غير متاح على حسابك 🔒'
    : myRole === 'guest'
    ? 'معطّل لرتبة الزائر 🔒'
    : !isAdminStaff
    ? 'للرتب الإدارية فقط 🔒'
    : 'رتبة مساوية أو أعلى 🔒';
  const staffOnlyLockReason =
    myRole === 'guest' ? 'معطّل لرتبة الزائر 🔒' : 'للرتب الإدارية فقط 🔒';

  // IP & Device details
  const ipAddress = targetUser.ipAddress || `185.${(targetUser.username.length * 17) % 250}.44.${(targetUser.level * 9) % 250}`;
  const deviceId = targetUser.deviceId || `DEV-${targetUser.id.slice(-6).toUpperCase()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/55 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border-[1.5px] dark:border border-slate-300 dark:border-slate-700 rounded-3xl w-full max-w-sm max-h-[92vh] overflow-hidden text-slate-900 dark:text-white shadow-2xl flex flex-col text-right transition-colors duration-300">
        {/* Header with Target User Details */}
        <div className="bg-slate-50 dark:bg-transparent dark:bg-gradient-to-r dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <img
                src={targetUser.avatar}
                alt={targetUser.username}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2"
                style={{ borderColor: getReadableRoleColor(targetUser.role, isDarkMode) }}
              />
              <span className="absolute -bottom-1 -left-1 text-xs">{targetUser.flag}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className="text-xs font-black truncate max-w-[130px]"
                  style={{ color: getReadableRoleColor(targetUser.role, isDarkMode) }}
                >
                  {targetUser.username}
                </span>
                <UserBadge role={targetUser.role} size="sm" />
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate max-w-[180px]">
                {targetUser.mood || 'متواجد في الروم'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* IP and Device Inspector Bar (when toggled by authorized staff) */}
        {showIpDetails && canViewIp && (
          <div className="bg-slate-50 dark:bg-slate-950 p-3 border-b border-slate-200 dark:border-slate-800 text-xs space-y-2 animate-in slide-in-from-top duration-150">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold">
                <Globe size={13} />
                <span>معلومات الاتصال والجهاز:</span>
              </span>
              <button
                onClick={() => setShowIpDetails(false)}
                className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1 font-mono text-[11px]">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 font-sans">عنوان IP:</span>
                <span className="text-amber-700 dark:text-amber-300 font-bold">{ipAddress}</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span className="text-slate-500 font-sans">معرف الجهاز:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{deviceId}</span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Dedicated Section: Direct Kick & All Ban Types (Visible to everyone, gated strictly) */}
          <div className="px-3 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800/90 bg-red-50/40 dark:bg-red-950/15 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-black text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <ShieldAlert size={13} className="text-red-600 dark:text-red-400" />
                <span>الطرد والحظر الإداري (بأنواعه):</span>
              </span>
              {!canBan && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  {modLockReason}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {/* Direct Kick from Room */}
              <button
                type="button"
                disabled={!canKick}
                aria-disabled={!canKick}
                title={canKick ? 'طرد المستخدم وإخراجه من الروم فوراً' : modLockReason}
                onClick={() => {
                  if (!canKick) return;
                  onKick(targetUser);
                  onClose();
                }}
                className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                  canKick
                    ? 'active:scale-95 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/50 dark:hover:bg-orange-900/60 border-orange-300 dark:border-orange-500/50 text-orange-800 dark:text-orange-200 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    canKick
                      ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {canKick ? <UserX size={16} /> : <Lock size={14} />}
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate">طرد من الغرفة</span>
                  <span className="text-[10px] opacity-80 block truncate">
                    {canKick ? 'إخراج فوري للوبي' : modLockReason}
                  </span>
                </div>
              </button>

              {/* Ban Type 1: IP Ban */}
              <button
                type="button"
                disabled={!canBan}
                aria-disabled={!canBan}
                title={canBan ? 'حظر عنوان الشبكة (IP) للعضو' : modLockReason}
                onClick={() => {
                  if (!canBan) return;
                  onClose();
                  onBan(targetUser, 'ip');
                }}
                className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                  canBan
                    ? 'active:scale-95 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/45 dark:hover:bg-sky-900/55 border-sky-300 dark:border-sky-500/45 text-sky-800 dark:text-sky-200 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    canBan
                      ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {canBan ? <Globe size={16} /> : <Lock size={14} />}
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate">حظر آي بي (IP)</span>
                  <span className="text-[10px] opacity-80 block truncate">
                    {canBan ? 'منع عنوان الشبكة' : modLockReason}
                  </span>
                </div>
              </button>

              {/* Ban Type 2: Device Ban */}
              <button
                type="button"
                disabled={!canBan}
                aria-disabled={!canBan}
                title={canBan ? 'حظر معرف الجهاز (Device ID) للعضو' : modLockReason}
                onClick={() => {
                  if (!canBan) return;
                  onClose();
                  onBan(targetUser, 'device');
                }}
                className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                  canBan
                    ? 'active:scale-95 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/45 dark:hover:bg-amber-900/55 border-amber-300 dark:border-amber-500/45 text-amber-800 dark:text-amber-200 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    canBan
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {canBan ? <Smartphone size={16} /> : <Lock size={14} />}
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate">حظر جهاز (Device)</span>
                  <span className="text-[10px] opacity-80 block truncate">
                    {canBan ? 'منع الجهاز نهائياً' : modLockReason}
                  </span>
                </div>
              </button>

              {/* Ban Type 3: Both (IP + Device) */}
              <button
                type="button"
                disabled={!canBan}
                aria-disabled={!canBan}
                title={canBan ? 'حظر شامل للآي بي والجهاز معاً' : modLockReason}
                onClick={() => {
                  if (!canBan) return;
                  onClose();
                  onBan(targetUser, 'both');
                }}
                className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                  canBan
                    ? 'active:scale-95 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-200 shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    canBan
                      ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {canBan ? <Ban size={16} /> : <Lock size={14} />}
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate">حظر شامل (كلاهما)</span>
                  <span className="text-[10px] opacity-80 block truncate">
                    {canBan ? 'IP + جهاز معاً' : modLockReason}
                  </span>
                </div>
              </button>

              {/* Optional Unban if target currently has an active ban entry */}
              {activeBanEntry && onUnban && (
                <button
                  type="button"
                  disabled={!canBan}
                  aria-disabled={!canBan}
                  onClick={() => {
                    if (!canBan) return;
                    onUnban(activeBanEntry, targetUser);
                    onClose();
                  }}
                  className={`col-span-2 p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                    canBan
                      ? 'active:scale-95 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border-emerald-300 dark:border-emerald-500/50 text-emerald-800 dark:text-emerald-200'
                      : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      canBan
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {canBan ? <Check size={16} /> : <Lock size={14} />}
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold block truncate">فك الحظر (Unban)</span>
                    <span className="text-[10px] opacity-80 block truncate">
                      {canBan
                        ? activeBanEntry.banType === 'ip'
                          ? 'محظور (IP) • انقر للفك'
                          : activeBanEntry.banType === 'device'
                          ? 'محظور (جهاز) • انقر للفك'
                          : 'محظور (شامل) • انقر للفك'
                        : modLockReason}
                    </span>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Action Grid (Other Controls & Social Actions — Visible to all, gated by role) */}
          <div className="p-3 grid grid-cols-2 gap-2 text-xs">
            {/* 1. Mute (كتم) */}
            <button
              type="button"
              disabled={!canMute}
              aria-disabled={!canMute}
              title={canMute ? 'منع أو السماح بالكتابة والمايك' : modLockReason}
              onClick={() => {
                if (!canMute) return;
                onMute(targetUser);
                onClose();
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                !canMute
                  ? 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                  : targetUser.isMuted
                  ? 'active:scale-95 bg-amber-50 dark:bg-amber-950/60 border-amber-400 dark:border-amber-500/50 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                  : 'active:scale-95 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  !canMute
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    : 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                {!canMute ? <Lock size={14} /> : targetUser.isMuted ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </div>
              <div className="min-w-0">
                <span className="font-bold block truncate">
                  {targetUser.isMuted ? 'إلغاء الكتم' : 'كتم (Mute)'}
                </span>
                <span className="text-[10px] opacity-80 block truncate">
                  {canMute ? 'منع الكتابة والمايك' : modLockReason}
                </span>
              </div>
            </button>

            {/* 2. Bind / Follow */}
            <button
              type="button"
              disabled={!canBind}
              aria-disabled={!canBind}
              title={canBind ? 'متابعة حركات المستخدم' : modLockReason}
              onClick={() => {
                if (!canBind) return;
                onBind(targetUser);
                onClose();
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                !canBind
                  ? 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                  : targetUser.isBound
                  ? 'active:scale-95 bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-500/50 text-purple-800 dark:text-purple-200'
                  : 'active:scale-95 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  !canBind
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    : 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400'
                }`}
              >
                {!canBind ? <Lock size={14} /> : <Link2 size={16} />}
              </div>
              <div className="min-w-0">
                <span className="font-bold block truncate">
                  {targetUser.isBound ? 'فك الربط' : 'ربط (Bind)'}
                </span>
                <span className="text-[10px] opacity-80 block truncate">
                  {canBind ? 'متابعة حركات المستخدم' : modLockReason}
                </span>
              </div>
            </button>

            {/* 3. View IP */}
            <button
              type="button"
              disabled={!canViewIp}
              aria-disabled={!canViewIp}
              title={canViewIp ? 'كشف عنوان الشبكة ومعرف الجهاز' : modLockReason}
              onClick={() => {
                if (!canViewIp) return;
                setShowIpDetails(!showIpDetails);
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                canViewIp
                  ? 'active:scale-95 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/40 dark:hover:bg-sky-900/50 border-sky-200 dark:border-sky-500/40 text-sky-800 dark:text-sky-200'
                  : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  canViewIp
                    ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                {canViewIp ? <Globe size={16} /> : <Lock size={14} />}
              </div>
              <div className="min-w-0">
                <span className="font-bold block truncate">عرض IP والجهاز</span>
                <span className="text-[10px] opacity-80 block truncate">
                  {canViewIp ? 'كشف عنوان الشبكة' : modLockReason}
                </span>
              </div>
            </button>

            {/* 4. Send Gift (إرسال هدية) */}
            <button
              type="button"
              onClick={() => {
                onSendGift(targetUser);
                onClose();
              }}
              className="p-2.5 rounded-2xl border border-amber-300 dark:border-amber-500/50 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 flex items-center gap-2 transition-all active:scale-95 text-right"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Gift size={16} />
              </div>
              <div className="min-w-0">
                <span className="font-bold block truncate">إرسال هدية</span>
                <span className="text-[10px] text-amber-700/80 dark:text-amber-300/80 block truncate">
                  إهداء كوينز وهدايا ملكية
                </span>
              </div>
            </button>

            {/* 5. Private Chat (مراسلة خاصة) */}
            {!isSelf && onOpenPrivateChat && (
              <button
                type="button"
                onClick={() => {
                  onOpenPrivateChat(targetUser);
                  if (!targetUser.isPrivateChatLocked) {
                    onClose();
                  }
                }}
                className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right col-span-2 ${
                  targetUser.isPrivateChatLocked
                    ? 'border-red-200 dark:border-red-500/40 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300'
                    : 'border-blue-200 dark:border-blue-500/40 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    targetUser.isPrivateChatLocked
                      ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                      : 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {targetUser.isPrivateChatLocked ? <Lock size={16} /> : <MessageSquare size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold block truncate">
                    {targetUser.isPrivateChatLocked ? 'الخاص مقفل 🔒' : 'مراسلة خاصة (PM)'}
                  </span>
                  <span
                    className={`text-[10px] block truncate ${
                      targetUser.isPrivateChatLocked ? 'text-red-600 dark:text-red-400' : 'text-blue-600/80 dark:text-blue-300/80'
                    }`}
                  >
                    {targetUser.isPrivateChatLocked
                      ? 'هذا المستخدم قام بقفل الرسائل الخاصة حالياً'
                      : 'بدء محادثة ثنائية مشفرة'}
                  </span>
                </div>
              </button>
            )}

            {/* 6, 7, 8. سحب المايك + تجديد الوقت + تثبيت الوقت */}
            <button
              type="button"
              disabled={!canRevokeMicTarget}
              aria-disabled={!canRevokeMicTarget}
              title={canRevokeMicTarget ? 'إنزال العضو وسحب المايك منه فوراً' : modLockReason}
              onClick={() => {
                if (!canRevokeMicTarget) return;
                onRevokeMic?.(targetUser);
                onClose();
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right col-span-2 shadow-xs group ${
                canRevokeMicTarget
                  ? 'active:scale-95 border-rose-300 dark:border-rose-500/50 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-800 dark:text-rose-200'
                  : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  canRevokeMicTarget
                    ? 'bg-rose-100 dark:bg-rose-500/25 text-rose-600 dark:text-rose-300 group-hover:scale-105 transition-transform'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                {canRevokeMicTarget ? <MicOff size={16} /> : <Lock size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold block truncate">
                    سحب المايك (Revoke Mic)
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-100/80 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-300/60 dark:border-rose-500/30 font-bold">
                    إداري
                  </span>
                </div>
                <span className="text-[10px] opacity-80 block truncate mt-0.5">
                  {canRevokeMicTarget
                    ? 'إنزال العضو من المايك وسحب التحدث منه فوراً'
                    : modLockReason}
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={!isAdminStaff}
              aria-disabled={!isAdminStaff}
              title={
                isAdminStaff
                  ? 'إعادة ضبط العداد التنازلي للمتحدث ليبدأ بالمدة الكاملة لرتبته'
                  : staffOnlyLockReason
              }
              onClick={() => {
                if (!isAdminStaff) return;
                onRenewMicTime?.(targetUser);
                onClose();
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                isAdminStaff
                  ? 'active:scale-95 border-amber-300 dark:border-amber-500/40 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/35 dark:hover:bg-amber-900/45 text-amber-800 dark:text-amber-200'
                  : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isAdminStaff
                    ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                {isAdminStaff ? <RotateCcw size={16} /> : <Lock size={14} />}
              </div>
              <div className="min-w-0">
                <span className="font-bold block truncate">تجديد الوقت</span>
                <span className="text-[10px] opacity-80 block truncate">
                  {isAdminStaff ? 'إعادة العداد من جديد' : staffOnlyLockReason}
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={!isAdminStaff}
              aria-disabled={!isAdminStaff}
              title={
                !isAdminStaff
                  ? staffOnlyLockReason
                  : isMicTimerPaused
                  ? 'استئناف العداد التنازلي من حيث توقف'
                  : 'إيقاف العداد التنازلي تماماً وتثبيت المتحدث'
              }
              onClick={() => {
                if (!isAdminStaff) return;
                onToggleFreezeMicTime?.(targetUser);
                onClose();
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right ${
                !isAdminStaff
                  ? 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
                  : isMicTimerPaused
                  ? 'active:scale-95 border-emerald-400 dark:border-emerald-500/60 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/55 text-emerald-800 dark:text-emerald-200'
                  : 'active:scale-95 border-slate-200 dark:border-slate-700/80 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  !isAdminStaff
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    : isMicTimerPaused
                    ? 'bg-emerald-100 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-300'
                    : 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300'
                }`}
              >
                {!isAdminStaff ? (
                  <Lock size={14} />
                ) : (
                  <Pin size={16} className={isMicTimerPaused ? 'fill-emerald-300/30' : ''} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold block truncate">
                    {isMicTimerPaused ? 'إلغاء تثبيت الوقت' : 'تثبيت الوقت'}
                  </span>
                  {isAdminStaff && isMicTimerPaused && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 font-bold shrink-0">
                      مثبّت
                    </span>
                  )}
                </div>
                <span className="text-[10px] opacity-80 block truncate">
                  {!isAdminStaff
                    ? staffOnlyLockReason
                    : isMicTimerPaused
                    ? 'استئناف العداد التنازلي'
                    : 'إيقاف العداد مؤقتاً'}
                </span>
              </div>
            </button>
          </div>

          {/* Safety reporting & local ignore */}
          {!isSelf && (onReportUser || onToggleBlockUser) && (
            <div className="px-3 pb-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {onReportUser && (
                  <button
                    type="button"
                    onClick={() => setShowReportPanel(prev => !prev)}
                    className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
                      showReportPanel
                        ? 'bg-red-100 dark:bg-red-950/70 border-red-400 dark:border-red-500/70 text-red-800 dark:text-red-200'
                        : 'bg-red-50 hover:bg-red-100 dark:bg-red-950/35 dark:hover:bg-red-950/60 border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-200'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                      <Flag size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold block truncate text-xs text-red-700 dark:text-red-300">
                        إبلاغ عن إساءة
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">
                        تقديم بلاغ إداري
                      </span>
                    </div>
                  </button>
                )}

                {onToggleBlockUser && (
                  <button
                    type="button"
                    onClick={() => {
                      onToggleBlockUser(targetUser);
                      onClose();
                    }}
                    className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all active:scale-95 text-right ${
                      isTargetBlocked
                        ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-200'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isTargetBlocked
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      <VolumeX size={15} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold block truncate text-xs">
                        {isTargetBlocked ? 'إلغاء التجاهل' : 'تجاهل رسائله'}
                      </span>
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">
                        {isTargetBlocked ? 'إظهار رسائله مجدداً' : 'إخفاء رسائله عندي'}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {showReportPanel && onReportUser && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-red-300 dark:border-red-500/40 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5">
                      <ShieldAlert size={13} className="text-red-600 dark:text-red-400" />
                      <span>تقديم بلاغ ضد «{targetUser.username}»</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowReportPanel(false)}
                      className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 touch-scroll-x py-0.5">
                    {REPORT_REASONS.map(reason => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setReportReason(reason)}
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border shrink-0 whitespace-nowrap transition-all ${
                          reportReason === reason
                            ? 'bg-red-600 border-red-500 dark:border-red-400 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-red-400 dark:hover:border-red-500/40'
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
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-400 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-white outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />

                  <label className="flex items-center gap-2 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={alsoBlockOnReport}
                      onChange={e => setAlsoBlockOnReport(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-red-500 focus:ring-red-500"
                    />
                    <span>تجاهل هذا المستخدم وإخفاء رسائله عندي فوراً</span>
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
        <div className="px-3 pb-3 pt-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-bold">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <Eraser size={13} />
              <span>خيارات مسح شاشة المحادثة (Clear Chat):</span>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onClearMyChat?.();
                onClose();
              }}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-all active:scale-95 text-right shadow-xs group"
              title="مسح رسائل الشات على جهازك أنت فقط دون التأثير على الآخرين"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-slate-700/80 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Eraser size={16} />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold block truncate text-xs text-slate-800 dark:text-slate-200">
                  مسح شاشتي فقط
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">
                  (محلي لجهازك فقط)
                </span>
              </div>
            </button>

            <button
              type="button"
              disabled={!hasRoomRank}
              aria-disabled={!hasRoomRank}
              onClick={() => {
                if (!hasRoomRank) return;
                onClearAllChat?.();
                onClose();
              }}
              className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all text-right shadow-xs group ${
                hasRoomRank
                  ? 'active:scale-95 border-amber-300 dark:border-amber-500/50 bg-gradient-to-r from-amber-50 to-red-50 hover:from-amber-100 hover:to-red-100 dark:from-amber-950/50 dark:to-red-950/40 dark:hover:from-amber-900/60 dark:hover:to-red-900/50 text-amber-900 dark:text-amber-200'
                  : 'bg-slate-100 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 opacity-55 cursor-not-allowed select-none'
              }`}
              title={hasRoomRank ? 'مسح شاشة الروم لجميع المتواجدين (خاص بالرتب)' : 'معطّل لرتبة الزائر 🔒'}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  hasRoomRank
                    ? 'bg-amber-100 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 group-hover:scale-105 transition-transform'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}
              >
                {hasRoomRank ? <Trash2 size={16} /> : <Lock size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`font-bold block truncate text-xs ${
                      hasRoomRank ? 'text-amber-800 dark:text-amber-300' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    مسح شاشة الروم
                  </span>
                  <span
                    className={`text-[8px] px-1 py-0.2 rounded font-bold ${
                      hasRoomRank
                        ? 'bg-amber-200/70 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    للكل
                  </span>
                </div>
                <span className="text-[9px] opacity-80 block truncate">
                  {hasRoomRank ? 'حذف الشات للجميع 👑' : 'معطّل لرتبة الزائر 🔒'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Hierarchy note */}
        <div className="px-3 py-2 bg-slate-100 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
          <span className="shrink-0">
            رتبتك:{' '}
            <strong style={{ color: getReadableRoleColor(myRole, isDarkMode) }}>
              {ROLE_HIERARCHY[myRole].label}
            </strong>
          </span>
          <span className="truncate">
            {isMaster
              ? 'صلاحية الماستر المطلقة — جميع الأزرار متاحة'
              : isSelf
              ? 'خيارات المايك والتحكم الشخصي'
              : myRole === 'guest'
              ? 'رتبة الزائر: الحظر والطرد معطلان'
              : !isAdminStaff
              ? 'الحظر والطرد للرتب الإدارية فقط'
              : hasHigherRank
              ? 'رتبتك أعلى — متاح الحظر والطرد'
              : 'ممنوع حظر أو طرد من يساويك أو يعلوك رتبة'}
          </span>
        </div>
      </div>
    </div>
  );
};
