import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Gift,
  Palette,
  MessageSquare,
  Mic,
  MicOff,
  Play,
  Pause,
  Sparkles,
  Image as ImageIcon,
  ZoomIn,
  X,
  Eraser,
  Trash2,
  Lock,
} from 'lucide-react';
import { ChatMessage, UserProfile, isRoomAdminRole, normalizeUserRole } from '../types/loqana';
import { QUICK_PHRASES, TEXT_COLORS } from '../data/mockLoqanaData';
import { soundEngine } from '../services/soundEngine';
import { UserBadge } from './UserBadge';
import { useTheme, getReadableTextColor, getReadableRoleColor } from '../context/ThemeContext';

interface ChatAreaProps {
  messages: ChatMessage[];
  currentUser: UserProfile;
  speaker: UserProfile | null;
  queueUsers: UserProfile[];
  onTakeMic: () => void;
  onReleaseMic: (reason?: 'manual' | 'timeout') => void;
  onJoinQueue: () => void;
  onLeaveQueue: () => void;
  isMicLocked?: boolean;
  isMicTransitioning?: boolean;
  onSendMessage: (text: string, color?: string, isBold?: boolean) => void;
  onOpenGifts: () => void;
  onSelectUser: (userId: string) => void;
  isMuted: boolean;
  onClearMyChat?: () => void;
  onClearAllChat?: () => void;
  onRankWarning?: (message: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  currentUser,
  speaker,
  queueUsers,
  onTakeMic,
  onReleaseMic,
  onJoinQueue,
  onLeaveQueue,
  isMicLocked = false,
  isMicTransitioning = false,
  onSendMessage,
  onOpenGifts,
  onSelectUser,
  isMuted,
  onClearMyChat,
  onClearAllChat,
  onRankWarning,
}) => {
  const { isDarkMode } = useTheme();
  const [inputText, setInputText] = useState('');
  const [selectedColor, setSelectedColor] = useState(currentUser.textColor || '#f8fafc');
  const [isBold, setIsBold] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showPhrases, setShowPhrases] = useState(false);
  const [showClearOptions, setShowClearOptions] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  const isCurrentUserSpeaking = speaker?.id === currentUser.id;
  const userQueueIndex = queueUsers.findIndex(u => u.id === currentUser.id);
  const isInQueue = userQueueIndex !== -1;
  const isStaff = isRoomAdminRole(currentUser.role);
  const isLockedForMe = Boolean(isMicLocked) && !isStaff;
  const canClearRoomChat = normalizeUserRole(currentUser.role) !== 'guest';

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Send Text
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    if (!isMuted) {
      soundEngine.playMessageChime();
    }
    onSendMessage(inputText.trim(), selectedColor, isBold);
    setInputText('');
  };

  // Quick phrase click
  const handleSelectPhrase = (phrase: string) => {
    if (!isMuted) {
      soundEngine.playMessageChime();
    }
    onSendMessage(phrase, selectedColor, isBold);
    setShowPhrases(false);
  };

  // Bottom-left Live Mic Toggle (Ascend / Descend / Queue)
  const handleBottomMicToggle = () => {
    if (isMicTransitioning) return;
    if (currentUser.isMuted) {
      onRankWarning?.('🔇 أنت مكتوم حالياً في هذه الغرفة ولا يمكنك التحدث بالمايك');
      return;
    }
    if (isCurrentUserSpeaking) {
      onReleaseMic('manual');
      return;
    }
    if (isInQueue) {
      onLeaveQueue();
      return;
    }
    if (isLockedForMe) {
      onTakeMic();
      return;
    }
    if (!speaker) {
      onTakeMic();
      return;
    }
    onJoinQueue();
  };

  // Play voice clip in message
  const handlePlayVoice = (id: string, url?: string) => {
    if (!url) return;

    if (playingVoiceId === id) {
      audioPlayerRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(url);
      audioPlayerRef.current = audio;
      audio.play();
      setPlayingVoiceId(id);
      audio.onended = () => {
        setPlayingVoiceId(null);
      };
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#090d16] overflow-hidden text-right select-text transition-colors duration-300">
      {/* Messages Scroll Area */}
      <div className="flex-1 p-2.5 overflow-y-auto space-y-2.5">
        {messages.map(msg => {
          // Special System Entry Message
          if (msg.type === 'system') {
            return (
              <div
                key={msg.id}
                className="py-1 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/20 text-center text-[11px] text-amber-800 dark:text-amber-300/90 shadow-xs flex items-center justify-center gap-1.5"
              >
                <Sparkles size={11} className="text-amber-600 dark:text-amber-400" />
                <span>{msg.content}</span>
              </div>
            );
          }

          // Special Gift Broadcast Message
          if (msg.type === 'gift' && msg.giftData) {
            return (
              <div
                key={msg.id}
                className="py-2 px-3 rounded-xl bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 dark:from-amber-900/40 dark:via-red-900/30 dark:to-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-center text-xs text-slate-900 dark:text-white shadow-sm dark:shadow-md flex items-center justify-center gap-2"
              >
                <span className="text-2xl animate-bounce">{msg.giftData.icon}</span>
                <div>
                  <span className="font-bold text-amber-700 dark:text-amber-300">{msg.senderName}</span>
                  <span className="text-slate-600 dark:text-slate-300"> أهدى </span>
                  <span className="font-bold text-amber-700 dark:text-amber-300">{msg.giftData.targetUserName || 'الروم'}</span>
                  <span className="text-rose-700 dark:text-amber-200"> «{msg.giftData.giftName}» </span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">({msg.giftData.value} كوينز)</span>
                </div>
              </div>
            );
          }

          // Mic event message
          if (msg.type === 'mic_event') {
            return (
              <div
                key={msg.id}
                className="py-1 px-2 rounded-lg bg-slate-100 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 text-center"
              >
                {msg.content}
              </div>
            );
          }

          // Voice Clip Message
          if (msg.type === 'voice_clip') {
            return (
              <div
                key={msg.id}
                className="bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 rounded-xl p-2 max-w-[85%] shadow-sm"
              >
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <UserBadge role={msg.senderRole} size="sm" />
                  <span className="text-xs">{msg.senderFlag}</span>
                  <button
                    onClick={() => onSelectUser(msg.senderId)}
                    className="text-xs font-black hover:underline cursor-pointer truncate max-w-[120px]"
                    style={{ color: getReadableRoleColor(msg.senderRole, isDarkMode) }}
                  >
                    {msg.senderName}
                  </button>
                  <span className="text-[10px] text-slate-500 mr-auto font-mono">{msg.timestamp}</span>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-slate-950/80 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => handlePlayVoice(msg.id, msg.voiceClipUrl)}
                    className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-400 active:scale-95 transition-all shrink-0"
                  >
                    {playingVoiceId === msg.id ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <div className="flex-1 flex items-center gap-1">
                    <div className="h-4 flex-1 flex items-center gap-0.5">
                      {[30, 80, 50, 90, 40, 75, 60, 95, 45, 80, 60, 40, 85, 30].map((h, i) => (
                        <div
                          key={i}
                          className={`flex-1 rounded-full ${
                            playingVoiceId === msg.id ? 'bg-amber-500 dark:bg-amber-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300 font-mono">
                    0:0{msg.voiceDuration || 4}
                  </span>
                </div>
              </div>
            );
          }

          // Image Message (خاص بأصحاب الرتب - مشاركة الكاميرا والصور)
          if (msg.type === 'image' && msg.imageUrl) {
            return (
              <div
                key={msg.id}
                className="bg-slate-50 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500/30 rounded-2xl p-2.5 max-w-[85%] sm:max-w-[70%] shadow-sm dark:shadow-md transition-all text-right"
              >
                {/* Sender Header */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <UserBadge role={msg.senderRole} size="sm" />
                  <span className="text-xs">{msg.senderFlag}</span>
                  <button
                    onClick={() => onSelectUser(msg.senderId)}
                    className="text-xs font-black hover:underline cursor-pointer truncate max-w-[130px]"
                    style={{ color: getReadableRoleColor(msg.senderRole, isDarkMode) }}
                  >
                    {msg.senderName}
                  </button>
                  <span className="text-[10px] text-slate-500 mr-auto font-mono">{msg.timestamp}</span>
                </div>

                {/* Image Container */}
                <div
                  onClick={() => setZoomImageUrl(msg.imageUrl || null)}
                  className="relative group/img rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/60 bg-slate-950 dark:bg-black cursor-pointer shadow-inner"
                >
                  <img
                    src={msg.imageUrl}
                    alt="صورة مرسلة في الروم"
                    referrerPolicy="no-referrer"
                    className="w-full max-h-[260px] object-cover group-hover/img:scale-102 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center gap-1.5 text-white text-xs font-bold transition-opacity">
                    <ZoomIn size={16} />
                    <span>انقر لتكبير الصورة</span>
                  </div>
                </div>

                {/* Optional Caption */}
                {msg.content && msg.content !== 'صورة' && (
                  <p
                    className="mt-2 text-xs text-right break-words leading-relaxed"
                    style={{
                      color: getReadableTextColor(msg.color, isDarkMode),
                      fontWeight: msg.isBold ? 700 : 500,
                    }}
                  >
                    {msg.content}
                  </p>
                )}
              </div>
            );
          }

          // Regular Chat Message (Loqana Style)
          return (
            <div
              key={msg.id}
              className="group bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/40 dark:hover:bg-slate-900/70 p-1.5 rounded-lg transition-colors border border-slate-200 dark:border-transparent hover:border-slate-300 dark:hover:border-slate-800/60 leading-relaxed text-right"
            >
              <div className="flex items-baseline gap-1.5 flex-wrap">
                <span className="text-xs">{msg.senderFlag}</span>
                <UserBadge role={msg.senderRole} size="sm" showLabel={false} />
                <button
                  onClick={() => onSelectUser(msg.senderId)}
                  className="text-xs font-black hover:underline cursor-pointer transition-colors"
                  style={{ color: getReadableRoleColor(msg.senderRole, isDarkMode) }}
                >
                  {msg.senderName}:
                </button>
                <span
                  className="text-xs break-words"
                  style={{
                    color: getReadableTextColor(msg.color, isDarkMode),
                    fontWeight: msg.isBold ? 700 : 500,
                  }}
                >
                  {msg.content}
                </span>
                <span className="text-[9px] text-slate-400 dark:text-slate-600 font-mono mr-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  {msg.timestamp}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Phrases Drawer Popover */}
      {showPhrases && (
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 text-xs grid grid-cols-2 gap-1.5 animate-in slide-in-from-bottom-2 duration-150 transition-colors duration-300">
          <div className="col-span-2 flex items-center justify-between pb-1 text-slate-500 dark:text-slate-400 text-[11px] border-b border-slate-200 dark:border-slate-800">
            <span>الاختصارات السريعة لدردشة اليالي الصوتية</span>
            <button
              onClick={() => setShowPhrases(false)}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              ✕
            </button>
          </div>
          {QUICK_PHRASES.map((phrase, i) => (
            <button
              key={i}
              onClick={() => handleSelectPhrase(phrase)}
              className="p-1.5 rounded-lg bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-right text-[11px] truncate border border-slate-200 dark:border-slate-700/60 active:scale-95 transition-all"
            >
              {phrase}
            </button>
          ))}
        </div>
      )}

      {/* Text Color Picker Popover */}
      {showColorPicker && (
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 text-xs animate-in slide-in-from-bottom-2 duration-150 transition-colors duration-300">
          <div className="flex items-center justify-between pb-1 text-slate-500 dark:text-slate-400 text-[11px] border-b border-slate-200 dark:border-slate-800 mb-2">
            <span>اختر لون الخط المفضل لرسائلك</span>
            <button
              onClick={() => setShowColorPicker(false)}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-2 touch-scroll-x py-1 px-1">
            {TEXT_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => {
                  setSelectedColor(c.value);
                  setShowColorPicker(false);
                }}
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-transform active:scale-90 ${
                  selectedColor === c.value
                    ? 'scale-110 border-amber-500 dark:border-white shadow-md'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
                style={{ backgroundColor: c.value }}
                title={c.name}
              />
            ))}
            <button
              onClick={() => setIsBold(!isBold)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 whitespace-nowrap ${
                isBold
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
            >
              B عريض
            </button>
          </div>
        </div>
      )}

      {/* Clear Chat Options Popover */}
      {showClearOptions && (
        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 text-xs animate-in slide-in-from-bottom-2 duration-150 transition-colors duration-300">
          <div className="flex items-center justify-between pb-1.5 text-slate-500 dark:text-slate-400 text-[11px] border-b border-slate-200 dark:border-slate-800 mb-2">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
              <Eraser size={14} />
              <span>خيارات مسح شاشة المحادثة (Clear Chat)</span>
            </span>
            <button
              onClick={() => setShowClearOptions(false)}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* 1. مسح شاشتي فقط */}
            <button
              type="button"
              onClick={() => {
                onClearMyChat?.();
                setShowClearOptions(false);
              }}
              className="p-2 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-right flex items-center gap-2 active:scale-95 transition-all"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-slate-700 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <Eraser size={15} />
              </div>
              <div className="min-w-0">
                <span className="font-bold block truncate text-xs">مسح شاشتي فقط</span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">محلي لجهازك</span>
              </div>
            </button>

            {/* 2. مسح شاشة الروم للكل */}
            {canClearRoomChat ? (
              <button
                type="button"
                onClick={() => {
                  onClearAllChat?.();
                  setShowClearOptions(false);
                }}
                className="p-2 rounded-xl bg-gradient-to-r from-amber-50 to-red-50 hover:from-amber-100 hover:to-red-100 dark:from-amber-950/60 dark:to-red-950/50 dark:hover:from-amber-900/60 dark:hover:to-red-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 text-right flex items-center gap-2 active:scale-95 transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Trash2 size={15} />
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate text-xs text-amber-800 dark:text-amber-300">مسح للكل 👑</span>
                  <span className="text-[9px] text-amber-700 dark:text-amber-300/80 block truncate">حذف الشات للجميع</span>
                </div>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onRankWarning?.('مسح شاشة الروم للكل مخصص لأصحاب الرتب فقط');
                  setShowClearOptions(false);
                }}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 text-right flex items-center gap-2 opacity-60 cursor-not-allowed"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-600 flex items-center justify-center shrink-0">
                  <Lock size={15} />
                </div>
                <div className="min-w-0">
                  <span className="font-bold block truncate text-xs text-slate-500">مسح للكل</span>
                  <span className="text-[9px] text-slate-500 dark:text-slate-600 block truncate">خاص بالرتب فقط</span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Input Action Bar (Wide writing box + Live Mic control on the left) */}
      <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 px-2.5 py-2 transition-colors duration-300">
        {currentUser.isMuted ? (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/40 rounded-xl text-center text-xs text-red-700 dark:text-red-300 font-bold flex items-center justify-center gap-2">
            <span>🔇 أنت مكتوم حالياً في هذه الغرفة من قِبل الإدارة</span>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-1.5 w-full">
            {/* Compact Tool Buttons Strip */}
            <div className="flex items-center gap-1 touch-scroll-x shrink-0 py-0.5">
              {/* Gifts Button */}
              <button
                type="button"
                onClick={onOpenGifts}
                className="w-8 h-8 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-sm active:scale-95 transition-all shrink-0 flex items-center justify-center"
                title="متجر الهدايا الفاخرة"
              >
                <Gift size={16} />
              </button>

              {/* Quick Phrases Trigger */}
              <button
                type="button"
                onClick={() => {
                  setShowPhrases(!showPhrases);
                  setShowColorPicker(false);
                  setShowClearOptions(false);
                }}
                className={`w-8 h-8 rounded-xl border transition-all active:scale-95 shrink-0 flex items-center justify-center ${
                  showPhrases
                    ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="العبارات والاختصارات السريعة"
              >
                <MessageSquare size={15} />
              </button>

              {/* Color Picker Trigger */}
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowPhrases(false);
                  setShowClearOptions(false);
                }}
                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all active:scale-95 shrink-0 flex items-center justify-center"
                title="تغيير لون الخط"
              >
                <Palette size={15} style={{ color: getReadableTextColor(selectedColor, isDarkMode) }} />
              </button>

              {/* Clear Chat Trigger */}
              <button
                type="button"
                onClick={() => {
                  setShowClearOptions(!showClearOptions);
                  setShowPhrases(false);
                  setShowColorPicker(false);
                }}
                className={`w-8 h-8 rounded-xl border transition-all active:scale-95 shrink-0 flex items-center justify-center ${
                  showClearOptions
                    ? 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
                title="خيارات مسح شاشة المحادثة"
              >
                <Eraser size={15} />
              </button>
            </div>

            {/* Expanded Text Input Box */}
            <div className="flex-1 min-w-0 relative flex items-center">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="اكتب رسالتك في الروم..."
                style={{
                  color: getReadableTextColor(selectedColor, isDarkMode),
                  fontWeight: isBold ? 700 : 500,
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700/90 focus:border-amber-500 dark:focus:border-amber-400 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-right outline-none transition-colors shadow-xs placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Send Button (appears cleanly when text is entered) */}
            {inputText.trim() && (
              <button
                type="submit"
                className="w-9 h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold active:scale-95 transition-all shrink-0 shadow-md flex items-center justify-center"
                title="إرسال"
              >
                <Send size={17} className="transform rotate-180" />
              </button>
            )}

            {/* Live Mic Ascend/Descend Toggle Button (Far Left of Writing Bar) */}
            <button
              type="button"
              disabled={isMicTransitioning}
              onClick={handleBottomMicToggle}
              title={
                isCurrentUserSpeaking
                  ? 'أنت على المايك — اضغط للنزول وتسليم المايك'
                  : isInQueue
                  ? `أنت في السرا (#${userQueueIndex + 1}) — اضغط لإلغاء الطلب`
                  : isLockedForMe && !speaker
                  ? 'المايك مقفل حالياً ومخصص للإدارة فقط'
                  : speaker
                  ? 'حجز دور في سرا المايك'
                  : 'صعود للمايك المباشر والتحدث'
              }
              className={`h-9 rounded-xl border font-bold active:scale-95 transition-all shrink-0 flex items-center justify-center gap-1 disabled:opacity-60 ${
                isCurrentUserSpeaking
                  ? 'px-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-red-400 shadow-md shadow-red-600/25 animate-pulse'
                  : isInQueue
                  ? 'px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-sm'
                  : isLockedForMe && !speaker
                  ? 'w-9 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                  : !speaker
                  ? 'w-9 bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 border-amber-300 shadow-sm'
                  : 'w-9 bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
              }`}
            >
              {isCurrentUserSpeaking ? (
                <>
                  <MicOff size={16} />
                  <span className="text-[11px]">نزول</span>
                </>
              ) : isInQueue ? (
                <>
                  <Mic size={15} />
                  <span className="text-[10px] font-black font-mono">#{userQueueIndex + 1}</span>
                </>
              ) : isLockedForMe && !speaker ? (
                <Lock size={15} />
              ) : (
                <Mic size={17} />
              )}
            </button>
          </form>
        )}
      </div>

      {/* Image Preview & Zoom Modal */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 dark:bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setZoomImageUrl(null)}
        >
          <div
            className="relative max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-3 shadow-2xl flex flex-col items-center transition-colors duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
              <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <ImageIcon size={14} />
                <span>معاينة الصورة</span>
              </span>
              <button
                onClick={() => setZoomImageUrl(null)}
                className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                title="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="w-full rounded-2xl overflow-hidden bg-slate-950 dark:bg-black max-h-[70vh] flex items-center justify-center border border-slate-200 dark:border-slate-800">
              <img
                src={zoomImageUrl}
                alt="معاينة كاملة"
                className="w-full h-auto max-h-[68vh] object-contain"
              />
            </div>

            <button
              onClick={() => setZoomImageUrl(null)}
              className="w-full mt-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs transition-colors"
            >
              إغلاق المعاينة
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
