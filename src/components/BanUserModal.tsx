import React, { useState } from 'react';
import {
  Ban,
  Globe,
  Smartphone,
  ShieldAlert,
  X,
  Check,
} from 'lucide-react';
import { BanType, UserProfile, ROLE_HIERARCHY } from '../types/loqana';
import { UserBadge } from './UserBadge';
import { useTheme, getReadableRoleColor } from '../context/ThemeContext';

interface BanUserModalProps {
  targetUser: UserProfile;
  initialBanType?: BanType;
  onClose: () => void;
  onConfirmBan: (targetUser: UserProfile, banType: BanType, reason?: string) => Promise<void> | void;
}

export const BanUserModal: React.FC<BanUserModalProps> = ({
  targetUser,
  initialBanType = 'both',
  onClose,
  onConfirmBan,
}) => {
  const { isDarkMode } = useTheme();
  const [selectedBanType, setSelectedBanType] = useState<BanType>(initialBanType);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ipAddress =
    targetUser.ipAddress ||
    `185.${(targetUser.username.length * 17) % 250}.44.${(targetUser.level * 9) % 250}`;
  const deviceId =
    targetUser.deviceId || `DEV-${targetUser.id.slice(-6).toUpperCase()}`;

  const banOptions: {
    type: BanType;
    title: string;
    subtitle: string;
    meta: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      type: 'ip',
      title: 'حظر آي بي (IP)',
      subtitle: 'منع عنوان الشبكة الحالي للعضو من دخول الروم',
      meta: `IP: ${ipAddress}`,
      icon: <Globe size={18} />,
      accent: 'sky',
    },
    {
      type: 'device',
      title: 'حظر جهاز (Device)',
      subtitle: 'منع معرف الجهاز الخاص بالعضو حتى لو غيّر الشبكة',
      meta: `Device: ${deviceId}`,
      icon: <Smartphone size={18} />,
      accent: 'amber',
    },
    {
      type: 'both',
      title: 'كلاهما معاً (IP + Device)',
      subtitle: 'حظر شامل يجمع بين عنوان الشبكة ومعرف الجهاز معاً',
      meta: `${ipAddress}  •  ${deviceId}`,
      icon: <ShieldAlert size={18} />,
      accent: 'red',
    },
  ];

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirmBan(targetUser, selectedBanType, reason.trim() || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/60 dark:bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border-[1.5px] dark:border border-red-300 dark:border-red-500/50 rounded-3xl w-full max-w-md overflow-hidden text-slate-900 dark:text-white shadow-2xl flex flex-col text-right transition-colors duration-300">
        {/* Header */}
        <div className="bg-red-50 dark:bg-transparent dark:bg-gradient-to-r dark:from-red-950/90 dark:via-slate-900 dark:to-rose-950/80 px-4 py-3 border-b border-red-200 dark:border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/40 flex items-center justify-center text-red-600 dark:text-red-400">
              <Ban size={18} />
            </div>
            <div>
              <h2 className="font-black text-sm text-slate-900 dark:text-white">
                تأكيد حظر المستخدم من الروم
              </h2>
              <span className="text-[10px] text-red-700 dark:text-red-300 font-semibold">
                اختر نوع الحظر بدقة قبل التنفيذ
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-red-100/70 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Target User Summary Card */}
        <div className="p-4 space-y-3.5 text-xs overflow-y-auto max-h-[75vh]">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border-[1.5px] dark:border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={targetUser.avatar}
                alt={targetUser.username}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full object-cover border-2 shrink-0"
                style={{ borderColor: getReadableRoleColor(targetUser.role, isDarkMode) }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm">{targetUser.flag}</span>
                  <span
                    className="font-black text-xs truncate max-w-[140px]"
                    style={{ color: getReadableRoleColor(targetUser.role, isDarkMode) }}
                  >
                    {targetUser.username}
                  </span>
                  <UserBadge role={targetUser.role} size="sm" />
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                  الرتبة: {ROLE_HIERARCHY[targetUser.role]?.label || targetUser.role}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Precise Ban Scope Options */}
          <div className="space-y-2">
            <label className="block font-bold text-slate-700 dark:text-slate-200 text-xs">
              نوع الحظر المطلوب:
            </label>
            <div className="space-y-2">
              {banOptions.map(opt => {
                const isSelected = selectedBanType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setSelectedBanType(opt.type)}
                    className={`w-full p-3 rounded-2xl border-[1.5px] dark:border text-right transition-all flex items-start gap-3 active:scale-[0.99] ${
                      isSelected
                        ? opt.type === 'both'
                          ? 'bg-red-50 dark:bg-red-950/60 border-red-500 dark:border-red-400 ring-2 ring-red-400/30 shadow-sm'
                          : opt.type === 'ip'
                          ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 dark:border-sky-400 ring-2 ring-sky-400/30 shadow-sm'
                          : 'bg-amber-50 dark:bg-amber-950/50 border-amber-500 dark:border-amber-400 ring-2 ring-amber-400/30 shadow-sm'
                        : 'bg-white dark:bg-slate-950/70 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        opt.type === 'ip'
                          ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400'
                          : opt.type === 'device'
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-xs text-slate-900 dark:text-white">
                          {opt.title}
                        </span>
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">
                        {opt.subtitle}
                      </p>
                      <span className="inline-block mt-1.5 text-[10px] font-mono px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 truncate max-w-full">
                        {opt.meta}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Reason */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">
              سبب الحظر (اختياري — يظهر في السجل وتقارير المشرفين):
            </label>
            <input
              type="text"
              maxLength={180}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="مثال: مخالفة قوانين الغرفة أو إزعاج المتواجدين..."
              className="w-full bg-slate-50 dark:bg-slate-950 border-[1.5px] dark:border border-slate-300 dark:border-slate-700 focus:border-red-500 dark:focus:border-red-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Ban size={15} />
            <span>
              {isSubmitting
                ? 'جاري تنفيذ الحظر...'
                : selectedBanType === 'ip'
                ? 'تأكيد حظر الآي بي (IP)'
                : selectedBanType === 'device'
                ? 'تأكيد حظر الجهاز (Device)'
                : 'تأكيد الحظر الشامل (كلاهما معاً)'}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-700 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
