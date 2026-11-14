import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  FileText,
  Mic,
  Lock,
  AlertTriangle,
  Mail,
} from 'lucide-react';

interface PrivacyTermsModalProps {
  onClose: () => void;
  initialTab?: 'privacy' | 'terms';
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(initialTab);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-black/55 dark:bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 text-right select-none"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-amber-400/50 dark:border-amber-500/30 rounded-3xl w-full max-w-md overflow-hidden text-slate-900 dark:text-white shadow-2xl flex flex-col max-h-[90vh] transition-colors duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-amber-950/70 dark:via-slate-900 dark:to-amber-950/70 px-4 py-3 border-b border-amber-200 dark:border-amber-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 border border-amber-300 dark:border-amber-500/40 flex items-center justify-center">
              <ShieldCheck size={17} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-amber-800 dark:text-amber-300">
                الشروط وسياسة الخصوصية
              </h2>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                تطبيق دردشة اليالي الصوتية
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-3 pb-2 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'privacy'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock size={13} />
            <span>سياسة الخصوصية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'terms'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileText size={13} />
            <span>شروط الاستخدام</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-3 text-xs leading-relaxed text-slate-700 dark:text-slate-300 select-text">
          {activeTab === 'privacy' ? (
            <>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  1. البيانات التي نستخدمها
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  يعمل تطبيق «دردشة اليالي الصوتية» بنظام الدخول المباشر باستخدام الاسم المستعار والرمز السري الاختياري دون إجبار المستخدم على ربط حساب بريد إلكتروني. يتم حفظ الاسم المستعار، الصورة الرمزية، رمز الدولة، الحالة، وتفضيلات الصوت محلياً وعلى قاعدة البيانات السحابية لعرض ملفك للمتواجدين معك داخل الغرف فقط.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-500/30 space-y-1.5">
                <h3 className="font-bold text-amber-800 dark:text-amber-300 text-xs flex items-center gap-1.5">
                  <Mic size={14} className="text-amber-600 dark:text-amber-400" />
                  <span>2. سياسة إذن الميكروفون والصوت الحي</span>
                </h3>
                <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
                  يُستخدم إذن الميكروفون حصرياً للمحادثات الصوتية الحية داخل الغرف عند صعودك على المايك بإرادتك. لا يقوم التطبيق بأي تسجيل خفي أو تخزين أو حفظ للمحادثات الصوتية الحية على الخوادم بأي شكل من الأشكال، ولا يصل إلى الميكروفون إطلاقاً عندما لا تكون متحدثاً على المايك أو عند إغلاق التطبيق.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  3. الكاميرا والصور والملفات
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  يُطلب إذن الكاميرا أو اختيار الصور فقط عندما يبادر المستخدم بتغيير صورته الشخصية أو مشاركة صورة أو بدء بث مرئي مباشر داخل الغرفة، ويمكن سحب هذه الأذونات في أي وقت من إعدادات المتصفح أو الجهاز.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  4. حماية القُصّر وأمان المستخدمين
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  التطبيق مخصص للمستخدمين البالغين (18 عاماً فأكثر). لا نبيع بيانات المستخدمين ولا نشاركها مع جهات إعلانية خارجية. يتم إخفاء سجل الرسائل القديمة تلقائياً عند دخول أي غرفة بحيث تبدأ المحادثة من لحظة دخولك فقط.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs flex items-center gap-1.5">
                  <Mail size={13} className="text-amber-600 dark:text-amber-400" />
                  <span>5. حذف البيانات والتواصل معنا</span>
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  يمكنك تعديل بيانات ملفك الشخصي في أي وقت أو طلب حذف بياناتك أو الإبلاغ عن أي مخالفة عبر التواصل مع إدارة التطبيق على البريد الإلكتروني:{' '}
                  <span className="font-mono text-amber-700 dark:text-amber-300">abolaith03675@gmail.com</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  1. الموافقة على الشروط
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  باستخدامك لتطبيق «دردشة اليالي الصوتية» ودخولك إلى أي غرفة صوتية أو كتابية، فإنك توافق على الالتزام بجميع شروط الاستخدام ومعايير السلوك الآمن للمجتمع.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/25 border border-red-200 dark:border-red-500/30 space-y-1.5">
                <h3 className="font-bold text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
                  <span>2. المحتوى الممنوع وسياسة عدم التسامح</span>
                </h3>
                <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
                  يُمنع منعاً باتاً نشر أو بث أي محتوى يتضمن إساءة أو قذفاً أو تحرشاً أو خطاب كراهية أو محتوى إباحياً أو عنفاً أو انتحالاً لشخصيات الآخرين أو إرسال روابط احتيالية وإعلانات مزعجة. تحتفظ إدارة الغرف ومالك التطبيق بالحق الكامل في كتم أو طرد أو حظر المخالفين نهائياً.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  3. نظام الإبلاغ والحظر الفوري
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  يتيح التطبيق لجميع المستخدمين زر «إبلاغ / حظر» داخل قائمة خيارات أي مستخدم؛ حيث يمكنك حظر المستخدم المسيء فوراً لإخفاء كافة رسائله ومنعه من مراسلتك، كما يتم رفع البلاغ مباشرة إلى الإدارة لاتخاذ الإجراء اللازم.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  4. الكوينز والهدايا الافتراضية
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  العملات والهدايا داخل التطبيق افتراضية وتُستخدم حصرياً للترفيه والتفاعل داخل الغرف، ولا تمثل رصيداً مالياً حقيقياً ولا تقبل الاستبدال النقدي.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <h3 className="font-bold text-amber-700 dark:text-amber-300 text-xs">
                  5. التحديثات وإنهاء الخدمة
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  قد نقوم بتحديث هذه الشروط أو سياسة الخصوصية عند الحاجة لتحسين الأمان وتجربة الاستخدام، ويُعد استمرارك في استخدام التطبيق موافقةً على النسخة المحدّثة.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all"
          >
            فهمت وأوافق
          </button>
        </div>
      </div>
    </div>
  );
};
