import React from 'react';
import { Mic, ShieldCheck, Lock, Volume2, X } from 'lucide-react';

interface MicPermissionModalProps {
  purposeLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const MicPermissionModal: React.FC<MicPermissionModalProps> = ({
  purposeLabel = 'المحادثة الصوتية الحية داخل الغرفة',
  onConfirm,
  onCancel,
}) => {
  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 bg-black/55 dark:bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 text-right select-none"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-amber-400/60 dark:border-amber-500/40 rounded-3xl w-full max-w-sm overflow-hidden text-slate-900 dark:text-white shadow-2xl flex flex-col transition-colors duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-950/70 dark:via-slate-900 dark:to-amber-950/70 px-4 py-3 border-b border-amber-200 dark:border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center">
              <Mic size={17} className="text-amber-600 dark:text-amber-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-800 dark:text-amber-300">
                تنويه إذن الميكروفون
              </h3>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                {purposeLabel}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="إغلاق"
          >
            <X size={17} />
          </button>
        </div>

        {/* Disclosure Body */}
        <div className="p-4 space-y-3 text-xs leading-relaxed">
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-100 font-bold leading-relaxed">
            يُستخدم إذن الميكروفون حصرياً للمحادثات الصوتية الحية داخل الغرف ولا يتم تسجيل أو تخزين أي صوت.
          </div>

          <div className="space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
              <Volume2 size={14} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                يتم تشغيل الميكروفون فقط أثناء وجودك على المايك المباشر أو عند اختيارك تسجيل مقطع صوتي لإرساله يدوياً.
              </span>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
              <Lock size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                لا نقوم بتسجيل محادثاتك الصوتية الحية أو حفظها في الخلفية أو مشاركتها مع أي طرف ثالث.
              </span>
            </div>

            <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5">
              <ShieldCheck size={14} className="text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
              <span>
                يمكنك إيقاف الميكروفون أو النزول من المايك في أي لحظة بضغطة واحدة.
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Mic size={15} />
            <span>موافق ومتابعة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
