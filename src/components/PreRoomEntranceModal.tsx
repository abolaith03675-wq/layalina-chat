import React, { useState, useEffect, useRef } from 'react';
import {
  LogIn,
  KeyRound,
  User,
  Lock,
  ShieldAlert,
  CheckCircle2,
  Bookmark,
  ChevronDown,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';
import { Room, UserRole, UserProfile } from '../types/loqana';
import { UserBadge } from './UserBadge';
import { PrivacyTermsModal } from './PrivacyTermsModal';
import { verifyRoomEntranceRole } from '../services/firebaseService';

const SAVED_ENTRANCE_ACCOUNTS_KEY = 'layali_saved_entrance_accounts_v1';

interface SavedEntranceAccount {
  id: string;
  username: string;
  password: string;
  pinCode: string;
  roomPassword?: string;
  updatedAt: number;
}

function loadSavedAccounts(): SavedEntranceAccount[] {
  try {
    const raw = window.localStorage.getItem(SAVED_ENTRANCE_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) &&
          typeof item.id === 'string' &&
          typeof item.username === 'string' &&
          item.username.trim().length > 0
      )
      .map(item => {
        const storedPin =
          typeof item.pinCode === 'string' && item.pinCode.length > 0
            ? item.pinCode
            : typeof item.password === 'string'
            ? item.password
            : '';
        return {
          id: String(item.id),
          username: String(item.username),
          password: storedPin,
          pinCode: storedPin,
          roomPassword: typeof item.roomPassword === 'string' ? item.roomPassword : '',
          updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        };
      })
      .slice(0, 25);
  } catch {
    return [];
  }
}

function persistSavedAccounts(accounts: SavedEntranceAccount[]): void {
  try {
    window.localStorage.setItem(SAVED_ENTRANCE_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    // Ignore storage quota / privacy mode errors cleanly
  }
}

interface PreRoomEntranceModalProps {
  room: Room;
  currentUser: UserProfile;
  onClose: () => void;
  onConfirmEntrance: (entranceData: {
    username: string;
    role: UserRole;
    pinCode?: string;
  }) => void;
}

export const PreRoomEntranceModal: React.FC<PreRoomEntranceModalProps> = ({
  room,
  currentUser,
  onClose,
  onConfirmEntrance,
}) => {
  const [savedAccounts, setSavedAccounts] = useState<SavedEntranceAccount[]>(() => loadSavedAccounts());
  const [username, setUsername] = useState(currentUser.username);
  const [pinCode, setPinCode] = useState(() => {
    const initialName = currentUser.username.trim().toLowerCase();
    const match = loadSavedAccounts().find(
      acc => acc.username.trim().toLowerCase() === initialName
    );
    return match ? match.pinCode || match.password || '' : '';
  });
  const [roomPassword, setRoomPassword] = useState(() => {
    const initialName = currentUser.username.trim().toLowerCase();
    const match = loadSavedAccounts().find(
      acc => acc.username.trim().toLowerCase() === initialName
    );
    return match?.roomPassword || '';
  });
  const [showPinText, setShowPinText] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSavedList, setShowSavedList] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const usernameFieldWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        usernameFieldWrapperRef.current &&
        !usernameFieldWrapperRef.current.contains(event.target as Node)
      ) {
        setShowSavedList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSaveCurrentAccount = () => {
    const cleanName = username.trim();
    if (!cleanName) {
      setErrorMessage('أدخل اسم الدخول أولاً لحفظه');
      return;
    }

    const latestAccounts = loadSavedAccounts();
    const cleanPin = pinCode.trim();
    const cleanRoomPass = roomPassword.trim();
    const existingIndex = latestAccounts.findIndex(
      acc => acc.username.trim().toLowerCase() === cleanName.toLowerCase()
    );

    const entry: SavedEntranceAccount = {
      id:
        existingIndex >= 0
          ? latestAccounts[existingIndex].id
          : `acc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: cleanName,
      password: cleanPin,
      pinCode: cleanPin,
      roomPassword: cleanRoomPass || undefined,
      updatedAt: Date.now(),
    };

    const nextAccounts = [
      entry,
      ...latestAccounts.filter((_, idx) => idx !== existingIndex),
    ].slice(0, 25);

    setSavedAccounts(nextAccounts);
    persistSavedAccounts(nextAccounts);
    setErrorMessage('');
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1800);
  };

  const handleSelectSavedAccount = (account: SavedEntranceAccount) => {
    const restoredPin = account.pinCode || account.password || '';
    setUsername(account.username);
    setPinCode(restoredPin);
    setRoomPassword(account.roomPassword || '');
    setErrorMessage('');
    setShowSavedList(false);
  };

  const handleDeleteSavedAccount = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const nextAccounts = loadSavedAccounts().filter(acc => acc.id !== id);
    setSavedAccounts(nextAccounts);
    persistSavedAccounts(nextAccounts);
    if (nextAccounts.length === 0) {
      setShowSavedList(false);
    }
  };

  // Determine potential role based on entered PIN and username (Master requires BOTH exact name & PIN)
  const detected = verifyRoomEntranceRole(room, username, pinCode);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMessage('يرجى إدخال اسم الدخول');
      return;
    }

    // Verify room lock password if the room is locked
    if (room.isLocked && room.password) {
      // Only an exact Master Name + PIN match bypasses room password
      if (!detected.isMasterMatch && roomPassword.trim() !== room.password) {
        setErrorMessage('كلمة سر الروم غير صحيحة!');
        return;
      }
    }

    onConfirmEntrance({
      username: username.trim(),
      role: detected.role,
      pinCode: pinCode.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/55 dark:bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-amber-400/60 dark:border-amber-500/40 rounded-3xl w-full max-w-sm p-4 text-slate-900 dark:text-white shadow-2xl text-right transition-colors duration-300">
        {/* Header with Room Info */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{room.flag}</span>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-[180px]">
                {room.name}
              </h3>
              <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                #{room.code} • الماستر:{' '}
                <strong className="text-red-600 dark:text-red-500">{room.ownerName}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        {/* Entrance Form */}
        <form onSubmit={handleSubmit} autoComplete="off" className="space-y-3.5 text-xs">
          {/* 1. First Field: Username + Saved Accounts Selector & Save Icon */}
          <div ref={usernameFieldWrapperRef} className="relative">
            <label className="block mb-1 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
              <span>اسم المستخدم (اسم الدخول):</span>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-normal flex items-center gap-1.5">
                {savedFeedback && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ تم حفظ الاسم والرمز</span>
                )}
                <span>مطلوب</span>
              </span>
            </label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 flex items-center">
                <User size={15} className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  name="room_entrance_nickname"
                  autoComplete="off"
                  required
                  value={username}
                  onFocus={() => {
                    if (savedAccounts.length > 0) setShowSavedList(true);
                  }}
                  onClick={() => {
                    if (savedAccounts.length > 0) setShowSavedList(true);
                  }}
                  onChange={e => {
                    setUsername(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="اكتب اسمك المستعار للدخول..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl pr-9 pl-8 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none font-bold"
                />
                {savedAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowSavedList(prev => !prev)}
                    className="absolute left-2 p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                    title="الأسماء والحسابات المحفوظة"
                  >
                    <ChevronDown
                      size={14}
                      className={`transition-transform duration-150 ${showSavedList ? 'rotate-180 text-amber-600 dark:text-amber-400' : ''}`}
                    />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleSaveCurrentAccount}
                className={`p-2 rounded-xl border transition-all active:scale-95 shrink-0 flex items-center justify-center ${
                  savedFeedback
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400/70 text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="حفظ الاسم والرمز السري معاً على هذا الجهاز"
              >
                <Bookmark size={15} className={savedFeedback ? 'fill-emerald-400/40' : ''} />
              </button>
            </div>

            {showSavedList && savedAccounts.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white dark:bg-slate-950 border border-amber-400/60 dark:border-amber-500/40 rounded-xl shadow-2xl max-h-40 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800/80">
                <div className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-900/90 text-[10px] text-amber-700 dark:text-amber-300 font-bold flex items-center justify-between sticky top-0">
                  <span>الحسابات والأسماء المحفوظة ({savedAccounts.length})</span>
                  <button
                    type="button"
                    onClick={() => setShowSavedList(false)}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                {savedAccounts.map(acc => (
                  <div
                    key={acc.id}
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => handleSelectSavedAccount(acc)}
                    className="flex items-center justify-between px-2.5 py-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer transition-colors gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {acc.username}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                        {acc.pinCode
                          ? `🔑 محفوظ مع الرمز السري (${'•'.repeat(Math.min(6, acc.pinCode.length))})`
                          : '👤 اسم فقط بدون رمز'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => handleDeleteSavedAccount(e, acc.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors shrink-0"
                      title="حذف من المحفوظات"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Second Field: Secret PIN Code for Ranks & Authentication */}
          <div>
            <label className="block mb-1 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-between">
              <span>الرمز السري (مخصص لأصحاب الرتب والمصادقة):</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">اختياري للزوار</span>
            </label>
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1 flex items-center">
                <KeyRound size={15} className="absolute right-3 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type={showPinText ? 'text' : 'password'}
                  name="room_rank_pin_entry"
                  autoComplete="new-password"
                  data-lpignore="true"
                  data-1p-ignore="true"
                  maxLength={16}
                  value={pinCode}
                  onChange={e => {
                    setPinCode(e.target.value);
                    setErrorMessage('');
                  }}
                  placeholder="أدخل الرمز السري إذا كنت ماستر أو صاحب رتبة..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 rounded-xl pr-9 pl-8 py-2 text-xs text-amber-700 dark:text-amber-300 font-mono placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none tracking-wider"
                />
                <button
                  type="button"
                  onClick={() => setShowPinText(prev => !prev)}
                  className="absolute left-2 p-1 rounded-lg text-slate-400 dark:text-slate-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
                  title={showPinText ? 'إخفاء الرمز' : 'إظهار الرمز'}
                >
                  {showPinText ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleSaveCurrentAccount}
                className={`p-2 rounded-xl border transition-all active:scale-95 shrink-0 flex items-center justify-center ${
                  savedFeedback
                    ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/50 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400/70 text-amber-600 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="حفظ الاسم والرمز معاً"
              >
                <Bookmark size={15} className={savedFeedback ? 'fill-emerald-400/40' : ''} />
              </button>
            </div>
          </div>

          {/* Room Password Field if Locked */}
          {room.isLocked && (
            <div>
              <label className="block mb-1 text-red-700 dark:text-red-300 font-bold flex items-center justify-between">
                <span>الغرفة مقفلة بكلمة سر للزوار:</span>
                <Lock size={12} className="text-red-600 dark:text-red-400" />
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={roomPassword}
                onChange={e => {
                  setRoomPassword(e.target.value);
                  setErrorMessage('');
                }}
                placeholder="أدخل كلمة سر الغرفة..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-red-300 dark:border-red-500/50 focus:border-red-500 dark:focus:border-red-400 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>
          )}

          {/* Role Detection Live Indicator */}
          <div className="bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
            <span className="text-[11px] text-slate-600 dark:text-slate-400">الرتبة التي ستدخل بها:</span>
            <div className="flex items-center gap-1.5">
              <UserBadge role={detected.role} size="sm" />
              {detected.verified && pinCode && (
                <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
          </div>

          {detected.masterRejectedReason && (
            <div className="p-2 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/50 rounded-xl text-red-700 dark:text-red-300 text-[11px] flex items-center gap-1.5">
              <ShieldAlert size={14} className="shrink-0 text-red-600 dark:text-red-400" />
              <span>{detected.masterRejectedReason}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/50 rounded-xl text-red-700 dark:text-red-300 text-xs flex items-center gap-1.5">
              <ShieldAlert size={14} className="shrink-0 text-red-600 dark:text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <LogIn size={15} />
              <span>دخول الروم</span>
            </button>
          </div>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setShowPrivacyModal(true)}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors underline-offset-4 hover:underline"
            >
              <ShieldCheck size={12} className="text-amber-600 dark:text-amber-400/80" />
              <span>الشروط وسياسة الخصوصية</span>
            </button>
          </div>
        </form>
      </div>

      {showPrivacyModal && (
        <PrivacyTermsModal onClose={() => setShowPrivacyModal(false)} />
      )}
    </div>
  );
};
