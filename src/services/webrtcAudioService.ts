import { WebRtcSignalDoc } from '../types/loqana';
import {
  cleanupStaleWebRtcSignalsInDb,
  sanitizeId,
  subscribeRoomWebRtcSignals,
  upsertWebRtcSignalInDb,
} from './firebaseService';
import { soundEngine } from './soundEngine';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const RTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 4,
};

function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function buildSignalDocId(
  type: 'offer' | 'answer',
  sessionId: string,
  speakerUid: string,
  listenerUid: string
): string {
  const prefix = type === 'offer' ? 'off' : 'ans';
  return sanitizeId(`${prefix}_${shortHash(sessionId)}_${shortHash(speakerUid)}_${shortHash(listenerUid)}`);
}

interface OutboundPeerState {
  listenerUid: string;
  pc: RTCPeerConnection;
  localSdp: string;
  localIceCandidates: string[];
  flushTimer: number | null;
  remoteAnswerSdp: string;
  appliedIceSet: Set<string>;
  pendingRemoteIce: string[];
  retryCount: number;
  makingOffer: boolean;
}

interface InboundPeerState {
  speakerUid: string;
  pc: RTCPeerConnection;
  appliedOfferSdp: string;
  appliedIceSet: Set<string>;
  pendingRemoteIce: string[];
  localSdp: string;
  localIceCandidates: string[];
  flushTimer: number | null;
}

export type WebRtcMicError = 'denied' | 'unavailable' | null;

class WebRtcAudioService {
  private roomId: string | null = null;
  private localUid: string | null = null;
  private sessionId: string | null = null;
  private activeSpeakerId: string | null = null;
  private listenerIds: string[] = [];

  private localMicStream: MediaStream | null = null;
  private outboundPeers = new Map<string, OutboundPeerState>();
  private inboundPeer: InboundPeerState | null = null;

  private unsubSignals: (() => void) | null = null;
  private latestSignals: WebRtcSignalDoc[] = [];

  private remoteAudioEl: HTMLAudioElement | null = null;
  private remoteStream: MediaStream | null = null;
  private isRoomMuted = false;

  private playbackBlockedCallback: ((blocked: boolean) => void) | null = null;
  private micErrorCallback: ((err: WebRtcMicError) => void) | null = null;
  private connectionCountCallback: ((count: number) => void) | null = null;

  setCallbacks(callbacks: {
    onPlaybackBlockedChange?: (blocked: boolean) => void;
    onMicError?: (err: WebRtcMicError) => void;
    onConnectedPeersChange?: (count: number) => void;
  }) {
    this.playbackBlockedCallback = callbacks.onPlaybackBlockedChange || null;
    this.micErrorCallback = callbacks.onMicError || null;
    this.connectionCountCallback = callbacks.onConnectedPeersChange || null;
  }

  private notifyConnectedPeers() {
    if (!this.connectionCountCallback) return;
    if (this.activeSpeakerId && this.activeSpeakerId === this.localUid) {
      let connected = 0;
      this.outboundPeers.forEach(p => {
        if (p.pc.connectionState === 'connected' || p.pc.iceConnectionState === 'connected' || p.pc.iceConnectionState === 'completed') {
          connected++;
        }
      });
      this.connectionCountCallback(connected);
    } else if (this.inboundPeer) {
      const s = this.inboundPeer.pc.connectionState;
      const ice = this.inboundPeer.pc.iceConnectionState;
      this.connectionCountCallback(s === 'connected' || ice === 'connected' || ice === 'completed' ? 1 : 0);
    } else {
      this.connectionCountCallback(0);
    }
  }

  private ensureAudioElement(): HTMLAudioElement {
    if (!this.remoteAudioEl) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.setAttribute('playsinline', 'true');
      audio.muted = this.isRoomMuted;
      audio.volume = 1;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      this.remoteAudioEl = audio;
    }
    this.remoteAudioEl.muted = this.isRoomMuted;
    return this.remoteAudioEl;
  }

  /**
   * Call during a user gesture (e.g., entering room or clicking enable audio)
   * so mobile Safari/Chrome allows subsequent remote WebRTC audio playback.
   */
  unlockAudioElement() {
    soundEngine.unlockAudio();
    const audio = this.ensureAudioElement();
    if (audio.srcObject && !this.isRoomMuted) {
      audio
        .play()
        .then(() => this.playbackBlockedCallback?.(false))
        .catch(() => {});
    }
  }

  async resumeRemoteAudio(): Promise<boolean> {
    soundEngine.unlockAudio();
    const audio = this.ensureAudioElement();
    audio.muted = this.isRoomMuted;
    if (!this.remoteStream) {
      this.playbackBlockedCallback?.(false);
      return true;
    }
    if (audio.srcObject !== this.remoteStream) {
      audio.srcObject = this.remoteStream;
    }
    try {
      await audio.play();
      this.playbackBlockedCallback?.(false);
      return true;
    } catch {
      this.playbackBlockedCallback?.(true);
      return false;
    }
  }

  setRemoteMuted(muted: boolean) {
    this.isRoomMuted = Boolean(muted);
    if (this.remoteAudioEl) {
      this.remoteAudioEl.muted = this.isRoomMuted;
      if (!this.isRoomMuted && this.remoteStream) {
        this.remoteAudioEl
          .play()
          .then(() => this.playbackBlockedCallback?.(false))
          .catch(() => this.playbackBlockedCallback?.(true));
      }
    }
  }

  async acquireLocalMic(): Promise<MediaStream | null> {
    if (
      this.localMicStream &&
      this.localMicStream.getAudioTracks().some(t => t.readyState === 'live')
    ) {
      soundEngine.attachExternalMicStream(this.localMicStream);
      this.micErrorCallback?.(null);
      return this.localMicStream;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.micErrorCallback?.('unavailable');
      return null;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      this.localMicStream = stream;
      soundEngine.attachExternalMicStream(stream);
      this.micErrorCallback?.(null);
      return stream;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        this.micErrorCallback?.('denied');
      } else {
        this.micErrorCallback?.('unavailable');
      }
      return null;
    }
  }

  stopLocalMic() {
    if (this.localMicStream) {
      this.localMicStream.getTracks().forEach(t => t.stop());
      this.localMicStream = null;
    }
    soundEngine.attachExternalMicStream(null);
    soundEngine.stopMicrophone();
    this.micErrorCallback?.(null);
  }

  private closeAllPeers(keepLocalMic = false) {
    this.outboundPeers.forEach(peer => {
      if (peer.flushTimer) window.clearTimeout(peer.flushTimer);
      try {
        peer.pc.close();
      } catch {
        // ignore close errors
      }
    });
    this.outboundPeers.clear();

    if (this.inboundPeer) {
      if (this.inboundPeer.flushTimer) window.clearTimeout(this.inboundPeer.flushTimer);
      try {
        this.inboundPeer.pc.close();
      } catch {
        // ignore close errors
      }
      this.inboundPeer = null;
    }

    if (this.remoteAudioEl) {
      this.remoteAudioEl.pause();
      this.remoteAudioEl.srcObject = null;
    }
    this.remoteStream = null;
    soundEngine.attachRemoteSpeakerStream(null);
    this.playbackBlockedCallback?.(false);

    if (!keepLocalMic) {
      this.stopLocalMic();
    }
    this.notifyConnectedPeers();
  }

  stopAll() {
    if (this.unsubSignals) {
      this.unsubSignals();
      this.unsubSignals = null;
    }
    this.closeAllPeers(false);
    this.roomId = null;
    this.localUid = null;
    this.sessionId = null;
    this.activeSpeakerId = null;
    this.listenerIds = [];
    this.latestSignals = [];
  }

  async syncRoomState(params: {
    activeInRoom: boolean;
    roomId: string | null;
    localUid: string | null;
    activeSpeakerId: string | null;
    micSessionId: string | null;
    participantIds: string[];
    isSelfMutedInRoom: boolean;
  }) {
    const {
      activeInRoom,
      roomId,
      localUid,
      activeSpeakerId,
      micSessionId,
      participantIds,
      isSelfMutedInRoom,
    } = params;

    if (!activeInRoom || !roomId || !localUid) {
      this.stopAll();
      return;
    }

    const cleanRoomId = sanitizeId(roomId);
    const cleanLocalUid = sanitizeId(localUid);
    const cleanSpeakerId = activeSpeakerId ? sanitizeId(activeSpeakerId) : null;
    const effectiveSessionId = cleanSpeakerId
      ? sanitizeId(micSessionId || `spk_${cleanSpeakerId}`)
      : null;

    const roomChanged = this.roomId !== cleanRoomId || this.localUid !== cleanLocalUid;
    const sessionChanged =
      this.sessionId !== effectiveSessionId || this.activeSpeakerId !== cleanSpeakerId;

    this.roomId = cleanRoomId;
    this.localUid = cleanLocalUid;
    this.listenerIds = participantIds
      .map(id => sanitizeId(id))
      .filter(id => id && id !== cleanLocalUid);

    if (roomChanged) {
      if (this.unsubSignals) {
        this.unsubSignals();
        this.unsubSignals = null;
      }
      this.latestSignals = [];
      this.closeAllPeers(false);

      this.unsubSignals = subscribeRoomWebRtcSignals(cleanRoomId, signals => {
        this.latestSignals = signals;
        this.processIncomingSignals();
      });
    }

    if (sessionChanged) {
      const amNextSpeaker = Boolean(cleanSpeakerId && cleanSpeakerId === cleanLocalUid && !isSelfMutedInRoom);
      this.closeAllPeers(amNextSpeaker);
      this.activeSpeakerId = cleanSpeakerId;
      this.sessionId = effectiveSessionId;

      if (!cleanSpeakerId || !effectiveSessionId) {
        if (!amNextSpeaker) {
          this.stopLocalMic();
        }
        return;
      }

      if (amNextSpeaker) {
        void cleanupStaleWebRtcSignalsInDb(cleanRoomId, effectiveSessionId);
      }
    }

    if (!this.activeSpeakerId || !this.sessionId) {
      this.closeAllPeers(false);
      return;
    }

    const amSpeaker = this.activeSpeakerId === cleanLocalUid && !isSelfMutedInRoom;
    if (amSpeaker) {
      await this.ensureSpeakerPeers();
      this.processIncomingSignals();
    } else {
      this.stopLocalMic();
      this.processIncomingSignals();
    }
  }

  private async ensureSpeakerPeers() {
    if (!this.roomId || !this.localUid || !this.sessionId) return;
    const stream = await this.acquireLocalMic();
    if (!stream) return;

    const currentRoomId = this.roomId;
    const currentLocalUid = this.localUid;
    const currentSessionId = this.sessionId;

    // Remove peers who left the room
    const activeSet = new Set(this.listenerIds);
    Array.from(this.outboundPeers.keys()).forEach(uid => {
      if (!activeSet.has(uid)) {
        const peer = this.outboundPeers.get(uid);
        if (peer) {
          if (peer.flushTimer) window.clearTimeout(peer.flushTimer);
          try {
            peer.pc.close();
          } catch {
            // ignore
          }
        }
        this.outboundPeers.delete(uid);
      }
    });

    // Create outbound peers for all current listeners in the room
    for (const listenerUid of this.listenerIds) {
      if (!this.outboundPeers.has(listenerUid)) {
        await this.createOutboundPeer(currentRoomId, currentSessionId, currentLocalUid, listenerUid, stream);
      }
    }
  }

  private scheduleOutboundSignalFlush(
    roomId: string,
    sessionId: string,
    speakerUid: string,
    peer: OutboundPeerState
  ) {
    if (peer.flushTimer) window.clearTimeout(peer.flushTimer);
    peer.flushTimer = window.setTimeout(() => {
      peer.flushTimer = null;
      if (!peer.localSdp) return;
      const docId = buildSignalDocId('offer', sessionId, speakerUid, peer.listenerUid);
      void upsertWebRtcSignalInDb(roomId, {
        id: docId,
        sessionId,
        fromUid: speakerUid,
        toUid: peer.listenerUid,
        type: 'offer',
        sdp: peer.localSdp,
        iceCandidates: peer.localIceCandidates,
      });
    }, 80);
  }

  private async createOutboundPeer(
    roomId: string,
    sessionId: string,
    speakerUid: string,
    listenerUid: string,
    stream: MediaStream,
    retryCount = 0
  ) {
    if (this.sessionId !== sessionId || this.activeSpeakerId !== speakerUid) return;

    const existing = this.outboundPeers.get(listenerUid);
    if (existing) {
      if (existing.flushTimer) window.clearTimeout(existing.flushTimer);
      try {
        existing.pc.close();
      } catch {
        // ignore
      }
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerState: OutboundPeerState = {
      listenerUid,
      pc,
      localSdp: '',
      localIceCandidates: [],
      flushTimer: null,
      remoteAnswerSdp: '',
      appliedIceSet: new Set(),
      pendingRemoteIce: [],
      retryCount,
      makingOffer: true,
    };
    this.outboundPeers.set(listenerUid, peerState);

    stream.getAudioTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = event => {
      if (event.candidate) {
        const serialized = JSON.stringify(event.candidate.toJSON());
        if (peerState.localIceCandidates.length < 80 && !peerState.localIceCandidates.includes(serialized)) {
          peerState.localIceCandidates.push(serialized);
          this.scheduleOutboundSignalFlush(roomId, sessionId, speakerUid, peerState);
        }
      }
    };

    const handleStateChange = () => {
      this.notifyConnectedPeers();
      if (
        (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') &&
        peerState.retryCount < 3 &&
        this.sessionId === sessionId &&
        this.activeSpeakerId === speakerUid &&
        this.localMicStream
      ) {
        const nextRetry = peerState.retryCount + 1;
        window.setTimeout(() => {
          if (this.sessionId === sessionId && this.activeSpeakerId === speakerUid && this.localMicStream) {
            void this.createOutboundPeer(roomId, sessionId, speakerUid, listenerUid, this.localMicStream, nextRetry);
          }
        }, 700 * nextRetry);
      }
    };

    pc.onconnectionstatechange = handleStateChange;
    pc.oniceconnectionstatechange = handleStateChange;

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: false });
      if (this.sessionId !== sessionId) return;
      await pc.setLocalDescription(offer);
      peerState.localSdp = offer.sdp || '';
      peerState.makingOffer = false;

      const docId = buildSignalDocId('offer', sessionId, speakerUid, listenerUid);
      await upsertWebRtcSignalInDb(roomId, {
        id: docId,
        sessionId,
        fromUid: speakerUid,
        toUid: listenerUid,
        type: 'offer',
        sdp: peerState.localSdp,
        iceCandidates: peerState.localIceCandidates,
      });
    } catch (err) {
      peerState.makingOffer = false;
      console.warn('WebRTC outbound offer error:', err);
    }
  }

  private scheduleInboundSignalFlush(
    roomId: string,
    sessionId: string,
    listenerUid: string,
    peer: InboundPeerState
  ) {
    if (peer.flushTimer) window.clearTimeout(peer.flushTimer);
    peer.flushTimer = window.setTimeout(() => {
      peer.flushTimer = null;
      if (!peer.localSdp) return;
      const docId = buildSignalDocId('answer', sessionId, peer.speakerUid, listenerUid);
      void upsertWebRtcSignalInDb(roomId, {
        id: docId,
        sessionId,
        fromUid: listenerUid,
        toUid: peer.speakerUid,
        type: 'answer',
        sdp: peer.localSdp,
        iceCandidates: peer.localIceCandidates,
      });
    }, 80);
  }

  private processIncomingSignals() {
    if (!this.roomId || !this.localUid || !this.sessionId || !this.activeSpeakerId) return;

    const currentRoomId = this.roomId;
    const currentLocalUid = this.localUid;
    const currentSessionId = this.sessionId;
    const currentSpeakerId = this.activeSpeakerId;

    const sessionSignals = this.latestSignals.filter(s => s.sessionId === currentSessionId);

    // 1. If I am the speaker, process answers from listeners
    if (currentSpeakerId === currentLocalUid) {
      const answers = sessionSignals.filter(
        s => s.type === 'answer' && s.toUid === currentLocalUid
      );
      for (const ans of answers) {
        const peer = this.outboundPeers.get(ans.fromUid);
        if (!peer) continue;
        void this.applyAnswerToOutboundPeer(peer, ans);
      }
      return;
    }

    // 2. If I am a listener, look for an offer addressed to me from the active speaker
    const offer = sessionSignals.find(
      s => s.type === 'offer' && s.fromUid === currentSpeakerId && s.toUid === currentLocalUid
    );
    if (!offer || !offer.sdp) return;

    void this.handleOfferAsListener(currentRoomId, currentSessionId, currentLocalUid, offer);
  }

  private async applyAnswerToOutboundPeer(peer: OutboundPeerState, ans: WebRtcSignalDoc) {
    try {
      if (ans.sdp && peer.remoteAnswerSdp !== ans.sdp && peer.pc.signalingState === 'have-local-offer') {
        peer.remoteAnswerSdp = ans.sdp;
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: ans.sdp });
      }

      if (peer.pc.remoteDescription) {
        for (const raw of peer.pendingRemoteIce) {
          if (!peer.appliedIceSet.has(raw)) {
            peer.appliedIceSet.add(raw);
            try {
              await peer.pc.addIceCandidate(JSON.parse(raw) as RTCIceCandidateInit);
            } catch {
              // ignore stale candidate
            }
          }
        }
        peer.pendingRemoteIce = [];

        for (const raw of ans.iceCandidates) {
          if (!peer.appliedIceSet.has(raw)) {
            peer.appliedIceSet.add(raw);
            try {
              await peer.pc.addIceCandidate(JSON.parse(raw) as RTCIceCandidateInit);
            } catch {
              // ignore stale candidate
            }
          }
        }
      } else {
        for (const raw of ans.iceCandidates) {
          if (!peer.appliedIceSet.has(raw) && !peer.pendingRemoteIce.includes(raw)) {
            peer.pendingRemoteIce.push(raw);
          }
        }
      }
    } catch (err) {
      console.warn('Error applying WebRTC answer:', err);
    }
  }

  private async handleOfferAsListener(
    roomId: string,
    sessionId: string,
    listenerUid: string,
    offer: WebRtcSignalDoc
  ) {
    try {
      const needNewPeer =
        !this.inboundPeer ||
        this.inboundPeer.speakerUid !== offer.fromUid ||
        (this.inboundPeer.appliedOfferSdp && this.inboundPeer.appliedOfferSdp !== offer.sdp);

      if (needNewPeer) {
        if (this.inboundPeer) {
          if (this.inboundPeer.flushTimer) window.clearTimeout(this.inboundPeer.flushTimer);
          try {
            this.inboundPeer.pc.close();
          } catch {
            // ignore
          }
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        const inbound: InboundPeerState = {
          speakerUid: offer.fromUid,
          pc,
          appliedOfferSdp: '',
          appliedIceSet: new Set(),
          pendingRemoteIce: [],
          localSdp: '',
          localIceCandidates: [],
          flushTimer: null,
        };
        this.inboundPeer = inbound;

        pc.ontrack = event => {
          const stream =
            event.streams && event.streams[0]
              ? event.streams[0]
              : new MediaStream([event.track]);
          this.remoteStream = stream;
          soundEngine.attachRemoteSpeakerStream(stream);
          const audio = this.ensureAudioElement();
          audio.srcObject = stream;
          audio.muted = this.isRoomMuted;
          if (!this.isRoomMuted) {
            audio
              .play()
              .then(() => this.playbackBlockedCallback?.(false))
              .catch(() => this.playbackBlockedCallback?.(true));
          }
        };

        pc.onicecandidate = event => {
          if (event.candidate) {
            const serialized = JSON.stringify(event.candidate.toJSON());
            if (inbound.localIceCandidates.length < 80 && !inbound.localIceCandidates.includes(serialized)) {
              inbound.localIceCandidates.push(serialized);
              this.scheduleInboundSignalFlush(roomId, sessionId, listenerUid, inbound);
            }
          }
        };

        pc.onconnectionstatechange = () => this.notifyConnectedPeers();
        pc.oniceconnectionstatechange = () => this.notifyConnectedPeers();
      }

      const peer = this.inboundPeer;
      if (!peer) return;

      if (peer.appliedOfferSdp !== offer.sdp) {
        peer.appliedOfferSdp = offer.sdp;
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });

        const answer = await peer.pc.createAnswer();
        if (this.sessionId !== sessionId) return;
        await peer.pc.setLocalDescription(answer);
        peer.localSdp = answer.sdp || '';

        const docId = buildSignalDocId('answer', sessionId, offer.fromUid, listenerUid);
        await upsertWebRtcSignalInDb(roomId, {
          id: docId,
          sessionId,
          fromUid: listenerUid,
          toUid: offer.fromUid,
          type: 'answer',
          sdp: peer.localSdp,
          iceCandidates: peer.localIceCandidates,
        });
      }

      if (peer.pc.remoteDescription) {
        for (const raw of offer.iceCandidates) {
          if (!peer.appliedIceSet.has(raw)) {
            peer.appliedIceSet.add(raw);
            try {
              await peer.pc.addIceCandidate(JSON.parse(raw) as RTCIceCandidateInit);
            } catch {
              // ignore stale candidate
            }
          }
        }
      }
    } catch (err) {
      console.warn('Error handling WebRTC offer as listener:', err);
    }
  }
}

export const webrtcAudioService = new WebRtcAudioService();
