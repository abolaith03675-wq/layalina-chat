import React, { useState } from 'react';
import { Gift, Coins, Plus, X, Check } from 'lucide-react';
import { GiftItem, UserProfile } from '../types/loqana';
import { GIFTS_CATALOG } from '../data/mockLoqanaData';
import { soundEngine } from '../services/soundEngine';

interface GiftModalProps {
  currentUser: UserProfile;
  speaker: UserProfile | null;
  users: UserProfile[];
  onClose: () => void;
  onSendGift: (gift: GiftItem, recipientId?: string, recipientName?: string) => void;
  onRechargeCoins: (amount: number) => void;
  isMuted: boolean;
}

export const GiftModal: React.FC<GiftModalProps> = ({
  currentUser,
  speaker,
  users,
  onClose,
  onSendGift,
  onRechargeCoins,
  isMuted,
}) => {
  const [selectedGift, setSelectedGift] = useState<GiftItem>(GIFTS_CATALOG[0]);
  const [recipientType, setRecipientType] = useState<'room' | 'speaker' | 'user'>(
    speaker ? 'speaker' : 'room'
  );
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'all' | 'classic' | 'luxury' | 'royal'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filteredGifts = GIFTS_CATALOG.filter(
    g => activeTab === 'all' || g.category === activeTab
  );

  const handleSend = () => {
    if (currentUser.coins < selectedGift.price) {
      setErrorMsg('رصيدك من الكوينز غير كافٍ! اضغط على زر (+) لشحن رصيدك فوراً.');
      soundEngine.playWarningTone();
      setTimeout(() => setErrorMsg(null), 3500);
      return;
    }
    setErrorMsg(null);

    if (!isMuted) {
      soundEngine.playGiftChime();
    }

    let recipientId: string | undefined;
    let recipientName: string | undefined;

    if (recipientType === 'speaker' && speaker) {
      recipientId = speaker.id;
      recipientName = speaker.username;
    } else if (recipientType === 'user') {
      const target = users.find(u => u.id === selectedUserId);
      if (target) {
        recipientId = target.id;
        recipientName = target.username;
      }
    } else {
      recipientName = 'الروم العام 👑';
    }

    onSendGift(selectedGift, recipientId, recipientName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-md overflow-hidden text-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 px-4 py-3 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift size={20} className="text-amber-400" />
            <h2 className="font-bold text-sm text-amber-300">متجر الهدايا الفاخرة</h2>
          </div>

          {/* User Coins Balance */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-2.5 py-1 text-xs">
              <Coins size={14} className="text-amber-400" />
              <span className="font-mono font-bold text-amber-300">
                {currentUser.coins.toLocaleString('ar-SA')}
              </span>
            </div>
            {/* Top-up free button */}
            <button
              onClick={() => onRechargeCoins(5000)}
              className="p-1.5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md active:scale-95 transition-all"
              title="شحن 5000 كوينز مجاناً للتجربة"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-white mr-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Recipient Selection Bar */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 text-right">
          <label className="text-[11px] text-slate-400 block mb-1.5 font-semibold">
            إهداء إلى:
          </label>
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            {speaker && (
              <button
                onClick={() => setRecipientType('speaker')}
                className={`py-1.5 px-2 rounded-xl border text-center transition-all truncate ${
                  recipientType === 'speaker'
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                المتحدث 🎙️
              </button>
            )}
            <button
              onClick={() => setRecipientType('room')}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                recipientType === 'room'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              الروم العام 👑
            </button>
            <button
              onClick={() => setRecipientType('user')}
              className={`py-1.5 px-2 rounded-xl border text-center transition-all ${
                recipientType === 'user'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              عضو محدد 👤
            </button>
          </div>

          {/* Specific user dropdown */}
          {recipientType === 'user' && (
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white outline-none"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.flag} {u.username}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 px-3 pt-2 border-b border-slate-800 text-xs">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'classic', label: 'كلاسيكية' },
            { id: 'luxury', label: 'فاخرة' },
            { id: 'royal', label: 'ملكية 👑' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'all' | 'classic' | 'luxury' | 'royal')}
              className={`px-3 py-1.5 rounded-t-lg transition-colors border-b-2 font-medium ${
                activeTab === tab.id
                  ? 'text-amber-400 border-amber-400 bg-slate-800/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Gifts Grid */}
        <div className="flex-1 p-3 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {filteredGifts.map(gift => {
            const isSelected = selectedGift.id === gift.id;
            const canAfford = currentUser.coins >= gift.price;

            return (
              <button
                key={gift.id}
                onClick={() => setSelectedGift(gift)}
                className={`p-2 rounded-2xl border text-center flex flex-col items-center justify-between transition-all relative ${
                  isSelected
                    ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/40 shadow-lg scale-102'
                    : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800'
                } ${!canAfford ? 'opacity-60' : ''}`}
              >
                {isSelected && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center">
                    <Check size={11} strokeWidth={3} />
                  </div>
                )}
                <span className="text-3xl my-1 transform group-hover:scale-110 transition-transform">
                  {gift.icon}
                </span>
                <span className="text-[11px] font-bold text-slate-200 truncate w-full mb-1">
                  {gift.name}
                </span>
                <div className="flex items-center gap-1 bg-slate-950/70 px-2 py-0.5 rounded-full border border-slate-800">
                  <Coins size={10} className="text-amber-400" />
                  <span className="text-[10px] font-mono text-amber-300 font-bold">
                    {gift.price}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Insufficient Coins Inline Error */}
        {errorMsg && (
          <div className="mx-3 mb-2 p-2 rounded-xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs text-center font-bold">
            {errorMsg}
          </div>
        )}

        {/* Footer & Send Action */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block">الهدية المختارة:</span>
            <div className="flex items-center gap-1">
              <span className="text-base">{selectedGift.icon}</span>
              <span className="text-xs font-bold text-amber-300">{selectedGift.name}</span>
            </div>
          </div>

          <button
            onClick={handleSend}
            className="flex-1 max-w-[180px] py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <Gift size={16} />
            <span>إرسال الهدية ({selectedGift.price})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
