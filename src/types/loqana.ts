export type UserRole = 'owner' | 'vip' | 'admin' | 'super_admin' | 'member' | 'guest';

export const ROLE_HIERARCHY: Record<UserRole, { level: number; label: string; color: string; hex: string }> = {
  owner: { level: 6, label: 'الماستر', color: 'text-red-500', hex: '#ef4444' },
  vip: { level: 5, label: 'مميز V.I.P', color: 'text-pink-500', hex: '#ec4899' },
  admin: { level: 4, label: 'مشرف', color: 'text-yellow-400', hex: '#eab308' },
  super_admin: { level: 3, label: 'سوبر أدمن', color: 'text-green-500', hex: '#22c55e' },
  member: { level: 2, label: 'عضو', color: 'text-blue-500', hex: '#3b82f6' },
  guest: { level: 1, label: 'زائر', color: 'text-slate-400', hex: '#94a3b8' },
};

export function normalizeUserRole(rawRole?: string | null): UserRole {
  const val = (rawRole || '').trim().toLowerCase();
  if (
    val === 'owner' ||
    val === 'master' ||
    val === 'general_master' ||
    val === 'ماستر' ||
    val === 'الماستر' ||
    val === 'الماستر العام' ||
    val === 'ماستر مشارك' ||
    val === 'ماستر الروم'
  ) {
    return 'owner';
  }
  if (val === 'vip' || val === 'v.i.p' || val === 'مميز' || val === 'مميز v.i.p') {
    return 'vip';
  }
  if (val === 'admin' || val === 'مشرف' || val === 'ادمن' || val === 'أدمن') {
    return 'admin';
  }
  if (
    val === 'super_admin' ||
    val === 'superadmin' ||
    val === 'super-admin' ||
    val === 'سوبر أدمن' ||
    val === 'سوبر ادمن'
  ) {
    return 'super_admin';
  }
  if (val === 'member' || val === 'عضو') {
    return 'member';
  }
  return 'guest';
}

export function getRoleLevel(role?: string | null): number {
  const normalized = normalizeUserRole(role);
  return ROLE_HIERARCHY[normalized]?.level || 1;
}

export function isMasterRole(role?: string | null): boolean {
  return normalizeUserRole(role) === 'owner';
}

export function isRoomAdminRole(role?: string | null): boolean {
  const normalized = normalizeUserRole(role);
  return (
    normalized === 'owner' ||
    normalized === 'vip' ||
    normalized === 'admin' ||
    normalized === 'super_admin'
  );
}

export function canModerateTarget(
  actorRole?: string | null,
  targetRole?: string | null,
  options?: { isSelf?: boolean; isGeneralMaster?: boolean }
): boolean {
  const normalizedActor = normalizeUserRole(actorRole);
  if (normalizedActor === 'owner' || (options?.isGeneralMaster && normalizedActor !== 'guest')) {
    return true;
  }
  if (!isRoomAdminRole(normalizedActor)) {
    return false;
  }
  if (options?.isSelf) {
    return false;
  }
  return getRoleLevel(normalizedActor) > getRoleLevel(targetRole);
}

export interface UserProfile {
  id: string;
  username: string;
  avatar: string;
  role: UserRole;
  countryCode: string;
  flag: string;
  level: number;
  coins: number;
  giftsReceivedCount: number;
  textColor: string;
  mood: string;
  isMuted?: boolean;
  isBound?: boolean;
  ipAddress?: string;
  deviceId?: string;
  pinCode?: string;
  birthDate?: string; // تاريخ الميلاد / المواليد
  profilePin?: string; // الرمز السري لحماية الملف الشخصي
  isPrivateChatLocked?: boolean; // قفل الرسائل الخاصة (المحادثة الخاصة)
  isSoundEffectsMuted?: boolean; // كتم أصوات المؤثرات والإشعارات في الغرف (مع إبقاء صوت المايك مسموعاً)
}

export type RoomCategory =
  | 'all'
  | 'iraq'
  | 'egypt'
  | 'saudi'
  | 'syria'
  | 'jordan'
  | 'lebanon'
  | 'palestine'
  | 'libya'
  | 'morocco'
  | 'algeria'
  | 'turkey'
  | 'gulf'
  | 'yemen'
  | 'sham'
  | 'maghreb'
  | 'entertainment';

export interface RoomCredential {
  id?: string;
  roomId?: string;
  username: string;
  pinCode: string;
  role: UserRole;
  deviceId?: string;
  assignedAt?: string;
  assignedByUid?: string;
}

export type BanType = 'ip' | 'device' | 'both';

export interface BannedUserEntry {
  id?: string;
  roomId?: string;
  ip: string;
  deviceId?: string;
  username: string;
  targetUid?: string;
  banType?: BanType;
  reason?: string;
  bannedAt: string;
  bannedBy: string;
  bannedByUid?: string;
}

export interface RoleQuotas {
  vip: number;
  admin: number;
  super_admin: number;
  member: number;
}

export interface MicDurations {
  owner: number;
  vip: number;
  admin: number;
  super_admin: number;
  member: number;
  guest: number;
}

export const DEFAULT_MIC_DURATIONS: MicDurations = {
  owner: 600,
  vip: 360,
  admin: 300,
  super_admin: 240,
  member: 180,
  guest: 60,
};

export interface Room {
  id: string;
  code: string;
  name: string;
  category: RoomCategory;
  countryName: string;
  countryKeywords?: string[];
  flag: string;
  description: string;
  ownerName: string;
  ownerAvatar: string;
  ownerId: string;
  ownerUid?: string;
  ownerColor?: string; // Always Red '#ef4444'
  masterPinCode?: string; // 4-digit secret PIN code
  occupantsCount: number;
  maxCapacity: number;
  isLocked: boolean;
  password?: string;
  welcomeMessage: string;
  activeSpeakerId: string | null;
  speakerStartedAtMs?: number | null;
  isMicTimerPaused?: boolean;
  micPausedRemainingSec?: number | null;
  micQueue: string[];
  bannerUrl?: string;
  isGoldName?: boolean; // When true, room name displays in distinctive Gold/Yellow color
  validityDays?: number; // Expiration in days (1 to 365)
  expiresAt?: string; // Expiration date ISO string
  expiresAtMs?: number; // Expiration epoch milliseconds
  isActive?: boolean; // Auto-set to false when validity countdown hits 0
  createdAtMs?: number;
  roleQuotas?: RoleQuotas; // Quota limits per role assigned by App Owner
  micDurations?: MicDurations; // Per-role mic duration in seconds configured by Room Master
  userCredentials?: RoomCredential[];
  bannedUsers?: BannedUserEntry[];
  mutedUserIds?: string[];
  isMicLocked?: boolean;
  reportsAllowedUsers?: string[]; // User IDs or usernames granted access to Supervisor Reports by Master
  reportsAllowedRoles?: UserRole[]; // Specific non-owner roles granted access to Supervisor Reports by Master
  activeVideoStream?: LiveVideoStream | null;
  micSessionId?: string | null;
  lastKickEvent?: {
    targetUid: string;
    targetName: string;
    kickedBy: string;
    kickedAtMs: number;
  } | null;
  lastBroadcastEvent?: RoomBroadcastEvent | null;
  isPublic?: boolean;
}

export interface WebRtcSignalDoc {
  id: string;
  roomId: string;
  sessionId: string;
  fromUid: string;
  toUid: string;
  type: 'offer' | 'answer';
  sdp: string;
  iceCandidates: string[];
  createdAtMs?: number;
}

export interface LiveVideoStream {
  id: string;
  roomId: string;
  broadcasterId: string;
  broadcasterName: string;
  broadcasterRole: UserRole;
  broadcasterAvatar: string;
  broadcasterFlag: string;
  startedAt: string;
  viewersCount: number;
  blockedUserIds: string[]; // List of user IDs blocked by broadcaster from watching
  isCameraActive: boolean;
  isMuted: boolean;
}

export type ChatMessageType = 'text' | 'gift' | 'system' | 'mic_event' | 'voice_clip' | 'image';

export interface ChatMessage {
  id: string;
  roomId: string;
  senderUid?: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  senderAvatar: string;
  senderFlag: string;
  content: string;
  timestamp: string;
  createdAtMs?: number;
  color?: string;
  isBold?: boolean;
  type: ChatMessageType;
  imageUrl?: string;
  giftData?: {
    giftId: string;
    giftName: string;
    icon: string;
    value: number;
    targetUserName?: string;
  };
  voiceClipUrl?: string;
  voiceDuration?: number;
}

export interface GiftItem {
  id: string;
  name: string;
  icon: string;
  price: number;
  description: string;
  category: 'classic' | 'luxury' | 'royal';
}

export interface SoundEffectItem {
  id: string;
  name: string;
  icon: string;
  soundType: 'applause' | 'celebrate' | 'whistle' | 'laugh' | 'horn' | 'drum' | 'bell';
}

export interface PrivateMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  participantIds?: string[];
  content: string;
  timestamp: string;
  createdAtMs?: number;
}

export interface AbuseReport {
  id: string;
  roomId: string;
  reporterId: string;
  reporterName: string;
  targetUserId: string;
  targetUsername: string;
  reason: string;
  details?: string;
  createdAtMs?: number;
}

export type RoomBroadcastCategory =
  | 'enter'
  | 'leave'
  | 'bind'
  | 'unbind'
  | 'gift'
  | 'ban'
  | 'ban_ip'
  | 'ban_device'
  | 'ban_both'
  | 'unban'
  | 'kick'
  | 'mute'
  | 'unmute'
  | 'admin';

export interface RoomBroadcastGiftData {
  giftId: string;
  giftName: string;
  icon: string;
  value: number;
  senderName: string;
  recipientName: string;
}

export interface RoomBroadcastEvent {
  id: string;
  category: RoomBroadcastCategory;
  title: string;
  message: string;
  actorName: string;
  targetName?: string;
  giftData?: RoomBroadcastGiftData;
  createdAtMs: number;
}

export type RoomLogAction =
  | 'enter'
  | 'leave'
  | 'kicked'
  | 'banned'
  | 'ban_ip'
  | 'ban_device'
  | 'ban_both'
  | 'unbanned'
  | 'bind'
  | 'unbind'
  | 'gift'
  | 'mute'
  | 'unmute'
  | 'admin';

export interface RoomLogEntry {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  userRole: UserRole;
  userFlag: string;
  userAvatar?: string;
  action: RoomLogAction;
  details?: string;
  ipAddress?: string;
  deviceId?: string;
  timestamp: string;
  createdAtMs: number;
}

export type SupervisorActionType =
  | 'mute'
  | 'unmute'
  | 'kick'
  | 'ban_ip'
  | 'ban_device'
  | 'ban_both'
  | 'unban'
  | 'bind'
  | 'unbind'
  | 'revoke_mic'
  | 'renew_mic'
  | 'freeze_mic'
  | 'unfreeze_mic'
  | 'clear_chat'
  | 'lock_mic'
  | 'unlock_mic'
  | 'assign_rank'
  | 'remove_rank'
  | 'give_mic'
  | 'reports_permission';

export interface SupervisorReportEntry {
  id: string;
  roomId: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  actionType: SupervisorActionType;
  actionLabel: string;
  targetUid?: string;
  targetName?: string;
  details?: string;
  timestamp: string;
  createdAtMs: number;
}
