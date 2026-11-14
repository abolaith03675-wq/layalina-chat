import React, { useMemo, useState } from 'react';
import {
  Crown,
  KeyRound,
  Shield,
  X,
  Trash2,
  Lock,
  Unlock,
  Check,
  AlertTriangle,
  Clock,
  LogIn,
  LogOut,
  UserX,
  Ban,
  ClipboardList,
  Search,
  Globe,
  Smartphone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  Room,
  UserProfile,
  UserRole,
  ROLE_HIERARCHY,
  RoomCredential,
  BannedUserEntry,
  MicDurations,
  RoomLogEntry,
  SupervisorReportEntry,
} from '../types/loqana';
import { UserBadge } from './UserBadge';
import { getRoomLogPresentation } from './PublicRoomEventsModal';
import { normalizeMicDurations } from '../services/firebaseService';
import { useTheme, getReadableRoleColor } from '../context/ThemeContext';

export type MasterPanelTab = 'ranks' | 'registry' | 'bans' | 'logs' | 'reports' | 'settings';

interface MasterControlPanelModalProps {
  room: Room;
  roomUsers: UserProfile[];
  isOwner?: boolean;
  initialTab?: MasterPanelTab;
  roomLogs?: RoomLogEntry[];
  supervisorReports?: SupervisorReportEntry[];
  onClose: () => void;
  onAssignRankWithPin: (credential: RoomCredential) => void;
  onRemoveCredential: (username: string) => void;
  onUnbanUser: (banIdentifier: string, banEntry?: BannedUserEntry) => void;
  onToggleMicLock: () => void;
  onClearRoomChat: () => void;
  onUpdateMicDurations: (micDurations: MicDurations) => Promise<void> | void;
  onUpdateReportsPermissions?: (allowedUsers: string[], allowedRoles: UserRole[]) => Promise<void> | void;
}

export const MasterControlPanelModal: React.FC<MasterControlPanelModalProps> = ({
  room,
  roomUsers,
  isOwner = true,
  initialTab,
  roomLogs = [],
  supervisorReports = [],
  onClose,
  onAssignRankWithPin,
  onRemoveCredential,
  onUnbanUser,
  onToggleMicLock,
  onClearRoomChat,
  onUpdateMicDurations,
  onUpdateReportsPermissions,
}) => {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState<MasterPanelTab>(() => {
    if (!isOwner) return 'reports';
    return initialTab || 'ranks';
  });

  // Form for assigning rank & PIN
  const [targetUsername, setTargetUsername] = useState(roomUsers[0]?.username || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>('vip');
  const [userPinCode, setUserPinCode] = useState('2026');
  const [deviceIdInput, setDeviceIdInput] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [clearNotice, setClearNotice] = useState('');

  // Room Logs filters
  const [logFilter, setLogFilter] = useState<'all' | 'enter' | 'leave' | 'moderation'>('all');
  const [logSearch, setLogSearch] = useState('');

  // Supervisor Reports filters & permission management state
  const [reportFilter, setReportFilter] = useState<'all' | 'bans_kicks' | 'mic_mute' | 'admin'>('all');
  const [reportSearch, setReportSearch] = useState('');
  const [showPermissionSettings, setShowPermissionSettings] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState('');
  const [customAllowedName, setCustomAllowedName] = useState('');

  // Per-role Mic Duration state (stored in seconds)
  const [micDurationsDraft, setMicDurationsDraft] = useState<MicDurations>(() =>
    normalizeMicDurations(room.micDurations)
  );
  const [durationUnit, setDurationUnit] = useState<'seconds' | 'minutes'>('seconds');
  const [micSavedNotice, setMicSavedNotice] = useState('');

  const allowedUsersList = room.reportsAllowedUsers || [];
  const allowedRolesList = room.reportsAllowedRoles || [];

  // Ranked candidates inside the room (online ranked users + saved ranked credentials, excluding guest & owner)
  const rankedCandidates = useMemo(() => {
    const map = new Map<string, { id?: string; username: string; role: UserRole; flag?: string }>();
    for (const u of roomUsers) {
      if (u.role !== 'guest' && u.role !== 'owner') {
        map.set(u.username.trim().toLowerCase(), {
          id: u.id,
          username: u.username.trim(),
          role: u.role,
          flag: u.flag,
        });
      }
    }
    for (const c of room.userCredentials || []) {
      if (c.role !== 'guest' && c.role !== 'owner') {
        const key = c.username.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            username: c.username.trim(),
            role: c.role,
          });
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => (ROLE_HIERARCHY[b.role]?.level || 0) - (ROLE_HIERARCHY[a.role]?.level || 0)
    );
  }, [roomUsers, room.userCredentials]);

  const isCandidatePermitted = (candidate: { id?: string; username: string }) => {
    const lowerName = candidate.username.trim().toLowerCase();
    return allowedUsersList.some(
      entry => entry === candidate.id || entry.trim().toLowerCase() === lowerName
    );
  };

  const handleToggleUserReportAccess = async (candidate: { id?: string; username: string }) => {
    if (!isOwner || !onUpdateReportsPermissions) return;
    const lowerName = candidate.username.trim().toLowerCase();
    const currentlyAllowed = isCandidatePermitted(candidate);

    const nextUsers = currentlyAllowed
      ? allowedUsersList.filter(
          entry => entry !== candidate.id && entry.trim().toLowerCase() !== lowerName
        )
      : Array.from(new Set([...allowedUsersList, candidate.id || candidate.username.trim(), candidate.username.trim()]));

    await onUpdateReportsPermissions(nextUsers, allowedRolesList);
    setPermissionNotice(
      currentlyAllowed
        ? `تم سحب صلاحية عرض التقارير من «${candidate.username}»`
        : `تم منح «${candidate.username}» صلاحية الاطلاع على تقارير المشرفين`
    );
    setTimeout(() => setPermissionNotice(''), 3000);
  };

  const handleToggleRoleReportAccess = async (role: UserRole) => {
    if (!isOwner || !onUpdateReportsPermissions || role === 'owner' || role === 'guest') return;
    const exists = allowedRolesList.includes(role);
    const nextRoles = exists
      ? allowedRolesList.filter(r => r !== role)
      : [...allowedRolesList, role];
    await onUpdateReportsPermissions(allowedUsersList, nextRoles);
    const label = ROLE_HIERARCHY[role]?.label || role;
    setPermissionNotice(
      exists
        ? `تم إلغاء صلاحية التقارير عن رتبة «${label}»`
        : `تم منح جميع حاملي رتبة «${label}» صلاحية الاطلاع على التقارير`
    );
    setTimeout(() => setPermissionNotice(''), 3000);
  };

  const handleAddCustomAllowedName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner || !onUpdateReportsPermissions) return;
    const trimmed = customAllowedName.trim();
    if (!trimmed) return;
    const nextUsers = Array.from(new Set([...allowedUsersList, trimmed]));
    await onUpdateReportsPermissions(nextUsers, allowedRolesList);
    setCustomAllowedName('');
    setPermissionNotice(`تم منح «${trimmed}» صلاحية الاطلاع على تقارير المشرفين`);
    setTimeout(() => setPermissionNotice(''), 3000);
  };

  const filteredLogs = useMemo(() => {
    return roomLogs.filter(log => {
      if (
        logSearch.trim() &&
        !log.username.toLowerCase().includes(logSearch.trim().toLowerCase()) &&
        !(log.details || '').toLowerCase().includes(logSearch.trim().toLowerCase())
      ) {
        return false;
      }
      if (logFilter === 'enter') return log.action === 'enter';
      if (logFilter === 'leave') return log.action === 'leave';
      if (logFilter === 'moderation') {
        return ['kicked', 'banned', 'ban_ip', 'ban_device', 'ban_both', 'unbanned', 'bind', 'unbind', 'mute', 'unmute', 'admin'].includes(log.action);
      }
      return true;
    });
  }, [roomLogs, logFilter, logSearch]);

  const filteredReports = useMemo(() => {
    return supervisorReports.filter(rep => {
      const q = reportSearch.trim().toLowerCase();
      if (
        q &&
        !rep.actorName.toLowerCase().includes(q) &&
        !(rep.targetName || '').toLowerCase().includes(q) &&
        !rep.actionLabel.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (reportFilter === 'bans_kicks') {
        return ['kick', 'ban_ip', 'ban_device', 'ban_both', 'unban'].includes(rep.actionType);
      }
      if (reportFilter === 'mic_mute') {
        return ['mute', 'unmute', 'revoke_mic', 'renew_mic', 'freeze_mic', 'unfreeze_mic', 'lock_mic', 'unlock_mic', 'give_mic'].includes(rep.actionType);
      }
      if (reportFilter === 'admin') {
        return ['bind', 'unbind', 'clear_chat', 'assign_rank', 'remove_rank', 'reports_permission'].includes(rep.actionType);
      }
      return true;
    });
  }, [supervisorReports, reportFilter, reportSearch]);

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

  const masterTabs: { id: MasterPanelTab; label: string }[] = isOwner
    ? [
        { id: 'ranks', label: 'تعيين الرتب' },
        { id: 'registry', label: `المحميون (${room.userCredentials?.length || 0})` },
        { id: 'bans', label: `المحظورون (${room.bannedUsers?.length || 0})` },
        { id: 'logs', label: `السجل (${roomLogs.length})` },
        { id: 'reports', label: `التقارير (${supervisorReports.length})` },
        { id: 'settings', label: 'أدوات الروم' },
      ]
    : [{ id: 'reports', label: `تقارير المشرفين (${supervisorReports.length})` }];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/55 dark:bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border-[1.5px] dark:border border-red-300 dark:border-red-500/50 rounded-3xl w-full max-w-lg overflow-hidden text-slate-900 dark:text-white shadow-2xl flex flex-col max-h-[90vh] text-right transition-colors duration-300">
        {/* Header */}
        <div className="bg-red-50 dark:bg-transparent dark:bg-gradient-to-r dark:from-red-950 dark:via-slate-900 dark:to-amber-950 px-4 py-3.5 border-b border-red-200 dark:border-red-500/30 flex items-center justify-between gap-2 shrink-0">
          <div className="w-8 h-8 shrink-0" aria-hidden="true" />
          <div className="flex-1 min-w-0 flex flex-col items-center justify-center text-center px-1">
            <div className="w-9 h-9 rounded-2xl bg-red-100 dark:bg-red-500/20 border border-red-300 dark:border-red-500/40 flex items-center justify-center shadow-xs mb-1 shrink-0">
              {isOwner ? (
                <Crown size={18} className="text-red-600 dark:text-red-400 animate-pulse" />
              ) : (
                <ClipboardList size={18} className="text-amber-600 dark:text-amber-400" />
              )}
            </div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-full">
              {isOwner ? 'لوحة تحكم ماستر الروم' : 'تقارير المشرفين والنشاطات'}
            </h2>
            <span className="text-[10px] text-red-600 dark:text-red-400 font-mono truncate max-w-full">
              {isOwner
                ? `صلاحيات المالك الكاملة • ${room.name}`
                : `صلاحية اطلاع ممنوحة من الماستر • ${room.name}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-red-100/70 dark:hover:bg-slate-800/80 transition-colors shrink-0 self-start"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-2 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs touch-scroll-x shrink-0">
          {masterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl border shrink-0 whitespace-nowrap transition-all font-medium ${
                activeTab === tab.id
                  ? 'bg-red-50 dark:bg-red-500/25 border-red-400 dark:border-red-500 text-red-700 dark:text-red-300 font-bold shadow-xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Assign Rank & Secret PIN */}
        {isOwner && activeTab === 'ranks' && (
          <form onSubmit={handleSaveCredential} className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs">
            {successMessage && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/60 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2 animate-in fade-in">
                <Check size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {formError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/60 rounded-xl text-red-700 dark:text-red-200 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Target User */}
            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300 font-bold">
                اختر أو اكتب اسم المستخدم:
              </label>
              <div className="space-y-1.5">
                <select
                  value={targetUsername}
                  onChange={e => handleSelectUser(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-slate-900 dark:text-white outline-none"
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
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs text-amber-700 dark:text-amber-300 outline-none"
                />
              </div>
            </div>

            {/* Role Selection with Exact Specified Colors */}
            <div>
              <label className="block mb-1 text-slate-700 dark:text-slate-300 font-bold">
                تحديد الرتبة واللون الإداري:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { role: 'vip' as UserRole, label: 'مميز V.I.P', desc: 'لون وردي (Pink) • صلاحيات كاملة' },
                  { role: 'admin' as UserRole, label: 'مشرف', desc: 'لون أصفر (Yellow) • صلاحيات كاملة' },
                  { role: 'super_admin' as UserRole, label: 'سوبر أدمن', desc: 'لون أخضر (Green) • صلاحيات متوسطة' },
                  { role: 'member' as UserRole, label: 'عضو', desc: 'لون أزرق (Blue) • صلاحيات أساسية' },
                  { role: 'guest' as UserRole, label: 'زائر', desc: 'لون افتراضي • بدون صلاحيات' },
                  { role: 'owner' as UserRole, label: 'ماستر مشارك', desc: 'لون أحمر (Red) • تحكم كامل' },
                ].map(r => (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => setSelectedRole(r.role)}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between ${
                      selectedRole === r.role
                        ? 'ring-2 ring-amber-400 bg-amber-50 dark:bg-slate-800 border-amber-500 dark:border-white shadow-md'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span
                        className="font-bold text-xs"
                        style={{ color: getReadableRoleColor(r.role, isDarkMode) }}
                      >
                        {r.label}
                      </span>
                      <UserBadge role={r.role} size="sm" showLabel={false} />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{r.desc}</span>
                    {/* Quota Limit Badge set by App Owner */}
                    {room.roleQuotas && room.roleQuotas[r.role as keyof typeof room.roleQuotas] !== undefined && (
                      <div className="mt-1 flex items-center justify-between text-[9px] bg-white dark:bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                        <span className="text-slate-500 dark:text-slate-400">الكوتا المسموحة:</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-300">
                          {(room.userCredentials || []).filter(c => c.role === r.role).length} / {room.roleQuotas[r.role as keyof typeof room.roleQuotas]}
                        </span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Secret PIN Code and Device Binding */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                <KeyRound size={15} />
                <span>حماية الرتبة بالرمز السري ومعرف الجهاز:</span>
              </div>

              <div>
                <label className="block mb-1 text-[11px] text-slate-600 dark:text-slate-400">
                  الرمز السري الخاص بالمستخدم (PIN / Password):
                </label>
                <input
                  type="text"
                  required
                  value={userPinCode}
                  onChange={e => setUserPinCode(e.target.value)}
                  placeholder="مثال: 4589"
                  className="w-full bg-white dark:bg-slate-900 border border-amber-400 dark:border-amber-500/50 rounded-xl p-2 text-center text-sm font-mono tracking-widest text-amber-700 dark:text-amber-300 font-bold outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  * يُلزم المستخدم بكتابة هذا الرمز في نافذة الدخول للحصول على رتبته.
                </span>
              </div>

              <div>
                <label className="block mb-1 text-[11px] text-slate-600 dark:text-slate-400">
                  معرف الجهاز المقترن (اختياري لربط الرتبة بجهاز العضو):
                </label>
                <input
                  type="text"
                  value={deviceIdInput}
                  onChange={e => setDeviceIdInput(e.target.value)}
                  placeholder="مثال: DEV-778899 أو اتركه فارغاً"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs font-mono text-slate-800 dark:text-slate-300 outline-none"
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
        {isOwner && activeTab === 'registry' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
            {(!room.userCredentials || room.userCredentials.length === 0) ? (
              <div className="p-8 text-center text-slate-500">
                لم يتم تسجيل أي رتب برمز سري في هذا الروم بعد.. انتقل لتبويب تعيين الرتب لإضافة المشرفين.
              </div>
            ) : (
              room.userCredentials.map(c => (
                <div
                  key={c.username}
                  className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{c.username}</span>
                      <UserBadge role={c.role} size="sm" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono">
                      <span>الرمز: <strong className="text-amber-700 dark:text-amber-300">{c.pinCode}</strong></span>
                      {c.deviceId && <span>• جهاز: {c.deviceId}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveCredential(c.username)}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900 text-red-600 dark:text-red-400 active:scale-90 transition-all"
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
        {isOwner && activeTab === 'bans' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-2 text-xs">
            {(!room.bannedUsers || room.bannedUsers.length === 0) ? (
              <div className="p-8 text-center text-slate-500">
                لا يوجد أي مستخدم محظور حالياً في هذا الروم.
              </div>
            ) : (
              room.bannedUsers.map(b => {
                const banScope = b.banType || 'both';
                const scopeBadge =
                  banScope === 'ip'
                    ? 'حظر آي بي (IP)'
                    : banScope === 'device'
                    ? 'حظر جهاز (Device)'
                    : 'حظر شامل (IP + جهاز)';
                return (
                  <div
                    key={b.id || `${b.ip}-${b.username}`}
                    className="bg-red-50/60 dark:bg-slate-950 p-3 rounded-2xl border-[1.5px] dark:border border-red-200 dark:border-red-500/30 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-red-600 dark:text-red-400 text-xs">{b.username}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            banScope === 'ip'
                              ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40'
                              : banScope === 'device'
                              ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                              : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40'
                          }`}
                        >
                          {scopeBadge}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono flex items-center gap-2 flex-wrap">
                        <span>IP: {b.ip}</span>
                        {b.deviceId && <span>• Device: {b.deviceId}</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        بواسطة: <strong className="text-slate-700 dark:text-slate-200">{b.bannedBy}</strong> • {b.bannedAt}
                        {b.reason && <span className="block text-red-600/80 dark:text-red-300/80 mt-0.5">السبب: {b.reason}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => onUnbanUser(b.id || b.ip, b)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] border border-emerald-300 dark:border-slate-700 shrink-0 active:scale-95 transition-all"
                    >
                      فك الحظر
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab 4: Room Entry/Exit Chronological Logs */}
        {isOwner && activeTab === 'logs' && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            {/* Filters & Search */}
            <div className="p-3 bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
              <div className="relative flex items-center">
                <Search size={14} className="absolute right-3 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={logSearch}
                  onChange={e => setLogSearch(e.target.value)}
                  placeholder="ابحث باسم العضو في سجل الدخول والخروج..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-amber-500 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 touch-scroll-x py-0.5">
                {[
                  { id: 'all', label: `الكل (${roomLogs.length})` },
                  { id: 'enter', label: 'دخول' },
                  { id: 'leave', label: 'خروج' },
                  { id: 'moderation', label: 'طرد وحظر' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setLogFilter(f.id as typeof logFilter)}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold shrink-0 whitespace-nowrap transition-all ${
                      logFilter === f.id
                        ? 'bg-amber-500 border-amber-500 text-slate-950'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chronological Feed */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  لا توجد أحداث دخول أو خروج مسجلة تطابق الفلتر الحالي.
                </div>
              ) : (
                filteredLogs.map(log => {
                  const { label: actionLabel, iconBg, badgeClass, Icon } = getRoomLogPresentation(log.action);
                  return (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                          <Icon size={15} />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs">{log.userFlag}</span>
                            <span
                              className="font-black text-xs truncate max-w-[130px]"
                              style={{ color: getReadableRoleColor(log.userRole, isDarkMode) }}
                            >
                              {log.username}
                            </span>
                            <UserBadge role={log.userRole} size="sm" showLabel={false} />
                            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold border ${badgeClass}`}>
                              {actionLabel}
                            </span>
                          </div>
                          {log.details && (
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-snug">
                              {log.details}
                            </p>
                          )}
                          {(log.ipAddress || log.deviceId) && (
                            <div className="text-[9px] font-mono text-slate-500 dark:text-slate-500 flex items-center gap-2 flex-wrap">
                              {log.ipAddress && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Globe size={9} /> {log.ipAddress}
                                </span>
                              )}
                              {log.deviceId && (
                                <span className="inline-flex items-center gap-0.5">
                                  <Smartphone size={9} /> {log.deviceId}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                        {log.timestamp}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 5: Supervisors Reports (Master by default + Master Permission Settings for Ranked Users) */}
        {activeTab === 'reports' && (
          <div className="flex-1 flex flex-col overflow-hidden text-xs">
            {/* Master-Only Permission Settings Accordion */}
            {isOwner && onUpdateReportsPermissions && (
              <div className="p-3 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200 dark:border-amber-500/25 space-y-2 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck size={15} className="text-amber-600 dark:text-amber-400" />
                    <div>
                      <span className="font-black text-slate-900 dark:text-white block text-xs">
                        صلاحية الاطلاع على تقارير المشرفين
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400">
                        افتراضياً للماستر فقط • يمكنك منح الصلاحية لأي شخص يحمل رتبة
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPermissionSettings(prev => !prev)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all shrink-0 ${
                      showPermissionSettings
                        ? 'bg-amber-500 border-amber-500 text-slate-950'
                        : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-500/40 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {showPermissionSettings ? 'إخفاء الإعدادات' : 'إدارة الصلاحيات'}
                  </button>
                </div>

                {permissionNotice && (
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-1.5">
                    <Check size={14} className="shrink-0" />
                    <span>{permissionNotice}</span>
                  </div>
                )}

                {showPermissionSettings && (
                  <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 max-h-56 overflow-y-auto">
                    {/* Role-level permissions */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                        منح الصلاحية حسب الرتبة (غير الزائر):
                      </span>
                      <div className="flex items-center gap-1.5 touch-scroll-x py-0.5">
                        {(['vip', 'admin', 'super_admin', 'member'] as UserRole[]).map(role => {
                          const enabled = allowedRolesList.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => void handleToggleRoleReportAccess(role)}
                              className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1 shrink-0 whitespace-nowrap transition-all ${
                                enabled
                                  ? 'bg-emerald-50 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/60 text-emerald-800 dark:text-emerald-200'
                                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {enabled && <Check size={11} className="text-emerald-600 dark:text-emerald-400" />}
                              <span style={{ color: getReadableRoleColor(role, isDarkMode) }}>
                                {ROLE_HIERARCHY[role].label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Specific Ranked Users */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Users size={11} />
                        <span>منح الصلاحية لأعضاء محددين يحملون رتبة في الروم:</span>
                      </span>
                      {rankedCandidates.length === 0 ? (
                        <p className="text-[10px] text-slate-500 py-1">
                          لا يوجد أعضاء برتبة حالياً؛ يمكنك إضافة اسم صاحب الرتبة أدناه:
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {rankedCandidates.map(cand => {
                            const allowed = isCandidatePermitted(cand);
                            return (
                              <div
                                key={cand.username}
                                className="flex items-center justify-between p-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {cand.flag && <span className="text-xs">{cand.flag}</span>}
                                  <span
                                    className="font-bold text-[11px] truncate max-w-[120px]"
                                    style={{ color: getReadableRoleColor(cand.role, isDarkMode) }}
                                  >
                                    {cand.username}
                                  </span>
                                  <UserBadge role={cand.role} size="sm" />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleUserReportAccess(cand)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                    allowed
                                      ? 'bg-emerald-600 border-emerald-500 text-white'
                                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  {allowed ? 'مسموح ✓' : 'منح صلاحية'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <form onSubmit={handleAddCustomAllowedName} className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={customAllowedName}
                          onChange={e => setCustomAllowedName(e.target.value)}
                          placeholder="أضف اسم مشرف/صاحب رتبة لمنحه الصلاحية..."
                          className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-[11px] text-slate-900 dark:text-white outline-none"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0"
                        >
                          منح
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reports Search & Category Filter */}
            <div className="p-3 bg-slate-50/70 dark:bg-slate-950/70 border-b border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
              <div className="relative flex items-center">
                <Search size={14} className="absolute right-3 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={reportSearch}
                  onChange={e => setReportSearch(e.target.value)}
                  placeholder="ابحث باسم المشرف، العضو، أو الإجراء..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-amber-500 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                />
              </div>
              <div className="flex items-center gap-1.5 touch-scroll-x py-0.5">
                {[
                  { id: 'all', label: `كل التقارير (${supervisorReports.length})` },
                  { id: 'bans_kicks', label: 'حظر وطرد' },
                  { id: 'mic_mute', label: 'المايك والكتم' },
                  { id: 'admin', label: 'الرتب والغرفة' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setReportFilter(f.id as typeof reportFilter)}
                    className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold shrink-0 whitespace-nowrap transition-all ${
                      reportFilter === f.id
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Reports Activity List */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2">
              {filteredReports.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  لا توجد تقارير مشرفين مسجلة بعد في هذا الروم. ستُسجّل جميع الإجراءات الإدارية هنا تلقائياً.
                </div>
              ) : (
                filteredReports.map(rep => {
                  const isBanOrKick = ['kick', 'ban_ip', 'ban_device', 'ban_both'].includes(rep.actionType);
                  const isUnban = rep.actionType === 'unban';
                  return (
                    <div
                      key={rep.id}
                      className={`p-2.5 rounded-2xl border space-y-1 ${
                        isBanOrKick
                          ? 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-500/30'
                          : isUnban
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-500/30'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span
                            className="font-black text-xs"
                            style={{ color: getReadableRoleColor(rep.actorRole, isDarkMode) }}
                          >
                            {rep.actorName}
                          </span>
                          <UserBadge role={rep.actorRole} size="sm" showLabel={false} />
                          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                            • {rep.actionLabel}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                          {rep.timestamp}
                        </span>
                      </div>
                      {rep.targetName && (
                        <div className="text-[11px] text-slate-700 dark:text-slate-300">
                          المستهدف: <strong className="text-slate-900 dark:text-white">{rep.targetName}</strong>
                        </div>
                      )}
                      {rep.details && (
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                          {rep.details}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Room Tools */}
        {isOwner && activeTab === 'settings' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {/* Mic Lock */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">حالة المايك في الروم:</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
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
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">مسح رسائل الشات:</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">تنظيف شريط المحادثة لجميع المتواجدين</span>
              </div>
              <button
                onClick={() => {
                  onClearRoomChat();
                  setClearNotice('تم مسح رسائل الشات العام بنجاح');
                  setTimeout(() => setClearNotice(''), 3000);
                }}
                className="py-1.5 px-3 rounded-xl bg-white hover:bg-amber-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-700 dark:text-amber-300 font-bold border border-amber-300 dark:border-slate-700"
              >
                مسح الآن
              </button>
            </div>
            {clearNotice && (
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
                <Check size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{clearNotice}</span>
              </div>
            )}

            {/* Per-role Mic Duration Configuration */}
            <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                  <Clock size={15} />
                  <span>تحديد مدة المايك حسب الرتبة:</span>
                </div>
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-0.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setDurationUnit('seconds')}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all ${
                      durationUnit === 'seconds'
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    بالدقائق
                  </button>
                </div>
              </div>

              <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
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
                      className="p-2 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[11px] font-bold"
                          style={{ color: getReadableRoleColor(item.role, isDarkMode) }}
                        >
                          {item.label}
                        </span>
                        <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300">
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
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 focus:border-amber-500 dark:focus:border-amber-400 rounded-lg p-1.5 text-center font-mono font-bold text-slate-900 dark:text-white outline-none text-xs"
                        />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
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
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-500/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-1.5">
                  <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
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
