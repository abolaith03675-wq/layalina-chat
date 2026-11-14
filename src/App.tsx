/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import {
  BellRing,
  Ban,
  Gift,
  Link2,
  LogIn,
  LogOut,
  ShieldAlert,
  ShieldCheck,
  Unlink,
  UserX,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { testFirestoreConnection } from './firebase';
import {
  addRoomBanInDb,
  addRoomBroadcastInDb,
  addRoomLogInDb,
  addSupervisorReportInDb,
  canUserViewSupervisorReports,
  cleanupLegacyDemoRooms,
  clearRoomMessagesInDb,
  createRoomInDb,
  deactivateExpiredRoomInDb,
  deleteRoomCredentialInDb,
  deleteRoomInDb,
  doesBanMatchUser,
  ensureUserProfile,
  fetchRoomBansOnce,
  fetchRoomCredentialsOnce,
  fetchRoomMessageTimestamp,
  getMicDurationForRole,
  getOrCreateLocalClientIp,
  getOrCreateLocalClientUid,
  getRoomExpiresAtMs,
  hasAcceptedMicDisclosure,
  incrementUserGiftsReceivedInDb,
  isRoomExpired,
  joinRoomAsParticipant,
  leaveRoomParticipant,
  loadBlockedUserIds,
  loadLocalUserProfile,
  markMicDisclosureAccepted,
  removeRoomBanInDb,
  sanitizeId,
  saveBlockedUserIds,
  sendPrivateMessageInDb,
  sendRoomMessageInDb,
  submitUserReportInDb,
  subscribePrivateConversationsList,
  subscribePrivateMessages,
  subscribePublicDirectory,
  subscribeRoomBans,
  subscribeRoomBroadcasts,
  subscribeRoomCredentials,
  subscribeRoomDoc,
  subscribeRoomLogs,
  subscribeRoomMessages,
  subscribeRoomParticipants,
  subscribeRooms,
  subscribeSupervisorReports,
  subscribeUserProfile,
  updateRoomLiveStateInDb,
  updateRoomMicDurationsInDb,
  updateRoomParticipantModeration,
  updateRoomReportsPermissionsInDb,
  updateRoomSettingsInDb,
  updateUserProfileInDb,
  upsertRoomCredentialInDb,
  verifyRoomEntranceRole,
} from './services/firebaseService';
import { SmartphoneWrapper } from './components/SmartphoneWrapper';
import { RoomListView } from './components/RoomListView';
import { RoomHeader } from './components/RoomHeader';
import { MicStage } from './components/MicStage';
import { ChatArea } from './components/ChatArea';
import { GiftModal } from './components/GiftModal';
import { GiftOverlay } from './components/GiftOverlay';
import { UserListModal } from './components/UserListModal';
import { ProfileModal } from './components/ProfileModal';
import { PrivateChatDrawer } from './components/PrivateChatDrawer';
import { PreRoomEntranceModal } from './components/PreRoomEntranceModal';
import { UserQuickActionsMenu } from './components/UserQuickActionsMenu';
import { MasterControlPanelModal, MasterPanelTab } from './components/MasterControlPanelModal';
import { BanUserModal } from './components/BanUserModal';
import { LiveStreamView } from './components/LiveStreamView';
import { MicPermissionModal } from './components/MicPermissionModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PublicRoomEventsModal } from './components/PublicRoomEventsModal';
import {
  BanType,
  ChatMessage,
  GiftItem,
  MicDurations,
  PrivateMessage,
  Room,
  RoomBroadcastCategory,
  RoomBroadcastEvent,
  RoomBroadcastGiftData,
  RoomLogAction,
  UserProfile,
  UserRole,
  ROLE_HIERARCHY,
  RoomCredential,
  BannedUserEntry,
  RoleQuotas,
  LiveVideoStream,
  RoomLogEntry,
  SupervisorActionType,
  SupervisorReportEntry,
  normalizeUserRole,
  isMasterRole,
  isRoomAdminRole,
  canModerateTarget,
} from './types/loqana';
import { DEFAULT_CROWN_AVATAR } from './data/mockLoqanaData';
import { soundEngine } from './services/soundEngine';
import { webrtcAudioService, WebRtcMicError } from './services/webrtcAudioService';

const createMicSessionId = (): string =>
  `ms_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export default function App() {
  // Direct Local Session Identity (No Email/Google Auth required)
  const localClientUid = useMemo(() => getOrCreateLocalClientUid(), []);

  // User Profile (persisted locally + synced in Firestore /users_public)
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    const cached = loadLocalUserProfile(localClientUid);
    return {
      id: localClientUid,
      username: cached.username || 'عضو ليالي',
      avatar: cached.avatar || DEFAULT_CROWN_AVATAR,
      role: 'member',
      countryCode: cached.countryCode || 'SA',
      flag: cached.flag || '🇸🇦',
      level: cached.level ?? 1,
      coins: cached.coins ?? 5000,
      giftsReceivedCount: cached.giftsReceivedCount ?? 0,
      textColor: cached.textColor || '#fbbf24',
      mood: cached.mood || 'أهلاً بكم في دردشة اليالي الصوتية 🌹',
      birthDate: cached.birthDate || '2000-01-01',
      isPrivateChatLocked: Boolean(cached.isPrivateChatLocked),
      isSoundEffectsMuted: Boolean(cached.isSoundEffectsMuted),
      profilePin: cached.profilePin || '',
      deviceId: cached.deviceId || `DEV-${localClientUid.slice(-6).toUpperCase()}`,
      ipAddress: cached.ipAddress || getOrCreateLocalClientIp(localClientUid),
    };
  });

  // Lobby & Rooms State (real-time from Firestore)
  const [activeView, setActiveView] = useState<'lobby' | 'room'>('lobby');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [publicDirectory, setPublicDirectory] = useState<UserProfile[]>([]);

  // Active Room Subcollections (real-time from Firestore)
  const [activeRoomDoc, setActiveRoomDoc] = useState<Room | null>(null);
  const [roomUsers, setRoomUsers] = useState<UserProfile[]>([]);
  const [roomCredentials, setRoomCredentials] = useState<RoomCredential[]>([]);
  const [roomBans, setRoomBans] = useState<BannedUserEntry[]>([]);
  const [roomLogs, setRoomLogs] = useState<RoomLogEntry[]>([]);
  const [supervisorReports, setSupervisorReports] = useState<SupervisorReportEntry[]>([]);
  const [rawMessages, setRawMessages] = useState<ChatMessage[]>([]);
  const [roomEntryTimestamp, setRoomEntryTimestamp] = useState<Timestamp | null>(null);
  const [localClearedIds, setLocalClearedIds] = useState<Set<string>>(() => new Set());

  // Audio & Local Media State
  const [isMuted, setIsMuted] = useState(false);
  const [liveMediaStream, setLiveMediaStream] = useState<MediaStream | null>(null);

  // Modals & Drawers
  const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isPrivateChatOpen, setIsPrivateChatOpen] = useState(false);
  const [activePrivateChatUser, setActivePrivateChatUser] = useState<UserProfile | null>(null);
  const [pendingEntranceRoom, setPendingEntranceRoom] = useState<Room | null>(null);
  const [selectedQuickUser, setSelectedQuickUser] = useState<UserProfile | null>(null);
  const [banTargetUser, setBanTargetUser] = useState<UserProfile | null>(null);
  const [banInitialType, setBanInitialType] = useState<BanType>('both');
  const [isMasterPanelOpen, setIsMasterPanelOpen] = useState(false);
  const [masterPanelInitialTab, setMasterPanelInitialTab] = useState<MasterPanelTab>('ranks');
  const [isPublicEventsOpen, setIsPublicEventsOpen] = useState(false);
  const [noticeBanner, setNoticeBanner] = useState<{
    title: string;
    message: string;
    category?: RoomBroadcastCategory;
  } | null>(null);
  const [isMicTransitioning, setIsMicTransitioning] = useState(false);
  const lastMicAscendAtRef = useRef<number>(0);
  const hasConfirmedParticipantRef = useRef<boolean>(false);
  const isLeavingVoluntarilyRef = useRef<boolean>(false);
  const seenKickKeysRef = useRef<Set<string>>(new Set());
  const seenBroadcastIdsRef = useRef<Set<string>>(new Set());
  const noticeTimerRef = useRef<number | null>(null);
  const verifiedSessionRoleRef = useRef<{
    roomId: string;
    role: UserRole;
    verifiedAtMs: number;
  } | null>(null);
  const activeViewRef = useRef<'lobby' | 'room'>(activeView);
  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);
  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [webrtcMicError, setWebrtcMicError] = useState<WebRtcMicError>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>(() =>
    loadBlockedUserIds(localClientUid)
  );
  const [micDisclosurePrompt, setMicDisclosurePrompt] = useState<{
    purposeLabel: string;
    onGranted: () => void;
  } | null>(null);

  // Private Chats State (real-time from Firestore)
  const [privateConvMeta, setPrivateConvMeta] = useState<{ chatId: string; partnerUid: string }[]>([]);
  const [activePrivateMessages, setActivePrivateMessages] = useState<PrivateMessage[]>([]);

  // Gift Overlay Celebration
  const [activeGiftOverlay, setActiveGiftOverlay] = useState<{
    gift: GiftItem;
    senderName: string;
    recipientName: string;
  } | null>(null);

  const showNotice = useCallback(
    (
      msg: string,
      title = 'تنبيه النظام',
      category?: RoomBroadcastCategory,
      silent = false
    ) => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
      setNoticeBanner({ title, message: msg, category });
      if (!silent) {
        if (category === 'enter' || category === 'gift' || category === 'unban') {
          soundEngine.playMessageChime();
        } else {
          soundEngine.playWarningTone();
        }
      }
      noticeTimerRef.current = window.setTimeout(() => {
        setNoticeBanner(null);
        noticeTimerRef.current = null;
      }, 4500);
    },
    []
  );

  // Keep global SoundEngine effects mute state synced with user's Profile preference across all rooms
  useEffect(() => {
    soundEngine.setEffectsMuted(Boolean(currentUser.isSoundEffectsMuted));
  }, [currentUser.isSoundEffectsMuted]);

  // Configure WebRTC Audio callbacks & cleanup on unmount
  useEffect(() => {
    webrtcAudioService.setCallbacks({
      onPlaybackBlockedChange: setAudioPlaybackBlocked,
      onMicError: setWebrtcMicError,
    });
    return () => {
      webrtcAudioService.stopAll();
    };
  }, []);

  // Sync Room Mute button (RoomHeader) to remote WebRTC audio playback
  useEffect(() => {
    webrtcAudioService.setRemoteMuted(isMuted);
  }, [isMuted]);

  // 1. Test Firestore connection on boot & sync public user profile directly
  useEffect(() => {
    void testFirestoreConnection();

    let cancelled = false;
    ensureUserProfile(localClientUid)
      .then(profile => {
        if (!cancelled) {
          setCurrentUser(prev => ({
            ...profile,
            role: activeView === 'room' ? prev.role : profile.role,
          }));
        }
      })
      .catch(err => {
        console.warn('Background public profile sync skipped:', err);
      });

    cleanupLegacyDemoRooms(localClientUid).catch(cleanupErr => {
      console.warn('Legacy demo cleanup skipped:', cleanupErr);
    });

    return () => {
      cancelled = true;
    };
  }, [localClientUid]);

  // 2. Global Firestore subscriptions (active immediately without login gate)
  useEffect(() => {
    const uid = sanitizeId(localClientUid);
    const unsubProfile = subscribeUserProfile(uid, updates => {
      setCurrentUser(prev => ({
        ...prev,
        ...updates,
        // Never overwrite verified room rank/moderation state with global profile role while inside a room
        role: activeViewRef.current === 'room' ? prev.role : normalizeUserRole(updates.role ?? prev.role),
        isMuted: activeViewRef.current === 'room' ? prev.isMuted : updates.isMuted,
        isBound: activeViewRef.current === 'room' ? prev.isBound : updates.isBound,
      }));
    });
    const unsubRooms = subscribeRooms(nextRooms => {
      setRooms(nextRooms);
    });
    const unsubDirectory = subscribePublicDirectory(users => {
      setPublicDirectory(users);
    });
    const unsubPrivateList = subscribePrivateConversationsList(uid, list => {
      setPrivateConvMeta(list);
    });

    return () => {
      unsubProfile();
      unsubRooms();
      unsubDirectory();
      unsubPrivateList();
    };
  }, [localClientUid]);

  const ejectFromRoomWithNotice = useCallback(
    (reasonMsg: string) => {
      webrtcAudioService.stopAll();
      soundEngine.stopMicrophone();
      if (liveMediaStream) {
        liveMediaStream.getTracks().forEach(t => t.stop());
        setLiveMediaStream(null);
      }
      hasConfirmedParticipantRef.current = false;
      isLeavingVoluntarilyRef.current = true;
      verifiedSessionRoleRef.current = null;
      setSelectedQuickUser(null);
      setBanTargetUser(null);
      setIsUserListOpen(false);
      setIsMasterPanelOpen(false);
      setIsPublicEventsOpen(false);
      setIsGiftModalOpen(false);
      setIsPrivateChatOpen(false);
      setActiveView('lobby');
      setActiveRoomDoc(null);
      setRoomEntryTimestamp(null);
      setRoomUsers([]);
      setRoomLogs([]);
      setSupervisorReports([]);
      setRawMessages([]);
      setLocalClearedIds(new Set());
      showNotice(reasonMsg);
    },
    [liveMediaStream, showNotice]
  );

  const ejectFromRoomRef = useRef(ejectFromRoomWithNotice);
  useEffect(() => {
    ejectFromRoomRef.current = ejectFromRoomWithNotice;
  }, [ejectFromRoomWithNotice]);

  const handleIncomingBroadcast = useCallback(
    (ev: RoomBroadcastEvent) => {
      if (!ev?.id || seenBroadcastIdsRef.current.has(ev.id)) return;
      seenBroadcastIdsRef.current.add(ev.id);
      if (seenBroadcastIdsRef.current.size > 300) {
        const oldest = seenBroadcastIdsRef.current.values().next().value;
        if (oldest) seenBroadcastIdsRef.current.delete(oldest);
      }

      showNotice(ev.message, ev.title, ev.category, ev.category === 'gift');

      if (ev.category === 'gift' && ev.giftData) {
        if (!isMuted) {
          soundEngine.playGiftChime();
        }
        setActiveGiftOverlay({
          gift: {
            id: ev.giftData.giftId,
            name: ev.giftData.giftName,
            icon: ev.giftData.icon,
            price: ev.giftData.value,
            description: '',
            category: 'luxury',
          },
          senderName: ev.giftData.senderName,
          recipientName: ev.giftData.recipientName,
        });
      }
    },
    [isMuted, showNotice]
  );

  const handleIncomingBroadcastRef = useRef(handleIncomingBroadcast);
  useEffect(() => {
    handleIncomingBroadcastRef.current = handleIncomingBroadcast;
  }, [handleIncomingBroadcast]);

  // 3. Active Room Firestore subscriptions (stable across entry timestamp & stream changes)
  useEffect(() => {
    if (activeView !== 'room' || !activeRoomId) return;

    const myUid = currentUser.id || localClientUid;
    let fallbackKickTimer: number | null = null;
    const unsubRoomDoc = subscribeRoomDoc(activeRoomId, docRoom => {
      setActiveRoomDoc(docRoom);
    });
    const unsubParticipants = subscribeRoomParticipants(activeRoomId, participants => {
      setRoomUsers(participants);
      const myRecord = participants.find(p => p.id === myUid);
      if (myRecord) {
        hasConfirmedParticipantRef.current = true;
        if (fallbackKickTimer) {
          window.clearTimeout(fallbackKickTimer);
          fallbackKickTimer = null;
        }
        const incomingRole = normalizeUserRole(myRecord.role);
        const pendingVerified = verifiedSessionRoleRef.current;
        const shouldPreserveFreshVerifiedRole =
          Boolean(pendingVerified) &&
          pendingVerified!.roomId === activeRoomId &&
          Date.now() - pendingVerified!.verifiedAtMs < 6000 &&
          incomingRole === 'guest' &&
          pendingVerified!.role !== 'guest';

        if (pendingVerified && pendingVerified.roomId === activeRoomId && incomingRole === pendingVerified.role) {
          verifiedSessionRoleRef.current = null;
        }

        setCurrentUser(prev => ({
          ...prev,
          id: myUid,
          isMuted: myRecord.isMuted,
          isBound: myRecord.isBound,
          role: shouldPreserveFreshVerifiedRole ? pendingVerified!.role : incomingRole,
          textColor: shouldPreserveFreshVerifiedRole
            ? ROLE_HIERARCHY[pendingVerified!.role]?.hex || myRecord.textColor
            : myRecord.textColor,
        }));
      } else if (hasConfirmedParticipantRef.current && !isLeavingVoluntarilyRef.current) {
        if (!fallbackKickTimer) {
          fallbackKickTimer = window.setTimeout(() => {
            if (hasConfirmedParticipantRef.current && !isLeavingVoluntarilyRef.current) {
              ejectFromRoomRef.current('🥾 تم إخراجك من الغرفة من قِبل الإدارة.');
            }
          }, 450);
        }
      }
    });
    const unsubBroadcasts = subscribeRoomBroadcasts(activeRoomId, ev => {
      handleIncomingBroadcastRef.current(ev);
    });
    const unsubCreds = subscribeRoomCredentials(activeRoomId, creds => {
      setRoomCredentials(creds);
    });
    const unsubBans = subscribeRoomBans(activeRoomId, bans => {
      setRoomBans(bans);
    });
    const unsubLogs = subscribeRoomLogs(activeRoomId, logs => {
      setRoomLogs(logs);
    });
    const unsubReports = subscribeSupervisorReports(activeRoomId, reps => {
      setSupervisorReports(reps);
    });

    return () => {
      if (fallbackKickTimer) window.clearTimeout(fallbackKickTimer);
      unsubRoomDoc();
      unsubParticipants();
      unsubBroadcasts();
      unsubCreds();
      unsubBans();
      unsubLogs();
      unsubReports();
    };
  }, [activeView, activeRoomId, currentUser.id, localClientUid]);

  // 3b. Active Room Chat Messages subscription (isolated so entry timestamp resolves without tearing down room listeners)
  useEffect(() => {
    if (activeView !== 'room' || !activeRoomId || !roomEntryTimestamp) return;
    const unsubMsgs = subscribeRoomMessages(
      activeRoomId,
      msgs => {
        setRawMessages(msgs);
      },
      roomEntryTimestamp
    );
    return () => {
      unsubMsgs();
    };
  }, [activeView, activeRoomId, roomEntryTimestamp]);

  // 4. Enforce kick/ban if current user gets banned while inside a room
  useEffect(() => {
    if (activeView !== 'room' || !currentUser.id) return;
    const matchedBan = roomBans.find(b => doesBanMatchUser(b, currentUser));
    if (matchedBan) {
      const scopeLabel =
        matchedBan.banType === 'ip'
          ? 'حظر آي بي (IP)'
          : matchedBan.banType === 'device'
          ? 'حظر جهاز (Device)'
          : 'حظر شامل (IP + جهاز)';
      ejectFromRoomWithNotice(`🚫 تم حظرك من هذه الغرفة (${scopeLabel}) من قِبل الإدارة.`);
    }
  }, [activeView, roomBans, currentUser, ejectFromRoomWithNotice]);

  // 5. Active 1-to-1 Private Chat Messages Subscription
  useEffect(() => {
    if (!isPrivateChatOpen || !activePrivateChatUser) {
      setActivePrivateMessages([]);
      return;
    }

    const myUid = currentUser.id || localClientUid;
    const unsub = subscribePrivateMessages(myUid, activePrivateChatUser.id, msgs => {
      setActivePrivateMessages(msgs);
    });

    return () => unsub();
  }, [isPrivateChatOpen, activePrivateChatUser, currentUser.id, localClientUid]);

  const deactivatedRoomsRef = useRef<Set<string>>(new Set());

  // 4b. Automatically deactivate expired rooms in Firestore & kick active view if room expires
  useEffect(() => {
    const checkExpirations = () => {
      const now = Date.now();
      for (const room of rooms) {
        const expMs = getRoomExpiresAtMs(room);
        const isNewlyCreated =
          typeof room.createdAtMs === 'number' &&
          now >= room.createdAtMs &&
          now - room.createdAtMs < 60000;
        if (
          !isNewlyCreated &&
          room.isActive !== false &&
          expMs !== null &&
          expMs > 0 &&
          now >= expMs &&
          isRoomExpired(room, now) &&
          !deactivatedRoomsRef.current.has(room.id)
        ) {
          deactivatedRoomsRef.current.add(room.id);
          deactivateExpiredRoomInDb(room.id).catch(err => {
            console.warn('Auto-deactivation skipped or failed:', err);
          });
        } else if (room.isActive !== false && (expMs === null || now < expMs)) {
          deactivatedRoomsRef.current.delete(room.id);
        }
      }
    };

    checkExpirations();
    const timer = setInterval(checkExpirations, 30000);
    return () => clearInterval(timer);
  }, [rooms]);

  // Derived active room merged with direct room doc + real-time subcollection data
  const baseCurrentRoom = useMemo(
    () =>
      (activeRoomDoc && activeRoomDoc.id === activeRoomId ? activeRoomDoc : null) ||
      rooms.find(r => r.id === activeRoomId) ||
      rooms[0],
    [activeRoomDoc, rooms, activeRoomId]
  );

  const currentRoom: Room | undefined = useMemo(() => {
    if (!baseCurrentRoom) return undefined;
    return {
      ...baseCurrentRoom,
      userCredentials: roomCredentials,
      bannedUsers: roomBans,
    };
  }, [baseCurrentRoom, roomCredentials, roomBans]);

  const canViewReports = useMemo(
    () => canUserViewSupervisorReports(currentRoom, currentUser),
    [currentRoom, currentUser]
  );

  useEffect(() => {
    if (activeView !== 'room' || !currentRoom) return;
    if (isRoomExpired(currentRoom, Date.now())) {
      soundEngine.stopMicrophone();
      if (liveMediaStream) {
        liveMediaStream.getTracks().forEach(t => t.stop());
        setLiveMediaStream(null);
      }
      setActiveView('lobby');
      setRoomEntryTimestamp(null);
      setRoomUsers([]);
      setRawMessages([]);
      if (currentUser.id) {
        leaveRoomParticipant(currentRoom.id, currentUser.id).catch(() => {});
      }
      showNotice('⛔ انتهت مدة صلاحية هذه الغرفة وتوقف تفعيلها تلقائياً.');
    }
  }, [activeView, currentRoom, currentUser.id, liveMediaStream, showNotice]);

  const speakerId = currentRoom?.activeSpeakerId || null;
  const queueUserIds = currentRoom?.micQueue || [];
  const activeVideoStream = currentRoom?.activeVideoStream || null;

  // Immediate Kick Listener (zero-clock-skew cross-device instant ejection with supervisor name alert)
  useEffect(() => {
    if (activeView !== 'room' || !currentRoom?.lastKickEvent) return;
    const ev = currentRoom.lastKickEvent;
    const myUid = currentUser.id || localClientUid;
    const kickKey = `${ev.kickedAtMs}_${ev.targetUid}`;
    if (ev.targetUid === myUid && !seenKickKeysRef.current.has(kickKey)) {
      seenKickKeysRef.current.add(kickKey);
      ejectFromRoomRef.current(`🥾 تم طردك من الغرفة فوراً بواسطة [${ev.kickedBy}]`);
    }
  }, [activeView, currentRoom?.lastKickEvent, currentUser.id, localClientUid]);

  // Global Real-Time Broadcast Fallback via Room Doc (deduplicated with /broadcasts subcollection, zero clock-skew)
  useEffect(() => {
    if (activeView !== 'room' || !currentRoom?.lastBroadcastEvent) return;
    handleIncomingBroadcast(currentRoom.lastBroadcastEvent);
  }, [activeView, currentRoom?.lastBroadcastEvent, handleIncomingBroadcast]);

  // Real-Time Cross-Device WebRTC Audio Streaming Sync (Speaker <-> Listeners)
  useEffect(() => {
    const myUid = currentUser.id || localClientUid;
    void webrtcAudioService.syncRoomState({
      activeInRoom: activeView === 'room' && Boolean(currentRoom?.id),
      roomId: currentRoom?.id || null,
      localUid: myUid,
      activeSpeakerId: speakerId,
      micSessionId: currentRoom?.micSessionId || null,
      participantIds: roomUsers.map(u => u.id),
      isSelfMutedInRoom: Boolean(currentUser.isMuted),
    });
  }, [
    activeView,
    currentRoom?.id,
    currentUser.id,
    localClientUid,
    speakerId,
    currentRoom?.micSessionId,
    roomUsers,
    currentUser.isMuted,
  ]);

  // Client-side filtered messages respecting local "Clear My Chat" & locally blocked users
  const visibleMessages = useMemo(
    () =>
      rawMessages.filter(m => {
        if (localClearedIds.has(m.id)) return false;
        if (blockedUserIds.includes(m.senderId)) return false;
        if (m.senderUid && blockedUserIds.includes(m.senderUid)) return false;
        return true;
      }),
    [rawMessages, localClearedIds, blockedUserIds]
  );

  // Active speaker & queue user profiles
  const speakerProfile = useMemo(() => {
    if (!speakerId) return null;
    if (speakerId === currentUser.id) return currentUser;
    return roomUsers.find(u => u.id === speakerId) || null;
  }, [speakerId, currentUser, roomUsers]);

  const queueProfiles = useMemo(
    () =>
      queueUserIds
        .map(id => (id === currentUser.id ? currentUser : roomUsers.find(u => id === u.id)))
        .filter(Boolean) as UserProfile[],
    [queueUserIds, currentUser, roomUsers]
  );

  // Build conversations list for PrivateChatDrawer (excluding locally blocked users)
  const privateConversations = useMemo(() => {
    const map = new Map<string, { user: UserProfile; messages: PrivateMessage[] }>();

    for (const meta of privateConvMeta) {
      if (blockedUserIds.includes(meta.partnerUid)) continue;
      const partner =
        roomUsers.find(u => u.id === meta.partnerUid) ||
        publicDirectory.find(u => u.id === meta.partnerUid);
      if (partner) {
        map.set(partner.id, {
          user: partner,
          messages: activePrivateChatUser?.id === partner.id ? activePrivateMessages : [],
        });
      }
    }

    if (activePrivateChatUser && !blockedUserIds.includes(activePrivateChatUser.id)) {
      map.set(activePrivateChatUser.id, {
        user: activePrivateChatUser,
        messages: activePrivateMessages,
      });
    }

    return Array.from(map.values());
  }, [privateConvMeta, roomUsers, publicDirectory, activePrivateChatUser, activePrivateMessages, blockedUserIds]);

  // Active client UID helper (no login required)
  const activeUid = currentUser.id || localClientUid;

  // Toggle local block for another user
  const handleToggleBlockUser = useCallback(
    (target: UserProfile) => {
      if (!target.id || target.id === activeUid) return;
      const isAlreadyBlocked = blockedUserIds.includes(target.id);
      const nextBlocked = isAlreadyBlocked
        ? blockedUserIds.filter(id => id !== target.id)
        : [...blockedUserIds, target.id];
      setBlockedUserIds(nextBlocked);
      saveBlockedUserIds(activeUid, nextBlocked);
      if (!isAlreadyBlocked && activePrivateChatUser?.id === target.id) {
        setIsPrivateChatOpen(false);
        setActivePrivateChatUser(null);
      }
      showNotice(
        isAlreadyBlocked
          ? `تم إلغاء حظر «${target.username}» وستظهر رسائله مجدداً`
          : `🚫 تم حظر «${target.username}» وإخفاء جميع رسائله عنك فوراً`
      );
    },
    [activeUid, blockedUserIds, activePrivateChatUser, showNotice]
  );

  // Submit abuse report to Firestore + optional immediate local block
  const handleReportUser = useCallback(
    async (target: UserProfile, reason: string, details: string, alsoBlock: boolean) => {
      if (!currentRoom || !target.id || target.id === activeUid) return;
      try {
        await submitUserReportInDb({
          roomId: currentRoom.id,
          reporterId: activeUid,
          reporterName: currentUser.username || 'عضو ليالي',
          targetUserId: target.id,
          targetUsername: target.username || 'مستخدم',
          reason,
          details,
        });
      } catch (err) {
        console.error('Failed to submit abuse report:', err);
      }

      if (alsoBlock && !blockedUserIds.includes(target.id)) {
        const nextBlocked = [...blockedUserIds, target.id];
        setBlockedUserIds(nextBlocked);
        saveBlockedUserIds(activeUid, nextBlocked);
        if (activePrivateChatUser?.id === target.id) {
          setIsPrivateChatOpen(false);
          setActivePrivateChatUser(null);
        }
      }

      showNotice(
        alsoBlock
          ? `✅ تم إرسال البلاغ ضد «${target.username}» وحظره وإخفاء رسائله فوراً`
          : `✅ تم إرسال البلاغ ضد «${target.username}» بنجاح لمراجعة الإدارة`
      );
    },
    [currentRoom, activeUid, currentUser.username, blockedUserIds, activePrivateChatUser, showNotice]
  );

  // Prominent Microphone Disclosure gate before calling getUserMedia
  const requestMicWithDisclosure = useCallback(
    (purposeLabel: string, onGranted: () => void) => {
      if (hasAcceptedMicDisclosure()) {
        onGranted();
        return;
      }
      setMicDisclosurePrompt({
        purposeLabel,
        onGranted,
      });
    },
    []
  );

  // Attempt to open private chat with lock & block verification
  const handleAttemptPrivateChat = (targetUser: UserProfile) => {
    if (targetUser.id === currentUser.id) return;
    if (blockedUserIds.includes(targetUser.id)) {
      showNotice('لقد قمت بحظر هذا المستخدم، يمكنك إلغاء الحظر من قائمة خياراته');
      return;
    }
    if (targetUser.isPrivateChatLocked) {
      showNotice('هذا المستخدم قام بقفل الرسائل الخاصة حالياً');
      return;
    }
    setActivePrivateChatUser(targetUser);
    setIsPrivateChatOpen(true);
  };

  // Select Room: fetches real credentials & bans from Firestore before opening PreRoomEntranceModal
  const handleSelectRoom = async (room: Room) => {
    if (isRoomExpired(room, Date.now())) {
      showNotice('⛔ انتهت مدة صلاحية هذه الغرفة (0 يوم) وتوقف تفعيلها تلقائياً.');
      return;
    }
    try {
      const [creds, bans] = await Promise.all([
        fetchRoomCredentialsOnce(room.id),
        fetchRoomBansOnce(room.id),
      ]);
      const matchedBan = bans.find(b => doesBanMatchUser(b, currentUser));
      if (matchedBan) {
        const scopeLabel =
          matchedBan.banType === 'ip'
            ? 'حظر آي بي (IP)'
            : matchedBan.banType === 'device'
            ? 'حظر جهاز (Device)'
            : 'حظر شامل (IP + جهاز)';
        showNotice(`🚫 أنت محظور من دخول هذه الغرفة (${scopeLabel}) من قبل الإدارة.`);
        return;
      }
      setPendingEntranceRoom({
        ...room,
        userCredentials: creds,
        bannedUsers: bans,
      });
    } catch (err) {
      console.error(err);
      setPendingEntranceRoom(room);
    }
  };

  // Entrance Confirmed from PreRoomEntranceModal (re-verified against saved Master Name + PIN)
  const handleConfirmEntrance = async (entranceData: {
    username: string;
    role: UserRole;
    pinCode?: string;
  }) => {
    if (!pendingEntranceRoom) return;
    const room = pendingEntranceRoom;
    const cleanEntranceName = entranceData.username.trim();
    const verification = verifyRoomEntranceRole(room, cleanEntranceName, entranceData.pinCode);
    const verifiedRole: UserRole = normalizeUserRole(verification.role);
    const roleColor = ROLE_HIERARCHY[verifiedRole]?.hex || '#94a3b8';
    const uid = activeUid;
    const isMutedInRoom = Boolean(room.mutedUserIds?.includes(uid));

    const updatedUser: UserProfile = {
      ...currentUser,
      id: uid,
      username: cleanEntranceName,
      role: verifiedRole,
      pinCode: verification.verified ? entranceData.pinCode?.trim() || undefined : undefined,
      textColor: roleColor,
      isMuted: isMutedInRoom,
    };

    const entryTimeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const entryMsgId = `msg-entry-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const entryWelcomeContent = `🎉 دخل الروم: ${cleanEntranceName} [${ROLE_HIERARCHY[verifiedRole].label}] أهلاً بك في ${room.name}! 🌹`;
    const optimisticEntryMsg: ChatMessage = {
      id: entryMsgId,
      roomId: room.id,
      senderUid: uid,
      senderId: 'system',
      senderName: 'إدارة الروم',
      senderRole: verifiedRole,
      senderAvatar: updatedUser.avatar || DEFAULT_CROWN_AVATAR,
      senderFlag: updatedUser.flag || '🇸🇦',
      content: entryWelcomeContent,
      timestamp: entryTimeStr,
      createdAtMs: Date.now(),
      type: 'system',
    };

    webrtcAudioService.unlockAudioElement();
    hasConfirmedParticipantRef.current = false;
    isLeavingVoluntarilyRef.current = false;
    seenBroadcastIdsRef.current.clear();
    seenKickKeysRef.current.clear();
    if (room.lastBroadcastEvent?.id) {
      seenBroadcastIdsRef.current.add(room.lastBroadcastEvent.id);
    }
    if (room.lastKickEvent) {
      seenKickKeysRef.current.add(`${room.lastKickEvent.kickedAtMs}_${room.lastKickEvent.targetUid}`);
    }
    verifiedSessionRoleRef.current = {
      roomId: room.id,
      role: verifiedRole,
      verifiedAtMs: Date.now(),
    };
    setSelectedQuickUser(null);
    setBanTargetUser(null);

    setCurrentUser(updatedUser);
    setLocalClearedIds(new Set());
    setActiveRoomDoc(room);
    setRoomEntryTimestamp(null);
    setRawMessages([optimisticEntryMsg]);
    setPendingEntranceRoom(null);

    try {
      await joinRoomAsParticipant(room.id, updatedUser, isMutedInRoom);
    } catch (err) {
      console.warn('Participant registration deferred:', err);
    }

    if (verification.masterRejectedReason) {
      showNotice(`⛔ ${verification.masterRejectedReason}`);
    }

    const entryBroadcastId = sanitizeId(`bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const entryBroadcastEvent: RoomBroadcastEvent = {
      id: entryBroadcastId,
      category: 'enter',
      title: 'دخول عضو للغرفة',
      message: `${cleanEntranceName} [${ROLE_HIERARCHY[verifiedRole].label}] انضم إلى الغرفة الآن`,
      actorName: cleanEntranceName,
      targetName: room.name,
      createdAtMs: Date.now(),
    };
    seenBroadcastIdsRef.current.add(entryBroadcastId);

    setActiveRoomId(room.id);
    setActiveView('room');
    showNotice(entryBroadcastEvent.message, entryBroadcastEvent.title, 'enter');

    void updateUserProfileInDb(uid, {
      username: cleanEntranceName,
      textColor: roleColor,
    }).catch(err => console.warn('Profile sync skipped:', err));

    void Promise.all([
      addRoomBroadcastInDb(room.id, entryBroadcastEvent).catch(err =>
        console.warn('Entry broadcast doc skipped:', err)
      ),
      updateRoomLiveStateInDb(room.id, {
        occupantsCount: Math.max(1, (room.occupantsCount || 0) + 1),
        lastBroadcastEvent: entryBroadcastEvent,
      }).catch(err => console.warn('Occupants sync skipped:', err)),
      addRoomLogInDb(room.id, {
        userId: uid,
        username: cleanEntranceName,
        userRole: verifiedRole,
        userFlag: updatedUser.flag || '🇸🇦',
        userAvatar: updatedUser.avatar,
        action: 'enter',
        details: `دخول برتبة ${ROLE_HIERARCHY[verifiedRole].label}`,
        ipAddress: updatedUser.ipAddress || getOrCreateLocalClientIp(uid),
        deviceId: updatedUser.deviceId,
        timestamp: entryTimeStr,
      }).catch(err => console.warn('Room entry log skipped:', err)),
    ]);

    try {
      await sendRoomMessageInDb(
        room.id,
        uid,
        {
          senderId: 'system',
          senderName: 'إدارة الروم',
          senderRole: verifiedRole,
          senderAvatar: updatedUser.avatar || DEFAULT_CROWN_AVATAR,
          senderFlag: updatedUser.flag || '🇸🇦',
          content: entryWelcomeContent,
          timestamp: entryTimeStr,
          type: 'system',
        },
        entryMsgId
      );
      const serverTs = await fetchRoomMessageTimestamp(room.id, entryMsgId);
      const safeCutoffTs = serverTs
        ? Timestamp.fromMillis(Math.max(0, serverTs.toMillis() - 5000))
        : Timestamp.fromMillis(Math.max(0, Date.now() - 60000));
      setRoomEntryTimestamp(safeCutoffTs);
    } catch (err) {
      console.warn('Welcome message skipped:', err);
      setRoomEntryTimestamp(Timestamp.fromMillis(Math.max(0, Date.now() - 60000)));
    }
  };

  // Leave room to lobby
  const handleLeaveRoom = async () => {
    isLeavingVoluntarilyRef.current = true;
    hasConfirmedParticipantRef.current = false;
    verifiedSessionRoleRef.current = null;
    webrtcAudioService.stopAll();

    if (!currentRoom) {
      setActiveView('lobby');
      return;
    }

    const roomId = currentRoom.id;
    const patch: {
      activeSpeakerId?: string | null;
      micSessionId?: string | null;
      speakerStartedAtMs?: number | null;
      isMicTimerPaused?: boolean;
      micPausedRemainingSec?: number | null;
      micQueue?: string[];
      occupantsCount?: number;
      activeVideoStream?: LiveVideoStream | null;
    } = {
      occupantsCount: Math.max(0, roomUsers.length - 1),
    };

    if (speakerId === currentUser.id) {
      soundEngine.playMicTone(false);
      soundEngine.stopMicrophone();
      patch.isMicTimerPaused = false;
      patch.micPausedRemainingSec = null;
      if (queueUserIds.length > 0) {
        patch.activeSpeakerId = queueUserIds[0];
        patch.micSessionId = createMicSessionId();
        patch.speakerStartedAtMs = Date.now();
        patch.micQueue = queueUserIds.slice(1);
      } else {
        patch.activeSpeakerId = null;
        patch.micSessionId = null;
        patch.speakerStartedAtMs = null;
      }
    } else if (queueUserIds.includes(currentUser.id)) {
      patch.micQueue = queueUserIds.filter(id => id !== currentUser.id);
    }

    if (activeVideoStream?.broadcasterId === currentUser.id) {
      if (liveMediaStream) {
        liveMediaStream.getTracks().forEach(t => t.stop());
        setLiveMediaStream(null);
      }
      patch.activeVideoStream = null;
    }

    const leaveRole = normalizeUserRole(currentUser.role);
    const leaveName = (currentUser.username || 'عضو ليالي').trim() || 'عضو ليالي';
    const leaveTimeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const leaveMsgContent = `👋 غادر الغرفة: ${leaveName} [${ROLE_HIERARCHY[leaveRole].label}]`;
    const leaveAvatar = currentUser.avatar || DEFAULT_CROWN_AVATAR;
    const leaveFlag = currentUser.flag || '🇸🇦';

    const leaveBroadcastId = sanitizeId(`bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const leaveBroadcastEvent: RoomBroadcastEvent = {
      id: leaveBroadcastId,
      category: 'leave',
      title: 'مغادرة الغرفة',
      message: `غادر الغرفة: ${leaveName} [${ROLE_HIERARCHY[leaveRole].label}]`,
      actorName: leaveName,
      createdAtMs: Date.now(),
    };

    seenBroadcastIdsRef.current.add(leaveBroadcastId);

    setSelectedQuickUser(null);
    setBanTargetUser(null);
    setIsPublicEventsOpen(false);
    setActiveView('lobby');
    setActiveRoomDoc(null);
    setRoomEntryTimestamp(null);
    setRoomUsers([]);
    setRoomLogs([]);
    setSupervisorReports([]);
    setRawMessages([]);
    setLocalClearedIds(new Set());

    await Promise.all([
      addRoomBroadcastInDb(roomId, leaveBroadcastEvent).catch(err =>
        console.warn('Leave broadcast doc skipped:', err)
      ),
      updateRoomLiveStateInDb(roomId, { ...patch, lastBroadcastEvent: leaveBroadcastEvent }),
      leaveRoomParticipant(roomId, activeUid),
      sendRoomMessageInDb(roomId, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: leaveRole,
        senderAvatar: leaveAvatar,
        senderFlag: leaveFlag,
        content: leaveMsgContent,
        timestamp: leaveTimeStr,
        type: 'system',
      }).catch(err => console.warn('Room leave message skipped:', err)),
      addRoomLogInDb(roomId, {
        userId: activeUid,
        username: leaveName,
        userRole: leaveRole,
        userFlag: leaveFlag,
        userAvatar: leaveAvatar,
        action: 'leave',
        details: `مغادرة الغرفة (${ROLE_HIERARCHY[leaveRole].label})`,
        ipAddress: currentUser.ipAddress || getOrCreateLocalClientIp(activeUid),
        deviceId: currentUser.deviceId,
        timestamp: leaveTimeStr,
      }).catch(err => console.warn('Room leave log skipped:', err)),
    ]);
  };

  // Take Mic Handler (with prominent microphone permission disclosure & WebRTC audio acquisition)
  const executeTakeMic = async () => {
    if (!currentRoom || isMicTransitioning) return;
    const speakerUid = activeUid;

    if (currentUser.isMuted) {
      showNotice('أنت مكتوم حالياً في هذه الغرفة ولا يمكنك الصعود للمايك');
      return;
    }
    const isStaff = isRoomAdminRole(currentUser.role);
    if (currentRoom.isMicLocked && !isStaff) {
      showNotice('🔒 المايك مقفل حالياً ومخصص للإدارة فقط');
      return;
    }
    if (speakerId && speakerId !== speakerUid) return;

    setIsMicTransitioning(true);
    lastMicAscendAtRef.current = Date.now();
    webrtcAudioService.unlockAudioElement();
    soundEngine.playMicTone(true);
    await webrtcAudioService.acquireLocalMic();
    const nextQueue = queueUserIds.filter(id => id !== speakerUid);

    try {
      await updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: speakerUid,
        micSessionId: createMicSessionId(),
        speakerStartedAtMs: Date.now(),
        isMicTimerPaused: false,
        micPausedRemainingSec: null,
        micQueue: nextQueue,
      });

      void sendRoomMessageInDb(currentRoom.id, speakerUid, {
        senderId: speakerUid,
        senderName: currentUser.username || 'عضو ليالي',
        senderRole: currentUser.role || 'guest',
        senderAvatar: currentUser.avatar || DEFAULT_CROWN_AVATAR,
        senderFlag: currentUser.flag || '🇸🇦',
        content: `🎙️ صعد على المايك: ${currentUser.username || 'عضو ليالي'}`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'mic_event',
      }).catch(msgErr => {
        console.warn('Mic ascent announcement skipped:', msgErr);
      });
    } catch (err) {
      console.error('Failed to take mic:', err);
      webrtcAudioService.stopLocalMic();
      showNotice('تعذر الصعود على المايك حالياً، حاول مرة أخرى');
    } finally {
      setTimeout(() => setIsMicTransitioning(false), 650);
    }
  };

  const handleReleaseMic = useCallback(async (reason: 'manual' | 'timeout' = 'manual') => {
    if (!currentRoom) return;
    const speakerUid = activeUid;
    if (speakerId !== speakerUid) return;
    if (reason === 'manual' && isMicTransitioning) return;
    if (
      reason === 'timeout' &&
      (currentRoom.isMicTimerPaused || Date.now() - lastMicAscendAtRef.current < 3000)
    ) {
      return;
    }

    soundEngine.playMicTone(false);
    webrtcAudioService.stopLocalMic();

    let nextSpeaker: string | null = null;
    let nextQueue = queueUserIds;
    if (queueUserIds.length > 0) {
      nextSpeaker = queueUserIds[0];
      nextQueue = queueUserIds.slice(1);
    }

    const roleLabel = ROLE_HIERARCHY[currentUser.role]?.label || currentUser.role;
    const eventText =
      reason === 'timeout'
        ? `⏱️ انتهى وقت المايك المحدد لرتبة «${roleLabel}» — نزل ${currentUser.username} من المايك تلقائياً`
        : `🎙️ سلّم المايك: ${currentUser.username}`;

    try {
      await updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: nextSpeaker,
        micSessionId: nextSpeaker ? createMicSessionId() : null,
        speakerStartedAtMs: nextSpeaker ? Date.now() : null,
        isMicTimerPaused: false,
        micPausedRemainingSec: null,
        micQueue: nextQueue,
      });

      void sendRoomMessageInDb(currentRoom.id, speakerUid, {
        senderId: speakerUid,
        senderName: currentUser.username || 'عضو ليالي',
        senderRole: currentUser.role || 'guest',
        senderAvatar: currentUser.avatar || DEFAULT_CROWN_AVATAR,
        senderFlag: currentUser.flag || '🇸🇦',
        content: eventText,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'mic_event',
      }).catch(msgErr => {
        console.warn('Mic release announcement skipped:', msgErr);
      });
    } catch (err) {
      console.error('Failed to release mic:', err);
    }
  }, [currentRoom, activeUid, queueUserIds, currentUser, speakerId, isMicTransitioning]);

  const handleJoinQueue = async () => {
    if (!currentRoom || queueUserIds.includes(currentUser.id)) return;
    webrtcAudioService.unlockAudioElement();
    requestMicWithDisclosure('حجز دور على المايك المباشر داخل الغرفة', () => {
      void updateRoomLiveStateInDb(currentRoom.id, {
        micQueue: [...queueUserIds, currentUser.id],
      });
    });
  };

  const handleLeaveQueue = async () => {
    if (!currentRoom) return;
    await updateRoomLiveStateInDb(currentRoom.id, {
      micQueue: queueUserIds.filter(id => id !== currentUser.id),
    });
  };

  // Send Real-Time Chat Message
  const handleSendMessage = async (text: string, color?: string, isBold?: boolean) => {
    if (!currentRoom) return;
    await sendRoomMessageInDb(currentRoom.id, activeUid, {
      senderId: activeUid,
      senderName: currentUser.username,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      senderFlag: currentUser.flag,
      content: text,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      color: color || currentUser.textColor,
      isBold: isBold || false,
      type: 'text',
    });
  };

  // Send Image in Chat
  const handleSendImage = async (imageUrl: string, caption?: string) => {
    if (!currentRoom) return;
    if (!isMuted) {
      soundEngine.playGiftChime();
    }
    await sendRoomMessageInDb(currentRoom.id, activeUid, {
      senderId: activeUid,
      senderName: currentUser.username,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      senderFlag: currentUser.flag,
      content: caption || 'صورة 📷',
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      type: 'image',
      imageUrl,
    });
  };

  // Global Broadcast Helper (Real-time alert bar + Public Events Log for ALL occupants)
  const emitGlobalRoomBroadcast = useCallback(
    async (params: {
      roomId?: string;
      category: RoomBroadcastCategory;
      title: string;
      message: string;
      actorName?: string;
      targetName?: string;
      logAction?: RoomLogAction;
      logTarget?: {
        id?: string;
        username?: string;
        role?: UserRole;
        flag?: string;
        avatar?: string;
        ipAddress?: string;
        deviceId?: string;
      };
      logDetails?: string;
      giftData?: RoomBroadcastGiftData;
      skipRoomDocUpdate?: boolean;
      skipRoomLog?: boolean;
      systemChatMessage?: string;
      systemChatSenderName?: string;
      systemChatSenderRole?: UserRole;
      systemChatSenderAvatar?: string;
      systemChatSenderFlag?: string;
      silentLocalBanner?: boolean;
    }) => {
      const targetRoomId = params.roomId || currentRoom?.id;
      if (!targetRoomId) return;
      const nowMs = Date.now();
      const eventId = sanitizeId(`bc_${nowMs}_${Math.random().toString(36).slice(2, 7)}`);
      const broadcastEvent: RoomBroadcastEvent = {
        id: eventId,
        category: params.category,
        title: params.title,
        message: params.message,
        actorName: params.actorName || currentUser.username || 'إدارة الروم',
        ...(params.targetName ? { targetName: params.targetName } : {}),
        ...(params.giftData ? { giftData: params.giftData } : {}),
        createdAtMs: nowMs,
      };

      seenBroadcastIdsRef.current.add(eventId);
      if (!params.silentLocalBanner && activeViewRef.current === 'room') {
        showNotice(params.message, params.title, params.category, params.category === 'gift');
      }

      const tasks: Promise<unknown>[] = [
        addRoomBroadcastInDb(targetRoomId, broadcastEvent).catch(err =>
          console.warn('Global broadcast subcollection skipped:', err)
        ),
      ];
      if (!params.skipRoomDocUpdate) {
        tasks.push(
          updateRoomLiveStateInDb(targetRoomId, { lastBroadcastEvent: broadcastEvent }).catch(err =>
            console.warn('Global broadcast room update skipped:', err)
          )
        );
      }
      if (!params.skipRoomLog && params.logAction) {
        const lt = params.logTarget;
        tasks.push(
          addRoomLogInDb(targetRoomId, {
            userId: lt?.id || activeUid,
            username: lt?.username || currentUser.username || 'عضو ليالي',
            userRole: normalizeUserRole(lt?.role || currentUser.role),
            userFlag: lt?.flag || currentUser.flag || '🌐',
            userAvatar: lt?.avatar,
            action: params.logAction,
            details: params.logDetails || params.message,
            ipAddress: lt?.ipAddress,
            deviceId: lt?.deviceId,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          }).catch(err => console.warn('Public room event log skipped:', err))
        );
      }
      if (params.systemChatMessage) {
        tasks.push(
          sendRoomMessageInDb(targetRoomId, activeUid, {
            senderId: 'system',
            senderName: params.systemChatSenderName || 'إدارة الروم',
            senderRole: params.systemChatSenderRole || currentUser.role,
            senderAvatar: params.systemChatSenderAvatar || currentUser.avatar || DEFAULT_CROWN_AVATAR,
            senderFlag: params.systemChatSenderFlag || currentUser.flag || '🇸🇦',
            content: params.systemChatMessage,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            type: 'system',
          }).catch(err => console.warn('System broadcast message skipped:', err))
        );
      }
      await Promise.all(tasks);
    },
    [currentRoom?.id, currentUser, activeUid, showNotice]
  );

  // Send Gift Handler (Global Broadcast to ALL occupants: overlay + alert bar + chat + public events log)
  const handleSendGift = async (gift: GiftItem, recipientId?: string, recipientName?: string) => {
    if (!currentRoom) return;

    const nextCoins = Math.max(0, currentUser.coins - gift.price);
    setCurrentUser(prev => ({ ...prev, coins: nextCoins }));
    const finalRecipient = recipientName || 'الروم العام 👑';

    setActiveGiftOverlay({
      gift,
      senderName: currentUser.username,
      recipientName: finalRecipient,
    });

    const giftBroadcastMsg = `أهدى ${currentUser.username} إلى ${finalRecipient} «${gift.name}» ${gift.icon}`;
    const ops: Promise<unknown>[] = [
      updateUserProfileInDb(activeUid, { coins: nextCoins }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: activeUid,
        senderName: currentUser.username,
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: `أهدى ${finalRecipient} ${gift.name} ${gift.icon}`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'gift',
        giftData: {
          giftId: gift.id,
          giftName: gift.name,
          icon: gift.icon,
          value: gift.price,
          targetUserName: finalRecipient,
        },
      }),
      emitGlobalRoomBroadcast({
        category: 'gift',
        title: 'هدية جديدة في الغرفة 🎁',
        message: giftBroadcastMsg,
        actorName: currentUser.username,
        targetName: finalRecipient,
        logAction: 'gift',
        logTarget: currentUser,
        logDetails: giftBroadcastMsg,
        giftData: {
          giftId: gift.id,
          giftName: gift.name,
          icon: gift.icon,
          value: gift.price,
          senderName: currentUser.username,
          recipientName: finalRecipient,
        },
      }),
    ];

    if (recipientId && recipientId !== activeUid) {
      const targetUser = roomUsers.find(u => u.id === recipientId);
      const nextGifts = (targetUser?.giftsReceivedCount || 0) + 1;
      ops.push(incrementUserGiftsReceivedInDb(recipientId, nextGifts));
      ops.push(
        updateRoomParticipantModeration(currentRoom.id, recipientId, {
          giftsReceivedCount: nextGifts,
        })
      );
    }

    await Promise.all(ops);
  };

  // Recharge Coins
  const handleRechargeCoins = async (amount: number) => {
    const nextCoins = currentUser.coins + amount;
    setCurrentUser(prev => ({ ...prev, coins: nextCoins }));
    await updateUserProfileInDb(currentUser.id, { coins: nextCoins });
  };

  // Select User from Chat: Quick Actions opens for all users (Ban/Kick remain strictly locked by rank & hierarchy)
  const handleSelectUser = (userId: string) => {
    const isStaff = isRoomAdminRole(currentUser.role);
    if (userId === currentUser.id) {
      if (isStaff && speakerId === currentUser.id) {
        setSelectedQuickUser(currentUser);
      } else {
        setIsProfileOpen(true);
      }
      return;
    }
    let target =
      roomUsers.find(u => u.id === userId) ||
      (speakerProfile?.id === userId ? speakerProfile : null) ||
      publicDirectory.find(u => u.id === userId) ||
      null;

    if (!target) {
      const msg = rawMessages.find(m => m.senderId === userId || m.senderUid === userId);
      if (msg && msg.senderId !== 'system') {
        target = {
          id: msg.senderId,
          username: msg.senderName,
          avatar: msg.senderAvatar || DEFAULT_CROWN_AVATAR,
          role: msg.senderRole || 'guest',
          countryCode: 'SA',
          flag: msg.senderFlag || '🇸🇦',
          level: 1,
          coins: 0,
          giftsReceivedCount: 0,
          textColor: '#94a3b8',
          mood: 'مستخدم في الروم',
        };
      }
    }

    if (target) {
      setSelectedQuickUser(target);
    }
  };

  // Select Speaker on MicStage: Quick Actions opens for all users (Ban/Kick remain strictly locked by rank & hierarchy)
  const handleSelectMicSpeaker = (userId: string) => {
    const isStaff = isRoomAdminRole(currentUser.role);
    if (userId === currentUser.id) {
      if (isStaff) {
        setSelectedQuickUser(currentUser);
      } else {
        setIsProfileOpen(true);
      }
      return;
    }
    const target =
      roomUsers.find(u => u.id === userId) ||
      (speakerProfile?.id === userId ? speakerProfile : null);
    if (target) {
      setSelectedQuickUser(target);
    }
  };

  // Log Supervisor / Master Administrative Actions to Reports
  const logSupervisorAction = useCallback(
    (
      actionType: SupervisorActionType,
      actionLabel: string,
      target?: { id?: string; username?: string },
      details?: string
    ) => {
      if (!currentRoom) return;
      void addSupervisorReportInDb(currentRoom.id, {
        actorUid: activeUid,
        actorName: currentUser.username || 'مشرف الروم',
        actorRole: currentUser.role,
        actionType,
        actionLabel,
        targetUid: target?.id,
        targetName: target?.username,
        details,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      }).catch(err => console.warn('Supervisor report log skipped:', err));
    },
    [currentRoom, activeUid, currentUser.username, currentUser.role]
  );

  // 1. Mute User (Hierarchy & Admin Role Enforced; General Master has absolute authority)
  const handleMuteUser = async (target: UserProfile) => {
    if (!currentRoom) return;
    const myRole = normalizeUserRole(currentUser.role);
    const isMaster = isMasterRole(myRole);
    const isSelfTarget = target.id === activeUid;
    if (
      !canModerateTarget(myRole, target.role, {
        isSelf: isSelfTarget,
        isGeneralMaster: isMaster,
      })
    ) {
      showNotice('⛔ لا تملك صلاحية كتم هذا المستخدم');
      return;
    }

    const nextMuted = !target.isMuted;
    const currentMutedIds = currentRoom.mutedUserIds || [];
    const nextMutedIds = nextMuted
      ? Array.from(new Set([...currentMutedIds, target.id]))
      : currentMutedIds.filter(id => id !== target.id);

    const muteMsg = nextMuted
      ? `🔇 قام المشرف [${currentUser.username}] بكتم العضو [${target.username}]`
      : `🔊 قام المشرف [${currentUser.username}] بإلغاء كتم العضو [${target.username}]`;

    await Promise.all([
      updateRoomParticipantModeration(currentRoom.id, target.id, { isMuted: nextMuted }),
      updateRoomLiveStateInDb(currentRoom.id, { mutedUserIds: nextMutedIds }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: myRole,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: muteMsg,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
      emitGlobalRoomBroadcast({
        category: nextMuted ? 'mute' : 'unmute',
        title: nextMuted ? 'كتم عضو في الغرفة' : 'إلغاء كتم عضو',
        message: muteMsg,
        actorName: currentUser.username,
        targetName: target.username,
        logAction: nextMuted ? 'mute' : 'unmute',
        logTarget: target,
        logDetails: `${nextMuted ? 'كتم' : 'إلغاء كتم'} بواسطة ${currentUser.username}`,
      }),
    ]);

    logSupervisorAction(
      nextMuted ? 'mute' : 'unmute',
      nextMuted ? 'كتم عضو' : 'إلغاء كتم عضو',
      target,
      nextMuted ? 'تم منع العضو من الكتابة والمايك' : 'تم السماح للعضو بالكتابة والمايك مجدداً'
    );
  };

  // 2. Ban User (with precise IP, Device, or Both scope + General Master absolute override + Hierarchy Check)
  const handleOpenBanModal = (target: UserProfile, initialType: BanType = 'both') => {
    const myRole = normalizeUserRole(currentUser.role);
    const isMaster = isMasterRole(myRole);
    const isSelfTarget = target.id === activeUid;
    if (!isMaster && !isRoomAdminRole(myRole)) {
      showNotice(
        myRole === 'guest'
          ? '⛔ مستخدم رتبة الزائر ممنوع تماماً من استخدام خيارات الحظر'
          : '⛔ خيارات الحظر مخصصة للرتب الإدارية داخل الروم فقط'
      );
      return;
    }
    if (isSelfTarget) {
      showNotice('⚠️ لا يمكنك حظر حسابك الشخصي من الغرفة');
      return;
    }
    if (
      !canModerateTarget(myRole, target.role, {
        isSelf: false,
        isGeneralMaster: isMaster,
      })
    ) {
      showNotice('⛔ لا يمكنك حظر مستخدم يساويك في الرتبة أو يعلوك في الصلاحيات');
      return;
    }
    setBanInitialType(initialType);
    setBanTargetUser(target);
  };

  const handleBanUser = async (target: UserProfile, banType: BanType, reason?: string) => {
    if (!currentRoom) return;
    const myRole = normalizeUserRole(currentUser.role);
    const isMaster = isMasterRole(myRole);
    const isSelfTarget = target.id === activeUid;
    if (!isMaster && !isRoomAdminRole(myRole)) {
      showNotice(
        myRole === 'guest'
          ? '⛔ مستخدم رتبة الزائر ممنوع تماماً من تنفيذ الحظر'
          : '⛔ الحظر مخصص للرتب الإدارية داخل الروم فقط'
      );
      return;
    }
    if (isSelfTarget) {
      showNotice('⚠️ لا يمكنك حظر حسابك الشخصي من الغرفة');
      return;
    }
    if (
      !canModerateTarget(myRole, target.role, {
        isSelf: false,
        isGeneralMaster: isMaster,
      })
    ) {
      showNotice('⛔ لا تملك صلاحية حظر هذا المستخدم (التسلسل الهرمي للصلاحيات)');
      return;
    }

    const ip = target.ipAddress || `185.${(target.username.length * 19) % 240}.50.12`;
    const deviceId = target.deviceId || `DEV-${target.id.slice(-6).toUpperCase()}`;
    const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const newBan: BannedUserEntry = {
      username: target.username,
      targetUid: target.id,
      ip,
      deviceId,
      banType,
      reason,
      bannedBy: currentUser.username,
      bannedAt: timeStr,
    };

    const scopeLabel =
      banType === 'ip'
        ? 'حظر آي بي (IP)'
        : banType === 'device'
        ? 'حظر جهاز (Device)'
        : 'حظر شامل (IP + جهاز)';
    const banLogAction: RoomLogAction =
      banType === 'ip' ? 'ban_ip' : banType === 'device' ? 'ban_device' : 'ban_both';
    const banBroadcastCat: RoomBroadcastCategory =
      banType === 'ip' ? 'ban_ip' : banType === 'device' ? 'ban_device' : 'ban_both';
    const banBroadcastId = sanitizeId(`bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const banBroadcastMsg = `🚫 تم تنفيذ [${scopeLabel}] بحق العضو [${target.username}] بواسطة [${currentUser.username}]${
      reason ? ` — السبب: ${reason}` : ''
    }`;
    const banBroadcastEvent: RoomBroadcastEvent = {
      id: banBroadcastId,
      category: banBroadcastCat,
      title: scopeLabel,
      message: banBroadcastMsg,
      actorName: currentUser.username,
      targetName: target.username,
      createdAtMs: Date.now(),
    };
    seenBroadcastIdsRef.current.add(banBroadcastId);
    showNotice(banBroadcastMsg, scopeLabel, banBroadcastCat);

    const nextQueue = queueUserIds.filter(id => id !== target.id);
    const nextSpeaker = speakerId === target.id ? nextQueue[0] || null : speakerId;
    const finalQueue = speakerId === target.id && nextQueue.length > 0 ? nextQueue.slice(1) : nextQueue;

    await Promise.all([
      addRoomBanInDb(currentRoom.id, activeUid, newBan),
      leaveRoomParticipant(currentRoom.id, target.id),
      addRoomBroadcastInDb(currentRoom.id, banBroadcastEvent).catch(err =>
        console.warn('Ban broadcast doc skipped:', err)
      ),
      updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: nextSpeaker,
        ...(speakerId === target.id
          ? {
              micSessionId: nextSpeaker ? createMicSessionId() : null,
              speakerStartedAtMs: nextSpeaker ? Date.now() : null,
              isMicTimerPaused: false,
              micPausedRemainingSec: null,
            }
          : {}),
        micQueue: finalQueue,
        occupantsCount: Math.max(0, roomUsers.length - 1),
        lastBroadcastEvent: banBroadcastEvent,
      }),
      addRoomLogInDb(currentRoom.id, {
        userId: target.id,
        username: target.username,
        userRole: target.role,
        userFlag: target.flag || '🇸🇦',
        userAvatar: target.avatar,
        action: banLogAction,
        details: `${scopeLabel} بواسطة ${currentUser.username}${reason ? ` — ${reason}` : ''}`,
        ipAddress: ip,
        deviceId,
        timestamp: timeStr,
      }).catch(err => console.warn('Ban room log skipped:', err)),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: banBroadcastMsg,
        timestamp: timeStr,
        type: 'system',
      }),
    ]);

    const actionType: SupervisorActionType =
      banType === 'ip' ? 'ban_ip' : banType === 'device' ? 'ban_device' : 'ban_both';
    logSupervisorAction(
      actionType,
      scopeLabel,
      target,
      `IP: ${ip} • Device: ${deviceId}${reason ? ` • السبب: ${reason}` : ''}`
    );
  };

  // 3. Kick User (Admin Ranks Only + General Master absolute override + Hierarchy Check + Instant Target Ejection + Global Broadcast)
  const handleKickUser = async (target: UserProfile) => {
    if (!currentRoom) return;
    const myRole = normalizeUserRole(currentUser.role);
    const isMaster = isMasterRole(myRole);
    const isSelfTarget = target.id === activeUid;
    if (!isMaster && !isRoomAdminRole(myRole)) {
      showNotice(
        myRole === 'guest'
          ? '⛔ مستخدم رتبة الزائر ممنوع تماماً من تنفيذ الطرد'
          : '⛔ الطرد مخصص للرتب الإدارية داخل الروم فقط'
      );
      return;
    }
    if (isSelfTarget) {
      showNotice('⚠️ لا يمكنك طرد حسابك الشخصي من الغرفة');
      return;
    }
    if (
      !canModerateTarget(myRole, target.role, {
        isSelf: false,
        isGeneralMaster: isMaster,
      })
    ) {
      showNotice('⛔ لا تملك صلاحية طرد هذا المستخدم (التسلسل الهرمي للصلاحيات)');
      return;
    }

    const timeStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    const nextQueue = queueUserIds.filter(id => id !== target.id);
    const nextSpeaker = speakerId === target.id ? nextQueue[0] || null : speakerId;
    const finalQueue = speakerId === target.id && nextQueue.length > 0 ? nextQueue.slice(1) : nextQueue;

    const kickBroadcastId = sanitizeId(`bc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const kickBroadcastMsg = `🥾 تم طرد العضو [${target.username}] من الغرفة بواسطة [${currentUser.username}]`;
    const kickBroadcastEvent: RoomBroadcastEvent = {
      id: kickBroadcastId,
      category: 'kick',
      title: 'طرد من الغرفة',
      message: kickBroadcastMsg,
      actorName: currentUser.username,
      targetName: target.username,
      createdAtMs: Date.now(),
    };
    seenBroadcastIdsRef.current.add(kickBroadcastId);
    showNotice(kickBroadcastMsg, 'طرد من الغرفة', 'kick');

    await Promise.all([
      leaveRoomParticipant(currentRoom.id, target.id),
      addRoomBroadcastInDb(currentRoom.id, kickBroadcastEvent).catch(err =>
        console.warn('Kick broadcast doc skipped:', err)
      ),
      updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: nextSpeaker,
        ...(speakerId === target.id
          ? {
              micSessionId: nextSpeaker ? createMicSessionId() : null,
              speakerStartedAtMs: nextSpeaker ? Date.now() : null,
              isMicTimerPaused: false,
              micPausedRemainingSec: null,
            }
          : {}),
        micQueue: finalQueue,
        occupantsCount: Math.max(0, roomUsers.length - 1),
        lastKickEvent: {
          targetUid: target.id,
          targetName: target.username,
          kickedBy: currentUser.username,
          kickedAtMs: Date.now(),
        },
        lastBroadcastEvent: kickBroadcastEvent,
      }),
      addRoomLogInDb(currentRoom.id, {
        userId: target.id,
        username: target.username,
        userRole: target.role,
        userFlag: target.flag || '🇸🇦',
        userAvatar: target.avatar,
        action: 'kicked',
        details: `طرد من الغرفة بواسطة ${currentUser.username}`,
        ipAddress: target.ipAddress,
        deviceId: target.deviceId,
        timestamp: timeStr,
      }).catch(err => console.warn('Kick room log skipped:', err)),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: kickBroadcastMsg,
        timestamp: timeStr,
        type: 'system',
      }),
    ]);

    logSupervisorAction('kick', 'طرد عضو من الغرفة', target);
  };

  // 4. Bind User (Admin Ranks + General Master absolute override + Hierarchy Enforced + Global Broadcast)
  const handleBindUser = async (target: UserProfile) => {
    if (!currentRoom) return;
    const myRole = normalizeUserRole(currentUser.role);
    const isMaster = isMasterRole(myRole);
    if (
      !canModerateTarget(myRole, target.role, {
        isSelf: target.id === activeUid,
        isGeneralMaster: isMaster,
      })
    ) {
      showNotice('⛔ لا تملك صلاحية ربط هذا المستخدم');
      return;
    }

    const nextBound = !target.isBound;
    const bindMsg = nextBound
      ? `🔗 تم ربط ومتابعة حساب العضو [${target.username}] بواسطة [${currentUser.username}]`
      : `⛓️ تم فك ربط حساب العضو [${target.username}] بواسطة [${currentUser.username}]`;

    await Promise.all([
      updateRoomParticipantModeration(currentRoom.id, target.id, { isBound: nextBound }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: bindMsg,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
      emitGlobalRoomBroadcast({
        category: nextBound ? 'bind' : 'unbind',
        title: nextBound ? 'ربط حساب عضو' : 'فك ربط حساب عضو',
        message: bindMsg,
        actorName: currentUser.username,
        targetName: target.username,
        logAction: nextBound ? 'bind' : 'unbind',
        logTarget: target,
        logDetails: `${nextBound ? 'ربط حساب' : 'فك ربط'} بواسطة ${currentUser.username}`,
      }),
    ]);

    logSupervisorAction(
      nextBound ? 'bind' : 'unbind',
      nextBound ? 'ربط ومتابعة عضو' : 'فك ربط عضو',
      target
    );
  };

  // Revoke Mic (سحب المايك - خاص بالرتب الإدارية)
  const handleRevokeMic = async (target: UserProfile) => {
    if (!currentRoom) return;
    if (!isRoomAdminRole(currentUser.role)) return;

    soundEngine.playWarningTone();
    const nextQueue = queueUserIds.filter(id => id !== target.id);
    let nextSpeaker = speakerId;
    let finalQueue = nextQueue;

    if (speakerId === target.id) {
      soundEngine.playMicTone(false);
      if (target.id === currentUser.id) {
        webrtcAudioService.stopLocalMic();
      }
      if (nextQueue.length > 0) {
        nextSpeaker = nextQueue[0];
        finalQueue = nextQueue.slice(1);
      } else {
        nextSpeaker = null;
      }
    }

    try {
      await updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: nextSpeaker,
        ...(speakerId === target.id
          ? {
              micSessionId: nextSpeaker ? createMicSessionId() : null,
              speakerStartedAtMs: nextSpeaker ? Date.now() : null,
              isMicTimerPaused: false,
              micPausedRemainingSec: null,
            }
          : {}),
        micQueue: finalQueue,
      });

      const revokeMsg = `🎙️ قام المشرف [${currentUser.username}] بسحب المايك من [${target.username}]`;
      void emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'تنبيه إداري: سحب المايك',
        message: revokeMsg,
        actorName: currentUser.username,
        targetName: target.username,
        logAction: 'admin',
        logTarget: target,
        logDetails: revokeMsg,
        systemChatMessage: revokeMsg,
      });

      logSupervisorAction('revoke_mic', 'سحب المايك من عضو', target);
    } catch (err) {
      console.error('Failed to revoke mic:', err);
      showNotice('تعذر سحب المايك، حاول مرة أخرى');
    }
  };

  // Renew current speaker's mic countdown back to full role duration
  const handleRenewMicTime = async (target: UserProfile) => {
    if (!currentRoom) return;
    const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);
    if (!isStaff) return;
    if (!speakerId) {
      showNotice('لا يوجد متحدث على المايك حالياً');
      return;
    }

    const activeSpeaker = speakerProfile || target;
    if (speakerId === currentUser.id) {
      lastMicAscendAtRef.current = Date.now();
    }
    soundEngine.playMessageChime();
    try {
      await updateRoomLiveStateInDb(currentRoom.id, {
        speakerStartedAtMs: Date.now(),
        isMicTimerPaused: false,
        micPausedRemainingSec: null,
      });

      const renewMsg = `🔄 قام المشرف [${currentUser.username}] بتجديد وقت المايك للمتحدث [${activeSpeaker.username}]`;
      void emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'تنبيه إداري: تجديد وقت المايك',
        message: renewMsg,
        actorName: currentUser.username,
        targetName: activeSpeaker.username,
        logAction: 'admin',
        logTarget: activeSpeaker,
        logDetails: renewMsg,
        systemChatMessage: renewMsg,
      });

      logSupervisorAction('renew_mic', 'تجديد وقت المايك', activeSpeaker);
    } catch (err) {
      console.error('Failed to renew mic time:', err);
      showNotice('تعذر تجديد وقت المايك');
    }
  };

  // Toggle freeze/pin mic countdown for current speaker
  const handleToggleFreezeMicTime = async (target: UserProfile) => {
    if (!currentRoom) return;
    const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);
    if (!isStaff) return;
    if (!speakerId) {
      showNotice('لا يوجد متحدث على المايك حالياً');
      return;
    }

    soundEngine.playMessageChime();
    const activeSpeaker = speakerProfile || target;
    const speakerDurationSec = getMicDurationForRole(currentRoom.micDurations, activeSpeaker.role);

    if (currentRoom.isMicTimerPaused) {
      const remaining = Math.max(
        1,
        Math.min(
          speakerDurationSec,
          typeof currentRoom.micPausedRemainingSec === 'number'
            ? currentRoom.micPausedRemainingSec
            : speakerDurationSec
        )
      );
      const resumedStartedAtMs = Date.now() - Math.max(0, speakerDurationSec - remaining) * 1000;
      if (speakerId === currentUser.id) {
        lastMicAscendAtRef.current = Date.now();
      }

      try {
        await updateRoomLiveStateInDb(currentRoom.id, {
          isMicTimerPaused: false,
          micPausedRemainingSec: null,
          speakerStartedAtMs: resumedStartedAtMs,
        });

        const resumeMsg = `▶️ قام المشرف [${currentUser.username}] بإلغاء تثبيت الوقت واستئناف العداد للمتحدث [${activeSpeaker.username}]`;
        void emitGlobalRoomBroadcast({
          category: 'admin',
          title: 'تنبيه إداري: استئناف العداد',
          message: resumeMsg,
          actorName: currentUser.username,
          targetName: activeSpeaker.username,
          logAction: 'admin',
          logTarget: activeSpeaker,
          logDetails: resumeMsg,
          systemChatMessage: resumeMsg,
        });

        logSupervisorAction('unfreeze_mic', 'إلغاء تثبيت وقت المايك', activeSpeaker);
      } catch (err) {
        console.error('Failed to resume mic timer:', err);
        showNotice('تعذر إلغاء تثبيت وقت المايك');
      }
      return;
    }

    const elapsedSec = currentRoom.speakerStartedAtMs
      ? Math.max(0, Math.floor((Date.now() - currentRoom.speakerStartedAtMs) / 1000))
      : 0;
    const remaining = Math.min(86400, Math.max(1, speakerDurationSec - elapsedSec));

    try {
      await updateRoomLiveStateInDb(currentRoom.id, {
        isMicTimerPaused: true,
        micPausedRemainingSec: remaining,
      });

      const freezeMsg = `📌 قام المشرف [${currentUser.username}] بتثبيت وقت المايك للمتحدث [${activeSpeaker.username}] (العداد متوقف)`;
      void emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'تنبيه إداري: تثبيت وقت المايك',
        message: freezeMsg,
        actorName: currentUser.username,
        targetName: activeSpeaker.username,
        logAction: 'admin',
        logTarget: activeSpeaker,
        logDetails: freezeMsg,
        systemChatMessage: freezeMsg,
      });

      logSupervisorAction('freeze_mic', 'تثبيت وقت المايك', activeSpeaker);
    } catch (err) {
      console.error('Failed to freeze mic timer:', err);
      showNotice('تعذر تثبيت وقت المايك');
    }
  };

  // Master Control Panel Handlers
  const handleAssignRankWithPin = async (credential: RoomCredential) => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    const hexColor = ROLE_HIERARCHY[credential.role]?.hex || '#94a3b8';

    await upsertRoomCredentialInDb(currentRoom.id, activeUid, credential);

    const matchingParticipants = roomUsers.filter(
      u => u.username.toLowerCase() === credential.username.toLowerCase()
    );
    const assignMsg = `👑 مبروك! قام ماستر الروم بتعيين رتبة «${ROLE_HIERARCHY[credential.role].label}» للعضو [${credential.username}] وتأمينها برمز سري محمي!`;
    await Promise.all([
      ...matchingParticipants.map(u =>
        updateRoomParticipantModeration(currentRoom.id, u.id, {
          role: credential.role,
          textColor: hexColor,
        })
      ),
      emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'ترقية وتعيين رتبة',
        message: assignMsg,
        actorName: currentUser.username,
        targetName: credential.username,
        logAction: 'admin',
        logTarget: {
          id: matchingParticipants[0]?.id || activeUid,
          username: credential.username,
          role: credential.role,
          flag: matchingParticipants[0]?.flag || currentRoom.flag,
        },
        logDetails: assignMsg,
        systemChatMessage: assignMsg,
        systemChatSenderName: 'ماستر الروم',
        systemChatSenderRole: 'owner',
        systemChatSenderAvatar: currentRoom.ownerAvatar,
        systemChatSenderFlag: currentRoom.flag,
      }),
    ]);

    logSupervisorAction(
      'assign_rank',
      `تعيين رتبة (${ROLE_HIERARCHY[credential.role].label})`,
      { username: credential.username },
      'تم تأمين الرتبة برمز سري'
    );
  };

  const handleRemoveCredential = async (username: string) => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    await deleteRoomCredentialInDb(currentRoom.id, username);
    const matching = roomUsers.filter(u => u.username.toLowerCase() === username.toLowerCase());
    const removeMsg = `⚖️ قام ماستر الروم بسحب الرتبة المحمية من [${username}]`;
    await Promise.all([
      ...matching.map(u =>
        updateRoomParticipantModeration(currentRoom.id, u.id, {
          role: 'guest',
          textColor: '#94a3b8',
        })
      ),
      emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'تنبيه إداري: سحب رتبة',
        message: removeMsg,
        actorName: currentUser.username,
        targetName: username,
        logAction: 'admin',
        logTarget: {
          id: matching[0]?.id || activeUid,
          username,
          role: 'guest',
          flag: matching[0]?.flag || currentRoom.flag,
        },
        logDetails: removeMsg,
        systemChatMessage: removeMsg,
        systemChatSenderName: 'ماستر الروم',
        systemChatSenderRole: 'owner',
        systemChatSenderAvatar: currentRoom.ownerAvatar,
        systemChatSenderFlag: currentRoom.flag,
      }),
    ]);
    logSupervisorAction('remove_rank', 'حذف رتبة محمية', { username });
  };

  const handleUnbanUser = async (
    banIdentifier: string,
    banEntry?: BannedUserEntry,
    targetUser?: UserProfile
  ) => {
    const myRole = normalizeUserRole(currentUser.role);
    const isMaster = isMasterRole(myRole);
    if (!currentRoom || (!isMaster && !isRoomAdminRole(myRole))) {
      showNotice('⛔ فك الحظر مخصص للرتب الإدارية فقط');
      return;
    }
    if (
      targetUser &&
      !canModerateTarget(myRole, targetUser.role, {
        isSelf: targetUser.id === activeUid,
        isGeneralMaster: isMaster,
      })
    ) {
      showNotice('⛔ لا تملك صلاحية فك الحظر عن مستخدم يساويك أو يعلوك رتبة');
      return;
    }
    await removeRoomBanInDb(currentRoom.id, banIdentifier);
    const targetName = banEntry?.username || banIdentifier;
    const unbanMsg = `✅ قام [${currentUser.username}] بفك الحظر عن العضو [${targetName}]`;
    logSupervisorAction(
      'unban',
      'فك الحظر عن مستخدم',
      { id: banEntry?.targetUid, username: targetName },
      banEntry?.ip ? `IP: ${banEntry.ip}` : undefined
    );
    void emitGlobalRoomBroadcast({
      category: 'unban',
      title: 'فك الحظر عن عضو',
      message: unbanMsg,
      actorName: currentUser.username,
      targetName,
      logAction: 'unbanned',
      logTarget: {
        id: banEntry?.targetUid || targetUser?.id || activeUid,
        username: targetName,
        role: targetUser?.role || 'guest',
        flag: targetUser?.flag || '🌐',
        ipAddress: banEntry?.ip,
        deviceId: banEntry?.deviceId,
      },
      logDetails: `فك الحظر بواسطة ${currentUser.username}`,
      systemChatMessage: unbanMsg,
    });
  };

  const handleUpdateReportsPermissions = async (
    allowedUsers: string[],
    allowedRoles: UserRole[]
  ) => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    await updateRoomReportsPermissionsInDb(currentRoom.id, allowedUsers, allowedRoles);
    const permMsg = `🛡️ قام ماستر الروم بتحديث صلاحيات الاطلاع على تقارير المشرفين`;
    void emitGlobalRoomBroadcast({
      category: 'admin',
      title: 'تنبيه إداري: صلاحيات التقارير',
      message: permMsg,
      actorName: currentUser.username,
      logAction: 'admin',
      logTarget: currentUser,
      logDetails: `رتب مسموح لها: ${allowedRoles.length} • أعضاء محددون: ${allowedUsers.length}`,
    });
    logSupervisorAction(
      'reports_permission',
      'تحديث صلاحيات الاطلاع على التقارير',
      undefined,
      `رتب مسموح لها: ${allowedRoles.length} • أعضاء محددون: ${allowedUsers.length}`
    );
  };

  const handleToggleMicLock = async () => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    const nextLocked = !currentRoom.isMicLocked;
    const lockMsg = nextLocked
      ? '🔒 قام ماستر الروم بقفل المايك للإدارة فقط'
      : '🔓 قام ماستر الروم بفتح المايك لجميع الأعضاء';
    await Promise.all([
      updateRoomLiveStateInDb(currentRoom.id, { isMicLocked: nextLocked }),
      emitGlobalRoomBroadcast({
        category: 'admin',
        title: nextLocked ? 'قفل المايك العام' : 'فتح المايك العام',
        message: lockMsg,
        actorName: currentUser.username,
        logAction: 'admin',
        logTarget: currentUser,
        logDetails: lockMsg,
        systemChatMessage: lockMsg,
        systemChatSenderName: 'ماستر الروم',
        systemChatSenderRole: 'owner',
        systemChatSenderAvatar: currentRoom.ownerAvatar,
        systemChatSenderFlag: currentRoom.flag,
      }),
    ]);

    logSupervisorAction(
      nextLocked ? 'lock_mic' : 'unlock_mic',
      nextLocked ? 'قفل المايك للإدارة فقط' : 'فتح المايك لجميع الأعضاء'
    );
  };

  // Clear Room Chat (from Master Panel)
  const handleClearRoomChat = async () => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    const clearMsg = '🧹 قام ماستر الروم بمسح رسائل الشات العام بنجاح';
    await clearRoomMessagesInDb(currentRoom.id, {
      senderUid: activeUid,
      senderName: 'ماستر الروم',
      senderRole: 'owner',
      senderAvatar: currentRoom.ownerAvatar,
      senderFlag: currentRoom.flag,
      content: clearMsg,
    });
    void emitGlobalRoomBroadcast({
      category: 'admin',
      title: 'تنبيه إداري: تنظيف الشات',
      message: clearMsg,
      actorName: currentUser.username,
      logAction: 'admin',
      logTarget: currentUser,
      logDetails: clearMsg,
    });
    logSupervisorAction('clear_chat', 'مسح شاشة المحادثة للجميع');
  };

  // Update per-role mic durations (from Master Panel)
  const handleUpdateMicDurations = async (micDurations: MicDurations) => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    const durMsg = '⏱️ قام ماستر الروم بتحديث أوقات المايك المحددة لكل رتبة في الغرفة';
    await Promise.all([
      updateRoomMicDurationsInDb(currentRoom.id, micDurations),
      emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'تنبيه إداري: أوقات المايك',
        message: durMsg,
        actorName: currentUser.username,
        logAction: 'admin',
        logTarget: currentUser,
        logDetails: durMsg,
        systemChatMessage: durMsg,
        systemChatSenderName: 'ماستر الروم',
        systemChatSenderRole: 'owner',
        systemChatSenderAvatar: currentRoom.ownerAvatar,
        systemChatSenderFlag: currentRoom.flag,
      }),
    ]);
  };

  // Clear My Chat Locally (مسح شاشتي فقط - متاح لجميع المستخدمين)
  const handleClearMyChat = () => {
    soundEngine.playMessageChime();
    setLocalClearedIds(new Set(rawMessages.map(m => m.id)));
  };

  // Clear Room Chat for Everyone (مسح شاشة الروم للكل - خاص بالرتب)
  const handleClearAllChat = async () => {
    if (!currentRoom) return;
    if (currentUser.role === 'guest') {
      showNotice('مسح شاشة الروم للكل مخصص لأصحاب الرتب فقط');
      return;
    }

    soundEngine.playMessageChime();
    const roleLabel = ROLE_HIERARCHY[currentUser.role]?.label || 'مشرف';
    const clearAllMsg = `🧹 قام [${currentUser.username}] (${roleLabel}) بمسح شاشة المحادثة لجميع المتواجدين في الروم`;
    await clearRoomMessagesInDb(currentRoom.id, {
      senderUid: activeUid,
      senderName: 'إدارة الروم',
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      senderFlag: currentUser.flag,
      content: clearAllMsg,
    });
    void emitGlobalRoomBroadcast({
      category: 'admin',
      title: 'تنبيه إداري: مسح المحادثة',
      message: clearAllMsg,
      actorName: currentUser.username,
      logAction: 'admin',
      logTarget: currentUser,
      logDetails: clearAllMsg,
    });
    logSupervisorAction('clear_chat', 'مسح شاشة المحادثة للجميع');
  };

  // Live Video Streaming Handlers
  const beginLiveStream = async () => {
    if (!currentRoom) return;
    let userCameraStream: MediaStream | null = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        userCameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: true,
        });
      } catch {
        try {
          userCameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
          });
        } catch (err) {
          console.warn('Physical camera unavailable:', err);
        }
      }
    }
    setLiveMediaStream(userCameraStream);

    soundEngine.playMicTone(true);
    const newStream: LiveVideoStream = {
      id: `stream-${Date.now()}`,
      roomId: currentRoom.id,
      broadcasterId: activeUid,
      broadcasterName: currentUser.username,
      broadcasterRole: currentUser.role,
      broadcasterAvatar: currentUser.avatar,
      broadcasterFlag: currentUser.flag,
      startedAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      viewersCount: Math.max(1, roomUsers.length),
      blockedUserIds: [],
      isCameraActive: true,
      isMuted: false,
    };

    const startStreamMsg = `🔴 بدأ العضو [${currentUser.username}] بثاً مباشراً بالفيديو الآن! 🎥`;
    await Promise.all([
      updateRoomLiveStateInDb(currentRoom.id, { activeVideoStream: newStream }),
      emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'بث مباشر بالفيديو 🎥',
        message: startStreamMsg,
        actorName: currentUser.username,
        logAction: 'admin',
        logTarget: currentUser,
        logDetails: startStreamMsg,
        systemChatMessage: startStreamMsg,
      }),
    ]);
  };

  const handleToggleLiveStream = async () => {
    if (!currentRoom) return;
    if (currentUser.role === 'guest') {
      showNotice('هذه الميزة مخصصة لأصحاب الرتب فقط');
      return;
    }

    if (activeVideoStream) {
      if (activeVideoStream.broadcasterId === currentUser.id) {
        await handleEndLiveStream();
      }
      return;
    }

    requestMicWithDisclosure('البث الصوتي والمرئي المباشر داخل الغرفة', () => {
      void beginLiveStream();
    });
  };

  const handleToggleBlockStreamUser = async (targetUserId: string) => {
    if (!currentRoom || !activeVideoStream || activeVideoStream.broadcasterId !== currentUser.id) return;
    const isBlocked = activeVideoStream.blockedUserIds.includes(targetUserId);
    const updatedBlocked = isBlocked
      ? activeVideoStream.blockedUserIds.filter(id => id !== targetUserId)
      : [...activeVideoStream.blockedUserIds, targetUserId];

    if (!isBlocked) soundEngine.playWarningTone();

    await updateRoomLiveStateInDb(currentRoom.id, {
      activeVideoStream: {
        ...activeVideoStream,
        blockedUserIds: updatedBlocked,
      },
    });
  };

  const handleToggleStreamCamera = async () => {
    if (!currentRoom || !activeVideoStream) return;
    await updateRoomLiveStateInDb(currentRoom.id, {
      activeVideoStream: {
        ...activeVideoStream,
        isCameraActive: !activeVideoStream.isCameraActive,
      },
    });
  };

  const handleToggleStreamMute = async () => {
    if (!currentRoom || !activeVideoStream) return;
    await updateRoomLiveStateInDb(currentRoom.id, {
      activeVideoStream: {
        ...activeVideoStream,
        isMuted: !activeVideoStream.isMuted,
      },
    });
  };

  const handleEndLiveStream = async () => {
    if (liveMediaStream) {
      liveMediaStream.getTracks().forEach(t => t.stop());
      setLiveMediaStream(null);
    }
    if (!currentRoom || !activeVideoStream) return;
    const broadcasterName = activeVideoStream.broadcasterName;
    soundEngine.playMicTone(false);

    const endStreamMsg = `⏹️ أنهى العضو [${broadcasterName}] البث المباشر بالفيديو`;
    await Promise.all([
      updateRoomLiveStateInDb(currentRoom.id, { activeVideoStream: null }),
      emitGlobalRoomBroadcast({
        category: 'admin',
        title: 'انتهاء البث المباشر 🎥',
        message: endStreamMsg,
        actorName: currentUser.username,
        logAction: 'admin',
        logTarget: currentUser,
        logDetails: endStreamMsg,
        systemChatMessage: endStreamMsg,
      }),
    ]);
  };

  // Send Real-Time Private Message (PM)
  const handleSendPrivateMessage = async (recipientId: string, content: string) => {
    const partner =
      roomUsers.find(u => u.id === recipientId) ||
      publicDirectory.find(u => u.id === recipientId) ||
      activePrivateChatUser;

    if (partner?.isPrivateChatLocked) {
      showNotice('هذا المستخدم قام بقفل الرسائل الخاصة حالياً');
      return;
    }

    await sendPrivateMessageInDb(activeUid, recipientId, content);
  };

  // Room CRUD (App Owner Panel -> Firestore, instant without Google/email auth)
  const handleCreateRoom = async (data: {
    name: string;
    category: Room['category'];
    countryName: string;
    flag: string;
    description: string;
    ownerName: string;
    masterPinCode: string;
    password?: string;
    validityDays: number;
    isGoldName: boolean;
    maxCapacity: number;
    roleQuotas: RoleQuotas;
  }): Promise<boolean | string> => {
    try {
      const created = await createRoomInDb(activeUid, data);
      setRooms(prev => {
        const merged = prev.some(r => r.id === created.id) ? prev : [created, ...prev];
        return [...merged].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      });
      soundEngine.playMessageChime();
      showNotice(`✅ تم إنشاء غرفة «${created.name}» وحفظها في قاعدة البيانات بنجاح`);
      return true;
    } catch (err) {
      console.error('Failed to create room in Firebase:', err);
      const rawMsg = err instanceof Error ? err.message : String(err);
      let parsedError = rawMsg;
      try {
        const parsed = JSON.parse(rawMsg) as { error?: string };
        if (parsed.error) parsedError = parsed.error;
      } catch {
        // Not JSON
      }

      let userMsg = 'تعذر إنشاء الغرفة وحفظها في قاعدة البيانات، يرجى المحاولة مرة أخرى';
      if (parsedError.includes('Quota exceeded')) {
        userMsg = 'تم تجاوز الحد اليومي المجاني لقاعدة البيانات، يرجى المحاولة غداً';
      } else if (parsedError.toLowerCase().includes('offline') || parsedError.toLowerCase().includes('network')) {
        userMsg = 'تعذر الاتصال بقاعدة البيانات، يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى';
      }
      showNotice(userMsg);
      return userMsg;
    }
  };

  const handleUpdateRoom = async (updatedRoom: Room) => {
    await updateRoomSettingsInDb(updatedRoom);
  };

  const handleDeleteRoom = async (roomId: string) => {
    await deleteRoomInDb(roomId);
    if (activeRoomId === roomId) {
      setActiveView('lobby');
    }
  };

  return (
    <SmartphoneWrapper>
      {activeView === 'lobby' || !currentRoom ? (
        /* Rooms Lobby View */
        <RoomListView
          rooms={rooms}
          currentUser={currentUser}
          onSelectRoom={handleSelectRoom}
          onCreateRoom={handleCreateRoom}
          onUpdateRoom={handleUpdateRoom}
          onDeleteRoom={handleDeleteRoom}
          onOpenProfile={() => setIsProfileOpen(true)}
        />
      ) : (
        /* Inside Layali Room View */
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#070a12] relative transition-colors duration-300">
          <RoomHeader
            room={currentRoom}
            currentUser={currentUser}
            canViewReports={canViewReports}
            onLeaveRoom={handleLeaveRoom}
            onOpenUsers={() => setIsUserListOpen(true)}
            onOpenPublicEvents={() => setIsPublicEventsOpen(true)}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onOpenMasterPanel={tab => {
              setMasterPanelInitialTab(tab || (currentUser.role === 'owner' ? 'ranks' : 'reports'));
              setIsMasterPanelOpen(true);
            }}
            onSendImage={handleSendImage}
            onRankWarning={showNotice}
            activeVideoStream={activeVideoStream}
            onToggleLiveStream={handleToggleLiveStream}
          />

          {activeVideoStream && (
            <LiveStreamView
              stream={activeVideoStream}
              currentUser={currentUser}
              roomUsers={roomUsers}
              streamMedia={liveMediaStream}
              onEndStream={handleEndLiveStream}
              onToggleBlockUser={handleToggleBlockStreamUser}
              onToggleCamera={handleToggleStreamCamera}
              onToggleMute={handleToggleStreamMute}
            />
          )}

          <MicStage
            room={currentRoom}
            currentUser={currentUser}
            speaker={speakerProfile}
            queueUsers={queueProfiles}
            onReleaseMic={handleReleaseMic}
            onSelectUser={handleSelectMicSpeaker}
            isMuted={isMuted}
            audioPlaybackBlocked={audioPlaybackBlocked}
            onUnlockRemoteAudio={() => void webrtcAudioService.resumeRemoteAudio()}
            micError={webrtcMicError}
            onRetryMic={() => void webrtcAudioService.acquireLocalMic()}
          />

          <ChatArea
            messages={visibleMessages}
            currentUser={currentUser}
            speaker={speakerProfile}
            queueUsers={queueProfiles}
            onTakeMic={() => {
              if (!currentRoom || isMicTransitioning) return;
              if (currentUser.isMuted) {
                showNotice('أنت مكتوم حالياً في هذه الغرفة ولا يمكنك الصعود للمايك');
                return;
              }
              const isStaff = isRoomAdminRole(currentUser.role);
              if (currentRoom.isMicLocked && !isStaff) {
                showNotice('🔒 المايك مقفل حالياً ومخصص للإدارة فقط');
                return;
              }
              if (speakerId && speakerId !== activeUid) return;
              requestMicWithDisclosure('التحدث عبر المايك المباشر داخل الغرفة', () => {
                void executeTakeMic();
              });
            }}
            onReleaseMic={handleReleaseMic}
            onJoinQueue={handleJoinQueue}
            onLeaveQueue={handleLeaveQueue}
            isMicLocked={Boolean(currentRoom.isMicLocked)}
            isMicTransitioning={isMicTransitioning}
            onSendMessage={handleSendMessage}
            onOpenGifts={() => setIsGiftModalOpen(true)}
            onSelectUser={handleSelectUser}
            isMuted={isMuted}
            onClearMyChat={handleClearMyChat}
            onClearAllChat={handleClearAllChat}
            onRankWarning={showNotice}
          />

          {isGiftModalOpen && (
            <GiftModal
              currentUser={currentUser}
              speaker={speakerProfile}
              users={roomUsers}
              onClose={() => setIsGiftModalOpen(false)}
              onSendGift={handleSendGift}
              onRechargeCoins={handleRechargeCoins}
              isMuted={isMuted}
            />
          )}

          {isUserListOpen && (
            <UserListModal
              users={roomUsers}
              currentUser={currentUser}
              speakerId={speakerId}
              queueUserIds={queueUserIds}
              bannedUsers={roomBans}
              onClose={() => setIsUserListOpen(false)}
              onOpenPrivateChat={handleAttemptPrivateChat}
              onSendGiftToUser={() => setIsGiftModalOpen(true)}
              onGiveMicToUser={
                isRoomAdminRole(currentUser.role)
                  ? async user => {
                      const giveMicMsg = `🎙️ قام المشرف [${currentUser.username}] بتسليم المايك إلى [${user.username}]`;
                      await Promise.all([
                        updateRoomLiveStateInDb(currentRoom.id, {
                          activeSpeakerId: user.id,
                          micSessionId: createMicSessionId(),
                          speakerStartedAtMs: Date.now(),
                          isMicTimerPaused: false,
                          micPausedRemainingSec: null,
                          micQueue: queueUserIds.filter(id => id !== user.id),
                        }),
                        emitGlobalRoomBroadcast({
                          category: 'admin',
                          title: 'تنبيه إداري: تسليم المايك',
                          message: giveMicMsg,
                          actorName: currentUser.username,
                          targetName: user.username,
                          logAction: 'admin',
                          logTarget: user,
                          logDetails: giveMicMsg,
                          systemChatMessage: giveMicMsg,
                        }),
                      ]);
                      logSupervisorAction('give_mic', 'تسليم المايك لعضو', user);
                    }
                  : undefined
              }
              onOpenQuickActions={user => setSelectedQuickUser(user)}
              onBanUser={isRoomAdminRole(currentUser.role) ? handleOpenBanModal : undefined}
              onUnbanUser={
                isRoomAdminRole(currentUser.role)
                  ? (banEntry, target) => void handleUnbanUser(banEntry.id || banEntry.ip, banEntry, target)
                  : undefined
              }
              onKickUser={
                isRoomAdminRole(currentUser.role) ? user => void handleKickUser(user) : undefined
              }
            />
          )}

          {isPublicEventsOpen && (
            <PublicRoomEventsModal
              roomName={currentRoom.name}
              currentUser={currentUser}
              roomLogs={roomLogs}
              onClose={() => setIsPublicEventsOpen(false)}
            />
          )}

          {isMasterPanelOpen && (isMasterRole(currentUser.role) || canViewReports) && (
            <MasterControlPanelModal
              room={currentRoom}
              roomUsers={roomUsers}
              isOwner={isMasterRole(currentUser.role)}
              initialTab={masterPanelInitialTab}
              roomLogs={roomLogs}
              supervisorReports={supervisorReports}
              onClose={() => setIsMasterPanelOpen(false)}
              onAssignRankWithPin={handleAssignRankWithPin}
              onRemoveCredential={handleRemoveCredential}
              onUnbanUser={handleUnbanUser}
              onToggleMicLock={handleToggleMicLock}
              onClearRoomChat={handleClearRoomChat}
              onUpdateMicDurations={handleUpdateMicDurations}
              onUpdateReportsPermissions={handleUpdateReportsPermissions}
            />
          )}

          {selectedQuickUser && (
            <UserQuickActionsMenu
              targetUser={selectedQuickUser}
              currentUser={currentUser}
              isGeneralMaster={isMasterRole(currentUser.role)}
              activeBanEntry={roomBans.find(b => doesBanMatchUser(b, selectedQuickUser)) || null}
              onClose={() => setSelectedQuickUser(null)}
              onMute={handleMuteUser}
              onBan={handleOpenBanModal}
              onUnban={(banEntry, target) => void handleUnbanUser(banEntry.id || banEntry.ip, banEntry, target)}
              onKick={handleKickUser}
              onBind={handleBindUser}
              onSendGift={() => setIsGiftModalOpen(true)}
              onOpenPrivateChat={handleAttemptPrivateChat}
              onRevokeMic={handleRevokeMic}
              speakerId={speakerId}
              isMicTimerPaused={Boolean(currentRoom.isMicTimerPaused)}
              onRenewMicTime={handleRenewMicTime}
              onToggleFreezeMicTime={handleToggleFreezeMicTime}
              onClearMyChat={handleClearMyChat}
              onClearAllChat={handleClearAllChat}
              isTargetBlocked={blockedUserIds.includes(selectedQuickUser.id)}
              onToggleBlockUser={handleToggleBlockUser}
              onReportUser={handleReportUser}
            />
          )}

          {banTargetUser &&
            banTargetUser.id !== activeUid &&
            canModerateTarget(currentUser.role, banTargetUser.role, {
              isSelf: false,
              isGeneralMaster: isMasterRole(currentUser.role),
            }) && (
              <BanUserModal
                targetUser={banTargetUser}
                initialBanType={banInitialType}
                onClose={() => setBanTargetUser(null)}
                onConfirmBan={handleBanUser}
              />
            )}

          {isPrivateChatOpen && (
            <PrivateChatDrawer
              currentUser={currentUser}
              activeChatUser={activePrivateChatUser}
              conversations={privateConversations}
              onClose={() => setIsPrivateChatOpen(false)}
              onSelectChatUser={user => setActivePrivateChatUser(user)}
              onSendMessage={handleSendPrivateMessage}
              isMuted={isMuted}
            />
          )}

          {activeGiftOverlay && (
            <GiftOverlay
              gift={activeGiftOverlay.gift}
              senderName={activeGiftOverlay.senderName}
              recipientName={activeGiftOverlay.recipientName}
              onFinished={() => setActiveGiftOverlay(null)}
            />
          )}
        </div>
      )}

      {pendingEntranceRoom && (
        <PreRoomEntranceModal
          room={pendingEntranceRoom}
          currentUser={currentUser}
          onClose={() => setPendingEntranceRoom(null)}
          onConfirmEntrance={handleConfirmEntrance}
        />
      )}

      {isProfileOpen && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setIsProfileOpen(false)}
          onUpdateProfile={async updated => {
            if (updated.isSoundEffectsMuted !== undefined) {
              soundEngine.setEffectsMuted(Boolean(updated.isSoundEffectsMuted));
            }
            let effectiveUpdate: Partial<UserProfile> = { ...updated };
            if (activeView === 'room' && currentRoom && updated.username !== undefined) {
              const reverified = verifyRoomEntranceRole(
                currentRoom,
                updated.username,
                currentUser.pinCode
              );
              if (currentUser.role === 'owner' && !reverified.isMasterMatch) {
                const fallbackRole =
                  reverified.verified && reverified.role !== 'guest' ? reverified.role : 'guest';
                effectiveUpdate = {
                  ...effectiveUpdate,
                  role: fallbackRole,
                  textColor: ROLE_HIERARCHY[fallbackRole]?.hex || '#94a3b8',
                  ...(fallbackRole === 'guest' ? { pinCode: undefined } : {}),
                };
                showNotice('⚠️ تم إلغاء صلاحية الماستر لأن الاسم الجديد لا يتطابق مع اسم ماستر الغرفة المحفوظ');
              }
            }
            const nextUserState: UserProfile = { ...currentUser, ...effectiveUpdate };
            setCurrentUser(nextUserState);
            await updateUserProfileInDb(activeUid, effectiveUpdate);
            const hasRoomVisibleProfileChange = Object.keys(effectiveUpdate).some(
              key => key !== 'isSoundEffectsMuted'
            );
            if (hasRoomVisibleProfileChange && activeView === 'room' && currentRoom) {
              await joinRoomAsParticipant(
                currentRoom.id,
                nextUserState,
                Boolean(nextUserState.isMuted)
              );
            }
          }}
          onRechargeCoins={handleRechargeCoins}
        />
      )}

      {micDisclosurePrompt && (
        <MicPermissionModal
          purposeLabel={micDisclosurePrompt.purposeLabel}
          onCancel={() => setMicDisclosurePrompt(null)}
          onConfirm={() => {
            markMicDisclosureAccepted();
            const proceed = micDisclosurePrompt.onGranted;
            setMicDisclosurePrompt(null);
            proceed();
          }}
        />
      )}

      <OfflineIndicator />

      {noticeBanner && (
        <div
          className={`fixed top-12 left-3 right-3 z-50 flex items-center justify-center p-3.5 bg-gradient-to-r rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-200 text-right transition-colors duration-300 border-2 ${
            noticeBanner.category === 'gift'
              ? 'from-pink-50 via-white to-amber-50 dark:from-pink-950/95 dark:via-slate-900 dark:to-amber-950/95 border-pink-400 dark:border-pink-500/80'
              : noticeBanner.category === 'enter' || noticeBanner.category === 'unban' || noticeBanner.category === 'unmute'
              ? 'from-emerald-50 via-white to-teal-50 dark:from-emerald-950/95 dark:via-slate-900 dark:to-teal-950/95 border-emerald-400 dark:border-emerald-500/80'
              : noticeBanner.category === 'bind' || noticeBanner.category === 'unbind'
              ? 'from-indigo-50 via-white to-purple-50 dark:from-indigo-950/95 dark:via-slate-900 dark:to-purple-950/95 border-indigo-400 dark:border-indigo-500/80'
              : noticeBanner.category === 'admin'
              ? 'from-amber-50 via-white to-yellow-50 dark:from-amber-950/95 dark:via-slate-900 dark:to-yellow-950/95 border-amber-400 dark:border-amber-500/80'
              : noticeBanner.category === 'leave'
              ? 'from-slate-100 via-white to-slate-100 dark:from-slate-800/95 dark:via-slate-900 dark:to-slate-800/95 border-slate-300 dark:border-slate-600'
              : 'from-red-50 via-white to-red-50 dark:from-red-950/95 dark:via-slate-900 dark:to-red-950/95 border-red-400 dark:border-red-500/80'
          } text-slate-900 dark:text-white`}
        >
          <div className="flex items-center gap-3 w-full">
            <div
              className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-md ${
                noticeBanner.category === 'gift'
                  ? 'bg-pink-100 dark:bg-pink-600/30 border-pink-300 dark:border-pink-500/50 text-pink-600 dark:text-pink-300'
                  : noticeBanner.category === 'enter' || noticeBanner.category === 'unban' || noticeBanner.category === 'unmute'
                  ? 'bg-emerald-100 dark:bg-emerald-600/30 border-emerald-300 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-300'
                  : noticeBanner.category === 'bind' || noticeBanner.category === 'unbind'
                  ? 'bg-indigo-100 dark:bg-indigo-600/30 border-indigo-300 dark:border-indigo-500/50 text-indigo-600 dark:text-indigo-300'
                  : noticeBanner.category === 'admin'
                  ? 'bg-amber-100 dark:bg-amber-600/30 border-amber-300 dark:border-amber-500/50 text-amber-600 dark:text-amber-300'
                  : noticeBanner.category === 'leave'
                  ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                  : 'bg-red-100 dark:bg-red-600/30 border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400'
              }`}
            >
              {noticeBanner.category === 'gift' ? (
                <Gift size={20} className="animate-bounce" />
              ) : noticeBanner.category === 'enter' ? (
                <LogIn size={20} />
              ) : noticeBanner.category === 'leave' ? (
                <LogOut size={20} />
              ) : noticeBanner.category === 'bind' ? (
                <Link2 size={20} />
              ) : noticeBanner.category === 'unbind' ? (
                <Unlink size={20} />
              ) : noticeBanner.category === 'unban' ? (
                <ShieldCheck size={20} />
              ) : noticeBanner.category === 'kick' ? (
                <UserX size={20} />
              ) : noticeBanner.category === 'mute' ? (
                <VolumeX size={20} />
              ) : noticeBanner.category === 'unmute' ? (
                <Volume2 size={20} />
              ) : noticeBanner.category === 'admin' ? (
                <ShieldAlert size={20} />
              ) : noticeBanner.category === 'ban' ||
                noticeBanner.category === 'ban_ip' ||
                noticeBanner.category === 'ban_device' ||
                noticeBanner.category === 'ban_both' ? (
                <Ban size={20} className="animate-pulse" />
              ) : (
                <BellRing size={20} className="animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-slate-800 dark:text-amber-300">
                {noticeBanner.title}
              </h4>
              <p className="text-xs text-slate-900 dark:text-white font-bold mt-0.5 leading-snug">
                {noticeBanner.message}
              </p>
            </div>
            <button
              onClick={() => setNoticeBanner(null)}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 text-sm rounded-lg hover:bg-black/5 dark:hover:bg-white/10 shrink-0 transition-colors"
              title="إغلاق التنبيه"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </SmartphoneWrapper>
  );
}
