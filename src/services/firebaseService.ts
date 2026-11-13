import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { signInAnonymously, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import {
  BannedUserEntry,
  ChatMessage,
  DEFAULT_MIC_DURATIONS,
  LiveVideoStream,
  MicDurations,
  PrivateMessage,
  RoleQuotas,
  Room,
  RoomCredential,
  UserProfile,
  UserRole,
  ROLE_HIERARCHY,
} from '../types/loqana';
import { DEFAULT_CROWN_AVATAR } from '../data/mockLoqanaData';

const DEMO_ROOM_IDS = new Set([
  'room-iraq',
  'room-egypt',
  'room-saudi',
  'room-syria',
  'room-jordan',
  'room-lebanon',
  'room-palestine',
  'room-libya',
  'room-morocco',
  'room-algeria',
  'room-turkey',
  'room-gulf',
  'room-yemen',
  'room-entertainment',
]);

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 120);
  return cleaned || `id-${Date.now()}`;
}

export function getConversationId(uidA: string, uidB: string): string {
  const sorted = [sanitizeId(uidA), sanitizeId(uidB)].sort();
  return `${sorted[0]}_${sorted[1]}`.slice(0, 128);
}

function timestampToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val === 'object' && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  return Date.now();
}

export function truncateString(str: string | undefined, maxLen: number): string {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function clampMicSeconds(val: unknown, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(1, Math.min(86400, Math.round(n)));
}

export function normalizeMicDurations(raw?: Partial<MicDurations> | null): MicDurations {
  return {
    owner: clampMicSeconds(raw?.owner, DEFAULT_MIC_DURATIONS.owner),
    vip: clampMicSeconds(raw?.vip, DEFAULT_MIC_DURATIONS.vip),
    admin: clampMicSeconds(raw?.admin, DEFAULT_MIC_DURATIONS.admin),
    super_admin: clampMicSeconds(raw?.super_admin, DEFAULT_MIC_DURATIONS.super_admin),
    member: clampMicSeconds(raw?.member, DEFAULT_MIC_DURATIONS.member),
    guest: clampMicSeconds(raw?.guest, DEFAULT_MIC_DURATIONS.guest),
  };
}

export function getMicDurationForRole(
  micDurations: Partial<MicDurations> | undefined | null,
  role: UserRole | string | undefined
): number {
  const normalized = normalizeMicDurations(micDurations);
  if (!role || !(role in normalized)) return normalized.guest;
  return normalized[role as UserRole] ?? normalized.guest;
}

function parseEpochMs(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
    return val;
  }
  if (val instanceof Timestamp) {
    const ms = val.toMillis();
    return ms > 0 ? ms : null;
  }
  if (val && typeof val === 'object' && 'seconds' in val) {
    const ms = Number((val as { seconds: number }).seconds) * 1000;
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  if (typeof val === 'string' && val.trim().length > 0) {
    const trimmed = val.trim();
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return Number.isFinite(num) && num > 0 ? num : null;
    }
    const parsed = Date.parse(trimmed);
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

export function getRoomExpiresAtMs(room: Pick<Room, 'expiresAtMs' | 'expiresAt' | 'createdAtMs' | 'validityDays'>): number | null {
  const fromMs = parseEpochMs(room.expiresAtMs);
  if (fromMs !== null) {
    return fromMs;
  }
  const fromIso = parseEpochMs(room.expiresAt);
  if (fromIso !== null) {
    return fromIso;
  }
  const createdMs = parseEpochMs(room.createdAtMs);
  if (createdMs !== null) {
    const rawDays = Number(room.validityDays);
    const days = Number.isFinite(rawDays) && rawDays >= 1 ? rawDays : 30;
    return createdMs + days * DAY_IN_MS;
  }
  return null;
}

export function getRoomRemainingDays(
  room: Pick<Room, 'expiresAtMs' | 'expiresAt' | 'createdAtMs' | 'validityDays' | 'isActive'>,
  nowMs: number = Date.now()
): number {
  const expiresAtMs = getRoomExpiresAtMs(room);
  if (room.isActive === false && (expiresAtMs === null || nowMs >= expiresAtMs)) {
    return 0;
  }
  if (expiresAtMs === null) {
    const rawDays = Number(room.validityDays);
    return Math.max(1, Number.isFinite(rawDays) && rawDays >= 1 ? Math.round(rawDays) : 30);
  }
  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs <= 0) return 0;
  const days = Math.ceil(remainingMs / DAY_IN_MS);
  if (
    typeof room.createdAtMs === 'number' &&
    typeof room.validityDays === 'number' &&
    room.validityDays >= 1 &&
    Math.abs(nowMs - room.createdAtMs) < 60000
  ) {
    return Math.min(Math.round(room.validityDays), days);
  }
  return days;
}

export function isRoomExpired(
  room: Pick<Room, 'expiresAtMs' | 'expiresAt' | 'createdAtMs' | 'validityDays' | 'isActive'>,
  nowMs: number = Date.now()
): boolean {
  if (
    typeof room.createdAtMs === 'number' &&
    nowMs - room.createdAtMs >= 0 &&
    nowMs - room.createdAtMs < 60000 &&
    (typeof room.validityDays !== 'number' || room.validityDays >= 1)
  ) {
    return false;
  }
  const expiresAtMs = getRoomExpiresAtMs(room);
  if (room.isActive === false && (expiresAtMs === null || nowMs >= expiresAtMs)) {
    return true;
  }
  if (expiresAtMs === null) return false;
  return nowMs >= expiresAtMs;
}

/**
 * Compresses an image Data URL using HTML5 Canvas so it safely fits Firestore doc limits.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxDimension = 640,
  maxLength = 420000
): Promise<string> {
  if (!dataUrl.startsWith('data:image/')) {
    return truncateString(dataUrl, maxLength);
  }
  if (dataUrl.startsWith('data:image/svg+xml') && dataUrl.length <= maxLength) {
    return dataUrl;
  }
  if (dataUrl.length <= maxLength) {
    return dataUrl;
  }

  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(truncateString(dataUrl, maxLength));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.78;
      let output = canvas.toDataURL('image/jpeg', quality);
      while (output.length > maxLength && quality > 0.25) {
        quality -= 0.12;
        output = canvas.toDataURL('image/jpeg', quality);
      }
      if (output.length > maxLength) {
        const smallCanvas = document.createElement('canvas');
        smallCanvas.width = Math.max(1, Math.round(width * 0.6));
        smallCanvas.height = Math.max(1, Math.round(height * 0.6));
        const sCtx = smallCanvas.getContext('2d');
        if (sCtx) {
          sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
          output = smallCanvas.toDataURL('image/jpeg', 0.6);
        }
      }
      resolve(output);
    };
    img.onerror = () => resolve(DEFAULT_CROWN_AVATAR);
    img.src = dataUrl;
  });
}

// =========================================================
// Auth & Direct Local Session Helpers
// =========================================================

const LOCAL_CLIENT_UID_KEY = 'layali_local_client_uid_v1';
const LOCAL_PROFILE_CACHE_KEY = 'layali_local_profile_cache_v1';

export function getOrCreateLocalClientUid(): string {
  const authUid = auth.currentUser?.uid;
  if (authUid) return sanitizeId(authUid);
  try {
    const existing = window.localStorage.getItem(LOCAL_CLIENT_UID_KEY);
    if (existing && /^[a-zA-Z0-9_\-]+$/.test(existing)) {
      return sanitizeId(existing);
    }
    const generated = sanitizeId(
      `usr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    );
    window.localStorage.setItem(LOCAL_CLIENT_UID_KEY, generated);
    return generated;
  } catch {
    return sanitizeId(`usr_${Date.now().toString(36)}`);
  }
}

export function loadLocalUserProfile(uid: string): Partial<UserProfile> {
  try {
    const raw = window.localStorage.getItem(LOCAL_PROFILE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {};
    return {
      id: uid,
      username: typeof parsed.username === 'string' && parsed.username.trim() ? parsed.username : undefined,
      avatar: typeof parsed.avatar === 'string' && parsed.avatar ? parsed.avatar : undefined,
      countryCode: typeof parsed.countryCode === 'string' ? parsed.countryCode : undefined,
      flag: typeof parsed.flag === 'string' ? parsed.flag : undefined,
      level: typeof parsed.level === 'number' ? parsed.level : undefined,
      coins: typeof parsed.coins === 'number' ? parsed.coins : undefined,
      giftsReceivedCount: typeof parsed.giftsReceivedCount === 'number' ? parsed.giftsReceivedCount : undefined,
      textColor: typeof parsed.textColor === 'string' ? parsed.textColor : undefined,
      mood: typeof parsed.mood === 'string' ? parsed.mood : undefined,
      birthDate: typeof parsed.birthDate === 'string' ? parsed.birthDate : undefined,
      isPrivateChatLocked: typeof parsed.isPrivateChatLocked === 'boolean' ? parsed.isPrivateChatLocked : undefined,
      isSoundEffectsMuted: typeof parsed.isSoundEffectsMuted === 'boolean' ? parsed.isSoundEffectsMuted : undefined,
      profilePin: typeof parsed.profilePin === 'string' ? parsed.profilePin : undefined,
      deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : undefined,
    };
  } catch {
    return {};
  }
}

export function saveLocalUserProfile(uid: string, updates: Partial<UserProfile>): void {
  try {
    const current = loadLocalUserProfile(uid);
    const merged: Record<string, unknown> = {
      ...current,
      ...updates,
      id: uid,
    };
    window.localStorage.setItem(LOCAL_PROFILE_CACHE_KEY, JSON.stringify(merged));
  } catch {
    // Ignore localStorage quota or privacy mode errors cleanly
  }
}

export async function signInWithGoogle(): Promise<User> {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export async function ensureAuthSession(): Promise<User> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  const cred = await signInAnonymously(auth);
  return cred.user;
}

// =========================================================
// User Profile (Split Public + Private PII Collections)
// =========================================================

export async function ensureUserProfile(userOrUid?: User | string | null): Promise<UserProfile> {
  const firebaseUser = typeof userOrUid === 'object' && userOrUid !== null ? userOrUid : null;
  const uid = sanitizeId(
    typeof userOrUid === 'string' && userOrUid.trim()
      ? userOrUid
      : firebaseUser?.uid || getOrCreateLocalClientUid()
  );
  const publicPath = `users_public/${uid}`;
  const localCached = loadLocalUserProfile(uid);

  let publicSnap;
  try {
    publicSnap = await getDoc(doc(db, 'users_public', uid));
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, publicPath);
  }

  let privateSnap = null;
  const canReadPrivate = Boolean(
    auth.currentUser &&
    auth.currentUser.emailVerified &&
    sanitizeId(auth.currentUser.uid) === uid
  );
  if (canReadPrivate) {
    try {
      privateSnap = await getDoc(doc(db, 'users_private', uid));
    } catch (err) {
      console.warn('Private user doc read skipped:', err);
    }
  }

  const defaultName = truncateString(
    localCached.username?.trim() ||
      firebaseUser?.displayName?.trim() ||
      firebaseUser?.email?.split('@')[0] ||
      'عضو ليالي',
    40
  );
  const defaultAvatar = truncateString(
    localCached.avatar || firebaseUser?.photoURL || DEFAULT_CROWN_AVATAR,
    190000
  );
  const defaultDeviceId = localCached.deviceId || `DEV-${uid.slice(-6).toUpperCase()}`;

  if (!publicSnap.exists()) {
    const publicPayload = {
      id: uid,
      username: defaultName,
      avatar: defaultAvatar,
      role: 'member' as UserRole,
      countryCode: localCached.countryCode || 'SA',
      flag: localCached.flag || '🇸🇦',
      level: typeof localCached.level === 'number' ? localCached.level : 1,
      coins: typeof localCached.coins === 'number' ? localCached.coins : 5000,
      giftsReceivedCount:
        typeof localCached.giftsReceivedCount === 'number' ? localCached.giftsReceivedCount : 0,
      textColor: localCached.textColor || '#fbbf24',
      mood: localCached.mood || 'أهلاً بكم في دردشة اليالي الصوتية 🌹',
      birthDate: localCached.birthDate || '2000-01-01',
      isPrivateChatLocked: Boolean(localCached.isPrivateChatLocked),
      isSoundEffectsMuted: Boolean(localCached.isSoundEffectsMuted),
      isPublic: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'users_public', uid), publicPayload);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, publicPath);
    }
  }

  if (canReadPrivate && privateSnap && !privateSnap.exists()) {
    const privatePayload = {
      id: uid,
      email: truncateString(firebaseUser?.email || '', 150),
      profilePin: localCached.profilePin || '',
      deviceId: defaultDeviceId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, 'users_private', uid), privatePayload);
    } catch (err) {
      console.warn('Private user doc creation skipped:', err);
    }
  }

  const pubData = publicSnap.exists() ? publicSnap.data() : null;
  const privData = privateSnap && privateSnap.exists() ? privateSnap.data() : null;

  const profile: UserProfile = {
    id: uid,
    username: pubData?.username || defaultName,
    avatar: pubData?.avatar || defaultAvatar,
    role: (pubData?.role as UserRole) || 'member',
    countryCode: pubData?.countryCode || localCached.countryCode || 'SA',
    flag: pubData?.flag || localCached.flag || '🇸🇦',
    level: typeof pubData?.level === 'number' ? pubData.level : localCached.level ?? 1,
    coins: typeof pubData?.coins === 'number' ? pubData.coins : localCached.coins ?? 5000,
    giftsReceivedCount:
      typeof pubData?.giftsReceivedCount === 'number'
        ? pubData.giftsReceivedCount
        : localCached.giftsReceivedCount ?? 0,
    textColor: pubData?.textColor || localCached.textColor || '#fbbf24',
    mood: pubData?.mood || localCached.mood || 'أهلاً بكم في دردشة اليالي الصوتية 🌹',
    birthDate: pubData?.birthDate || localCached.birthDate || '2000-01-01',
    isPrivateChatLocked: Boolean(pubData?.isPrivateChatLocked ?? localCached.isPrivateChatLocked),
    isSoundEffectsMuted: Boolean(pubData?.isSoundEffectsMuted ?? localCached.isSoundEffectsMuted),
    profilePin: privData?.profilePin || localCached.profilePin || '',
    deviceId: privData?.deviceId || localCached.deviceId || defaultDeviceId,
  };
  saveLocalUserProfile(uid, profile);
  return profile;
}

export function subscribeUserProfile(
  uid: string,
  onUpdate: (updates: Partial<UserProfile>) => void
): Unsubscribe {
  const cleanUid = sanitizeId(uid);
  const unsubPub = onSnapshot(
    doc(db, 'users_public', cleanUid),
    snap => {
      if (snap.exists()) {
        const d = snap.data();
        const updates: Partial<UserProfile> = {
          username: d.username,
          avatar: d.avatar,
          countryCode: d.countryCode,
          flag: d.flag,
          level: d.level,
          coins: d.coins,
          giftsReceivedCount: d.giftsReceivedCount,
          textColor: d.textColor,
          mood: d.mood,
          birthDate: d.birthDate,
          isPrivateChatLocked: Boolean(d.isPrivateChatLocked),
          isSoundEffectsMuted: Boolean(d.isSoundEffectsMuted),
        };
        saveLocalUserProfile(cleanUid, updates);
        onUpdate(updates);
      }
    },
    err => handleFirestoreError(err, OperationType.GET, `users_public/${cleanUid}`)
  );

  const canReadPrivate = Boolean(
    auth.currentUser &&
    auth.currentUser.emailVerified &&
    sanitizeId(auth.currentUser.uid) === cleanUid
  );
  const unsubPriv = canReadPrivate
    ? onSnapshot(
        doc(db, 'users_private', cleanUid),
        snap => {
          if (snap.exists()) {
            const d = snap.data();
            onUpdate({
              profilePin: d.profilePin || '',
              deviceId: d.deviceId || '',
            });
          }
        },
        err => console.warn('Private user subscription skipped:', err)
      )
    : () => {};

  return () => {
    unsubPub();
    unsubPriv();
  };
}

export async function updateUserProfileInDb(
  uid: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  saveLocalUserProfile(cleanUid, updates);

  const publicPatch: Record<string, unknown> = {};
  const privatePatch: Record<string, unknown> = {};

  if (updates.username !== undefined) publicPatch.username = truncateString(updates.username.trim(), 40);
  if (updates.avatar !== undefined) {
    publicPatch.avatar = await compressImageDataUrl(updates.avatar, 320, 180000);
  }
  if (updates.countryCode !== undefined) publicPatch.countryCode = truncateString(updates.countryCode, 10);
  if (updates.flag !== undefined) publicPatch.flag = truncateString(updates.flag, 16);
  if (updates.textColor !== undefined) publicPatch.textColor = truncateString(updates.textColor, 20);
  if (updates.mood !== undefined) publicPatch.mood = truncateString(updates.mood.trim(), 120);
  if (updates.birthDate !== undefined) publicPatch.birthDate = truncateString(updates.birthDate, 20);
  if (updates.isPrivateChatLocked !== undefined) {
    publicPatch.isPrivateChatLocked = Boolean(updates.isPrivateChatLocked);
  }
  if (updates.isSoundEffectsMuted !== undefined) {
    publicPatch.isSoundEffectsMuted = Boolean(updates.isSoundEffectsMuted);
  }
  if (updates.coins !== undefined) publicPatch.coins = Math.max(0, Math.round(updates.coins));
  if (updates.level !== undefined) publicPatch.level = Math.max(1, Math.min(999, Math.round(updates.level)));

  if (updates.profilePin !== undefined) {
    privatePatch.profilePin = truncateString(updates.profilePin.trim(), 20);
  }
  if (updates.deviceId !== undefined) {
    privatePatch.deviceId = truncateString(updates.deviceId.trim(), 64);
  }

  if (Object.keys(publicPatch).length > 0) {
    publicPatch.updatedAt = serverTimestamp();
    try {
      await updateDoc(doc(db, 'users_public', cleanUid), publicPatch);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users_public/${cleanUid}`);
    }
  }

  const canWritePrivate = Boolean(
    auth.currentUser &&
    auth.currentUser.emailVerified &&
    sanitizeId(auth.currentUser.uid) === cleanUid
  );
  if (canWritePrivate && Object.keys(privatePatch).length > 0) {
    privatePatch.updatedAt = serverTimestamp();
    try {
      await updateDoc(doc(db, 'users_private', cleanUid), privatePatch);
    } catch (err) {
      console.warn('Private profile update skipped:', err);
    }
  }
}

export async function incrementUserGiftsReceivedInDb(targetUid: string, nextCount: number): Promise<void> {
  const cleanUid = sanitizeId(targetUid);
  try {
    const ref = doc(db, 'users_public', cleanUid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const current = Number(snap.data().giftsReceivedCount || 0);
    await updateDoc(ref, {
      giftsReceivedCount: Math.max(current + 1, nextCount),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users_public/${cleanUid}`);
  }
}

export function subscribePublicDirectory(
  onUpdate: (users: UserProfile[]) => void
): Unsubscribe {
  const q = query(collection(db, 'users_public'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    snap => {
      const list: UserProfile[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          username: data.username,
          avatar: data.avatar,
          role: (data.role as UserRole) || 'member',
          countryCode: data.countryCode || 'SA',
          flag: data.flag || '🇸🇦',
          level: Number(data.level || 1),
          coins: Number(data.coins || 0),
          giftsReceivedCount: Number(data.giftsReceivedCount || 0),
          textColor: data.textColor || '#fbbf24',
          mood: data.mood || '',
          birthDate: data.birthDate || '',
          isPrivateChatLocked: Boolean(data.isPrivateChatLocked),
          isSoundEffectsMuted: Boolean(data.isSoundEffectsMuted),
        };
      });
      onUpdate(list);
    },
    err => handleFirestoreError(err, OperationType.LIST, 'users_public')
  );
}

// =========================================================
// Rooms (Real Database Only - Cleanup Legacy Demo Rooms)
// =========================================================

export async function cleanupLegacyDemoRooms(
  userUid: string,
  userEmail?: string | null
): Promise<void> {
  const cleanUid = sanitizeId(userUid);
  const isAdminEmail = userEmail === 'abolaith03675@gmail.com';
  const q = query(collection(db, 'rooms'), where('isPublic', '==', true));
  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'rooms');
  }

  const demoDocs = snap.docs.filter(d => {
    if (!DEMO_ROOM_IDS.has(d.id)) return false;
    return isAdminEmail || d.data().ownerUid === cleanUid;
  });

  if (demoDocs.length === 0) return;

  const batch = writeBatch(db);
  demoDocs.forEach(d => batch.delete(d.ref));
  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'rooms');
  }
}

export function subscribeRooms(onUpdate: (rooms: Room[]) => void): Unsubscribe {
  const q = query(collection(db, 'rooms'), where('isPublic', '==', true));
  return onSnapshot(
    q,
    snap => {
      const list: Room[] = snap.docs
        .filter(d => !DEMO_ROOM_IDS.has(d.id))
        .map(d => {
          const r = d.data();
          return {
            id: d.id,
            code: r.code || '1000',
            name: r.name || '',
            category: r.category || 'all',
            countryName: r.countryName || '',
            countryKeywords: Array.isArray(r.countryKeywords) ? r.countryKeywords : [],
            flag: r.flag || '🌐',
            description: r.description || '',
            ownerName: r.ownerName || 'ماستر الروم',
            ownerAvatar: r.ownerAvatar || DEFAULT_CROWN_AVATAR,
            ownerId: r.ownerId || r.ownerUid || '',
            ownerUid: r.ownerUid || '',
            ownerColor: r.ownerColor || '#ef4444',
            masterPinCode: r.masterPinCode || '1976',
            occupantsCount: Number(r.occupantsCount || 0),
            maxCapacity: Number(r.maxCapacity || 100),
            isLocked: Boolean(r.isLocked),
            password: r.password || undefined,
            welcomeMessage: r.welcomeMessage || '',
            activeSpeakerId: r.activeSpeakerId || null,
            speakerStartedAtMs: typeof r.speakerStartedAtMs === 'number' ? r.speakerStartedAtMs : null,
            isMicTimerPaused: Boolean(r.isMicTimerPaused),
            micPausedRemainingSec: typeof r.micPausedRemainingSec === 'number' ? r.micPausedRemainingSec : null,
            micQueue: Array.isArray(r.micQueue) ? r.micQueue : [],
            isGoldName: Boolean(r.isGoldName),
            validityDays: typeof r.validityDays === 'number' && r.validityDays >= 1 ? r.validityDays : 30,
            expiresAt: typeof r.expiresAt === 'string' ? r.expiresAt : undefined,
            expiresAtMs: parseEpochMs(r.expiresAtMs) ?? parseEpochMs(r.expiresAt) ?? undefined,
            isActive: r.isActive !== undefined ? Boolean(r.isActive) : true,
            createdAtMs: r.createdAt ? timestampToMs(r.createdAt) : Date.now(),
            roleQuotas: r.roleQuotas || { vip: 5, admin: 10, super_admin: 15, member: 50 },
            micDurations: normalizeMicDurations(r.micDurations),
            mutedUserIds: Array.isArray(r.mutedUserIds) ? r.mutedUserIds : [],
            isMicLocked: Boolean(r.isMicLocked),
            activeVideoStream: r.activeVideoStream || null,
            isPublic: Boolean(r.isPublic),
          } as Room;
        })
        .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      onUpdate(list);
    },
    err => handleFirestoreError(err, OperationType.LIST, 'rooms')
  );
}

export async function createRoomInDb(
  ownerUid: string,
  data: {
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
  }
): Promise<Room> {
  const rawOwnerUid = ownerUid || auth.currentUser?.uid || getOrCreateLocalClientUid();
  const cleanOwnerUid = /^[a-zA-Z0-9_\-]+$/.test(rawOwnerUid)
    ? rawOwnerUid
    : sanitizeId(rawOwnerUid);
  const nowMs = Date.now();
  const randSuffix = Math.random().toString(36).slice(2, 8).padEnd(4, '0');
  const roomId = `room-${nowMs}-${randSuffix}`;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const rawDays = Number(data.validityDays);
  const validityDays =
    Number.isFinite(rawDays) && rawDays >= 1
      ? Math.min(365, Math.round(rawDays))
      : 30;
  const expiresAtMs = nowMs + validityDays * DAY_IN_MS;
  const expiresAt = new Date(expiresAtMs).toISOString();
  const micDurations = normalizeMicDurations(DEFAULT_MIC_DURATIONS);

  const safeName = truncateString((data.name || '').trim() || 'غرفة جديدة', 100);
  const safeOwnerName = truncateString((data.ownerName || '').trim() || 'ماستر الروم', 50);
  const safeCountryName = truncateString((data.countryName || 'العالم').trim() || 'العالم', 40);
  const safeCategory = truncateString(String(data.category || 'all').trim() || 'all', 32);
  const safeFlag = truncateString(String(data.flag || '🌐').trim() || '🌐', 16);
  const safeDescription = truncateString((data.description || '').trim(), 300);
  const safeMasterPin = truncateString((data.masterPinCode || '').trim() || '1976', 16);
  const trimmedPassword = (data.password || '').trim();
  const safePassword = trimmedPassword ? truncateString(trimmedPassword, 40) : null;
  const safeRoleQuotas: RoleQuotas = {
    vip: Math.min(10000, Math.max(0, Math.round(Number(data.roleQuotas?.vip ?? 5) || 0))),
    admin: Math.min(10000, Math.max(0, Math.round(Number(data.roleQuotas?.admin ?? 10) || 0))),
    super_admin: Math.min(10000, Math.max(0, Math.round(Number(data.roleQuotas?.super_admin ?? 15) || 0))),
    member: Math.min(10000, Math.max(0, Math.round(Number(data.roleQuotas?.member ?? 50) || 0))),
  };
  const safeMaxCapacity = Math.max(5, Math.min(1000, Math.round(Number(data.maxCapacity) || 100)));
  const safeKeywords = Array.from(
    new Set(
      [safeCountryName, truncateString(safeName, 40), truncateString(safeOwnerName, 40)].filter(Boolean)
    )
  ).slice(0, 20);

  const cleanPayload = {
    id: roomId,
    code,
    name: safeName,
    category: safeCategory,
    countryName: safeCountryName,
    countryKeywords: safeKeywords,
    flag: safeFlag,
    description: safeDescription,
    ownerName: safeOwnerName,
    ownerAvatar: DEFAULT_CROWN_AVATAR,
    ownerId: cleanOwnerUid,
    ownerUid: cleanOwnerUid,
    ownerColor: '#ef4444',
    masterPinCode: safeMasterPin,
    occupantsCount: 0,
    maxCapacity: safeMaxCapacity,
    isLocked: Boolean(safePassword),
    password: safePassword,
    welcomeMessage: truncateString(`مرحباً بكم في ${safeName} بإدارة الماستر ${safeOwnerName} 👑`, 300),
    activeSpeakerId: null,
    speakerStartedAtMs: null,
    isMicTimerPaused: false,
    micPausedRemainingSec: null,
    micQueue: [] as string[],
    isGoldName: Boolean(data.isGoldName),
    validityDays,
    expiresAt,
    expiresAtMs,
    isActive: true,
    roleQuotas: safeRoleQuotas,
    micDurations,
    mutedUserIds: [] as string[],
    isMicLocked: false,
    activeVideoStream: null,
    isPublic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'rooms', roomId), cleanPayload);
  } catch (err) {
    console.error('Failed to write room document to Firestore:', err);
    handleFirestoreError(err, OperationType.CREATE, `rooms/${roomId}`);
  }

  return {
    ...cleanPayload,
    category: (data.category || 'all') as Room['category'],
    createdAtMs: nowMs,
    password: safePassword ?? undefined,
  };
}

export async function updateRoomSettingsInDb(updatedRoom: Room): Promise<void> {
  const roomId = sanitizeId(updatedRoom.id);
  const nowMs = Date.now();
  const rawDays = Number(updatedRoom.validityDays);
  const validityDays =
    Number.isFinite(rawDays) && rawDays >= 1
      ? Math.min(365, Math.round(rawDays))
      : 30;
  const existingExpMs = parseEpochMs(updatedRoom.expiresAtMs) ?? parseEpochMs(updatedRoom.expiresAt);
  const expiresAtMs = existingExpMs !== null ? existingExpMs : nowMs + validityDays * DAY_IN_MS;
  const expiresAt = new Date(expiresAtMs).toISOString();
  const safeRoleQuotas: RoleQuotas = {
    vip: Math.min(10000, Math.max(0, Math.round(Number(updatedRoom.roleQuotas?.vip ?? 5) || 0))),
    admin: Math.min(10000, Math.max(0, Math.round(Number(updatedRoom.roleQuotas?.admin ?? 10) || 0))),
    super_admin: Math.min(10000, Math.max(0, Math.round(Number(updatedRoom.roleQuotas?.super_admin ?? 15) || 0))),
    member: Math.min(10000, Math.max(0, Math.round(Number(updatedRoom.roleQuotas?.member ?? 50) || 0))),
  };
  const safeKeywords = (updatedRoom.countryKeywords || [])
    .map(k => truncateString(String(k || '').trim(), 60))
    .filter(Boolean)
    .slice(0, 20);

  const patch: Record<string, unknown> = {
    name: truncateString(updatedRoom.name, 100),
    category: truncateString(String(updatedRoom.category || 'all').trim() || 'all', 32),
    countryName: truncateString(updatedRoom.countryName, 40),
    countryKeywords: safeKeywords,
    flag: truncateString(updatedRoom.flag, 16),
    description: truncateString(updatedRoom.description, 300),
    ownerName: truncateString((updatedRoom.ownerName || '').trim() || 'ماستر الروم', 50),
    masterPinCode: truncateString((updatedRoom.masterPinCode || '').trim() || '1976', 16),
    maxCapacity: Math.max(5, Math.min(1000, Number(updatedRoom.maxCapacity || 100))),
    isLocked: Boolean(updatedRoom.password),
    password: updatedRoom.password ? truncateString(updatedRoom.password, 40) : null,
    welcomeMessage: truncateString(updatedRoom.welcomeMessage, 300),
    isGoldName: Boolean(updatedRoom.isGoldName),
    validityDays,
    expiresAt,
    expiresAtMs,
    isActive: updatedRoom.isActive !== undefined ? Boolean(updatedRoom.isActive) : expiresAtMs > nowMs,
    roleQuotas: safeRoleQuotas,
    micDurations: normalizeMicDurations(updatedRoom.micDurations),
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'rooms', roomId), patch);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${roomId}`);
  }
}

export async function updateRoomMicDurationsInDb(
  roomId: string,
  micDurations: MicDurations
): Promise<void> {
  const cleanId = sanitizeId(roomId);
  const normalized = normalizeMicDurations(micDurations);
  try {
    await updateDoc(doc(db, 'rooms', cleanId), {
      micDurations: normalized,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${cleanId}`);
  }
}

export async function deactivateExpiredRoomInDb(roomId: string): Promise<void> {
  const cleanId = sanitizeId(roomId);
  try {
    await updateDoc(doc(db, 'rooms', cleanId), {
      isActive: false,
      activeSpeakerId: null,
      speakerStartedAtMs: null,
      isMicTimerPaused: false,
      micPausedRemainingSec: null,
      micQueue: [],
      activeVideoStream: null,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${cleanId}`);
  }
}

export async function deleteRoomInDb(roomId: string): Promise<void> {
  const cleanId = sanitizeId(roomId);
  try {
    await deleteDoc(doc(db, 'rooms', cleanId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanId}`);
  }
}

export async function updateRoomLiveStateInDb(
  roomId: string,
  patch: {
    activeSpeakerId?: string | null;
    speakerStartedAtMs?: number | null;
    isMicTimerPaused?: boolean;
    micPausedRemainingSec?: number | null;
    micQueue?: string[];
    occupantsCount?: number;
    isMicLocked?: boolean;
    mutedUserIds?: string[];
    activeVideoStream?: LiveVideoStream | null;
  }
): Promise<void> {
  const cleanId = sanitizeId(roomId);
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (patch.activeSpeakerId !== undefined) payload.activeSpeakerId = patch.activeSpeakerId;
  if (patch.speakerStartedAtMs !== undefined) payload.speakerStartedAtMs = patch.speakerStartedAtMs;
  if (patch.isMicTimerPaused !== undefined) payload.isMicTimerPaused = patch.isMicTimerPaused;
  if (patch.micPausedRemainingSec !== undefined) payload.micPausedRemainingSec = patch.micPausedRemainingSec;
  if (patch.micQueue !== undefined) payload.micQueue = patch.micQueue.slice(0, 50);
  if (patch.occupantsCount !== undefined) payload.occupantsCount = Math.max(0, patch.occupantsCount);
  if (patch.isMicLocked !== undefined) payload.isMicLocked = patch.isMicLocked;
  if (patch.mutedUserIds !== undefined) payload.mutedUserIds = patch.mutedUserIds.slice(0, 200);
  if (patch.activeVideoStream !== undefined) payload.activeVideoStream = patch.activeVideoStream;

  try {
    await updateDoc(doc(db, 'rooms', cleanId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${cleanId}`);
  }
}

// =========================================================
// Room Participants (Real-time Presence)
// =========================================================

export function subscribeRoomParticipants(
  roomId: string,
  onUpdate: (participants: UserProfile[]) => void
): Unsubscribe {
  const cleanRoomId = sanitizeId(roomId);
  const q = query(
    collection(db, 'rooms', cleanRoomId, 'participants'),
    where('roomId', '==', cleanRoomId)
  );
  return onSnapshot(
    q,
    snap => {
      const list: UserProfile[] = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            username: data.username,
            avatar: data.avatar,
            role: (data.role as UserRole) || 'guest',
            countryCode: data.countryCode || 'SA',
            flag: data.flag || '🇸🇦',
            level: Number(data.level || 1),
            coins: Number(data.coins || 0),
            giftsReceivedCount: Number(data.giftsReceivedCount || 0),
            textColor: data.textColor || '#94a3b8',
            mood: data.mood || '',
            isMuted: Boolean(data.isMuted),
            isBound: Boolean(data.isBound),
            isPrivateChatLocked: Boolean(data.isPrivateChatLocked),
          } as UserProfile;
        })
        .sort((a, b) => (ROLE_HIERARCHY[b.role]?.level || 0) - (ROLE_HIERARCHY[a.role]?.level || 0));
      onUpdate(list);
    },
    err => handleFirestoreError(err, OperationType.LIST, `rooms/${cleanRoomId}/participants`)
  );
}

export async function joinRoomAsParticipant(
  roomId: string,
  user: UserProfile,
  isMutedInRoom: boolean
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const uid = sanitizeId(user.id);
  const ref = doc(db, 'rooms', cleanRoomId, 'participants', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${cleanRoomId}/participants/${uid}`);
  }

  const avatarSafe = await compressImageDataUrl(user.avatar || DEFAULT_CROWN_AVATAR, 320, 180000);
  const safeUsername = truncateString((user.username || 'عضو ليالي').trim() || 'عضو ليالي', 40);
  const safeRole: UserRole = user.role && user.role in ROLE_HIERARCHY ? user.role : 'guest';

  if (existingSnap.exists()) {
    try {
      await updateDoc(ref, {
        username: safeUsername,
        avatar: avatarSafe,
        role: safeRole,
        countryCode: truncateString(user.countryCode || 'SA', 10),
        flag: truncateString(user.flag || '🇸🇦', 16),
        level: Math.max(1, Number(user.level || 1)),
        coins: Math.max(0, Number(user.coins || 0)),
        giftsReceivedCount: Math.max(0, Number(user.giftsReceivedCount || 0)),
        textColor: truncateString(user.textColor || '#94a3b8', 20),
        mood: truncateString(user.mood || '', 120),
        isPrivateChatLocked: Boolean(user.isPrivateChatLocked),
        lastSeenAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${cleanRoomId}/participants/${uid}`);
    }
  } else {
    try {
      await setDoc(ref, {
        id: uid,
        roomId: cleanRoomId,
        username: safeUsername,
        avatar: avatarSafe,
        role: safeRole,
        countryCode: truncateString(user.countryCode || 'SA', 10),
        flag: truncateString(user.flag || '🇸🇦', 16),
        level: Math.max(1, Number(user.level || 1)),
        coins: Math.max(0, Number(user.coins || 0)),
        giftsReceivedCount: Math.max(0, Number(user.giftsReceivedCount || 0)),
        textColor: truncateString(user.textColor || '#94a3b8', 20),
        mood: truncateString(user.mood || '', 120),
        isMuted: isMutedInRoom,
        isBound: false,
        isPrivateChatLocked: Boolean(user.isPrivateChatLocked),
        joinedAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${cleanRoomId}/participants/${uid}`);
    }
  }
}

export async function leaveRoomParticipant(roomId: string, uid: string): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const cleanUid = sanitizeId(uid);
  try {
    await deleteDoc(doc(db, 'rooms', cleanRoomId, 'participants', cleanUid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanRoomId}/participants/${cleanUid}`);
  }
}

export async function updateRoomParticipantModeration(
  roomId: string,
  targetUid: string,
  patch: {
    role?: UserRole;
    textColor?: string;
    isMuted?: boolean;
    isBound?: boolean;
    giftsReceivedCount?: number;
  }
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const cleanTargetUid = sanitizeId(targetUid);
  const ref = doc(db, 'rooms', cleanRoomId, 'participants', cleanTargetUid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      ...patch,
      lastSeenAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `rooms/${cleanRoomId}/participants/${cleanTargetUid}`);
  }
}

// =========================================================
// Room Credentials & Bans
// =========================================================

export function subscribeRoomCredentials(
  roomId: string,
  onUpdate: (creds: RoomCredential[]) => void
): Unsubscribe {
  const cleanRoomId = sanitizeId(roomId);
  const q = query(
    collection(db, 'rooms', cleanRoomId, 'credentials'),
    where('roomId', '==', cleanRoomId)
  );
  return onSnapshot(
    q,
    snap => {
      const creds: RoomCredential[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          roomId: data.roomId,
          username: data.username,
          pinCode: data.pinCode,
          role: data.role as UserRole,
          deviceId: data.deviceId || undefined,
          assignedAt: data.assignedAt || undefined,
          assignedByUid: data.assignedByUid,
        };
      });
      onUpdate(creds);
    },
    err => handleFirestoreError(err, OperationType.LIST, `rooms/${cleanRoomId}/credentials`)
  );
}

export async function upsertRoomCredentialInDb(
  roomId: string,
  assignedByUid: string,
  credential: RoomCredential
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const cleanBy = sanitizeId(assignedByUid);
  const credId = sanitizeId(`cred_${credential.username.trim().toLowerCase()}`);
  const ref = doc(db, 'rooms', cleanRoomId, 'credentials', credId);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `rooms/${cleanRoomId}/credentials/${credId}`);
  }

  const baseData: Record<string, unknown> = {
    username: truncateString(credential.username.trim(), 40),
    pinCode: truncateString(credential.pinCode.trim(), 20),
    role: credential.role,
    deviceId: credential.deviceId ? truncateString(credential.deviceId.trim(), 64) : null,
    assignedAt: credential.assignedAt || new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    assignedByUid: cleanBy,
    updatedAt: serverTimestamp(),
  };

  if (snap.exists()) {
    try {
      await updateDoc(ref, baseData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${cleanRoomId}/credentials/${credId}`);
    }
  } else {
    try {
      await setDoc(ref, {
        ...baseData,
        id: credId,
        roomId: cleanRoomId,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${cleanRoomId}/credentials/${credId}`);
    }
  }
}

export async function deleteRoomCredentialInDb(roomId: string, username: string): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const credId = sanitizeId(`cred_${username.trim().toLowerCase()}`);
  try {
    await deleteDoc(doc(db, 'rooms', cleanRoomId, 'credentials', credId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanRoomId}/credentials/${credId}`);
  }
}

export async function fetchRoomCredentialsOnce(roomId: string): Promise<RoomCredential[]> {
  const cleanRoomId = sanitizeId(roomId);
  const q = query(
    collection(db, 'rooms', cleanRoomId, 'credentials'),
    where('roomId', '==', cleanRoomId)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        roomId: data.roomId,
        username: data.username,
        pinCode: data.pinCode,
        role: data.role as UserRole,
        deviceId: data.deviceId || undefined,
        assignedAt: data.assignedAt || undefined,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `rooms/${cleanRoomId}/credentials`);
  }
}

export function subscribeRoomBans(
  roomId: string,
  onUpdate: (bans: BannedUserEntry[]) => void
): Unsubscribe {
  const cleanRoomId = sanitizeId(roomId);
  const q = query(collection(db, 'rooms', cleanRoomId, 'bans'), where('roomId', '==', cleanRoomId));
  return onSnapshot(
    q,
    snap => {
      const list: BannedUserEntry[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          roomId: data.roomId,
          ip: data.ip,
          deviceId: data.deviceId || undefined,
          username: data.username,
          targetUid: data.targetUid || undefined,
          bannedAt: data.bannedAt,
          bannedBy: data.bannedBy,
          bannedByUid: data.bannedByUid,
        };
      });
      onUpdate(list);
    },
    err => handleFirestoreError(err, OperationType.LIST, `rooms/${cleanRoomId}/bans`)
  );
}

export async function fetchRoomBansOnce(roomId: string): Promise<BannedUserEntry[]> {
  const cleanRoomId = sanitizeId(roomId);
  const q = query(collection(db, 'rooms', cleanRoomId, 'bans'), where('roomId', '==', cleanRoomId));
  try {
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        roomId: data.roomId,
        ip: data.ip,
        deviceId: data.deviceId || undefined,
        username: data.username,
        targetUid: data.targetUid || undefined,
        bannedAt: data.bannedAt,
        bannedBy: data.bannedBy,
      };
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `rooms/${cleanRoomId}/bans`);
  }
}

export async function addRoomBanInDb(
  roomId: string,
  bannedByUid: string,
  ban: BannedUserEntry
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const banId = sanitizeId(`ban_${ban.targetUid || ban.ip}`);
  const payload: Record<string, unknown> = {
    id: banId,
    roomId: cleanRoomId,
    ip: truncateString(ban.ip, 64),
    username: truncateString(ban.username, 40),
    bannedAt: truncateString(ban.bannedAt, 40),
    bannedBy: truncateString(ban.bannedBy, 40),
    bannedByUid: sanitizeId(bannedByUid),
    createdAt: serverTimestamp(),
  };
  if (ban.deviceId) payload.deviceId = truncateString(ban.deviceId, 64);
  if (ban.targetUid) payload.targetUid = truncateString(ban.targetUid, 128);

  try {
    await setDoc(doc(db, 'rooms', cleanRoomId, 'bans', banId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${cleanRoomId}/bans/${banId}`);
  }
}

export async function removeRoomBanInDb(roomId: string, banIdOrIp: string): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const q = query(collection(db, 'rooms', cleanRoomId, 'bans'), where('roomId', '==', cleanRoomId));
  try {
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      if (d.id === banIdOrIp || d.data().ip === banIdOrIp) {
        await deleteDoc(d.ref);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanRoomId}/bans`);
  }
}

// =========================================================
// Room Chat Messages
// =========================================================

export function subscribeRoomMessages(
  roomId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  sinceTimestamp?: Timestamp | null
): Unsubscribe {
  const cleanRoomId = sanitizeId(roomId);
  const cutoffTs = sinceTimestamp ?? Timestamp.now();
  const q = query(
    collection(db, 'rooms', cleanRoomId, 'messages'),
    where('roomId', '==', cleanRoomId),
    where('createdAt', '>=', cutoffTs)
  );
  return onSnapshot(
    q,
    snap => {
      const list: ChatMessage[] = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            roomId: data.roomId,
            senderUid: data.senderUid,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole as UserRole,
            senderAvatar: data.senderAvatar,
            senderFlag: data.senderFlag,
            content: data.content,
            timestamp: data.timestamp,
            createdAtMs: timestampToMs(data.createdAt),
            color: data.color || undefined,
            isBold: Boolean(data.isBold),
            type: data.type,
            imageUrl: data.imageUrl || undefined,
            voiceClipUrl: data.voiceClipUrl || undefined,
            voiceDuration: typeof data.voiceDuration === 'number' ? data.voiceDuration : undefined,
            giftData: data.giftData || undefined,
          } as ChatMessage;
        })
        .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0))
        .slice(-150);
      onUpdate(list);
    },
    err => handleFirestoreError(err, OperationType.LIST, `rooms/${cleanRoomId}/messages`)
  );
}

export async function fetchRoomMessageTimestamp(
  roomId: string,
  msgId: string
): Promise<Timestamp | null> {
  const cleanRoomId = sanitizeId(roomId);
  const cleanMsgId = sanitizeId(msgId);
  try {
    const snap = await getDocFromServer(doc(db, 'rooms', cleanRoomId, 'messages', cleanMsgId));
    const createdAt = snap.data()?.createdAt;
    return createdAt instanceof Timestamp ? createdAt : null;
  } catch (err) {
    console.warn('Could not fetch message server timestamp:', err);
    return null;
  }
}

export async function sendRoomMessageInDb(
  roomId: string,
  senderUid: string,
  msg: Omit<ChatMessage, 'id' | 'roomId' | 'senderUid' | 'createdAtMs'>,
  customMsgId?: string
): Promise<string> {
  const cleanRoomId = sanitizeId(roomId);
  const rawAuthUid = auth.currentUser?.uid || senderUid;
  const cleanSenderUid = /^[a-zA-Z0-9_\-]+$/.test(rawAuthUid) ? rawAuthUid : sanitizeId(rawAuthUid);
  const msgId = customMsgId
    ? sanitizeId(customMsgId)
    : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const payload: Record<string, unknown> = {
    id: msgId,
    roomId: cleanRoomId,
    senderUid: cleanSenderUid,
    senderId: truncateString(msg.senderId || cleanSenderUid || 'system', 128) || 'system',
    senderName: truncateString((msg.senderName || 'عضو ليالي').trim() || 'عضو ليالي', 50),
    senderRole: msg.senderRole && msg.senderRole in ROLE_HIERARCHY ? msg.senderRole : 'guest',
    senderAvatar: truncateString(msg.senderAvatar || DEFAULT_CROWN_AVATAR, 190000),
    senderFlag: truncateString(msg.senderFlag || '🌐', 16),
    content: truncateString(msg.content || '', 2000),
    timestamp: truncateString(msg.timestamp || '00:00', 40),
    type: msg.type,
    createdAt: serverTimestamp(),
  };

  if (msg.color) payload.color = truncateString(msg.color, 20);
  if (msg.isBold !== undefined) payload.isBold = Boolean(msg.isBold);
  if (msg.imageUrl) {
    payload.imageUrl = await compressImageDataUrl(msg.imageUrl, 800, 450000);
  }
  if (msg.voiceClipUrl) {
    payload.voiceClipUrl = truncateString(msg.voiceClipUrl, 450000);
  }
  if (msg.voiceDuration !== undefined) {
    payload.voiceDuration = Math.max(0, Math.min(120, Math.round(msg.voiceDuration)));
  }
  if (msg.giftData) {
    payload.giftData = {
      giftId: truncateString(msg.giftData.giftId, 40),
      giftName: truncateString(msg.giftData.giftName, 60),
      icon: truncateString(msg.giftData.icon, 16),
      value: Math.max(0, Number(msg.giftData.value)),
      ...(msg.giftData.targetUserName
        ? { targetUserName: truncateString(msg.giftData.targetUserName, 50) }
        : {}),
    };
  }

  try {
    await setDoc(doc(db, 'rooms', cleanRoomId, 'messages', msgId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${cleanRoomId}/messages/${msgId}`);
  }
  return msgId;
}

export async function clearRoomMessagesInDb(
  roomId: string,
  noticeMsg: {
    senderUid: string;
    senderName: string;
    senderRole: UserRole;
    senderAvatar: string;
    senderFlag: string;
    content: string;
  }
): Promise<void> {
  const cleanRoomId = sanitizeId(roomId);
  const q = query(collection(db, 'rooms', cleanRoomId, 'messages'), where('roomId', '==', cleanRoomId));
  let snap;
  try {
    snap = await getDocs(q);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, `rooms/${cleanRoomId}/messages`);
  }

  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanRoomId}/messages`);
    }
  }

  await sendRoomMessageInDb(cleanRoomId, noticeMsg.senderUid, {
    senderId: 'system',
    senderName: noticeMsg.senderName,
    senderRole: noticeMsg.senderRole,
    senderAvatar: noticeMsg.senderAvatar,
    senderFlag: noticeMsg.senderFlag,
    content: noticeMsg.content,
    timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    type: 'system',
  });
}

// =========================================================
// Private Chats (1-to-1)
// =========================================================

export function subscribePrivateConversationsList(
  myUid: string,
  onUpdate: (convs: { chatId: string; partnerUid: string }[]) => void
): Unsubscribe {
  const cleanMyUid = sanitizeId(myUid);
  const q = query(
    collection(db, 'users_public', cleanMyUid, 'inbox'),
    where('ownerId', '==', cleanMyUid)
  );
  return onSnapshot(
    q,
    snap => {
      const list = snap.docs
        .map(d => {
          const data = d.data();
          const partnerUid = typeof data.partnerId === 'string' ? data.partnerId : '';
          return { chatId: d.id, partnerUid };
        })
        .filter(item => Boolean(item.partnerUid));
      onUpdate(list);
    },
    err => handleFirestoreError(err, OperationType.LIST, `users_public/${cleanMyUid}/inbox`)
  );
}

export function subscribePrivateMessages(
  myUid: string,
  partnerUid: string,
  onUpdate: (messages: PrivateMessage[]) => void
): Unsubscribe {
  const cleanMyUid = sanitizeId(myUid);
  const chatId = getConversationId(cleanMyUid, partnerUid);
  const q = query(
    collection(db, 'private_chats', chatId, 'messages'),
    where('conversationId', '==', chatId)
  );
  return onSnapshot(
    q,
    snap => {
      const msgs: PrivateMessage[] = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            conversationId: data.conversationId,
            senderId: data.senderId,
            recipientId: data.recipientId,
            participantIds: data.participantIds,
            content: data.content,
            timestamp: data.timestamp,
            createdAtMs: timestampToMs(data.createdAt),
          };
        })
        .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
      onUpdate(msgs);
    },
    err => handleFirestoreError(err, OperationType.LIST, `private_chats/${chatId}/messages`)
  );
}

export async function sendPrivateMessageInDb(
  senderUid: string,
  recipientUid: string,
  content: string
): Promise<void> {
  const cleanSender = sanitizeId(senderUid);
  const cleanRecipient = sanitizeId(recipientUid);
  const chatId = getConversationId(cleanSender, cleanRecipient);
  const participantIds = [cleanSender, cleanRecipient].sort();
  const timestamp = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const trimmed = truncateString(content.trim(), 2000);
  if (!trimmed) return;

  const chatRef = doc(db, 'private_chats', chatId);
  let chatSnap;
  try {
    chatSnap = await getDoc(chatRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `private_chats/${chatId}`);
  }

  if (!chatSnap.exists()) {
    try {
      await setDoc(chatRef, {
        id: chatId,
        participantIds,
        lastMessage: trimmed,
        lastTimestamp: timestamp,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `private_chats/${chatId}`);
    }
  } else {
    try {
      await updateDoc(chatRef, {
        lastMessage: trimmed,
        lastTimestamp: timestamp,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `private_chats/${chatId}`);
    }
  }

  const upsertInboxEntry = async (ownerId: string, partnerId: string) => {
    const inboxRef = doc(db, 'users_public', ownerId, 'inbox', chatId);
    let inboxSnap;
    try {
      inboxSnap = await getDoc(inboxRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users_public/${ownerId}/inbox/${chatId}`);
    }
    if (!inboxSnap.exists()) {
      try {
        await setDoc(inboxRef, {
          id: chatId,
          ownerId,
          partnerId,
          lastMessage: trimmed,
          lastTimestamp: timestamp,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users_public/${ownerId}/inbox/${chatId}`);
      }
    } else {
      try {
        await updateDoc(inboxRef, {
          lastMessage: trimmed,
          lastTimestamp: timestamp,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users_public/${ownerId}/inbox/${chatId}`);
      }
    }
  };

  await Promise.all([
    upsertInboxEntry(cleanSender, cleanRecipient),
    ...(cleanRecipient !== cleanSender ? [upsertInboxEntry(cleanRecipient, cleanSender)] : []),
  ]);

  const msgId = `pm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(db, 'private_chats', chatId, 'messages', msgId), {
      id: msgId,
      conversationId: chatId,
      senderId: cleanSender,
      recipientId: cleanRecipient,
      participantIds,
      content: trimmed,
      timestamp,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `private_chats/${chatId}/messages/${msgId}`);
  }
}

// =========================================================
// Safety Compliance: Abuse Reports, Local Block List & Mic Disclosure
// =========================================================

const BLOCKED_USERS_KEY_PREFIX = 'layali_blocked_users_v1_';
const MIC_DISCLOSURE_ACCEPTED_KEY = 'layali_mic_disclosure_accepted_v1';

export function loadBlockedUserIds(myUid: string): string[] {
  try {
    const cleanUid = sanitizeId(myUid);
    const raw = window.localStorage.getItem(`${BLOCKED_USERS_KEY_PREFIX}${cleanUid}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export function saveBlockedUserIds(myUid: string, ids: string[]): void {
  try {
    const cleanUid = sanitizeId(myUid);
    const unique = Array.from(new Set(ids.filter(Boolean))).slice(0, 500);
    window.localStorage.setItem(`${BLOCKED_USERS_KEY_PREFIX}${cleanUid}`, JSON.stringify(unique));
  } catch {
    // ignore storage errors
  }
}

export function hasAcceptedMicDisclosure(): boolean {
  try {
    return window.localStorage.getItem(MIC_DISCLOSURE_ACCEPTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markMicDisclosureAccepted(): void {
  try {
    window.localStorage.setItem(MIC_DISCLOSURE_ACCEPTED_KEY, 'true');
  } catch {
    // ignore storage errors
  }
}

export async function submitUserReportInDb(report: {
  roomId: string;
  reporterId: string;
  reporterName: string;
  targetUserId: string;
  targetUsername: string;
  reason: string;
  details?: string;
}): Promise<string> {
  const cleanRoomId = sanitizeId(report.roomId);
  const cleanReporterId = sanitizeId(report.reporterId);
  const cleanTargetId = sanitizeId(report.targetUserId);
  const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const payload: Record<string, unknown> = {
    id: reportId,
    roomId: cleanRoomId,
    reporterId: cleanReporterId,
    reporterName: truncateString((report.reporterName || 'عضو ليالي').trim() || 'عضو ليالي', 50),
    targetUserId: cleanTargetId,
    targetUsername: truncateString((report.targetUsername || 'مستخدم').trim() || 'مستخدم', 50),
    reason: truncateString((report.reason || 'إساءة أو مخالفة').trim() || 'إساءة أو مخالفة', 120),
    createdAt: serverTimestamp(),
  };

  const trimmedDetails = report.details?.trim();
  if (trimmedDetails) {
    payload.details = truncateString(trimmedDetails, 500);
  }

  try {
    await setDoc(doc(db, 'rooms', cleanRoomId, 'reports', reportId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `rooms/${cleanRoomId}/reports/${reportId}`);
  }

  return reportId;
}

// =========================================================
// Room Master & Rank Verification (Name + Secret PIN Bound)
// =========================================================

export interface VerifiedEntranceResult {
  role: UserRole;
  title: string;
  verified: boolean;
  isMasterMatch: boolean;
  masterRejectedReason?: string;
}

export function verifyRoomEntranceRole(
  room: Room,
  rawUsername: string,
  rawPinCode?: string
): VerifiedEntranceResult {
  const trimmedUser = (rawUsername || '').trim();
  const trimmedPin = (rawPinCode || '').trim();
  const savedMasterName = (room.ownerName || '').trim();
  const savedMasterPin = (room.masterPinCode || '').trim();

  if (!trimmedPin) {
    return {
      role: 'guest',
      title: 'دخول كزائر عادي',
      verified: true,
      isMasterMatch: false,
    };
  }

  // 1. Strict Master Verification: BOTH exact Master Name AND saved Master PIN must match
  if (savedMasterName && savedMasterPin && trimmedPin === savedMasterPin) {
    if (trimmedUser === savedMasterName) {
      return {
        role: 'owner',
        title: 'ماستر الروم (المالك)',
        verified: true,
        isMasterMatch: true,
      };
    }
  }

  // 2. Check Assigned Credentials for this room (bound to both username and pinCode)
  if (room.userCredentials && room.userCredentials.length > 0) {
    const match = room.userCredentials.find(
      c =>
        c.username.trim().toLowerCase() === trimmedUser.toLowerCase() &&
        c.pinCode.trim() === trimmedPin
    );
    if (match) {
      const isConflictingMasterPin =
        match.role === 'owner' &&
        Boolean(savedMasterPin) &&
        trimmedPin === savedMasterPin &&
        trimmedUser !== savedMasterName;

      if (!isConflictingMasterPin) {
        return {
          role: match.role,
          title: ROLE_HIERARCHY[match.role]?.label || match.role,
          verified: true,
          isMasterMatch: match.role === 'owner',
        };
      }
    }
  }

  // 3. Reject Master grant if someone entered the Master PIN with a non-matching name
  if (savedMasterPin && trimmedPin === savedMasterPin && trimmedUser !== savedMasterName) {
    return {
      role: 'guest',
      title: 'مرفوض (الاسم لا يطابق اسم الماستر)',
      verified: false,
      isMasterMatch: false,
      masterRejectedReason:
        'تم رفض صلاحية الماستر: اسم المستخدم المدخل يجب أن يتطابق تماماً مع اسم الماستر المحفوظ لهذه الغرفة.',
    };
  }

  // 4. Fallback when PIN does not match any authorized account
  return {
    role: 'guest',
    title: 'رمز غير مطابق (دخول كزائر)',
    verified: false,
    isMasterMatch: false,
  };
}
