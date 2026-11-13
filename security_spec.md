# Security Specification — دردشة اليالي الصوتية (Layali)

## 1. Data Invariants
1. **Verified Identity**: No read or write is permitted without a verified Firebase Auth account (`request.auth != null && request.auth.token.email_verified == true`).
2. **PII Isolation**: User email, profile PIN, and device ID live exclusively in `/users_private/{userId}` and are readable/writable only by `request.auth.uid == userId` or verified admin (`abolaith03675@gmail.com` with `email_verified == true`). Public display fields live in `/users_public/{userId}`.
3. **Anti-Privilege Escalation**: Users creating `/users_public/{userId}` cannot self-assign `owner`, `vip`, `admin`, or `super_admin` globally; only `'member'` or `'guest'` is allowed on creation. Room ranks are stored per-room after credential/PIN verification.
4. **Master Gate & Relational Sync**: All room subcollections (`participants`, `credentials`, `bans`, `messages`) verify parent room existence via `exists(/databases/$(database)/documents/rooms/$(roomId))` on create. Private chat messages verify the caller is in the parent `participantIds` array.
5. **Temporal Integrity & Immutability**: `createdAt` must equal `request.time` on creation and never change on update. `updatedAt` must equal `request.time` on updates. Ownership fields (`ownerUid`, `senderUid`, `senderId`, `roomId`, `conversationId`) are immutable.
6. **Bounded Payloads**: Every string enforces `.size()` bounds (`id` <= 128 matching `^[a-zA-Z0-9_\-]+$`, `avatar` <= 200000, `imageUrl`/`voiceClipUrl` <= 500000) and every array enforces `.size()` bounds (`micQueue` <= 50, `mutedUserIds` <= 200, `participantIds` == 2).
7. **Query Enforcer**: Every `allow list` inspects `resource.data` directly (e.g., `resource.data.isPublic == true`, `resource.data.roomId == roomId`, `request.auth.uid in resource.data.participantIds`) without `get()` or `exists()`.

## 2. The "Dirty Dozen" Attack Payloads (All Expected: PERMISSION_DENIED)
1. **Unauthenticated Room Read**: Unauthenticated client calls `getDocs(collection(db, 'rooms'))` -> DENIED.
2. **Unverified Email Spoof Admin**: User with `email: 'abolaith03675@gmail.com'` and `email_verified: false` tries to delete any room -> DENIED.
3. **PII Snooping**: User A calls `getDoc(doc(db, 'users_private', 'userB'))` -> DENIED.
4. **Self-Role Escalation**: User A creates `/users_public/userA` with `role: 'owner'` -> DENIED.
5. **Shadow / Ghost Field Injection**: User A creates `/rooms/r1/messages/m1` adding `isSystemAdmin: true` -> DENIED (`keys().hasOnly(...)`).
6. **Identity Spoofing on Message**: User A sends message in `/rooms/r1/messages/m1` with `senderUid: 'userB'` -> DENIED.
7. **Client-Forged Timestamp**: User A creates `/rooms/r1/messages/m1` with `createdAt: new Date(2020, 1, 1)` -> DENIED (`!= request.time`).
8. **ID Poisoning**: User A writes `/rooms/invalid!id$with@spaces/messages/m1` -> DENIED (`isValidId`).
9. **Resource Exhaustion / 1MB String**: User A sends a chat message with `content` length > 2000 chars -> DENIED.
10. **Guest Clearing Room Chat for Everyone**: User with `role: 'guest'` in `/rooms/r1/participants/{uid}` attempts to delete another user's message -> DENIED.
11. **Private Chat Eavesdropping**: User C (not in `participantIds`) tries to `get` or `list` `/private_chats/userA_userB/messages` -> DENIED.
12. **Orphaned Subcollection Write**: User A tries to write `/rooms/nonexistent_room/messages/m1` -> DENIED (`exists(room)` fails).
