import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Users,
  Lock,
  Radio,
  Crown,
  ShieldAlert,
  KeyRound,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Compass,
  Sparkles,
  Calendar,
  Shield,
  Edit3,
  Trash2,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { Room, RoomCategory, UserProfile, RoleQuotas } from '../types/loqana';
import {
  DAY_IN_MS,
  getRoomExpiresAtMs,
  getRoomRemainingDays,
  isRoomExpired,
} from '../services/firebaseService';
import { PrivacyTermsModal } from './PrivacyTermsModal';

interface RoomListViewProps {
  rooms: Room[];
  currentUser: UserProfile;
  onSelectRoom: (room: Room) => void;
  onCreateRoom: (roomData: {
    name: string;
    category: RoomCategory;
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
  }) => Promise<boolean | string | void> | void;
  onUpdateRoom?: (updatedRoom: Room) => void;
  onDeleteRoom?: (roomId: string) => void;
  onOpenProfile: () => void;
}

// Arabic text normalizer for accurate search without hamza/ta-marbuta discrepancies
const normalizeArabic = (text: string = ''): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // strip Arabic diacritics
    .replace(/\s+/g, ' ');
};

// Full list of countries with codes and flags
const COUNTRIES_LIST: { id: RoomCategory; label: string; code: string; flag: string }[] = [
  { id: 'all', label: 'الكل', code: 'ALL', flag: '🌐' },
  { id: 'iraq', label: 'العراق', code: 'IQ', flag: '🇮🇶' },
  { id: 'egypt', label: 'مصر', code: 'EG', flag: '🇪🇬' },
  { id: 'saudi', label: 'السعودية', code: 'SA', flag: '🇸🇦' },
  { id: 'syria', label: 'سوريا', code: 'SY', flag: '🇸🇾' },
  { id: 'jordan', label: 'الأردن', code: 'JO', flag: '🇯🇴' },
  { id: 'lebanon', label: 'لبنان', code: 'LB', flag: '🇱🇧' },
  { id: 'palestine', label: 'فلسطين', code: 'PS', flag: '🇵🇸' },
  { id: 'libya', label: 'ليبيا', code: 'LY', flag: '🇱🇾' },
  { id: 'morocco', label: 'المغرب', code: 'MA', flag: '🇲🇦' },
  { id: 'algeria', label: 'الجزائر', code: 'DZ', flag: '🇩🇿' },
  { id: 'turkey', label: 'تركيا', code: 'TR', flag: '🇹🇷' },
  { id: 'gulf', label: 'دول الخليج', code: 'GULF', flag: '👑' },
  { id: 'yemen', label: 'اليمن', code: 'YE', flag: '🇾🇪' },
  { id: 'entertainment', label: 'مسابقات وتسلية', code: 'FUN', flag: '🎯' },
];

export const RoomListView: React.FC<RoomListViewProps> = ({
  rooms,
  currentUser,
  onSelectRoom,
  onCreateRoom,
  onUpdateRoom,
  onDeleteRoom,
  onOpenProfile,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<RoomCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const countriesScrollRef = useRef<HTMLDivElement>(null);

  // Owner Secret Code Gate State (ezez1976)
  const [showOwnerAuthModal, setShowOwnerAuthModal] = useState(false);
  const [ownerPasswordInput, setOwnerPasswordInput] = useState('');
  const [ownerAuthError, setOwnerAuthError] = useState('');
  const [showOwnerPanelModal, setShowOwnerPanelModal] = useState(false);
  const [ownerActiveTab, setOwnerActiveTab] = useState<'manage' | 'create'>('manage');
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Rooms edit & delete state
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');

  // Edit Room Form States
  const [editRoomName, setEditRoomName] = useState('');
  const [editIsGoldName, setEditIsGoldName] = useState(false);
  const [editValidityDays, setEditValidityDays] = useState(30);
  const [editMaxCapacity, setEditMaxCapacity] = useState(100);
  const [editVipQuota, setEditVipQuota] = useState(5);
  const [editAdminQuota, setEditAdminQuota] = useState(10);
  const [editSuperAdminQuota, setEditSuperAdminQuota] = useState(15);
  const [editMemberQuota, setEditMemberQuota] = useState(50);
  const [editMasterName, setEditMasterName] = useState('');
  const [editMasterPin, setEditMasterPin] = useState('1976');
  const [editRoomDesc, setEditRoomDesc] = useState('');
  const [editRoomPassword, setEditRoomPassword] = useState('');
  const [editCategory, setEditCategory] = useState<RoomCategory>('iraq');
  const [editCountryName, setEditCountryName] = useState('العراق');
  const [editFlag, setEditFlag] = useState('🇮🇶');
  const [editFormError, setEditFormError] = useState('');

  // New room form state with Assigned Master & 4-digit PIN
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomDesc, setNewRoomDesc] = useState('');
  const [newRoomCategory, setNewRoomCategory] = useState<RoomCategory>('iraq');
  const [newRoomCountryName, setNewRoomCountryName] = useState('العراق');
  const [newRoomFlag, setNewRoomFlag] = useState('🇮🇶');
  const [newMasterName, setNewMasterName] = useState('ماستر الروم');
  const [newMasterPin, setNewMasterPin] = useState('1976');
  const [newRoomPassword, setNewRoomPassword] = useState('');

  // 1. Room Expiration (1 to 365 days)
  const [newValidityDays, setNewValidityDays] = useState<number>(30);

  // 2. Gold/Yellow Room Name Toggle Switch
  const [newIsGoldName, setNewIsGoldName] = useState<boolean>(false);

  // 3. Room Capacity (Concurrent users)
  const [newMaxCapacity, setNewMaxCapacity] = useState<number>(100);

  // 4. Roles Quotas Limits
  const [newVipQuota, setNewVipQuota] = useState<number>(5);
  const [newAdminQuota, setNewAdminQuota] = useState<number>(10);
  const [newSuperAdminQuota, setNewSuperAdminQuota] = useState<number>(15);
  const [newMemberQuota, setNewMemberQuota] = useState<number>(50);

  const [formError, setFormError] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick every 30s so room expiration countdowns decrement automatically at 24h marks
  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Total online users calculation
  const totalOnline = rooms.reduce((acc, r) => acc + r.occupantsCount, 0);

  // Smooth scroll helper for horizontal countries bar
  const scrollCountries = (direction: 'left' | 'right') => {
    if (countriesScrollRef.current) {
      const scrollAmount = direction === 'left' ? -220 : 220;
      countriesScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Robust Search & Filter System
  const normQuery = normalizeArabic(searchQuery);

  const filteredRooms = rooms.filter(room => {
    // When a search query is active, search universally across all rooms and country metadata
    if (normQuery) {
      const normCountry = normalizeArabic(room.countryName || '');
      const normName = normalizeArabic(room.name || '');
      const normDesc = normalizeArabic(room.description || '');
      const normOwner = normalizeArabic(room.ownerName || '');
      const codeMatch = room.code?.includes(searchQuery.trim());

      const countryMatches =
        normCountry.includes(normQuery) ||
        normQuery.includes(normCountry) ||
        room.countryKeywords?.some(keyword => {
          const normK = normalizeArabic(keyword);
          return normK.includes(normQuery) || normQuery.includes(normK);
        });

      return (
        countryMatches ||
        normName.includes(normQuery) ||
        normDesc.includes(normQuery) ||
        normOwner.includes(normQuery) ||
        Boolean(codeMatch)
      );
    }

    // When search query is empty, filter by selectedCategory
    return selectedCategory === 'all' || room.category === selectedCategory;
  });

  // Handle click on "إنشاء روم"
  const handleOpenCreateRoom = () => {
    setOwnerPasswordInput('');
    setOwnerAuthError('');
    setShowOwnerAuthModal(true);
  };

  // Verify Owner Secret Passcode (ezez1976)
  const handleVerifyOwnerPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerPasswordInput.trim() === 'ezez1976') {
      setShowOwnerAuthModal(false);
      setOwnerAuthError('');
      setFormError('');
      setOwnerActiveTab('manage');
      setShowOwnerPanelModal(true);
    } else {
      setOwnerAuthError('الرمز السري غير صحيح! خاصية إدارة الرومات مقتصرة فقط على مالك التطبيق.');
    }
  };

  // Start Editing Room
  const handleStartEdit = (room: Room) => {
    const currentRemaining = getRoomRemainingDays(room, Date.now());
    setEditingRoom(room);
    setEditRoomName(room.name);
    setEditIsGoldName(Boolean(room.isGoldName));
    setEditValidityDays(Math.max(1, currentRemaining || room.validityDays || 30));
    setEditMaxCapacity(room.maxCapacity || 100);
    setEditVipQuota(room.roleQuotas?.vip ?? 5);
    setEditAdminQuota(room.roleQuotas?.admin ?? 10);
    setEditSuperAdminQuota(room.roleQuotas?.super_admin ?? 15);
    setEditMemberQuota(room.roleQuotas?.member ?? 50);
    setEditMasterName(room.ownerName);
    setEditMasterPin(room.masterPinCode || '1976');
    setEditRoomDesc(room.description || '');
    setEditRoomPassword(room.password || '');
    setEditCategory(room.category);
    setEditCountryName(room.countryName);
    setEditFlag(room.flag);
    setEditFormError('');
  };

  // Save Room Edit Changes
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;

    if (!editRoomName.trim()) {
      setEditFormError('يرجى كتابة اسم الغرفة');
      return;
    }
    if (!editMasterName.trim()) {
      setEditFormError('يرجى تعيين اسم ماستر الروم');
      return;
    }
    if (!/^\d{4}$/.test(editMasterPin.trim())) {
      setEditFormError('يجب أن يتكون الرمز السري للماستر من 4 أرقام بالضبط');
      return;
    }

    const validityNum = Number(editValidityDays);
    if (isNaN(validityNum) || validityNum < 1 || validityNum > 365) {
      setEditFormError('مدة صلاحية الروم يجب أن تكون بين 1 يوم و 365 يوماً');
      return;
    }

    const capacityNum = Number(editMaxCapacity);
    if (isNaN(capacityNum) || capacityNum < 5 || capacityNum > 1000) {
      setEditFormError('السعة الاستيعابية للروم يجب أن تكون بين 5 و 1000 عضو');
      return;
    }

    const currentNow = Date.now();
    const prevRemaining = getRoomRemainingDays(editingRoom, currentNow);
    const shouldRecalculateExpiry =
      isRoomExpired(editingRoom, currentNow) ||
      validityNum !== prevRemaining ||
      !getRoomExpiresAtMs(editingRoom);

    const nextExpiresAtMs = shouldRecalculateExpiry
      ? currentNow + validityNum * DAY_IN_MS
      : (getRoomExpiresAtMs(editingRoom) ?? currentNow + validityNum * DAY_IN_MS);

    const updated: Room = {
      ...editingRoom,
      name: editRoomName.trim(),
      isGoldName: Boolean(editIsGoldName),
      validityDays: validityNum,
      expiresAtMs: nextExpiresAtMs,
      expiresAt: new Date(nextExpiresAtMs).toISOString(),
      isActive: true,
      maxCapacity: capacityNum,
      roleQuotas: {
        vip: Math.max(0, Number(editVipQuota) || 0),
        admin: Math.max(0, Number(editAdminQuota) || 0),
        super_admin: Math.max(0, Number(editSuperAdminQuota) || 0),
        member: Math.max(0, Number(editMemberQuota) || 0),
      },
      ownerName: editMasterName.trim(),
      masterPinCode: editMasterPin.trim(),
      category: editCategory,
      countryName: editCountryName,
      countryKeywords: [editCountryName, editRoomName.trim(), editMasterName.trim()],
      flag: editFlag,
      description: editRoomDesc.trim(),
      password: editRoomPassword.trim() || undefined,
      isLocked: Boolean(editRoomPassword.trim()),
    };

    setNowMs(currentNow);
    onUpdateRoom?.(updated);
    setEditingRoom(null);
  };

  // Confirm Delete Room
  const handleConfirmDelete = () => {
    if (deletingRoom) {
      onDeleteRoom?.(deletingRoom.id);
      setDeletingRoom(null);
    }
  };

  // Submit Create Room with Master & 4-digit PIN & App Owner Controls
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingRoom) return;
    if (!newRoomName.trim()) {
      setFormError('يرجى كتابة اسم الغرفة');
      return;
    }
    if (!newMasterName.trim()) {
      setFormError('يرجى تعيين اسم ماستر الروم');
      return;
    }
    if (!/^\d{4}$/.test(newMasterPin.trim())) {
      setFormError('يجب أن يتكون الرمز السري للماستر من 4 أرقام بالضبط (مثال: 1976)');
      return;
    }

    const validityNum = Number(newValidityDays);
    if (isNaN(validityNum) || validityNum < 1 || validityNum > 365) {
      setFormError('مدة صلاحية الروم يجب أن تكون بين 1 يوم و 365 يوماً');
      return;
    }

    const capacityNum = Number(newMaxCapacity);
    if (isNaN(capacityNum) || capacityNum < 5 || capacityNum > 1000) {
      setFormError('السعة الاستيعابية للروم يجب أن تكون بين 5 و 1000 عضو');
      return;
    }

    setIsCreatingRoom(true);
    setFormError('');
    setNowMs(Date.now());
    try {
      const result = await onCreateRoom({
        name: newRoomName.trim(),
        category: newRoomCategory,
        countryName: newRoomCountryName,
        flag: newRoomFlag,
        description: newRoomDesc.trim() || `غرفة مميزة برعاية إدارة دردشة اليالي الصوتية - ${newRoomCountryName}`,
        ownerName: newMasterName.trim(),
        masterPinCode: newMasterPin.trim(),
        password: newRoomPassword.trim() || undefined,
        validityDays: validityNum,
        isGoldName: Boolean(newIsGoldName),
        maxCapacity: capacityNum,
        roleQuotas: {
          vip: Math.min(10000, Math.max(0, Number(newVipQuota) || 0)),
          admin: Math.min(10000, Math.max(0, Number(newAdminQuota) || 0)),
          super_admin: Math.min(10000, Math.max(0, Number(newSuperAdminQuota) || 0)),
          member: Math.min(10000, Math.max(0, Number(newMemberQuota) || 0)),
        },
      });

      if (result === false || typeof result === 'string') {
        setFormError(typeof result === 'string' ? result : 'تعذر حفظ الغرفة في قاعدة البيانات، يرجى المحاولة مرة أخرى');
        return;
      }

      setSelectedCategory('all');
      setSearchQuery('');
      setShowOwnerPanelModal(false);
      setNewRoomName('');
      setNewRoomDesc('');
      setNewMasterName('ماستر الروم');
      setNewMasterPin('1976');
      setNewRoomPassword('');
      setNewValidityDays(30);
      setNewIsGoldName(false);
      setNewMaxCapacity(100);
      setNewVipQuota(5);
      setNewAdminQuota(10);
      setNewSuperAdminQuota(15);
      setNewMemberQuota(50);
      setFormError('');
    } catch (err) {
      console.error('Error submitting create room form:', err);
      setFormError('تعذر حفظ الغرفة في قاعدة البيانات، يرجى المحاولة مرة أخرى');
    } finally {
      setIsCreatingRoom(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#070a12] text-white overflow-hidden text-right select-none">
      {/* Lobby Brand Header */}
      <header className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 px-4 py-3 border-b border-amber-500/20 flex items-center justify-between gap-2 shadow-lg">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-2xl overflow-hidden flex items-center justify-center shadow-lg shadow-purple-500/20 border border-purple-400/30 bg-[#070a12] shrink-0">
            <img
              src="/assets/aistudio/________7b81d3a3.png"
              alt="شعار دردشة ليالينا الصوتية"
              className="w-full h-full object-cover scale-[1.06] block"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black tracking-wide bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 bg-clip-text text-transparent truncate">
                دردشة ليالينا الصوتية
              </h1>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-600/30 text-red-300 border border-red-500/40 shrink-0">
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              المتواجدون الآن: <strong className="text-amber-400 font-mono">{totalOnline}</strong> عضو
            </p>
          </div>
        </div>

        {/* User Profile Mini Bar */}
        <button
          onClick={onOpenProfile}
          className="flex items-center justify-center gap-2 p-1 sm:p-1.5 sm:pr-2.5 rounded-[50%] sm:rounded-full aspect-square sm:aspect-auto shrink-0 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 active:scale-95 transition-all text-right"
        >
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block max-w-[90px] truncate">
              {currentUser.username}
            </span>
            <span className="text-[10px] text-amber-400 font-mono">
              {currentUser.coins.toLocaleString('ar-SA')} 🪙
            </span>
          </div>
          <div className="relative w-8 h-8 rounded-[50%] shrink-0">
            <img
              src={currentUser.avatar}
              alt={currentUser.username}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-[50%] aspect-square object-cover border border-amber-400 block"
            />
            <span className="absolute -bottom-1 -left-1 text-xs">{currentUser.flag}</span>
          </div>
        </button>
      </header>

      {/* Search & Create Room Bar */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800/90 flex items-center gap-2">
        <div className="flex-1 relative flex items-center">
          <Search size={15} className="absolute right-3 text-amber-400/80" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم أي دولة (مصر، العراق، السعودية، سوريا...) أو برقم الروم..."
            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500/60 rounded-xl pr-9 pl-8 py-2 text-xs text-white placeholder:text-slate-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 text-slate-400 hover:text-white p-0.5"
              title="مسح البحث"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Create Room Button (Owner Only - Requires ezez1976) */}
        <button
          onClick={handleOpenCreateRoom}
          className="py-2 px-3 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-900/30 active:scale-95 transition-all shrink-0 border border-red-400/40"
          title="خاص بمالك التطبيق فقط (يتطلب رمز سري)"
        >
          <KeyRound size={14} className="text-yellow-300" />
          <span>إنشاء روم</span>
        </button>
      </div>

      {/* 1. Fully Horizontal Scrollable Countries Navigation Bar */}
      <div className="relative bg-slate-950 border-b border-slate-800/80 px-1 py-2 flex items-center">
        {/* Right Scroll Arrow (Desktop/Touch Helper) */}
        <button
          onClick={() => scrollCountries('right')}
          className="hidden md:flex p-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white shrink-0 mx-1 z-10 border border-slate-800 shadow-sm"
          title="تمرير لليمين"
        >
          <ChevronRight size={16} />
        </button>

        {/* Scrollable Container */}
        <div
          ref={countriesScrollRef}
          className="flex-1 flex items-center gap-2 overflow-x-auto scroll-smooth scrollbar-thin scrollbar-thumb-slate-700/60 pb-1 px-2 select-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {COUNTRIES_LIST.map(country => {
            const isSelected = selectedCategory === country.id && !searchQuery;
            return (
              <button
                key={country.id}
                onClick={() => {
                  setSelectedCategory(country.id);
                  setSearchQuery(''); // clear search when explicitly selecting a country tab
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border shrink-0 transition-all text-xs whitespace-nowrap active:scale-95 ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/20 border-amber-400 text-amber-300 font-bold shadow-sm shadow-amber-500/10'
                    : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                <span className="text-base shrink-0">{country.flag}</span>
                <span className="font-semibold">{country.label}</span>
                {country.code !== 'ALL' && country.code !== 'FUN' && (
                  <span className="text-[10px] font-mono text-slate-400 font-normal">
                    {country.code}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Left Scroll Arrow (Desktop/Touch Helper) */}
        <button
          onClick={() => scrollCountries('left')}
          className="hidden md:flex p-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white shrink-0 mx-1 z-10 border border-slate-800 shadow-sm"
          title="تمرير لليسار"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Active Search Results Indicator Banner */}
      {searchQuery && (
        <div className="bg-amber-950/40 border-b border-amber-500/30 px-3 py-1.5 text-xs text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass size={14} className="text-amber-400" />
            <span>
              نتائج البحث عن «<strong>{searchQuery}</strong>»: ({filteredRooms.length} غرفة متاحة)
            </span>
          </div>
          <button
            onClick={() => setSearchQuery('')}
            className="text-[11px] text-amber-400 hover:underline flex items-center gap-0.5 font-bold"
          >
            <span>مسح البحث</span>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Rooms List Display */}
      <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
        {filteredRooms.length === 0 ? (
          rooms.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/50 border border-amber-500/25 rounded-2xl text-slate-300 text-xs space-y-3">
              <Crown size={38} className="mx-auto text-amber-400/80" />
              <p className="font-black text-white text-sm">
                لا توجد غرف حقيقية متاحة حالياً
              </p>
              <p className="text-slate-400 text-[11px] max-w-xs mx-auto leading-relaxed">
                يعرض التطبيق فقط الغرف الحقيقية المنشأة في قاعدة البيانات. يمكن لمالك التطبيق إنشاء أول غرفة الآن.
              </p>
              <button
                onClick={handleOpenCreateRoom}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs shadow-md active:scale-95 transition-all inline-flex items-center gap-1.5"
              >
                <KeyRound size={14} />
                <span>إنشاء غرفة جديدة</span>
              </button>
            </div>
          ) : searchQuery ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-xs space-y-3">
              <Compass size={36} className="mx-auto text-amber-500/50" />
              <p className="font-bold text-white text-sm">
                لم نجد غرفاً مطابقة لـ «{searchQuery}»
              </p>
              <p className="text-slate-400 text-[11px] max-w-xs mx-auto leading-relaxed">
                يمكنك البحث باسم الدولة أو اسم الغرفة أو اسم الماستر أو رقم الروم.
              </p>
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md hover:bg-amber-400 active:scale-95 transition-all"
              >
                عرض جميع الغرف
              </button>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl text-slate-400 text-xs space-y-3">
              <Compass size={36} className="mx-auto text-amber-500/50" />
              <p className="font-bold text-white text-sm">
                لا توجد غرف في قسم «{COUNTRIES_LIST.find(c => c.id === selectedCategory)?.label || selectedCategory}» حالياً
              </p>
              <button
                onClick={() => setSelectedCategory('all')}
                className="px-4 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-md hover:bg-amber-400 active:scale-95 transition-all"
              >
                عرض كل الغرف المتاحة
              </button>
            </div>
          )
        ) : (
          filteredRooms.map(room => {
            const remainingDays = getRoomRemainingDays(room, nowMs);
            const expired = isRoomExpired(room, nowMs);
            return (
            <div
              key={room.id}
              onClick={() => onSelectRoom(room)}
              className={`group border rounded-2xl p-3 shadow-md hover:shadow-xl transition-all cursor-pointer relative overflow-hidden ${
                expired
                  ? 'bg-slate-900/60 border-red-900/50 opacity-75'
                  : room.isGoldName
                  ? 'bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-950 border-amber-500/50 hover:border-amber-400 shadow-amber-500/10'
                  : 'bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-950 border-slate-800/80 hover:border-amber-500/40'
              }`}
            >
              {/* Top Row: Flag + Name + Badges + Room Code */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0 group-hover:scale-110 transition-transform">
                    {room.flag}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3
                        className={`font-bold text-sm truncate transition-colors ${
                          room.isGoldName
                            ? 'text-yellow-400 font-black drop-shadow-[0_1px_4px_rgba(234,179,8,0.7)] group-hover:text-yellow-300'
                            : 'text-white group-hover:text-amber-300'
                        }`}
                      >
                        {room.name}
                      </h3>
                      {room.isGoldName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-gradient-to-r from-yellow-500/25 to-amber-500/25 text-yellow-300 border border-yellow-400/50 font-bold flex items-center gap-0.5 shadow-xs">
                          <Sparkles size={9} className="text-yellow-400 animate-spin" />
                          <span>اسم ذهبي</span>
                        </span>
                      )}
                      {expired ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-950/70 text-red-300 border border-red-500/40 font-mono">
                          ⛔ منتهي التفعيل (0 يوم)
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-mono">
                          ⏳ {remainingDays} يوم
                        </span>
                      )}
                      {room.countryName && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-amber-300/90 border border-slate-700">
                          {room.countryName}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate max-w-[240px] mt-0.5">
                      {room.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {room.isLocked ? (
                    <span className="p-1 rounded-md bg-red-950/60 text-red-400 border border-red-500/30">
                      <Lock size={12} />
                    </span>
                  ) : null}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    #{room.code}
                  </span>
                </div>
              </div>

              {/* Bottom Row: Master (In RED Color), Mic status & Occupants */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                {/* Master Info: COLOR MUST BE RED */}
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <img
                    src={room.ownerAvatar}
                    alt={room.ownerName}
                    referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full object-cover border border-red-500 shadow-xs"
                  />
                  <span>👑 الماستر:</span>
                  <span className="text-red-500 font-black tracking-wide drop-shadow-[0_1px_2px_rgba(239,68,68,0.3)]">
                    {room.ownerName}
                  </span>
                  {room.masterPinCode && (
                    <span className="text-[9px] bg-red-950/60 text-red-300 border border-red-800/60 px-1 py-0.2 rounded font-mono">
                      PIN
                    </span>
                  )}
                </div>

                {/* Mic & Live Occupants */}
                <div className="flex items-center gap-2">
                  {room.activeSpeakerId ? (
                    <span className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                      <Radio size={10} className="text-amber-400 animate-spin" />
                      <span>المايك شغال</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-0.5 rounded-full">
                      المايك حر
                    </span>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-slate-300 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                    <Users size={12} className="text-amber-400" />
                    <span className="font-mono font-bold text-amber-300">
                      {room.occupantsCount}/{room.maxCapacity}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            );
          })
        )}

        {/* Legal & Google Play Store Compliance Footer Link */}
        <div className="pt-3 pb-2 flex items-center justify-center">
          <button
            type="button"
            onClick={() => setShowPrivacyModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/70 hover:bg-slate-900 border border-slate-800/80 hover:border-amber-500/40 text-[11px] text-slate-400 hover:text-amber-300 transition-all"
          >
            <ShieldCheck size={13} className="text-amber-400/90" />
            <span>الشروط وسياسة الخصوصية</span>
          </button>
        </div>
      </div>

      {/* 1. Owner Secret Passcode Gate Modal (ezez1976) */}
      {showOwnerAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-sm p-4 text-white shadow-2xl text-right">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2 text-amber-400">
                <KeyRound size={18} />
                <h3 className="font-bold text-sm text-white">تحقق صلاحية مالك التطبيق</h3>
              </div>
              <button
                onClick={() => setShowOwnerAuthModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
              إنشاء وإدارة الغرف ميزة مقتصرة فقط على <strong>مالك التطبيق</strong>. يرجى إدخال الرمز السري للمالك للمتابعة:
            </p>

            <form onSubmit={handleVerifyOwnerPassword} className="space-y-3">
              <div>
                <label className="block mb-1 text-[11px] text-amber-300 font-bold">
                  رمز مالك التطبيق السري:
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={ownerPasswordInput}
                  onChange={e => {
                    setOwnerPasswordInput(e.target.value);
                    setOwnerAuthError('');
                  }}
                  placeholder="أدخل الرمز السري هنا..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm text-center font-mono text-amber-300 outline-none tracking-widest"
                />
              </div>

              {ownerAuthError && (
                <div className="p-2 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs flex items-center gap-1.5">
                  <ShieldAlert size={14} className="shrink-0 text-red-400" />
                  <span>{ownerAuthError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOwnerAuthModal(false)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs shadow-md active:scale-95 transition-all"
                >
                  تأكيد ودخول
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. App Owner Management Panel Modal (Manage, Edit, Delete, and Create Rooms) */}
      {showOwnerPanelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-lg p-4 text-white shadow-2xl text-right max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-600 via-amber-500 to-yellow-500 flex items-center justify-center shadow-md">
                  <Crown size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-300">
                    لوحة تحكم مالك التطبيق
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    إدارة وتعديل وحذف الغرف وحصص الرتب وإنشاء الرومات الجديدة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOwnerPanelModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Tabs Bar */}
            <div className="flex items-center gap-2 mb-3 bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
              <button
                type="button"
                onClick={() => setOwnerActiveTab('manage')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  ownerActiveTab === 'manage'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield size={14} />
                <span>إدارة وتعديل وحذف الغرف ({rooms.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setOwnerActiveTab('create')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  ownerActiveTab === 'create'
                    ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus size={14} />
                <span>+ إنشاء روم جديد</span>
              </button>
            </div>

            {/* Tab 1: Manage Rooms (List, Edit, Delete) */}
            {ownerActiveTab === 'manage' && (
              <div className="flex-1 overflow-y-auto space-y-3 pr-0.5">
                {/* Search in owner panel */}
                <div className="relative flex items-center shrink-0">
                  <Search size={14} className="absolute right-3 text-amber-400/70" />
                  <input
                    type="text"
                    value={ownerSearchQuery}
                    onChange={e => setOwnerSearchQuery(e.target.value)}
                    placeholder="ابحث بين غرف التطبيق لتعديلها أو حذفها..."
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 rounded-xl pr-8 pl-8 py-2 text-xs text-white placeholder:text-slate-500 outline-none"
                  />
                  {ownerSearchQuery && (
                    <button
                      onClick={() => setOwnerSearchQuery('')}
                      className="absolute left-2.5 text-slate-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Rooms List */}
                <div className="space-y-2.5">
                  {rooms.length === 0 ? (
                    <div className="p-6 text-center bg-slate-950/70 border border-slate-800 rounded-2xl space-y-2.5">
                      <p className="text-xs font-bold text-slate-300">
                        لا توجد غرف مسجلة في قاعدة البيانات حتى الآن
                      </p>
                      <button
                        type="button"
                        onClick={() => setOwnerActiveTab('create')}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-500 text-white font-bold text-xs shadow-md"
                      >
                        + إنشاء أول غرفة حقيقية
                      </button>
                    </div>
                  ) : (
                    rooms
                    .filter(r => {
                      if (!ownerSearchQuery.trim()) return true;
                      const q = normalizeArabic(ownerSearchQuery);
                      return (
                        normalizeArabic(r.name).includes(q) ||
                        normalizeArabic(r.countryName).includes(q) ||
                        normalizeArabic(r.ownerName).includes(q) ||
                        r.id.toLowerCase().includes(q.toLowerCase())
                      );
                    })
                    .map(room => (
                      <div
                        key={room.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          room.isGoldName
                            ? 'bg-slate-950/90 border-yellow-500/50 shadow-md shadow-yellow-500/5'
                            : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Top row: Flag, Name, Badges */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xl shrink-0">{room.flag}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4
                                  className={`text-xs font-black truncate ${
                                    room.isGoldName
                                      ? 'text-yellow-400 drop-shadow-[0_1px_3px_rgba(234,179,8,0.6)]'
                                      : 'text-white'
                                  }`}
                                >
                                  {room.name}
                                </h4>
                                {room.isGoldName && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-bold flex items-center gap-0.5">
                                    <Sparkles size={8} />
                                    <span>ذهبي</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                <span>{room.countryName}</span>
                                <span>•</span>
                                <span className="font-mono text-slate-500">ID: {room.id}</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(room)}
                              className="px-2.5 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95"
                              title="تعديل إعدادات الغرفة"
                            >
                              <Edit3 size={12} className="text-blue-400" />
                              <span>تعديل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRoom(room)}
                              className="px-2.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 font-bold text-[11px] flex items-center gap-1 transition-all active:scale-95"
                              title="حذف الغرفة نهائياً"
                            >
                              <Trash2 size={12} className="text-red-400" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </div>

                        {/* Middle row: Master Info in RED & Expiration / Capacity */}
                        <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 mb-2 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Crown size={12} className="text-red-400 shrink-0" />
                              <span className="text-slate-400">ماستر الروم:</span>
                              <strong className="text-red-400 font-black">{room.ownerName}</strong>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              رمز الماستر: <strong className="text-amber-300">{room.masterPinCode || '1976'}</strong>
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                            <div className={`flex items-center gap-1 font-medium ${isRoomExpired(room, nowMs) ? 'text-red-400' : 'text-emerald-400'}`}>
                              <Calendar size={11} />
                              {isRoomExpired(room, nowMs) ? (
                                <span>⛔ منتهي التفعيل (<strong>0 يوم</strong>)</span>
                              ) : (
                                <span>صلاحية الروم: <strong>{getRoomRemainingDays(room, nowMs)} يوم</strong></span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-amber-300 font-mono">
                              <Users size={11} />
                              <span>السعة: <strong>{room.occupantsCount || 0}/{room.maxCapacity || 100}</strong></span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom row: Role Quotas limits badges */}
                        <div className="flex items-center gap-1 flex-wrap text-[9px]">
                          <span className="text-slate-500 ml-1">حصص الرتب:</span>
                          <span className="px-1.5 py-0.5 rounded-md bg-pink-950/40 border border-pink-500/30 text-pink-300 font-bold">
                            مميز: {room.roleQuotas?.vip ?? 5}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-yellow-950/40 border border-yellow-500/30 text-yellow-300 font-bold">
                            مشرف: {room.roleQuotas?.admin ?? 10}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-green-950/40 border border-green-500/30 text-green-300 font-bold">
                            سوبر: {room.roleQuotas?.super_admin ?? 15}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-md bg-blue-950/40 border border-blue-500/30 text-blue-300 font-bold">
                            عضو: {room.roleQuotas?.member ?? 50}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 2: Create New Room Form */}
            {ownerActiveTab === 'create' && (
              <form onSubmit={handleCreateSubmit} className="flex-1 overflow-y-auto space-y-3.5 text-xs pr-0.5">
                {/* 1. Room Name with Gold/Yellow Toggle Switch */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <span>اسم الغرفة:</span>
                      <span className="text-red-400 font-normal">* مطلوب</span>
                    </label>

                    {/* Gold/Yellow Name Toggle Switch */}
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold transition-colors ${newIsGoldName ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {newIsGoldName ? '✨ اسم ذهبي (مفعّل)' : 'اسم عادي'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewIsGoldName(!newIsGoldName)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                          newIsGoldName ? 'bg-gradient-to-r from-amber-500 to-yellow-400 justify-end shadow-md shadow-yellow-500/30' : 'bg-slate-800 justify-start'
                        }`}
                        title="تفعيل اللون الأصفر/الذهبي لاسم الروم في القائمة الرئيسية"
                      >
                        <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md transform transition-transform duration-200 flex items-center justify-center">
                          {newIsGoldName ? <Sparkles size={10} className="text-yellow-400" /> : null}
                        </span>
                      </button>
                    </div>
                  </div>

                  <input
                    type="text"
                    required
                    value={newRoomName}
                    onChange={e => setNewRoomName(e.target.value)}
                    placeholder="مثال: مضايف بغداد وسهرات العراق الأصيلة 🇮🇶"
                    className={`w-full bg-slate-900 border rounded-xl p-2.5 text-xs outline-none transition-all ${
                      newIsGoldName
                        ? 'border-yellow-500/70 text-yellow-300 font-black drop-shadow-[0_1px_2px_rgba(234,179,8,0.5)] focus:border-yellow-400'
                        : 'border-slate-800 text-white focus:border-amber-500'
                    }`}
                  />

                  {/* Live Name Preview */}
                  <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">معاينة اسم الروم في القائمة:</span>
                    <div className="flex items-center gap-1.5">
                      <span className={newIsGoldName ? 'text-yellow-400 font-black drop-shadow-[0_1px_3px_rgba(234,179,8,0.7)]' : 'text-white font-bold'}>
                        {newRoomName || 'اسم الغرفة...'}
                      </span>
                      {newIsGoldName && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 font-bold flex items-center gap-0.5">
                          <Sparkles size={9} />
                          <span>ذهبي</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Room Expiration in Days (1 to 365) */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <Calendar size={14} className="text-emerald-400" />
                      <span>مدة صلاحية الروم (بالأيام - من 1 إلى 365):</span>
                    </label>
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <span className="text-emerald-400 font-bold text-sm">{newValidityDays}</span>
                      <span className="text-slate-400">يوم</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={365}
                      value={newValidityDays}
                      onChange={e => setNewValidityDays(Number(e.target.value))}
                      className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={newValidityDays}
                      onChange={e => setNewValidityDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-18 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl py-1 px-2 text-center text-xs font-mono font-bold text-emerald-400 outline-none"
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500">مدة مقترحة:</span>
                    {[
                      { days: 7, label: '7 أيام' },
                      { days: 30, label: '30 يوم' },
                      { days: 90, label: '90 يوم' },
                      { days: 180, label: '180 يوم' },
                      { days: 365, label: '365 يوم (سنة)' },
                    ].map(p => (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => setNewValidityDays(p.days)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] transition-all font-medium ${
                          newValidityDays === p.days
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold shadow-xs'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 pt-0.5">
                    تاريخ الانتهاء الفعلي: <strong className="text-emerald-300 font-mono">{new Date(nowMs + newValidityDays * DAY_IN_MS).toLocaleDateString('ar-SA')}</strong> (يتناقص يوماً كل 24 ساعة تلقائياً)
                  </p>
                </div>

                {/* 3. Room Capacity (Concurrent users) */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <Users size={14} className="text-amber-400" />
                      <span>السعة الاستيعابية للروم (الحد الأقصى للمتواجدين):</span>
                    </label>
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <span className="text-amber-400 font-bold text-sm">{newMaxCapacity}</span>
                      <span className="text-slate-400">عضو</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={10}
                      max={1000}
                      step={10}
                      value={newMaxCapacity}
                      onChange={e => setNewMaxCapacity(Number(e.target.value))}
                      className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                    <input
                      type="number"
                      min={5}
                      max={1000}
                      value={newMaxCapacity}
                      onChange={e => setNewMaxCapacity(Math.min(1000, Math.max(5, Number(e.target.value) || 10)))}
                      className="w-18 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl py-1 px-2 text-center text-xs font-mono font-bold text-amber-300 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="text-[10px] text-slate-500">سعة مقترحة:</span>
                    {[50, 100, 200, 500, 1000].map(cap => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => setNewMaxCapacity(cap)}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] transition-all font-medium ${
                          newMaxCapacity === cap
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold shadow-xs'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {cap} عضو
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Roles Quotas Limits (كوتا وتعداد الرتب المسموح بها) */}
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <Shield size={15} />
                      <span>تحديد كوتا وتعداد الرتب (Roles Quotas Limits):</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">صلاحية المالك</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    يحدد المالك العدد الأقصى المسموح به لكل رتبة، ولن يستطيع ماستر الروم تجاوز هذه الأعداد:
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* VIP Quota */}
                    <div className="p-2 rounded-xl bg-pink-950/25 border border-pink-500/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-pink-400">مميز (V.I.P):</span>
                        <span className="text-[9px] px-1 rounded bg-pink-900/60 text-pink-300">وردي</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={newVipQuota}
                        onChange={e => setNewVipQuota(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-pink-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-pink-300 outline-none text-xs"
                      />
                    </div>

                    {/* Admin Quota */}
                    <div className="p-2 rounded-xl bg-yellow-950/25 border border-yellow-500/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-yellow-400">مشرف (Admin):</span>
                        <span className="text-[9px] px-1 rounded bg-yellow-900/60 text-yellow-300">أصفر</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={newAdminQuota}
                        onChange={e => setNewAdminQuota(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-yellow-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-yellow-300 outline-none text-xs"
                      />
                    </div>

                    {/* Super Admin Quota */}
                    <div className="p-2 rounded-xl bg-green-950/25 border border-green-500/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-green-400">سوبر أدمن:</span>
                        <span className="text-[9px] px-1 rounded bg-green-900/60 text-green-300">أخضر</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={150}
                        value={newSuperAdminQuota}
                        onChange={e => setNewSuperAdminQuota(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-green-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-green-300 outline-none text-xs"
                      />
                    </div>

                    {/* Member Quota */}
                    <div className="p-2 rounded-xl bg-blue-950/25 border border-blue-500/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-400">عضو (Member):</span>
                        <span className="text-[9px] px-1 rounded bg-blue-900/60 text-blue-300">أزرق</span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={500}
                        value={newMemberQuota}
                        onChange={e => setNewMemberQuota(Math.max(0, Number(e.target.value) || 0))}
                        className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-blue-300 outline-none text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Country Selection */}
                <div>
                  <label className="block mb-1 text-slate-300 font-bold">دولة وتصنيف الروم:</label>
                  <select
                    value={newRoomCategory}
                    onChange={e => {
                      const cat = e.target.value as RoomCategory;
                      setNewRoomCategory(cat);
                      const found = COUNTRIES_LIST.find(c => c.id === cat);
                      if (found) {
                        setNewRoomCountryName(found.label);
                        setNewRoomFlag(found.flag);
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl p-2 text-white outline-none"
                  >
                    {COUNTRIES_LIST.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.flag} {c.label} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assigned Room Master Section (With RED Color Highlight) */}
                <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-2xl space-y-3">
                  <div className="flex items-center gap-1.5 text-red-400 font-bold">
                    <Crown size={15} />
                    <span>تعيين ماستر الروم المسؤول (اسمه سيظهر باللون الأحمر دائماً):</span>
                  </div>

                  <div>
                    <label className="block mb-1 text-slate-300">
                      اسم ماستر الروم:
                    </label>
                    <input
                      type="text"
                      required
                      value={newMasterName}
                      onChange={e => setNewMasterName(e.target.value)}
                      placeholder="مثال: صقر بغداد / كابتن أحمد"
                      className="w-full bg-slate-950 border border-red-500/50 focus:border-red-400 rounded-xl p-2 text-red-400 font-black outline-none"
                    />
                    <span className="text-[10px] text-red-400/90 block mt-1">
                      * سيظهر اسم هذا الماستر باللون الأحمر في شريط الرومات والمايك والمحادثة.
                    </span>
                  </div>

                  {/* Master's 4-digit Secret Code */}
                  <div>
                    <label className="block mb-1 text-slate-300">
                      الرمز السري لماستر الروم (4 أرقام):
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={4}
                      value={newMasterPin}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setNewMasterPin(val);
                      }}
                      placeholder="مثال: 1976"
                      className="w-full bg-slate-950 border border-red-500/50 focus:border-red-400 rounded-xl p-2 text-center text-sm font-mono tracking-widest text-amber-300 font-bold outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-1">
                      * يستخدمه الماستر لإثبات هويته والتحكم بإدارة الروم.
                    </span>
                  </div>
                </div>

                {/* Room Description */}
                <div>
                  <label className="block mb-1 text-slate-300 font-bold">وصف الروم:</label>
                  <input
                    type="text"
                    value={newRoomDesc}
                    onChange={e => setNewRoomDesc(e.target.value)}
                    placeholder="أهلاً بكم في دردشة اليالي الصوتية، حياكم الله جميعاً 🌹"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white outline-none"
                  />
                </div>

                {/* Room Password for locking (Optional) */}
                <div>
                  <label className="block mb-1 text-slate-300 font-bold">كلمة سر قفل الروم للزوار (اختياري):</label>
                  <input
                    type="password"
                    value={newRoomPassword}
                    onChange={e => setNewRoomPassword(e.target.value)}
                    placeholder="اتركه فارغاً ليكون الروم عاماً ومفتوحاً للجميع"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white outline-none"
                  />
                </div>

                {formError && (
                  <div className="p-2 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs">
                    {formError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowOwnerPanelModal(false)}
                    className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingRoom}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60"
                  >
                    <Check size={15} />
                    <span>{isCreatingRoom ? 'جاري الحفظ...' : 'تأكيد وإنشاء الغرفة'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 3. Edit Room Modal (Open when owner clicks "تعديل" on any room) */}
      {editingRoom && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-blue-500/40 rounded-3xl w-full max-w-md p-4 text-white shadow-2xl text-right max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <Edit3 size={18} className="text-blue-400" />
                <div>
                  <h3 className="font-bold text-sm text-blue-300">
                    تعديل إعدادات الغرفة: {editingRoom.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {editingRoom.id}</span>
                </div>
              </div>
              <button
                onClick={() => setEditingRoom(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              {/* Room Name with Gold/Yellow Toggle */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold">اسم الغرفة:</label>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold ${editIsGoldName ? 'text-yellow-400' : 'text-slate-400'}`}>
                      {editIsGoldName ? '✨ اسم ذهبي (مفعّل)' : 'اسم عادي'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditIsGoldName(!editIsGoldName)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ${
                        editIsGoldName ? 'bg-gradient-to-r from-amber-500 to-yellow-400 justify-end shadow-md' : 'bg-slate-800 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-slate-950 shadow-md flex items-center justify-center">
                        {editIsGoldName ? <Sparkles size={10} className="text-yellow-400" /> : null}
                      </span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  required
                  value={editRoomName}
                  onChange={e => setEditRoomName(e.target.value)}
                  className={`w-full bg-slate-900 border rounded-xl p-2.5 text-xs outline-none transition-all ${
                    editIsGoldName
                      ? 'border-yellow-500/70 text-yellow-300 font-black'
                      : 'border-slate-800 text-white focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Room Expiration (1 to 365 Days) */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Calendar size={14} className="text-emerald-400" />
                    <span>مدة صلاحية الروم (بالأيام):</span>
                  </label>
                  <div className="font-mono text-xs">
                    <span className="text-emerald-400 font-bold text-sm">{editValidityDays}</span>
                    <span className="text-slate-400 mr-1">يوم</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={365}
                    value={editValidityDays}
                    onChange={e => setEditValidityDays(Number(e.target.value))}
                    className="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={editValidityDays}
                    onChange={e => setEditValidityDays(Math.min(365, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-18 bg-slate-900 border border-slate-700 rounded-xl py-1 px-2 text-center text-xs font-mono font-bold text-emerald-400 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {[7, 30, 90, 180, 365].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setEditValidityDays(days)}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] ${
                        editValidityDays === days
                          ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      {days} يوم
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Capacity */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Users size={14} className="text-amber-400" />
                    <span>السعة الاستيعابية للروم:</span>
                  </label>
                  <div className="font-mono text-xs">
                    <span className="text-amber-400 font-bold text-sm">{editMaxCapacity}</span>
                    <span className="text-slate-400 mr-1">عضو</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={5}
                    max={1000}
                    step={10}
                    value={editMaxCapacity}
                    onChange={e => setEditMaxCapacity(Number(e.target.value))}
                    className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <input
                    type="number"
                    min={5}
                    max={1000}
                    value={editMaxCapacity}
                    onChange={e => setEditMaxCapacity(Math.min(1000, Math.max(5, Number(e.target.value) || 5)))}
                    className="w-18 bg-slate-900 border border-slate-700 rounded-xl py-1 px-2 text-center text-xs font-mono font-bold text-amber-300 outline-none"
                  />
                </div>
              </div>

              {/* Roles Quotas Limits */}
              <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold">
                    <Shield size={14} />
                    <span>تحديث كوتا وتعداد الرتب:</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-pink-950/25 border border-pink-500/40 space-y-1">
                    <span className="text-[11px] font-bold text-pink-400 block">مميز (V.I.P):</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editVipQuota}
                      onChange={e => setEditVipQuota(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-pink-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-pink-300 outline-none"
                    />
                  </div>

                  <div className="p-2 rounded-xl bg-yellow-950/25 border border-yellow-500/40 space-y-1">
                    <span className="text-[11px] font-bold text-yellow-400 block">مشرف (Admin):</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={editAdminQuota}
                      onChange={e => setEditAdminQuota(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-yellow-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-yellow-300 outline-none"
                    />
                  </div>

                  <div className="p-2 rounded-xl bg-green-950/25 border border-green-500/40 space-y-1">
                    <span className="text-[11px] font-bold text-green-400 block">سوبر أدمن:</span>
                    <input
                      type="number"
                      min={0}
                      max={150}
                      value={editSuperAdminQuota}
                      onChange={e => setEditSuperAdminQuota(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-green-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-green-300 outline-none"
                    />
                  </div>

                  <div className="p-2 rounded-xl bg-blue-950/25 border border-blue-500/40 space-y-1">
                    <span className="text-[11px] font-bold text-blue-400 block">عضو (Member):</span>
                    <input
                      type="number"
                      min={0}
                      max={500}
                      value={editMemberQuota}
                      onChange={e => setEditMemberQuota(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full bg-slate-900 border border-blue-500/50 rounded-lg p-1.5 text-center font-mono font-bold text-blue-300 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Master Name & PIN */}
              <div className="p-3 bg-red-950/30 border border-red-500/40 rounded-2xl space-y-2.5">
                <div className="flex items-center gap-1.5 text-red-400 font-bold">
                  <Crown size={14} />
                  <span>ماستر الروم والرمز السري (الاسم أحمر):</span>
                </div>
                <div>
                  <label className="block mb-1 text-slate-300">اسم ماستر الروم:</label>
                  <input
                    type="text"
                    required
                    value={editMasterName}
                    onChange={e => setEditMasterName(e.target.value)}
                    className="w-full bg-slate-950 border border-red-500/50 rounded-xl p-2 text-red-400 font-black outline-none"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-300">الرمز السري للماستر (4 أرقام):</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={editMasterPin}
                    onChange={e => setEditMasterPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-950 border border-red-500/50 rounded-xl p-2 text-center text-sm font-mono tracking-widest text-amber-300 font-bold outline-none"
                  />
                </div>
              </div>

              {/* Country Selection */}
              <div>
                <label className="block mb-1 text-slate-300 font-bold">الدولة والتصنيف:</label>
                <select
                  value={editCategory}
                  onChange={e => {
                    const cat = e.target.value as RoomCategory;
                    setEditCategory(cat);
                    const found = COUNTRIES_LIST.find(c => c.id === cat);
                    if (found) {
                      setEditCountryName(found.label);
                      setEditFlag(found.flag);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white outline-none"
                >
                  {COUNTRIES_LIST.filter(c => c.id !== 'all').map(c => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.label} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block mb-1 text-slate-300 font-bold">وصف الغرفة:</label>
                <input
                  type="text"
                  value={editRoomDesc}
                  onChange={e => setEditRoomDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white outline-none"
                />
              </div>

              {/* Room Password */}
              <div>
                <label className="block mb-1 text-slate-300 font-bold">كلمة سر القفل (اختياري):</label>
                <input
                  type="password"
                  value={editRoomPassword}
                  onChange={e => setEditRoomPassword(e.target.value)}
                  placeholder="فارغ = غرفة مفتوحة للجميع"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white outline-none"
                />
              </div>

              {editFormError && (
                <div className="p-2 bg-red-950/60 border border-red-500/50 rounded-xl text-red-300 text-xs">
                  {editFormError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRoom(null)}
                  className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Check size={15} />
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Delete Room Confirmation Dialog */}
      {deletingRoom && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-red-500/60 rounded-3xl w-full max-w-sm p-5 text-white shadow-2xl text-right space-y-4">
            <div className="flex items-center gap-3 border-b border-red-900/40 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-red-400">تأكيد حذف الغرفة</h3>
                <span className="text-[10px] text-slate-400">إجراء لا يمكن التراجع عنه</span>
              </div>
            </div>

            {/* Prompt Explicit Text */}
            <p className="text-sm font-bold text-white leading-relaxed">
              هل أنت متأكد من حذف هذه الغرفة نهائياً؟
            </p>

            {/* Room Preview Card */}
            <div className="p-3 bg-slate-950/80 border border-red-500/30 rounded-2xl space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-xl">{deletingRoom.flag}</span>
                <span className="font-bold text-white truncate">{deletingRoom.name}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                <span>ماستر الروم: <strong className="text-red-400">{deletingRoom.ownerName}</strong></span>
                <span className="font-mono text-slate-500">{deletingRoom.id}</span>
              </div>
            </div>

            <p className="text-[11px] text-red-300/80 leading-relaxed">
              * سيتم مسح الغرفة وقواعد بياناتها بالكامل من التطبيق وتحديث القائمة الرئيسية فوراً.
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeletingRoom(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 text-xs font-medium transition-all"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-900/40 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>نعم، حذف نهائي</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyModal && (
        <PrivacyTermsModal onClose={() => setShowPrivacyModal(false)} />
      )}
    </div>
  );
};
