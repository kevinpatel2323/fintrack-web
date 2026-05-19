export function Icon({ children, size = 20, stroke = 1.75, style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IcHome = (p) => (<Icon {...p}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9.5h14V10" /></Icon>);
export const IcList = (p) => (<Icon {...p}><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></Icon>);
export const IcCal = (p) => (<Icon {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3.5v3M16 3.5v3" /></Icon>);
export const IcFriends = (p) => (<Icon {...p}><circle cx="9" cy="9" r="3.5" /><path d="M3 19.5c.5-3.4 3.3-5.5 6-5.5s5.5 2.1 6 5.5" /><path d="M16 11a3 3 0 0 0 0-6" /><path d="M21 18c-.3-2-1.7-3.4-3.5-4" /></Icon>);
export const IcChart = (p) => (<Icon {...p}><path d="M4 20V8M10 20V4M16 20v-7M22 20H2" /></Icon>);
export const IcWallet = (p) => (<Icon {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16 14.5h2" /></Icon>);
export const IcCard = (p) => (<Icon {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10.5h18M7 15h4" /></Icon>);
export const IcTag = (p) => (<Icon {...p}><path d="M12 3H4v8l9 9 8-8z" /><circle cx="8" cy="8" r="1.4" /></Icon>);
export const IcUpload = (p) => (<Icon {...p}><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Icon>);
export const IcDownload = (p) => (<Icon {...p}><path d="M12 4v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></Icon>);
export const IcSettings = (p) => (<Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Icon>);
export const IcPlus = (p) => (<Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>);
export const IcSearch = (p) => (<Icon {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.5-3.5" /></Icon>);
export const IcFilter = (p) => (<Icon {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Icon>);
export const IcSort = (p) => (<Icon {...p}><path d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3" /></Icon>);
export const IcBell = (p) => (<Icon {...p}><path d="M6 17V11a6 6 0 0 1 12 0v6" /><path d="M4.5 17h15M10 20.5a2 2 0 0 0 4 0" /></Icon>);
export const IcChevR = (p) => (<Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>);
export const IcChevL = (p) => (<Icon {...p}><path d="m15 6-6 6 6 6" /></Icon>);
export const IcChevD = (p) => (<Icon {...p}><path d="m6 9 6 6 6-6" /></Icon>);
export const IcChevU = (p) => (<Icon {...p}><path d="m6 15 6-6 6 6" /></Icon>);
export const IcClose = (p) => (<Icon {...p}><path d="M6 6l12 12M18 6 6 18" /></Icon>);
export const IcCheck = (p) => (<Icon {...p}><path d="m4 12 5 5L20 6" /></Icon>);
export const IcMore = (p) => (<Icon {...p}><circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" /></Icon>);
export const IcSparkle = (p) => (<Icon {...p}><path d="M12 3v6m0 6v6M3 12h6m6 0h6" /><path d="m6 6 3 3m6 6 3 3M6 18l3-3m6-6 3-3" strokeOpacity=".4" /></Icon>);
export const IcArrowUR = (p) => (<Icon {...p}><path d="M7 17 17 7M9 7h8v8" /></Icon>);
export const IcArrowDL = (p) => (<Icon {...p}><path d="M17 7 7 17M15 17H7V9" /></Icon>);
export const IcCart = (p) => (<Icon {...p}><path d="M3 5h2l2.5 11h11l2-8H6" /><circle cx="9" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></Icon>);
export const IcCoffee = (p) => (<Icon {...p}><path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M17 10h2a2 2 0 0 1 0 4h-2M8 3v2M11 3v2M14 3v2" /></Icon>);
export const IcCar = (p) => (<Icon {...p}><path d="M4 14V11l2-5h12l2 5v3" /><rect x="3" y="14" width="18" height="5" rx="1.5" /><circle cx="7" cy="18.5" r="1.3" /><circle cx="17" cy="18.5" r="1.3" /></Icon>);
export const IcBolt = (p) => (<Icon {...p}><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></Icon>);
export const IcHouse = (p) => (<Icon {...p}><path d="M4 11.5 12 4l8 7.5V20H4z" /><path d="M10 20v-5h4v5" /></Icon>);
export const IcFilm = (p) => (<Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 12h18M3 8.5h4M3 15.5h4M17 8.5h4M17 15.5h4" /></Icon>);
export const IcHeart = (p) => (<Icon {...p}><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.7A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></Icon>);
export const IcSwap = (p) => (<Icon {...p}><path d="M7 7h13m0 0-3-3m3 3-3 3M17 17H4m0 0 3-3m-3 3 3 3" /></Icon>);
export const IcReceipt = (p) => (<Icon {...p}><path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3z" /><path d="M8 8h8M8 12h8M8 16h5" /></Icon>);
export const IcSplit = (p) => (<Icon {...p}><path d="M4 4v4a4 4 0 0 0 4 4h8a4 4 0 0 1 4 4v4" /></Icon>);
export const IcRepeat = (p) => (<Icon {...p}><path d="M4 9a5 5 0 0 1 5-5h7m0 0-3-3m3 3-3 3M20 15a5 5 0 0 1-5 5H8m0 0 3 3m-3-3 3-3" /></Icon>);
export const IcUser = (p) => (<Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 20c1-4 4-6 8-6s7 2 8 6" /></Icon>);
export const IcLogout = (p) => (<Icon {...p}><path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 8l-4 4 4 4M6 12h12" /></Icon>);
export const IcTrash = (p) => (<Icon {...p}><path d="M5 7h14M10 11v6M14 11v6" /><path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" /></Icon>);
export const IcEdit = (p) => (<Icon {...p}><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m14 6 4 4" /></Icon>);
export const IcRefresh = (p) => (<Icon {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></Icon>);
export const IcCommand = (p) => (<Icon {...p}><rect x="6" y="6" width="12" height="12" rx="1" /><path d="M6 9V6h3M15 6h3v3M18 15v3h-3M9 18H6v-3" /></Icon>);

// Brand mark — lime square with F
export function IcLogo({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="28" height="28" rx="8" fill="#D7FF3D" />
      <path d="M9 22V10h12M9 16h9" stroke="#0A0B0E" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22" cy="22" r="2.4" fill="#0A0B0E" />
    </svg>
  );
}

// Category icon resolver (best-effort, matches palette keys)
import {
  // re-import names already in scope above? They are. Just map.
} from 'react';

export function categoryIconFor(catKey) {
  switch (catKey) {
    case 'food': return IcCoffee;
    case 'transport': return IcCar;
    case 'shopping': return IcCart;
    case 'bills': return IcBolt;
    case 'grocery': return IcCart;
    case 'rent': return IcHouse;
    case 'entmt': return IcFilm;
    case 'transfer': return IcSwap;
    case 'salary': return IcArrowDL;
    case 'health': return IcHeart;
    default: return IcTag;
  }
}
