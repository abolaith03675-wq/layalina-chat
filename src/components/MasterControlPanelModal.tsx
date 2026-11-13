import React, { useState } from 'react';
import {
  Crown,
  KeyRound,
  Shield,
  UserCheck,
  X,
  Trash2,
  Lock,
  Unlock,
  Radio,
  Sparkles,
  Smartphone,
  Check,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  Room,
  UserProfile,
  UserRole,
  ROLE_HIERARCHY,
  RoomCredential,
  BannedUserEntry,
  MicDurations,
} from '../types/loqana';
import { UserBadge } from './UserBadge';
import { normalizeMicDurations } from '../services/firebaseService';

interface MasterControlPanelModalProps {
  room: Room;
  roomUsers: UserProfile[];
  onClose: () => void;
  onAssignRankWithPin: (credential: RoomCredential) => void;
  onRemoveCredential: (username: string) => void;
  onUnbanUser: (ip: string) => void;
  onToggleMicLock: () => void;
  onClearRoomChat: () => void;
  onUpdateMicDurations: (micDurations: MicDurations) => Promise<void> | void;
}

export const MasterControlPanelModal: React.FC<MasterControlPanelModalProps> = ({
  room,
  roomUsers,
  onClose,
  onAssignRankWithPin,
  onRemoveCredential,
  onUnbanUser,
  onToggleMicLock,
  onClearRoomChat,
  onUpdateMicDurations,
}) => {
  const [activeTab, setActiveTab] = useState<'ranks' | 'registry' | 'bans' | 'settings'>('ranks');

  // Form for assigning rank & PIN
  const [targetUsername, setTargetUsername] = useState(roomUsers[0]?.username || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>('vip');
  const [userPinCode, setUserPinCode] = useState('2026');
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [clearNotice, setClearNotice] = useState('');

  // Per-role Mic Duration state (stored in seconds)
  const [micDurationsDraft, setMicDurationsDraft] = useState<MicDurations>(() =>
    normalizeMicDurations(room.micDurations)
  );
  const [durationUnit, setDurationUnit] = useState<'seconds' | 'minutes'>('seconds');
  const [micSavedNotice, setMicSavedNotice] = useState('');

  const formatSecondsPreview = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleRoleDurationChange = (role: UserRole, rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    const nextSeconds =
      durationUnit === 'minutes'
        ? Math.max(5, Math.min(7200, Math.round(parsed * 60)))
        : Math.max(5, Math.min(7200, Math.round(parsed)));
    setMicDurationsDraft(prev => ({
      ...prev,
      [role]: nextSeconds,
    }));
  };

  const handleSaveMicDurations = async () => {
    const normalized = normalizeMicDurations(micDurationsDraft);
    setMicDurationsDraft(normalized);
    await onUpdateMicDurations(normalized);
    setMicSavedNotice('تم حفظ مدد التحدث على المايك لكل رتبة بنجاح!');
    setTimeout(() => setMicSavedNotice(''), 3500);
  };

  // Handle when target user changes in select dropdown
  const handleSelectUser = (name: string) => {
    setTargetUsername(name);
    const existing = room.userCredentials?.find(
      c => c.username.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      setSelectedRole(existing.role);
      setUserPinCode(existing.pinCode);
      setDeviceIdInput(existing.deviceId || '');
    } else {
      setUserPinCode(String(Math.floor(1000 + Math.random() * 9000)));
      setDeviceIdInput('');
    }
  };

  const handleSaveCredential = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUsername.trim()) {
      setFormError('يرجى اختيار أو كتابة اسم المستخدم');
      return;
    }
    if (!userPinCode.trim()) {
      setFormError('يرجى تحديد رمز سري (PIN) لحماية الرتبة');
      return;
    }

    // Role Quota Enforcement (Set by App Owner)
    const isQuotedRole =
      selectedRole === 'vip' ||
      selectedRole === 'admin' ||
      selectedRole === 'super_admin' ||
      selectedRole === 'member';

    if (isQuotedRole && room.roleQuotas) {
      const quotaKey = selectedRole as keyof typeof room.roleQuotas;
      const maxAllowed = room.roleQuotas[quotaKey];
      if (typeof maxAllowed === 'number' && maxAllowed > 0) {
        // Count already assigned users for this role (excluding target if editing)
        const currentCount = (room.userCredentials || []).filter(
          c => c.role === selectedRole && c.username.toLowerCase() !== targetUsername.trim().toLowerCase()
        ).length;

        if (currentCount >= maxAllowed) {
          setFormError(
            `عذراً، تم استنفاذ الحد الأقصى المسموح به لكوتا رتبة «${ROLE_HIERARCHY[selectedRole].label}» في هذه الغرفة (${currentCount}/${maxAllowed}). هذه الكوتا محددة من قِبل مالك التطبيق.`
          );
          return;
        }
      }
    }

    onAssignRankWithPin({
      username: targetUsername.trim(),
      role: selectedRole,
      pinCode: userPinCode.trim(),
      deviceId: deviceIdInput.trim() || undefined,
      assignedAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    });

    setFormError('');
    setSuccessMessage(`تم بنجاح تعيين رتبة «${ROLE_HIERARCHY[selectedRole].label}» للمستخدم (${targetUsername}) برمز سري محمي!`);
    setTimeout(() => setSuccessMessage(''), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-red-500/50 rounded-3xl w-full max-w-md overflow-hidden text-white shadow-2xl flex flex-col max-h-[90vh] text-right">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 px-4 py-3 border-b border-red-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={20} className="text-red-500 animate-pulse" />
            <div>
              <h2 className="font-bold text-sm text-white">لوحة تحكم ماستر الروم</h2>
              <span className="text-[10px] text-red-400 font-mono">
                صلاحيات المالك الكاملة • {room.name}
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

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-2 bg-slate-950 border-b border-slate-800 text-xs overflow-x-auto scrollbar-none">
          {[
            { id: 'ranks', label: 'تعيين الرتب والرمز' },
            { id: 'registry', label: `المحميون (${room.userCredentials?.length || 0})` },
            { id: 'bans', label: `المحظورون (${room.bannedUsers?.length || 0})` },
            { id: 'settings', label: 'أدوات الروم' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3 py-1.5 rounded-xl border shrink-0 transition-all font-medium ${
                activeTab === tab.id
                  ? 'bg-red-500/25 border-red-500 text-red-300 font-bold shadow-xs'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Assign Rank & Secret PIN */}
        {activeTab === 'ranks' && (
          <form onSubmit={handleSaveCredential} className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {successMessage && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/60 rounded-xl text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                <Check size={16} className="text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {formError && (
              <div className="p-2.5 bg-red-950/60 border border-red-500/60 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Target User */}
            <div>
              <label className="block mb-1 text-slate-300 font-bold">
                اختر أو اكتب اسم المستخدم:
              </label>
              <div className="space-y-1.5">
                <select
                  value={targetUsername}
                  onChange={e => handleSelectUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-white outline-none"
                >
                  {roomUsers.map(u => (
                    <option key={u.id} value={u.username}>
                      {u.flag} {u.username} ({ROLE_HIERARCHY[u.role].label})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={targetUsername}
                  onChange={e => setTargetUsername(e.target.value)}
                  placeholder="أو اكتب اسماً جديداً..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-amber-300 outline-none"
                />
              </div>
            </div>

            {/* Role Selection with Exact Specified Colors */}
            <div>
              <label className="block mb-1 text-slate-300 font-bold">
                تحديد الرتبة واللون الإداري:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { role: 'vip' as UserRole, label: 'مميز V.I.P', desc: 'لون وردي (Pink) • صلاحيات كاملة', color: '#ec4899' },
                  { role: 'admin' as UserRole, label: 'مشرف', desc: 'لون أصفر (Yellow) • صلاحيات كاملة', color: '#eab308' },
                  { role: 'super_admin' as UserRole, label: 'سوبر أدمن', desc: 'لون أخضر (Green) • صلاحيات متوسطة', color: '#22c55e' },
                  { role: 'member' as UserRole, label: 'عضو', desc: 'لون أزرق (Blue) • صلاحيات أساسية', color: '#3b82f6' },
                  { role: 'guest' as UserRole, label: 'زائر', desc: 'لون افتراضي • بدون صلاحيات', color: '#94a3b8' },
                  { role: 'owner' as UserRole, label: 'ماستر مشارك', desc: 'لون أحمر (Red) • تحكم كامل', color: '#ef4444' },
                ].map(r => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setSelectedRole(r.role)}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      selectedRole === r.role
                        ? 'ring-2 ring-amber-400 bg-slate-800 border-white shadow-md'
                        : 'bg-slate-950 border-slate-800 hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs" style={{ color: r.color }}>
                        {r.label}
                      </span>
                      <UserBadge role={r.role} size="sm" showLabel={false} />
                    </div>
                    <span className="text-[10px] text-slate-400">{r.desc}</span>
                    {/* Quota Limit Badge set by App Owner */}
                    {room.roleQuotas && room.roleQuotas[r.role as keyof typeof room.roleQuotas] !== undefined && (
                      <div className="mt-1 flex items-center justify-between text-[9px] bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                        <span className="text-slate-400">الكوتا المسموحة:</span>
                        <span className="font-mono font-bold text-amber-300">
                          {(room.userCredentials || []).filter(c => c.role === r.role).length} / {room.roleQuotas[r.role as keyof typeof room.roleQuotas]}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Secret PIN Code and Device Binding */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <KeyRound size={15} />
                <span>حماية الرتبة بالرمز السري ومعرف الجهاز:</span>
              </div>

              <div>
                <label className="block mb-1 text-[11px] text-slate-400">
                  الرمز السري الخاص بالمستخدم (PIN / Password):
                </label>
                <input
                  type="text"
                  required
                  value={userPinCode}
                  onChange={e => setUserPinCode(e.target.value)}
                  placeholder="مثال: 4589"
                  className="w-full bg-slate-900 border border-amber-500/50 rounded-xl p-2 text-center text-sm font-mono tracking-widest text-amber-300 font-bold outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  * يُلزم المستخدم بكتابة هذا الرمز في نافذة الدخول للحصول على رتبته.
                </span>
              </div>

              <div>
                <label className="block mb-1 text-[11px] text-slate-400">
                  معرف الجهاز المقترن (اختياري لربط الرتبة بجهاز العضو):
                </label>
                <input
                  type="text"
                  value={deviceIdInput}
                  onChange={e => setDeviceIdInput(e.target.value)}
                  placeholder="مثال: DEV-778899 أو اتركه فارغاً"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs font-mono text-slate-300 outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <Check size={16} />
              <span>تثبيت الرتبة وحفظ الرمز السري</span>
            </button>
          </form>
        )}

        {/* Tab 2: Protected Registry */}
        {activeTab === 'registry' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
            {(!room.userCredentials || room.userCredentials.length === 0) ? (
              <div className="p-8 text-center text-slate-500">
                لم يتم تسجيل أي رتب برمز سري في هذا الروم بعد.. انتقل لتبويب تعيين الرتب لإضافة المشرفين.
              </div>
            ) : (
              room.userCredentials.map(c => (
                <div
                  key={c.username}
                  className="bg-slate-950 p-2.5 rounded-2xl border border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs">{c.username}</span>
                      <UserBadge role={c.role} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                      <span>الرمز: <strong className="text-amber-300">{c.pinCode}</strong></span>
                      {c.deviceId && <span>• جهاز: {c.deviceId}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveCredential(c.username)}
                    className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 active:scale-90 transition-all"
                    title="حذف الرتبة المحمية"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 3: Ban List */}
        {activeTab === 'bans' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
            {(!room.bannedUsers || room.bannedUsers.length === 0) ? (
              <div className="p-8 text-center text-slate-500">
                لا يوجد أي مستخدم محظور حالياً في هذا الروم.
              </div>
            ) : (
              room.bannedUsers.map(b => (
                <div
                  key={b.ip}
                  className="bg-slate-950 p-2.5 rounded-2xl border border-red-500/30 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-red-400 block text-xs">{b.username}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      IP: {b.ip} • حظر بواسطة: {b.bannedBy}
                    </span>
                  </div>
                  <button
                    onClick={() => onUnbanUser(b.ip)}
                    className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-[11px] border border-slate-700"
                  >
                    فك الحظر
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 4: Room Tools */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {/* Mic Lock */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">حالة المايك في الروم:</span>
                <span className="text-[11px] text-slate-400">
                  {room.isMicLocked ? 'المايك مقفل للإدارة فقط' : 'المايك متاح ومفتوح لجميع الأعضاء'}
                </span>
              </div>
              <button
                onClick={onToggleMicLock}
                className={`py-1.5 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 ${
                  room.isMicLocked
                    ? 'bg-red-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                {room.isMicLocked ? <Lock size={14} /> : <Unlock size={14} />}
                <span>{room.isMicLocked ? 'مقفل' : 'مفتوح'}</span>
              </button>
            </div>

            {/* Clear Chat */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">مسح رسائل الشات:</span>
                <span className="text-[11px] text-slate-400">تنظيف شريط المحادثة لجميع المتواجدين</span>
              </div>
              <button
                onClick={() => {
                  onClearRoomChat();
                  setClearNotice('تم مسح رسائل الشات العام بنجاح');
                  setTimeout(() => setClearNotice(''), 3000);
                }}
                className="py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold border border-slate-700"
              >
                مسح الآن
              </button>
            </div>
            {clearNotice && (
              <div className="p-2.5 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check size={15} className="text-emerald-400 shrink-0" />
                <span>{clearNotice}</span>
              </div>
            )}

            {/* Per-role Mic Duration Configuration */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Clock size={15} />
                  <span>تحديد مدة المايك حسب الرتبة:</span>
                </div>
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDurationUnit('seconds')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                      durationUnit === 'seconds'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    بالثواني
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationUnit('minutes')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                      durationUnit === 'minutes'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    بالدقائق
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed">
                حدد مدة التحدث على المايك لكل رتبة؛ ينزل المستخدم تلقائياً عند انتهاء وقته:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { role: 'guest' as UserRole, label: 'الزائر' },
                    { role: 'member' as UserRole, label: 'العضو' },
                    { role: 'super_admin' as UserRole, label: 'سوبر أدمن' },
                    { role: 'admin' as UserRole, label: 'المشرف / الأدمن' },
                    { role: 'vip' as UserRole, label: 'مميز V.I.P' },
                    { role: 'owner' as UserRole, label: 'الماستر' },
                  ]
                ).map(item => {
                  const secondsVal = micDurationsDraft[item.role];
                  const displayVal =
                    durationUnit === 'minutes'
                      ? Number((secondsVal / 60).toFixed(2))
                      : secondsVal;

                  return (
                    <div
                      key={item.role}
                      className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: ROLE_HIERARCHY[item.role].hex }}
                        >
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono text-amber-300">
                          {formatSecondsPreview(secondsVal)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={durationUnit === 'minutes' ? 0.1 : 5}
                          max={durationUnit === 'minutes' ? 120 : 7200}
                          step={durationUnit === 'minutes' ? 0.5 : 5}
                          value={displayVal}
                          onChange={e => handleRoleDurationChange(item.role, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-lg p-1.5 text-center font-mono font-bold text-white outline-none text-xs"
                        />
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {durationUnit === 'minutes' ? 'د' : 'ث'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleSaveMicDurations}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Check size={15} />
                <span>حفظ مدد المايك للرتب</span>
              </button>

              {micSavedNotice && (
                <div className="p-2 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-emerald-300 text-[11px] flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-400 shrink-0" />
                  <span>{micSavedNotice}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
