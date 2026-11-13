import React, { useState } from 'react';
import { X, Send, User, MessageCircle, Lock } from 'lucide-react';
import { PrivateMessage, UserProfile } from '../types/loqana';
import { soundEngine } from '../services/soundEngine';

interface PrivateChatDrawerProps {
  currentUser: UserProfile;
  activeChatUser: UserProfile | null;
  conversations: { user: UserProfile; messages: PrivateMessage[] }[];
  onClose: () => void;
  onSelectChatUser: (user: UserProfile) => void;
  onSendMessage: (recipientId: string, content: string) => void;
  isMuted: boolean;
}

export const PrivateChatDrawer: React.FC<PrivateChatDrawerProps> = ({
  currentUser,
  activeChatUser,
  conversations,
  onClose,
  onSelectChatUser,
  onSendMessage,
  isMuted,
}) => {
  const [inputText, setInputText] = useState('');

  const currentConversation = conversations.find(
    c => c.user.id === activeChatUser?.id
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeChatUser) return;

    if (!isMuted) {
      soundEngine.playMessageChime();
    }
    onSendMessage(activeChatUser.id, inputText.trim());
    setInputText('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md h-[80vh] flex flex-col text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-amber-400" />
            <h2 className="font-bold text-sm text-white">الرسائل الخاصة (الخاص)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conversation Partner Tabs */}
        {conversations.length > 0 && (
          <div className="flex items-center gap-1.5 p-2 bg-slate-950/60 border-b border-slate-800 overflow-x-auto scrollbar-none">
            {conversations.map(conv => {
              const isSelected = conv.user.id === activeChatUser?.id;
              return (
                <button
                  key={conv.user.id}
                  onClick={() => onSelectChatUser(conv.user)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs shrink-0 transition-all ${
                    isSelected
                      ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <img
                    src={conv.user.avatar}
                    alt={conv.user.username}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover"
                  />
                  <span className="truncate max-w-[90px]">{conv.user.username}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Active Conversation Details */}
        {activeChatUser ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Partner Mini Bar */}
            <div className="px-3 py-2 bg-slate-850 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-right">
              <div className="flex items-center gap-2">
                <img
                  src={activeChatUser.avatar}
                  alt={activeChatUser.username}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover border border-amber-400/50"
                />
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-white">{activeChatUser.username}</span>
                    <span className="text-xs">{activeChatUser.flag}</span>
                  </div>
                  {activeChatUser.isPrivateChatLocked ? (
                    <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                      <Lock size={10} />
                       <span>الخاص مقفل</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 block">متصل الآن</span>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 text-right">
              {currentConversation?.messages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-10">
                  لا توجد رسائل سابقة.. ابدأ المحادثة الآن بسلام أو تحية 🌹
                </div>
              ) : (
                currentConversation?.messages.map(msg => {
                  const isMine = msg.senderId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-[78%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-sm ${
                          isMine
                            ? 'bg-amber-500 text-slate-950 font-medium rounded-br-xs'
                            : 'bg-slate-800 text-white rounded-bl-xs border border-slate-700/60'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="text-[9px] text-slate-600 font-mono mt-0.5 px-1">
                        {msg.timestamp}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input or Locked Notice */}
            {activeChatUser.isPrivateChatLocked ? (
              <div className="p-3.5 bg-red-950/60 border-t border-red-500/40 text-center text-xs text-red-300 flex items-center justify-center gap-2">
                <Lock size={16} className="text-red-400 shrink-0" />
                <span className="font-bold">هذا المستخدم قام بقفل الرسائل الخاصة حالياً</span>
              </div>
            ) : (
              <form onSubmit={handleSend} className="p-2 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  placeholder="اكتب رسالة خاصة..."
                  className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none text-right"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold active:scale-95 transition-all"
                >
                  <Send size={16} className="transform rotate-180" />
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
            <MessageCircle size={36} className="text-slate-700 mb-2" />
            <p>اختر عضواً من قائمة المتواجدين لبدء محادثة خاصة (PM)</p>
          </div>
        )}
      </div>
    </div>
  );
};
