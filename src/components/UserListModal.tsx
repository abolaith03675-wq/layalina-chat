import React, { useState } from 'react';
import { X, Search, MessageSquare, Gift, Mic, ShieldAlert, Lock, Ban, Check, UserX } from 'lucide-react';
import {
  BannedUserEntry,
  UserProfile,
  normalizeUserRole,
  isMasterRole,
  isRoomAdminRole,
  canModerateTarget,
} from '../types/loqana';
import { UserBadge } from './UserBadge';
import { doesBanMatchUser } from '../services/firebaseService';

interface UserListModalProps {
  users: UserProfile[];
  currentUser: UserProfile;
  speakerId: string | null;
  queueUserIds: string[];
  bannedUsers?: BannedUserEntry[];
  onClose: () => void;
  onOpenPrivateChat: (user: UserProfile) => void;
  onSendGiftToUser: (user: UserProfile) => void;
  onGiveMicToUser?: (user: UserProfile) => void;
  onOpenQuickActions?: (user: UserProfile) => void;
  onBanUser?: (user: UserProfile) => void;
  onUnbanUser?: (banEntry: BannedUserEntry, user: UserProfile) => void;
  onKickUser?: (user: UserProfile) => void;
}

export const UserListModal: React.FC<UserListModalProps> = ({
  users,
  currentUser,
  speakerId,
  queueUserIds,
  bannedUsers = [],
  onClose,
  onOpenPrivateChat,
  onSendGiftToUser,
  onGiveMicToUser,
  onOpenQuickActions,
  onBanUser,
  onUnbanUser,
  onKickUser,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'staff' | 'mic' | 'vip'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const myRole = normalizeUserRole(currentUser.role);
  const isMaster = isMasterRole(myRole);
  const isStaff = isMaster || isRoomAdminRole(myRole);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    const normalizedUserRole = normalizeUserRole(user.role);

    if (activeTab === 'staff') {
      return (
        normalizedUserRole === 'owner' ||
        normalizedUserRole === 'super_admin' ||
        normalizedUserRole === 'admin'
      );
    }
    if (activeTab === 'mic') {
      return user.id === speakerId || queueUserIds.includes(user.id);
    }
    if (activeTab === 'vip') {
      return normalizedUserRole === 'vip';
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border-[1.5px] dark:border border-slate-300 dark:border-slate-700 rounded-3xl w-full max-w-md overflow-hidden text-slate-900 dark:text-white shadow-2xl flex flex-col max-h-[85vh] transition-colors duration-300">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-transparent dark:bg-gradient-to-r dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">المتواجدون في الروم</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
              {users.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-2.5 bg-slate-50/70 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
          <div className="relative flex items-center">
            <Search size={14} className="absolute right-3 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث عن اسم عضو بالروم..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-amber-500/50 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 px-3 pt-2 border-b border-slate-200 dark:border-slate-800 text-xs touch-scroll-x shrink-0">
          {[
            { id: 'all', label: `الكل (${users.length})` },
            { id: 'staff', label: 'الإدارة 👑' },
            { id: 'mic', label: 'المايك والسرا 🎙️' },
            { id: 'vip', label: 'المميزين 💎' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'all' | 'staff' | 'mic' | 'vip')}
              className={`px-3 py-1.5 rounded-t-lg transition-colors border-b-2 font-medium shrink-0 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'text-amber-700 dark:text-amber-400 border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-slate-800/60'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User Rows */}
        <div className="flex-1 p-2 overflow-y-auto space-y-1">
          {filteredUsers.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              لا يوجد أعضاء مطابقين للبحث
            </div>
          ) : (
            filteredUsers.map(u => {
              const isOnMic = u.id === speakerId;
              const isInQueue = queueUserIds.includes(u.id);

              return (
                <div
                  key={u.id}
                  onClick={() => setSelectedUser(u)}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 active:bg-slate-200 dark:active:bg-slate-700/60 transition-colors border border-slate-200/80 dark:border-slate-800/60 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={u.avatar}
                        alt={u.username}
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full object-cover border border-slate-300 dark:border-slate-700"
                      />
                      {isOnMic ? (
                        <span className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-amber-500 text-slate-950">
                          <Mic size={10} />
                        </span>
                      ) : (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-slate-900" />
                      )}
                    </div>

                    <div className="min-w-0 text-right">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm">{u.flag}</span>
                        <span
                          className={`text-xs truncate max-w-[120px] ${
                            u.role === 'owner' ? 'text-red-600 dark:text-red-500 font-black' : 'font-bold text-slate-900 dark:text-white'
                          }`}
                        >
                          {u.username}
                        </span>
                        <UserBadge role={u.role} size="sm" />
                        {u.isPrivateChatLocked && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-red-50 dark:bg-red-950/70 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/40 flex items-center gap-0.5 font-bold" title="الخاص مقفل">
                            <Lock size={8} />
                            <span>الخاص مقفل</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[190px] mt-0.5">
                        {u.mood || 'مرحباً بكم في دردشة اليالي الصوتية 🌹'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isOnMic && (
                      <span className="text-[10px] bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                        على المايك
                      </span>
                    )}
                    {isInQueue && (
                      <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        في السرا
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-transparent px-1.5 py-0.5 rounded">
                      Lv.{u.level}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected User Action Bottom Sheet */}
        {selectedUser && (
          <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 text-right animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.username}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover border border-amber-500 dark:border-amber-400"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-sm ${
                        selectedUser.role === 'owner' ? 'text-red-600 dark:text-red-500 font-black' : 'font-bold text-slate-900 dark:text-white'
                      }`}
                    >
                      {selectedUser.username}
                    </span>
                    <span className="text-xs">{selectedUser.flag}</span>
                  </div>
                  <UserBadge role={selectedUser.role} size="sm" />
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                إغلاق
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {/* Private Chat button */}
              <button
                onClick={() => {
                  onOpenPrivateChat(selectedUser);
                  if (!selectedUser.isPrivateChatLocked) {
                    setSelectedUser(null);
                    onClose();
                  }
                }}
                className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 border active:scale-95 transition-all ${
                  selectedUser.isPrivateChatLocked
                    ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/40'
                    : 'bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                }`}
                title={selectedUser.isPrivateChatLocked ? 'هذا المستخدم قام بقفل الرسائل الخاصة حالياً' : 'محادثة خاصة'}
              >
                {selectedUser.isPrivateChatLocked ? (
                  <Lock size={14} className="text-red-600 dark:text-red-400" />
                ) : (
                  <MessageSquare size={14} className="text-amber-600 dark:text-amber-400" />
                )}
                <span>{selectedUser.isPrivateChatLocked ? 'الخاص مقفل 🔒' : 'محادثة خاصة (PM)'}</span>
              </button>

              {/* Send Gift button */}
              <button
                onClick={() => {
                  onSendGiftToUser(selectedUser);
                  setSelectedUser(null);
                  onClose();
                }}
                className="py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/20 dark:hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5 border border-amber-300 dark:border-amber-500/40 active:scale-95 transition-all"
              >
                <Gift size={14} className="text-amber-600 dark:text-amber-400" />
                <span>إرسال هدية 🎁</span>
              </button>

              {/* Quick Actions Menu — Available to everyone (Ban/Kick remain strictly locked inside by rank & hierarchy) */}
              {onOpenQuickActions && (
                <button
                  onClick={() => {
                    onOpenQuickActions(selectedUser);
                    setSelectedUser(null);
                    onClose();
                  }}
                  className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-500/40 active:scale-95 transition-all"
                >
                  <ShieldAlert size={14} className="text-red-600 dark:text-red-400" />
                  <span>إجراءات سريعة ⚡</span>
                </button>
              )}

              {/* Admin Give Mic action */}
              {isStaff && onGiveMicToUser && selectedUser.id !== speakerId && (
                <button
                  onClick={() => {
                    onGiveMicToUser(selectedUser);
                    setSelectedUser(null);
                    onClose();
                  }}
                  className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 border border-emerald-200 dark:border-emerald-500/40 active:scale-95 transition-all"
                >
                  <Mic size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>تسليم المايك</span>
                </button>
              )}

              {/* Direct Kick — Exclusively for administrative ranks (General Master bypasses hierarchy) */}
              {(() => {
                const isTargetSelf = selectedUser.id === currentUser.id;
                const canKickTarget =
                  isStaff &&
                  Boolean(onKickUser) &&
                  !isTargetSelf &&
                  canModerateTarget(myRole, selectedUser.role, {
                    isSelf: isTargetSelf,
                    isGeneralMaster: isMaster,
                  });
                if (!canKickTarget) return null;
                return (
                  <button
                    onClick={() => {
                      const target = selectedUser;
                      setSelectedUser(null);
                      onClose();
                      onKickUser!(target);
                    }}
                    className="py-2 px-3 rounded-xl bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/60 dark:hover:bg-orange-900/60 text-orange-700 dark:text-orange-300 flex items-center justify-center gap-1.5 border border-orange-300 dark:border-orange-500/40 active:scale-95 transition-all"
                  >
                    <UserX size={14} className="text-orange-600 dark:text-orange-400" />
                    <span>طرد من الغرفة</span>
                  </button>
                );
              })()}

              {/* Direct Ban / Unban — Exclusively for administrative ranks (General Master bypasses hierarchy) */}
              {(() => {
                const isTargetSelf = selectedUser.id === currentUser.id;
                const canBanTarget =
                  isStaff &&
                  !isTargetSelf &&
                  canModerateTarget(myRole, selectedUser.role, {
                    isSelf: isTargetSelf,
                    isGeneralMaster: isMaster,
                  });
                if (!canBanTarget) return null;
                const existingBan = bannedUsers.find(b => doesBanMatchUser(b, selectedUser));
                if (existingBan && onUnbanUser) {
                  return (
                    <button
                      onClick={() => {
                        onUnbanUser(existingBan, selectedUser);
                        setSelectedUser(null);
                        onClose();
                      }}
                      className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 border border-emerald-300 dark:border-emerald-500/40 active:scale-95 transition-all"
                    >
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>فك الحظر</span>
                    </button>
                  );
                }
                if (onBanUser) {
                  return (
                    <button
                      onClick={() => {
                        const target = selectedUser;
                        setSelectedUser(null);
                        onClose();
                        onBanUser(target);
                      }}
                      className="py-2 px-3 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/60 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 flex items-center justify-center gap-1.5 border border-red-300 dark:border-red-500/40 active:scale-95 transition-all"
                    >
                      <Ban size={14} className="text-red-600 dark:text-red-400" />
                      <span>حظر (IP / جهاز)</span>
                    </button>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
