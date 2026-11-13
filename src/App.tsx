/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Lock } from 'lucide-react';
import { testFirestoreConnection } from './firebase';
import {
  addRoomBanInDb,
  cleanupLegacyDemoRooms,
  clearRoomMessagesInDb,
  createRoomInDb,
  deactivateExpiredRoomInDb,
  deleteRoomCredentialInDb,
  deleteRoomInDb,
  ensureUserProfile,
  fetchRoomBansOnce,
  fetchRoomCredentialsOnce,
  fetchRoomMessageTimestamp,
  getMicDurationForRole,
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
  subscribeRoomCredentials,
  subscribeRoomMessages,
  subscribeRoomParticipants,
  subscribeRooms,
  subscribeUserProfile,
  updateRoomLiveStateInDb,
  updateRoomMicDurationsInDb,
  updateRoomParticipantModeration,
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
import { MasterControlPanelModal } from './components/MasterControlPanelModal';
import { LiveStreamView } from './components/LiveStreamView';
import { MicPermissionModal } from './components/MicPermissionModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  ChatMessage,
  GiftItem,
  MicDurations,
  PrivateMessage,
  Room,
  UserProfile,
  UserRole,
  ROLE_HIERARCHY,
  RoomCredential,
  BannedUserEntry,
  RoleQuotas,
  LiveVideoStream,
} from './types/loqana';
import { DEFAULT_CROWN_AVATAR } from './data/mockLoqanaData';
import { soundEngine } from './services/soundEngine';

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
    };
  });

  // Lobby & Rooms State (real-time from Firestore)
  const [activeView, setActiveView] = useState<'lobby' | 'room'>('lobby');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [publicDirectory, setPublicDirectory] = useState<UserProfile[]>([]);

  // Active Room Subcollections (real-time from Firestore)
  const [roomUsers, setRoomUsers] = useState<UserProfile[]>([]);
  const [roomCredentials, setRoomCredentials] = useState<RoomCredential[]>([]);
  const [roomBans, setRoomBans] = useState<BannedUserEntry[]>([]);
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
  const [isMasterPanelOpen, setIsMasterPanelOpen] = useState(false);
  const [noticeBanner, setNoticeBanner] = useState<string | null>(null);
  const [isMicTransitioning, setIsMicTransitioning] = useState(false);
  const lastMicAscendAtRef = useRef<number>(0);
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

  const showNotice = useCallback((msg: string) => {
    setNoticeBanner(msg);
    soundEngine.playWarningTone();
    setTimeout(() => setNoticeBanner(null), 3800);
  }, []);

  // Keep global SoundEngine effects mute state synced with user's Profile preference across all rooms
  useEffect(() => {
    soundEngine.setEffectsMuted(Boolean(currentUser.isSoundEffectsMuted));
  }, [currentUser.isSoundEffectsMuted]);

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
      setCurrentUser(prev => ({ ...prev, ...updates }));
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

  // 3. Active Room Firestore subscriptions
  useEffect(() => {
    if (activeView !== 'room' || !activeRoomId) return;

    const myUid = currentUser.id || localClientUid;
    const unsubParticipants = subscribeRoomParticipants(activeRoomId, participants => {
      setRoomUsers(participants);
      const myRecord = participants.find(p => p.id === myUid);
      if (myRecord) {
        setCurrentUser(prev => ({
          ...prev,
          id: myUid,
          isMuted: myRecord.isMuted,
          isBound: myRecord.isBound,
          role: myRecord.role,
          textColor: myRecord.textColor,
        }));
      }
    });
    const unsubCreds = subscribeRoomCredentials(activeRoomId, creds => {
      setRoomCredentials(creds);
    });
    const unsubBans = subscribeRoomBans(activeRoomId, bans => {
      setRoomBans(bans);
    });
    const unsubMsgs = roomEntryTimestamp
      ? subscribeRoomMessages(
          activeRoomId,
          msgs => {
            setRawMessages(msgs);
          },
          roomEntryTimestamp
        )
      : () => {};

    return () => {
      unsubParticipants();
      unsubCreds();
      unsubBans();
      unsubMsgs();
    };
  }, [activeView, activeRoomId, currentUser.id, localClientUid, roomEntryTimestamp]);

  // 4. Enforce kick/ban if current user gets banned while inside a room
  useEffect(() => {
    if (activeView !== 'room' || !currentUser.id) return;
    const isBannedNow = roomBans.some(
      b =>
        b.targetUid === currentUser.id ||
        b.username.toLowerCase() === currentUser.username.toLowerCase()
    );
    if (isBannedNow) {
      if (liveMediaStream) {
        liveMediaStream.getTracks().forEach(t => t.stop());
        setLiveMediaStream(null);
      }
      setActiveView('lobby');
      setRoomEntryTimestamp(null);
      setRawMessages([]);
      showNotice('🚫 تم حظرك من هذه الغرفة من قِبل الإدارة.');
    }
  }, [activeView, roomBans, currentUser.id, currentUser.username, liveMediaStream, showNotice]);

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

  // Derived active room merged with real-time subcollection data
  const baseCurrentRoom = useMemo(
    () => rooms.find(r => r.id === activeRoomId) || rooms[0],
    [rooms, activeRoomId]
  );

  const currentRoom: Room | undefined = useMemo(() => {
    if (!baseCurrentRoom) return undefined;
    return {
      ...baseCurrentRoom,
      userCredentials: roomCredentials,
      bannedUsers: roomBans,
    };
  }, [baseCurrentRoom, roomCredentials, roomBans]);

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
      const isBanned = bans.some(
        b =>
          b.targetUid === currentUser.id ||
          b.username.toLowerCase() === currentUser.username.toLowerCase()
      );
      if (isBanned) {
        showNotice('أنت محظور من دخول هذه الغرفة من قبل الإدارة.');
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
    const verifiedRole: UserRole = verification.role;
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

    setCurrentUser(updatedUser);
    setLocalClearedIds(new Set());
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

    setActiveRoomId(room.id);
    setActiveView('room');

    void updateUserProfileInDb(uid, {
      username: cleanEntranceName,
      textColor: roleColor,
    }).catch(err => console.warn('Profile sync skipped:', err));

    void updateRoomLiveStateInDb(room.id, {
      occupantsCount: Math.max(1, (room.occupantsCount || 0) + 1),
    }).catch(err => console.warn('Occupants sync skipped:', err));

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
      setRoomEntryTimestamp(serverTs ?? Timestamp.now());
    } catch (err) {
      console.warn('Welcome message skipped:', err);
      setRoomEntryTimestamp(Timestamp.now());
    }
  };

  // Leave room to lobby
  const handleLeaveRoom = async () => {
    if (!currentRoom) {
      setActiveView('lobby');
      return;
    }

    const roomId = currentRoom.id;
    const patch: {
      activeSpeakerId?: string | null;
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
        patch.speakerStartedAtMs = Date.now();
        patch.micQueue = queueUserIds.slice(1);
      } else {
        patch.activeSpeakerId = null;
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

    setActiveView('lobby');
    setRoomEntryTimestamp(null);
    setRoomUsers([]);
    setRawMessages([]);
    setLocalClearedIds(new Set());

    await Promise.all([
      updateRoomLiveStateInDb(roomId, patch),
      leaveRoomParticipant(roomId, activeUid),
    ]);
  };

  // Take Mic Handler (with prominent microphone permission disclosure before getUserMedia)
  const executeTakeMic = async () => {
    if (!currentRoom || isMicTransitioning) return;
    const speakerUid = activeUid;

    if (currentUser.isMuted) {
      showNotice('أنت مكتوم حالياً في هذه الغرفة ولا يمكنك الصعود للمايك');
      return;
    }
    const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);
    if (currentRoom.isMicLocked && !isStaff) {
      showNotice('🔒 المايك مقفل حالياً ومخصص للإدارة فقط');
      return;
    }
    if (speakerId && speakerId !== speakerUid) return;

    setIsMicTransitioning(true);
    lastMicAscendAtRef.current = Date.now();
    soundEngine.playMicTone(true);
    void soundEngine.startMicrophone().catch(() => false);
    const nextQueue = queueUserIds.filter(id => id !== speakerUid);

    try {
      await updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: speakerUid,
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
      soundEngine.stopMicrophone();
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
    soundEngine.stopMicrophone();

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
    await updateRoomLiveStateInDb(currentRoom.id, {
      micQueue: [...queueUserIds, currentUser.id],
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

  // Send Recorded Voice Note
  const handleSendVoiceClip = async (url: string, duration: number) => {
    if (!currentRoom) return;
    await sendRoomMessageInDb(currentRoom.id, activeUid, {
      senderId: activeUid,
      senderName: currentUser.username,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      senderFlag: currentUser.flag,
      content: 'رسالة صوتية 🎙️',
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      type: 'voice_clip',
      voiceClipUrl: url,
      voiceDuration: duration,
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

  // Send Gift Handler
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

  // Select User from Chat opens Quick Actions Menu (self opens Profile unless staff is currently speaking)
  const handleSelectUser = (userId: string) => {
    const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);
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

  // Select Speaker on MicStage opens Quick Actions Menu (allows staff to control mic time even when solo)
  const handleSelectMicSpeaker = (userId: string) => {
    const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);
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

  // 1. Mute User
  const handleMuteUser = async (target: UserProfile) => {
    if (!currentRoom) return;
    const nextMuted = !target.isMuted;
    const currentMutedIds = currentRoom.mutedUserIds || [];
    const nextMutedIds = nextMuted
      ? Array.from(new Set([...currentMutedIds, target.id]))
      : currentMutedIds.filter(id => id !== target.id);

    await Promise.all([
      updateRoomParticipantModeration(currentRoom.id, target.id, { isMuted: nextMuted }),
      updateRoomLiveStateInDb(currentRoom.id, { mutedUserIds: nextMutedIds }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: nextMuted
          ? `🔇 قام المشرف [${currentUser.username}] بكتم العضو [${target.username}]`
          : `🔊 قام المشرف [${currentUser.username}] بإلغاء كتم العضو [${target.username}]`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
    ]);
  };

  // 2. Ban User
  const handleBanUser = async (target: UserProfile) => {
    if (!currentRoom) return;
    const ip = target.ipAddress || `185.${(target.username.length * 19) % 240}.50.12`;
    const deviceId = target.deviceId || `DEV-${target.id.slice(-6).toUpperCase()}`;
    const newBan: BannedUserEntry = {
      username: target.username,
      targetUid: target.id,
      ip,
      deviceId,
      bannedBy: currentUser.username,
      bannedAt: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextQueue = queueUserIds.filter(id => id !== target.id);
    const nextSpeaker = speakerId === target.id ? nextQueue[0] || null : speakerId;
    const finalQueue = speakerId === target.id && nextQueue.length > 0 ? nextQueue.slice(1) : nextQueue;

    await Promise.all([
      addRoomBanInDb(currentRoom.id, activeUid, newBan),
      leaveRoomParticipant(currentRoom.id, target.id),
      updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: nextSpeaker,
        ...(speakerId === target.id
          ? {
              speakerStartedAtMs: nextSpeaker ? Date.now() : null,
              isMicTimerPaused: false,
              micPausedRemainingSec: null,
            }
          : {}),
        micQueue: finalQueue,
        occupantsCount: Math.max(0, roomUsers.length - 1),
      }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: `🚫 تم حظر العضو [${target.username}] نهائياً بواسطة [${currentUser.username}]`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
    ]);
  };

  // 3. Kick User
  const handleKickUser = async (target: UserProfile) => {
    if (!currentRoom) return;
    const nextQueue = queueUserIds.filter(id => id !== target.id);
    const nextSpeaker = speakerId === target.id ? nextQueue[0] || null : speakerId;
    const finalQueue = speakerId === target.id && nextQueue.length > 0 ? nextQueue.slice(1) : nextQueue;

    await Promise.all([
      leaveRoomParticipant(currentRoom.id, target.id),
      updateRoomLiveStateInDb(currentRoom.id, {
        activeSpeakerId: nextSpeaker,
        ...(speakerId === target.id
          ? {
              speakerStartedAtMs: nextSpeaker ? Date.now() : null,
              isMicTimerPaused: false,
              micPausedRemainingSec: null,
            }
          : {}),
        micQueue: finalQueue,
        occupantsCount: Math.max(0, roomUsers.length - 1),
      }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: `👢 تم طرد العضو [${target.username}] من الغرفة بواسطة [${currentUser.username}]`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
    ]);
  };

  // 4. Bind User
  const handleBindUser = async (target: UserProfile) => {
    if (!currentRoom) return;
    const nextBound = !target.isBound;
    await Promise.all([
      updateRoomParticipantModeration(currentRoom.id, target.id, { isBound: nextBound }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: nextBound
          ? `🔗 تم ربط ومتابعة حركة العضو [${target.username}] بواسطة [${currentUser.username}]`
          : `⛓️ تم فك ربط العضو [${target.username}] بواسطة [${currentUser.username}]`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
    ]);
  };

  // Revoke Mic (سحب المايك - خاص بالرتب الإدارية)
  const handleRevokeMic = async (target: UserProfile) => {
    if (!currentRoom) return;
    const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);
    if (!isStaff) return;

    soundEngine.playWarningTone();
    const nextQueue = queueUserIds.filter(id => id !== target.id);
    let nextSpeaker = speakerId;
    let finalQueue = nextQueue;

    if (speakerId === target.id) {
      soundEngine.playMicTone(false);
      if (target.id === currentUser.id) {
        soundEngine.stopMicrophone();
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
              speakerStartedAtMs: nextSpeaker ? Date.now() : null,
              isMicTimerPaused: false,
              micPausedRemainingSec: null,
            }
          : {}),
        micQueue: finalQueue,
      });

      void sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar || DEFAULT_CROWN_AVATAR,
        senderFlag: currentUser.flag || '🇸🇦',
        content: `🎙️ قام المشرف [${currentUser.username}] بسحب المايك من [${target.username}]`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }).catch(msgErr => console.warn('Revoke message skipped:', msgErr));
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

      void sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar || DEFAULT_CROWN_AVATAR,
        senderFlag: currentUser.flag || '🇸🇦',
        content: `🔄 قام المشرف [${currentUser.username}] بتجديد وقت المايك للمتحدث [${activeSpeaker.username}]`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }).catch(msgErr => console.warn('Renew message skipped:', msgErr));
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

        void sendRoomMessageInDb(currentRoom.id, activeUid, {
          senderId: 'system',
          senderName: 'إدارة الروم',
          senderRole: currentUser.role,
          senderAvatar: currentUser.avatar || DEFAULT_CROWN_AVATAR,
          senderFlag: currentUser.flag || '🇸🇦',
          content: `▶️ قام المشرف [${currentUser.username}] بإلغاء تثبيت الوقت واستئناف العداد للمتحدث [${activeSpeaker.username}]`,
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          type: 'system',
        }).catch(msgErr => console.warn('Resume timer message skipped:', msgErr));
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

      void sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar || DEFAULT_CROWN_AVATAR,
        senderFlag: currentUser.flag || '🇸🇦',
        content: `📌 قام المشرف [${currentUser.username}] بتثبيت وقت المايك للمتحدث [${activeSpeaker.username}] (العداد متوقف)`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }).catch(msgErr => console.warn('Freeze timer message skipped:', msgErr));
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
    await Promise.all([
      ...matchingParticipants.map(u =>
        updateRoomParticipantModeration(currentRoom.id, u.id, {
          role: credential.role,
          textColor: hexColor,
        })
      ),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'ماستر الروم',
        senderRole: 'owner',
        senderAvatar: currentRoom.ownerAvatar,
        senderFlag: currentRoom.flag,
        content: `👑 مبروك! قام ماستر الروم بتعيين رتبة «${ROLE_HIERARCHY[credential.role].label}» للعضو [${credential.username}] وتأمينها برمز سري محمي!`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
    ]);
  };

  const handleRemoveCredential = async (username: string) => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    await deleteRoomCredentialInDb(currentRoom.id, username);
    const matching = roomUsers.filter(u => u.username.toLowerCase() === username.toLowerCase());
    await Promise.all(
      matching.map(u =>
        updateRoomParticipantModeration(currentRoom.id, u.id, {
          role: 'guest',
          textColor: '#94a3b8',
        })
      )
    );
  };

  const handleUnbanUser = async (ip: string) => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    await removeRoomBanInDb(currentRoom.id, ip);
  };

  const handleToggleMicLock = async () => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    const nextLocked = !currentRoom.isMicLocked;
    await Promise.all([
      updateRoomLiveStateInDb(currentRoom.id, { isMicLocked: nextLocked }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'ماستر الروم',
        senderRole: 'owner',
        senderAvatar: currentRoom.ownerAvatar,
        senderFlag: currentRoom.flag,
        content: nextLocked
          ? '🔒 قام ماستر الروم بقفل المايك للإدارة فقط'
          : '🔓 قام ماستر الروم بفتح المايك لجميع الأعضاء',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
      }),
    ]);
  };

  // Clear Room Chat (from Master Panel)
  const handleClearRoomChat = async () => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    await clearRoomMessagesInDb(currentRoom.id, {
      senderUid: activeUid,
      senderName: 'ماستر الروم',
      senderRole: 'owner',
      senderAvatar: currentRoom.ownerAvatar,
      senderFlag: currentRoom.flag,
      content: '🧹 قام ماستر الروم بمسح رسائل الشات العام بنجاح',
    });
  };

  // Update per-role mic durations (from Master Panel)
  const handleUpdateMicDurations = async (micDurations: MicDurations) => {
    if (!currentRoom || currentUser.role !== 'owner') return;
    await Promise.all([
      updateRoomMicDurationsInDb(currentRoom.id, micDurations),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'ماستر الروم',
        senderRole: 'owner',
        senderAvatar: currentRoom.ownerAvatar,
        senderFlag: currentRoom.flag,
        content: '⏱️ قام ماستر الروم بتحديث أوقات المايك المحددة لكل رتبة في الغرفة',
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
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
    await clearRoomMessagesInDb(currentRoom.id, {
      senderUid: activeUid,
      senderName: 'إدارة الروم',
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      senderFlag: currentUser.flag,
      content: `🧹 قام [${currentUser.username}] (${roleLabel}) بمسح شاشة المحادثة لجميع المتواجدين في الروم`,
    });
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

    await Promise.all([
      updateRoomLiveStateInDb(currentRoom.id, { activeVideoStream: newStream }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: `🔴 بدأ العضو [${currentUser.username}] بثاً مباشراً بالفيديو الآن! 🎥`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
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

    await Promise.all([
      updateRoomLiveStateInDb(currentRoom.id, { activeVideoStream: null }),
      sendRoomMessageInDb(currentRoom.id, activeUid, {
        senderId: 'system',
        senderName: 'إدارة الروم',
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        senderFlag: currentUser.flag,
        content: `⏹️ أنهى العضو [${broadcasterName}] البث المباشر بالفيديو`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        type: 'system',
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
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#070a12] relative">
          <RoomHeader
            room={currentRoom}
            currentUser={currentUser}
            onLeaveRoom={handleLeaveRoom}
            onOpenUsers={() => setIsUserListOpen(true)}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onOpenMasterPanel={() => setIsMasterPanelOpen(true)}
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
            onTakeMic={() => {
              if (!currentRoom || isMicTransitioning) return;
              if (currentUser.isMuted) {
                showNotice('أنت مكتوم حالياً في هذه الغرفة ولا يمكنك الصعود للمايك');
                return;
              }
              const isStaff = ['owner', 'vip', 'admin', 'super_admin'].includes(currentUser.role);
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
            onSelectUser={handleSelectMicSpeaker}
            isMuted={isMuted}
            isMicTransitioning={isMicTransitioning}
          />

          <ChatArea
            messages={visibleMessages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
            onSendVoiceClip={handleSendVoiceClip}
            onOpenGifts={() => setIsGiftModalOpen(true)}
            onSelectUser={handleSelectUser}
            isMuted={isMuted}
            onClearMyChat={handleClearMyChat}
            onClearAllChat={handleClearAllChat}
            onRankWarning={showNotice}
            onRequestMicPermission={requestMicWithDisclosure}
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
              onClose={() => setIsUserListOpen(false)}
              onOpenPrivateChat={handleAttemptPrivateChat}
              onSendGiftToUser={() => setIsGiftModalOpen(true)}
              onGiveMicToUser={async user => {
                await updateRoomLiveStateInDb(currentRoom.id, {
                  activeSpeakerId: user.id,
                  speakerStartedAtMs: Date.now(),
                  isMicTimerPaused: false,
                  micPausedRemainingSec: null,
                  micQueue: queueUserIds.filter(id => id !== user.id),
                });
              }}
              onOpenQuickActions={user => setSelectedQuickUser(user)}
            />
          )}

          {isMasterPanelOpen && (
            <MasterControlPanelModal
              room={currentRoom}
              roomUsers={roomUsers}
              onClose={() => setIsMasterPanelOpen(false)}
              onAssignRankWithPin={handleAssignRankWithPin}
              onRemoveCredential={handleRemoveCredential}
              onUnbanUser={handleUnbanUser}
              onToggleMicLock={handleToggleMicLock}
              onClearRoomChat={handleClearRoomChat}
              onUpdateMicDurations={handleUpdateMicDurations}
            />
          )}

          {selectedQuickUser && (
            <UserQuickActionsMenu
              targetUser={selectedQuickUser}
              currentUser={currentUser}
              onClose={() => setSelectedQuickUser(null)}
              onMute={handleMuteUser}
              onBan={handleBanUser}
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
        <div className="fixed top-12 left-3 right-3 z-50 flex items-center justify-center p-3.5 bg-gradient-to-r from-red-950/95 via-slate-900 to-red-950/95 border-2 border-red-500/80 text-white rounded-2xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-200 text-right">
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-red-600/30 border border-red-500/50 flex items-center justify-center shrink-0 shadow-md">
              <Lock size={20} className="text-red-400 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-red-300">تنبيه النظام</h4>
              <p className="text-xs text-white font-bold mt-0.5 leading-snug">{noticeBanner}</p>
            </div>
            <button
              onClick={() => setNoticeBanner(null)}
              className="text-red-400 hover:text-white p-1 text-sm rounded-lg hover:bg-red-900/40 shrink-0"
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
