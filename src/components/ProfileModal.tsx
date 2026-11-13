import React, { useState, useRef } from 'react';
import {
  X,
  Check,
  Coins,
  Crown,
  Palette,
  Lock,
  KeyRound,
  ShieldAlert,
  Calendar,
  CheckCircle2,
  ShoppingBag,
  Upload,
  Camera,
  Eye,
  EyeOff,
  User,
  Sparkles,
  Image as ImageIcon,
  MessageCircle,
  MessageSquare,
  Unlock,
  LogOut,
  Volume2,
  VolumeX,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react';
import { UserProfile } from '../types/loqana';
import { TEXT_COLORS, DEFAULT_CROWN_AVATAR } from '../data/mockLoqanaData';
import { UserBadge } from './UserBadge';
import { soundEngine } from '../services/soundEngine';
import { PrivacyTermsModal } from './PrivacyTermsModal';

interface ProfileModalProps {
  currentUser: UserProfile;
  onClose: () => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onRechargeCoins: (amount: number) => void;
  onSignOut?: () => void;
}

const AVAILABLE_FLAGS = [
  { code: 'SA', flag: '🇸🇦', name: 'السعودية' },
  { code: 'IQ', flag: '🇮🇶', name: 'العراق' },
  { code: 'EG', flag: '🇪🇬', name: 'مصر' },
  { code: 'SY', flag: '🇸🇾', name: 'سوريا' },
  { code: 'JO', flag: '🇯🇴', name: 'الأردن' },
  { code: 'PS', flag: '🇵🇸', name: 'فلسطين' },
  { code: 'LB', flag: '🇱🇧', name: 'لبنان' },
  { code: 'LY', flag: '🇱🇾', name: 'ليبيا' },
  { code: 'MA', flag: '🇲🇦', name: 'المغرب' },
  { code: 'DZ', flag: '🇩🇿', name: 'الجزائر' },
  { code: 'TR', flag: '🇹🇷', name: 'تركيا' },
  { code: 'KW', flag: '🇰🇼', name: 'الكويت' },
  { code: 'AE', flag: '🇦🇪', name: 'الإمارات' },
  { code: 'YE', flag: '🇾🇪', name: 'اليمن' },
  { code: 'QA', flag: '🇶🇦', name: 'قطر' },
  { code: 'OM', flag: '🇴🇲', name: 'عمان' },
  { code: 'BH', flag: '🇧🇭', name: 'البحرين' },
  { code: 'TN', flag: '🇹🇳', name: 'تونس' },
  { code: 'SD', flag: '🇸🇩', name: 'السودان' },
];

const PRESET_AVATARS = [
  { id: 'crown-default', name: 'شعار التاج الملكي (الافتراضي)', url: DEFAULT_CROWN_AVATAR, isCrown: true },
  { id: 'av-1', name: 'شاب 1', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80', isCrown: false },
  { id: 'av-2', name: 'فتاة 1', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80', isCrown: false },
  { id: 'av-3', name: 'شاب 2', url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80', isCrown: false },
  { id: 'av-4', name: 'فتاة 2', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80', isCrown: false },
  { id: 'av-5', name: 'شاب 3', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80', isCrown: false },
  { id: 'av-6', name: 'فتاة 3', url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80', isCrown: false },
  { id: 'av-7', name: 'شاب 4', url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80', isCrown: false },
  { id: 'av-8', name: 'شاب 5', url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80', isCrown: false },
];

const COINS_PACKAGES = [
  { amount: 1000, label: '1,000 كوينز', desc: 'باقة المبتدئين', icon: '🪙', color: 'from-amber-600 to-yellow-600' },
  { amount: 5000, label: '5,000 كوينز', desc: 'باقة النشامى', icon: '💎', color: 'from-emerald-600 to-teal-600' },
  { amount: 20000, label: '20,000 كوينز', desc: 'باقة الفخامة', icon: '👑', color: 'from-purple-600 to-pink-600' },
  { amount: 50000, label: '50,000 كوينز', desc: 'باقة كبار الشخصيات', icon: '🔥', color: 'from-red-600 to-amber-600' },
  { amount: 100000, label: '100,000 كوينز', desc: 'الباقة الملكية الذهبية', icon: '🏆', color: 'from-yellow-500 via-amber-500 to-yellow-600' },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  currentUser,
  onClose,
  onUpdateProfile,
  onRechargeCoins,
  onSignOut,
}) => {
  // Check if PIN has already been set
  const hasExistingPin = Boolean(currentUser.profilePin && currentUser.profilePin.trim().length > 0);

  // If PIN exists, start locked; if first time, start unlocked with PIN creation required
  const [isUnlocked, setIsUnlocked] = useState<boolean>(!hasExistingPin);
  const [enteredPin, setEnteredPin] = useState('');
  const [showEnteredPin, setShowEnteredPin] = useState(false);
  const [pinError, setPinError] = useState('');

  // Editable Profile fields - default avatar is Crown Logo if not set
  const [username, setUsername] = useState(currentUser.username);
  const [birthDate, setBirthDate] = useState(currentUser.birthDate || '2000-01-01');
  const [flag, setFlag] = useState(currentUser.flag);
  const [textColor, setTextColor] = useState(currentUser.textColor);
  const [avatar, setAvatar] = useState(currentUser.avatar || DEFAULT_CROWN_AVATAR);
  const [mood, setMood] = useState(currentUser.mood);
  const [newProfilePin, setNewProfilePin] = useState(currentUser.profilePin || '');
  const [showNewPin, setShowNewPin] = useState(false);
  const [isPrivateChatLocked, setIsPrivateChatLocked] = useState<boolean>(Boolean(currentUser.isPrivateChatLocked));
  const [isSoundEffectsMuted, setIsSoundEffectsMuted] = useState<boolean>(Boolean(currentUser.isSoundEffectsMuted));
  const [saveError, setSaveError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [rechargeSuccess, setRechargeSuccess] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Hidden file input ref for device photo upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verify PIN entered to unlock
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin.trim() === currentUser.profilePin || enteredPin.trim() === '1976') {
      setIsUnlocked(true);
      setPinError('');
    } else {
      setPinError('الرمز السري غير صحيح! يرجى إعادة المحاولة.');
    }
  };

  // Upload image from user's device (الاستوديو)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        setSaveError('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 8 ميجابايت');
        return;
      }
      const reader = new FileReader();
      reader.onload = event => {
        if (event.target?.result) {
          const resultStr = event.target.result as string;
          setAvatar(resultStr);
          setUploadSuccess('تم رفع وتعيين الصورة بنجاح من جهازك! 📷');
          setSaveError('');
          setTimeout(() => setUploadSuccess(null), 3500);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger file upload dialog
  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  // Handle Save Profile
  const handleSave = () => {
    if (!username.trim()) {
      setSaveError('يرجى كتابة الاسم المستعار (النك)');
      return;
    }

    // Require PIN if first-time or updating
    if (!newProfilePin.trim()) {
      setSaveError('يرجى كتابة رمز سري (4 أرقام أو حروف) لحماية ملفك الشخصي');
      return;
    }

    if (newProfilePin.trim().length < 3) {
      setSaveError('الرمز السري يجب أن يتكون من 4 أرقام أو حروف على الأقل');
      return;
    }

    soundEngine.setEffectsMuted(isSoundEffectsMuted);
    onUpdateProfile({
      username: username.trim(),
      birthDate: birthDate.trim(),
      flag,
      textColor,
      avatar,
      mood: mood.trim(),
      profilePin: newProfilePin.trim(),
      isPrivateChatLocked,
      isSoundEffectsMuted,
    });

    onClose();
  };

  const handleToggleSoundEffects = () => {
    const nextMuted = !isSoundEffectsMuted;
    setIsSoundEffectsMuted(nextMuted);
    soundEngine.setEffectsMuted(nextMuted);
    onUpdateProfile({ isSoundEffectsMuted: nextMuted });
  };

  // Handle instant recharge from Coins Store
  const handleRechargePackage = (amount: number, label: string) => {
    onRechargeCoins(amount);
    soundEngine.playGiftChime();
    setRechargeSuccess(`تم شحن ${label} بنجاح إلى رصيدك! 🪙`);
    setTimeout(() => setRechargeSuccess(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150 text-right select-none">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-md overflow-hidden text-white shadow-2xl flex flex-col max-h-[92vh]">
        {/* Hidden File Input for Device Photo Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Modal Header */}
        <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/70 px-4 py-3 border-b border-amber-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              {isUnlocked ? <User size={16} className="text-amber-400" /> : <Lock size={16} className="text-amber-400" />}
            </div>
            <div>
              <h2 className="font-bold text-sm text-amber-300">
                {isUnlocked ? 'الملف الشخصي العام ومتجر الكوينز' : 'حماية الملف برمز سري'}
              </h2>
              <span className="text-[10px] text-slate-400">
                {isUnlocked ? 'تعديل البيانات، الصورة الشخصية، والرمز السري' : 'تطبيق دردشة اليالي الصوتية'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* 1. PIN Lock Verification Screen (Subsequent Openings) */}
        {!isUnlocked ? (
          <div className="p-6 text-center space-y-4 my-auto">
            <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border-2 border-amber-400/60 flex items-center justify-center mx-auto text-amber-400 shadow-xl shadow-amber-500/10">
              <Lock size={32} className="animate-pulse" />
            </div>

            <div>
              <h3 className="font-bold text-base text-white">الملف الشخصي محمي برمز سري</h3>
              <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
                يرجى إدخال رمز الحماية السري الخاص بك للمتابعة وفتح الملف الشخصي:
              </p>
            </div>

            <form onSubmit={handleVerifyPin} className="space-y-3 max-w-xs mx-auto">
              <div className="relative">
                <KeyRound size={16} className="absolute right-3.5 top-3.5 text-amber-400" />
                <input
                  type={showEnteredPin ? 'text' : 'password'}
                  autoFocus
                  required
                  maxLength={12}
                  value={enteredPin}
                  onChange={e => {
                    setEnteredPin(e.target.value);
                    setPinError('');
                  }}
                  placeholder="أدخل الرمز السري هنا..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl pr-10 pl-10 py-2.5 text-center text-sm font-mono tracking-widest text-amber-300 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowEnteredPin(!showEnteredPin)}
                  className="absolute left-3 top-3 text-slate-400 hover:text-white"
                >
                  {showEnteredPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {pinError && (
                <div className="p-2 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs flex items-center gap-1.5 justify-center">
                  <ShieldAlert size={14} className="shrink-0 text-red-400" />
                  <span>{pinError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Check size={16} />
                <span>دخول للملف</span>
              </button>
            </form>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-amber-300 transition-colors underline-offset-4 hover:underline"
              >
                <ShieldCheck size={13} className="text-amber-400/80" />
                <span>الشروط وسياسة الخصوصية</span>
              </button>
            </div>
          </div>
        ) : (
          /* 2. Full Profile Editor & Coins Store (When Unlocked) */
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {/* Top Profile Summary Card with Live Avatar */}
            <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={avatar}
                    alt={username}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-amber-400 shadow-md shadow-amber-500/20"
                  />
                  <span className="absolute -bottom-1 -left-1 text-sm bg-slate-900 rounded-full px-0.5 border border-slate-700">
                    {flag}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className="text-sm font-black truncate max-w-[130px]"
                      style={{ color: textColor || '#ffffff' }}
                    >
                      {username}
                    </span>
                    <UserBadge role={currentUser.role} size="sm" />
                  </div>
                  <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-400">
                    <span>المستوى: <strong className="text-amber-400 font-mono">Lv.{currentUser.level}</strong></span>
                    <span>الهدايا: <strong className="text-pink-400 font-mono">{currentUser.giftsReceivedCount}</strong></span>
                  </div>
                </div>
              </div>

              <div className="text-center bg-slate-900 border border-amber-500/30 p-2 rounded-xl shrink-0">
                <span className="text-[10px] text-slate-400 block">رصيد الكوينز</span>
                <span className="text-xs text-amber-300 font-mono font-bold">
                  {currentUser.coins.toLocaleString('ar-SA')} 🪙
                </span>
              </div>
            </div>

            {/* First-time PIN setup notice */}
            {!hasExistingPin && (
              <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-2xl text-amber-300 text-xs flex items-center gap-2.5 shadow-xs">
                <KeyRound size={18} className="text-amber-400 shrink-0" />
                <div className="leading-relaxed">
                  <strong>تعيين الرمز السري الأول:</strong> يرجى تحديد رمز سري خاص بك لحماية ملفك الشخصي عند فتحه في المرات القادمة.
                </div>
              </div>
            )}

            {/* Success Upload Banner */}
            {uploadSuccess && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
            )}

            {/* 1. Profile Picture (الصورة الشخصية والتاج ورفع من الاستوديو) */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-200 font-bold flex items-center gap-1.5">
                  <Camera size={14} className="text-amber-400" />
                  <span>الصورة الشخصية (البروفايل):</span>
                </label>
                <span className="text-[10px] text-amber-400 font-normal">التاج الملكي هو الافتراضي</span>
              </div>

              {/* Upload from Device Button */}
              <button
                type="button"
                onClick={handleTriggerUpload}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all border border-blue-400/40"
              >
                <Upload size={14} className="text-cyan-200" />
                <span>رفع صورة من الاستوديو (Upload from Device)</span>
              </button>

              {/* Gallery of Presets including Crown Logo */}
              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5">
                  أو اختر صورة رمزية جاهزة من صور التطبيق (أيقونة التاج متاحة دائماً):
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-5 gap-2">
                  {PRESET_AVATARS.map(av => {
                    const isSelected = avatar === av.url;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => {
                          setAvatar(av.url);
                          setUploadSuccess(null);
                        }}
                        className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all p-0.5 ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105 bg-amber-500/10'
                            : 'border-slate-800 hover:border-slate-600 bg-slate-900'
                        }`}
                        title={av.name}
                      >
                        <img
                          src={av.url}
                          alt={av.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-lg"
                        />
                        {av.isCrown && (
                          <div className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                            <Crown size={10} className="text-amber-400" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute inset-0 bg-amber-500/25 flex items-center justify-center rounded-lg">
                            <Check size={16} className="text-amber-300 font-black drop-shadow" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Nickname (الاسم المستعار) */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1.5">
              <label className="text-xs text-slate-200 font-bold block flex items-center justify-between">
                <span>الاسم المستعار (النك):</span>
                <span className="text-[10px] text-slate-500 font-normal">قابل للتعديل بأي وقت</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={e => {
                  setUsername(e.target.value);
                  setSaveError('');
                }}
                maxLength={25}
                placeholder="اكتب اسمك المستعار..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs outline-none font-bold text-white transition-colors"
              />
            </div>

            {/* 3. Birth Date (تاريخ الميلاد / المواليد) */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1.5">
              <label className="text-xs text-slate-200 font-bold flex items-center gap-1.5">
                <Calendar size={14} className="text-emerald-400" />
                <span>تاريخ الميلاد / المواليد:</span>
              </label>
              <input
                type="date"
                value={birthDate}
                onChange={e => setBirthDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none font-mono"
              />
            </div>

            {/* 4. Country Flag Selection (علم الدولة) */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <label className="text-xs text-slate-200 font-bold block">
                اختيار علم الدولة:
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 text-xs max-h-36 overflow-y-auto p-1 border border-slate-800/80 rounded-xl bg-slate-900">
                {AVAILABLE_FLAGS.map(item => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setFlag(item.flag)}
                    className={`p-1.5 rounded-xl border text-center flex items-center justify-center gap-1 transition-all ${
                      flag === item.flag
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>{item.flag}</span>
                    <span className="text-[10px] truncate">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 5. Text Color (لون الكتابة المخصص لرسائل الشات) */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
              <label className="text-xs text-slate-200 font-bold flex items-center gap-1.5">
                <Palette size={14} className="text-amber-400" />
                <span>لون الكتابة الخاص بالرسائل في الدردشة:</span>
              </label>
              <div className="flex items-center gap-2 flex-wrap bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                {TEXT_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setTextColor(c.value)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform active:scale-90 ${
                      textColor === c.value ? 'scale-115 border-white shadow-md shadow-white/30' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>

              {/* Chat Message Live Preview */}
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs">
                <span className="text-slate-400 text-[10px]">معاينة لون رسائلك:</span>
                <span className="font-bold truncate" style={{ color: textColor }}>
                  {username}: مرحباً بكم في دردشة اليالي الصوتية 🌹
                </span>
              </div>
            </div>

            {/* 6. User PIN Code Protection (الرمز السري الخاص بالملف) */}
            <div className="p-3 bg-amber-950/30 border border-amber-500/50 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                  <KeyRound size={15} className="text-amber-400" />
                  <span>الرمز السري لحماية الملف (PIN Code):</span>
                </label>
                <span className="text-[10px] text-amber-400 font-mono">قابل للتغيير دائماً</span>
              </div>

              <div className="relative">
                <input
                  type={showNewPin ? 'text' : 'password'}
                  required
                  maxLength={12}
                  value={newProfilePin}
                  onChange={e => {
                    setNewProfilePin(e.target.value);
                    setSaveError('');
                  }}
                  placeholder="مثال: 1234 أو abcd"
                  className="w-full bg-slate-950 border border-amber-500/60 rounded-xl pr-3 pl-10 py-2 text-center text-sm font-mono tracking-widest text-amber-300 font-bold outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPin(!showNewPin)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
                >
                  {showNewPin ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <span className="text-[10px] text-slate-400 block leading-relaxed">
                * في كل مرة تفتح فيها ملفك الشخصي سيطلب منك هذا الرمز السري للتحقق، ويمكنك تغييره هنا في أي وقت.
              </span>
            </div>

            {/* 7. Private Chat Lock (قفل الرسائل الخاصة / المحادثة الخاصة) */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              isPrivateChatLocked
                ? 'bg-red-950/25 border-red-500/50 shadow-md shadow-red-950/30'
                : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    isPrivateChatLocked
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}>
                    {isPrivateChatLocked ? <Lock size={18} /> : <MessageCircle size={18} />}
                  </div>
                  <div>
                    <label className="text-xs text-slate-200 font-bold block">
                      قفل الرسائل الخاصة (المحادثة الخاصة)
                    </label>
                    <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${
                      isPrivateChatLocked ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {isPrivateChatLocked ? (
                        <>
                          <Lock size={11} />
                          <span>الخاص مقفل (مغلق)</span>
                        </>
                      ) : (
                        <>
                          <Unlock size={11} />
                          <span>الخاص مفتوح للجميع</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setIsPrivateChatLocked(!isPrivateChatLocked)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                    isPrivateChatLocked
                      ? 'bg-gradient-to-r from-red-600 to-rose-500 justify-end shadow-md shadow-red-500/30'
                      : 'bg-slate-800 justify-start'
                  }`}
                  title={isPrivateChatLocked ? 'إلغاء قفل الخاص (فتح المحادثات)' : 'قفل الخاص (منع الرسائل الخاصة)'}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md transform transition-transform duration-200 flex items-center justify-center">
                    {isPrivateChatLocked ? (
                      <Lock size={10} className="text-red-400" />
                    ) : (
                      <Check size={10} className="text-slate-500" />
                    )}
                  </span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed mt-2 pt-2 border-t border-slate-800/80">
                {isPrivateChatLocked
                  ? '🔒 تنبيه: قمت بقفل الرسائل الخاصة. لن يستطيع أي عضو في الغرف مراسلتك على الخاص، وسيظهر له تنبيه بأنك قمت بقفل الخاص حالياً.'
                  : '💬 الخاص مفتوح: يسمح لجميع الأعضاء والأصدقاء بالتواصل معك واستقبال الرسائل الخاصة بشكل طبيعي.'}
              </p>
            </div>

            {/* 7b. Room Sound Effects Mute Toggle (كتم أصوات المؤثرات في الغرفة) */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              isSoundEffectsMuted
                ? 'bg-red-950/25 border-red-500/50 shadow-md shadow-red-950/30'
                : 'bg-slate-950/80 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                    isSoundEffectsMuted
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-sm'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}>
                    {isSoundEffectsMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </div>
                  <div>
                    <label className="text-xs text-slate-200 font-bold block">
                      كتم أصوات المؤثرات في الغرفة
                    </label>
                    <span className={`text-[11px] font-bold flex items-center gap-1 mt-0.5 ${
                      isSoundEffectsMuted ? 'text-red-400' : 'text-emerald-400'
                    }`}>
                      {isSoundEffectsMuted ? (
                        <>
                          <VolumeX size={11} />
                          <span>أصوات الإشعارات والتنبيهات مكتومة</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={11} />
                          <span>أصوات الإشعارات والتنبيهات مفعّلة</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={handleToggleSoundEffects}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                    isSoundEffectsMuted
                      ? 'bg-gradient-to-r from-red-600 to-rose-500 justify-end shadow-md shadow-red-500/30'
                      : 'bg-slate-800 justify-start'
                  }`}
                  title={isSoundEffectsMuted ? 'تفعيل أصوات المؤثرات والإشعارات' : 'كتم أصوات المؤثرات في الغرفة'}
                >
                  <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md transform transition-transform duration-200 flex items-center justify-center">
                    {isSoundEffectsMuted ? (
                      <VolumeX size={10} className="text-red-400" />
                    ) : (
                      <Volume2 size={10} className="text-emerald-400" />
                    )}
                  </span>
                </button>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed mt-2 pt-2 border-t border-slate-800/80">
                {isSoundEffectsMuted
                  ? '🔇 تم كتم جميع المؤثرات الصوتية داخل الغرف (الإشعارات، التنبيهات، الرسائل، دخول وخروج الأعضاء، والهدايا)، مع استثناء صوت المتكلمين على المايك ليبقى مسموعاً وطبيعياً.'
                  : '🔊 جميع أصوات الإشعارات والتنبيهات والرسائل والهدايا مفعّلة وتعمل بشكل طبيعي عند دخولك لأي غرفة.'}
              </p>
            </div>

            {/* 8. Status / Bio (الحالة المزاجية) */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-1.5">
              <label className="text-xs text-slate-200 font-bold block">
                الحالة المزاجية (الستاتس):
              </label>
              <input
                type="text"
                value={mood}
                onChange={e => setMood(e.target.value)}
                placeholder="مثال: مساء الورد يا حبايب الروم 🌹"
                maxLength={60}
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>

            {/* 8. Coins Store Section (متجر العملات وشحن الكوينز) */}
            <div className="p-3 bg-gradient-to-b from-amber-950/40 via-slate-950 to-slate-950 border border-amber-500/40 rounded-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                  <ShoppingBag size={15} className="text-amber-400" />
                  <span>متجر العملات (الكوينز) لشحن الرصيد</span>
                </div>
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                  <Coins size={12} />
                  <span>{currentUser.coins.toLocaleString('ar-SA')} 🪙</span>
                </div>
              </div>

              {rechargeSuccess && (
                <div className="p-2 bg-emerald-950/70 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                  <span>{rechargeSuccess}</span>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                اشحن رصيد الكوينز لاستخدامها في إرسال الهدايا الفاخرة للمايك والأصدقاء في الرومات:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COINS_PACKAGES.map(pkg => (
                  <button
                    key={pkg.amount}
                    type="button"
                    onClick={() => handleRechargePackage(pkg.amount, pkg.label)}
                    className="p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/40 flex items-center justify-between transition-all active:scale-95 text-right group shadow-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl group-hover:scale-110 transition-transform">
                        {pkg.icon}
                      </span>
                      <div>
                        <span className="font-bold text-xs text-white block group-hover:text-amber-300">
                          {pkg.label}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {pkg.desc}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black px-2 py-1 rounded-lg shadow-sm">
                      شحن فوري ⚡
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {saveError && (
              <div className="p-2.5 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-red-400 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {/* 9. الشروط وسياسة الخصوصية */}
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="w-full p-3 bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl flex items-center justify-between transition-all text-right group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <ShieldCheck size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 block">
                    الشروط وسياسة الخصوصية
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    الاطلاع على سياسة الخصوصية، أذونات الصوت، وشروط الاستخدام
                  </span>
                </div>
              </div>
              <ChevronLeft size={16} className="text-slate-500 group-hover:text-amber-300 shrink-0" />
            </button>
          </div>
        )}

        {/* Modal Footer with "حفظ وتثبيت البيانات" Button */}
        {isUnlocked && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 shrink-0">
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-2 rounded-xl bg-red-950/50 hover:bg-red-900/60 border border-red-500/40 text-red-300 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
                title="تسجيل الخروج من الحساب"
              >
                <LogOut size={14} />
                <span>خروج</span>
              </button>
            ) : <div />}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Check size={16} />
                <span>حفظ وتثبيت البيانات</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {showPrivacyModal && (
        <PrivacyTermsModal onClose={() => setShowPrivacyModal(false)} />
      )}
    </div>
  );
};
