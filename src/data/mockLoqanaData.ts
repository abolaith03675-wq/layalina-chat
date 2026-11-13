import { GiftItem, SoundEffectItem } from '../types/loqana';

export const GIFTS_CATALOG: GiftItem[] = [
  {
    id: 'gift-rose',
    name: 'وردة جورية حمراء',
    icon: '🌹',
    price: 20,
    description: 'رمز الود والمحبة في الروم',
    category: 'classic',
  },
  {
    id: 'gift-coffee',
    name: 'دلة وقهوة شاذلية',
    icon: '☕️',
    price: 50,
    description: 'كرم الضيافة والترحيب بالغالين',
    category: 'classic',
  },
  {
    id: 'gift-oud',
    name: 'مبخرة عود كمبودي',
    icon: '🪵',
    price: 100,
    description: 'رائحة الطيب للأرواح النقية',
    category: 'classic',
  },
  {
    id: 'gift-horse',
    name: 'خيل عربي أصيل',
    icon: '🐎',
    price: 300,
    description: 'رمز الأصالة والشجاعة',
    category: 'luxury',
  },
  {
    id: 'gift-falcon',
    name: 'صقر شاهين حر',
    icon: '🦅',
    price: 500,
    description: 'هدية الصقارين والشيوخ',
    category: 'luxury',
  },
  {
    id: 'gift-ring',
    name: 'خاتم ألماس برّاق',
    icon: '💍',
    price: 800,
    description: 'فخامة لا تليق إلا بالقمة',
    category: 'luxury',
  },
  {
    id: 'gift-crown',
    name: 'تاج الملوك الذهبي',
    icon: '👑',
    price: 1500,
    description: 'تتويج ملكي يظهر لكل المتواجدين',
    category: 'royal',
  },
  {
    id: 'gift-car',
    name: 'سيارة لامبورغيني سبورت',
    icon: '🏎️',
    price: 3000,
    description: 'موكب فاخر مع عاصفة مؤثرات',
    category: 'royal',
  },
  {
    id: 'gift-jet',
    name: 'طائرة نفاثة خاصة',
    icon: '✈️',
    price: 5000,
    description: 'تحليق ذهبي يزين كامل الشاشة',
    category: 'royal',
  },
  {
    id: 'gift-palace',
    name: 'قصر الملوك الأسطوري',
    icon: '🏰',
    price: 10000,
    description: 'أعلى هدايا ليالينا فخامة وهيبة',
    category: 'royal',
  },
];

export const SOUND_EFFECTS: SoundEffectItem[] = [
  { id: 's-applause', name: 'تصفيق', icon: '👏', soundType: 'applause' },
  { id: 's-celebrate', name: 'زغروطة', icon: '🎉', soundType: 'celebrate' },
  { id: 's-whistle', name: 'تصفير', icon: '🎺', soundType: 'whistle' },
  { id: 's-laugh', name: 'ضحك', icon: '😂', soundType: 'laugh' },
  { id: 's-horn', name: 'بوق المايك', icon: '📯', soundType: 'horn' },
  { id: 's-drum', name: 'طبلة', icon: '🥁', soundType: 'drum' },
];

export const QUICK_PHRASES: string[] = [
  'أرحببب تراحيب المطر نورت الروم 🌹',
  'منورين جميعاً ويسعد مساكم الطيب 🤍',
  'صح لسانك ولا هان منطوقك يا غالي 🎙️',
  'وعليكم السلام ورحمة الله وبركاته 💐',
  'مايكك ذهب وصوتك عافية 👏',
  'فديت الذوق وراعي الذوق 👑',
  'منور الروم يا بعد راسي 💎',
  'تسلم الأيادي على الإهداء الفخم 🎁',
];

export const TEXT_COLORS = [
  { name: 'أبيض ناصع', value: '#f8fafc' },
  { name: 'ذهبي ملكي', value: '#fbbf24' },
  { name: 'أحمر قرمزي', value: '#ef4444' },
  { name: 'أزرق سماوي', value: '#38bdf8' },
  { name: 'أخضر زمردي', value: '#34d399' },
  { name: 'بنفسجي فاخر', value: '#c084fc' },
  { name: 'وردي أنيق', value: '#f472b6' },
  { name: 'برتقالي مشع', value: '#fb923c' },
];

// App's Royal Crown Default Avatar (شعار التاج الملكي لتطبيق دردشة اليالي الصوتية)
export const DEFAULT_CROWN_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <defs>
    <radialGradient id="crownBg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#b45309"/>
      <stop offset="50%" stop-color="#78350f"/>
      <stop offset="100%" stop-color="#090d16"/>
    </radialGradient>
    <linearGradient id="crownGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="35%" stop-color="#facc15"/>
      <stop offset="70%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
    <linearGradient id="crownRuby" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fda4af"/>
      <stop offset="50%" stop-color="#f43f5e"/>
      <stop offset="100%" stop-color="#be123c"/>
    </linearGradient>
  </defs>
  <circle cx="60" cy="60" r="57" fill="url(#crownBg)" stroke="#facc15" stroke-width="3"/>
  <circle cx="60" cy="60" r="51" fill="none" stroke="#fde047" stroke-width="1.2" stroke-dasharray="3,3" opacity="0.7"/>
  <path d="M 28 78 L 33 44 L 47 58 L 60 32 L 73 58 L 87 44 L 92 78 Z" fill="url(#crownGold)" stroke="#fef08a" stroke-width="1.5" stroke-linejoin="round"/>
  <rect x="28" y="78" width="64" height="11" rx="3" fill="url(#crownGold)" stroke="#fef08a" stroke-width="1"/>
  <circle cx="33" cy="42" r="4.5" fill="url(#crownRuby)" stroke="#fff" stroke-width="1"/>
  <circle cx="60" cy="30" r="5.5" fill="url(#crownRuby)" stroke="#fff" stroke-width="1.2"/>
  <circle cx="87" cy="42" r="4.5" fill="url(#crownRuby)" stroke="#fff" stroke-width="1"/>
  <circle cx="38" cy="83.5" r="2.5" fill="#38bdf8"/>
  <circle cx="49" cy="83.5" r="2.8" fill="url(#crownRuby)"/>
  <circle cx="60" cy="83.5" r="3.2" fill="#fef08a"/>
  <circle cx="71" cy="83.5" r="2.8" fill="url(#crownRuby)"/>
  <circle cx="82" cy="83.5" r="2.5" fill="#38bdf8"/>
</svg>
`)}`;

