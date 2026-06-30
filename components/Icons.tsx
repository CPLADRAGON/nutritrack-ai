import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

export const AppLogo: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}>
    <rect width="48" height="48" rx="16" fill="url(#logoGradient)" />
    {/* Bowl */}
    <path d="M8 20 L13 36 C13 39 18 42 24 42 C30 42 35 39 35 36 L40 20 Z" fill="white" fillOpacity="0.95" />
    {/* Chopsticks */}
    <line x1="30" y1="12" x2="26" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    <line x1="34" y1="12" x2="30" y2="32" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
    {/* Food: rice, protein, veggies */}
    <ellipse cx="24" cy="28" rx="10" ry="6" fill="#fef3c7" opacity="0.95" />
    <ellipse cx="20" cy="27" rx="5" ry="3.5" fill="#fca5a5" opacity="0.85" />
    <circle cx="29" cy="29" r="3.5" fill="#86efac" opacity="0.85" />
    <circle cx="18" cy="31" r="2" fill="#fdba74" opacity="0.9" />
    {/* AI spark */}
    <path d="M34 14 L35 17 L38 18 L35 19 L34 22 L33 19 L30 18 L33 17 Z" fill="#4f46e5" opacity="0.92" />
    <defs>
      <linearGradient id="logoGradient" x1="6" y1="5" x2="42" y2="44" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10b981" />
        <stop offset="1" stopColor="#047857" />
      </linearGradient>
    </defs>
  </svg>
);

export const UserIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

export const BotIcon: React.FC<IconProps> = ({ className = 'w-6 h-6', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="4" y="7" width="16" height="12" rx="4" />
    <path d="M12 3v4" />
    <path d="M9 12h.01" />
    <path d="M15 12h.01" />
    <path d="M9 16h6" />
  </svg>
);

export const MealIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M7 3v18" />
    <path d="M4 3v5a3 3 0 0 0 6 0V3" />
    <path d="M17 3c-2.2 1.7-3 4.2-3 7h3v11" />
    <path d="M17 3v7" />
  </svg>
);

export const EnergyIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
);

export const ProteinIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M6.5 10.5 4 13a3 3 0 0 0 4.2 4.2l2.3-2.3" />
    <path d="M13.5 9.1 15.8 6.8A3 3 0 1 1 20 11l-2.5 2.5" />
    <path d="M8 8h8v8H8z" />
  </svg>
);

export const CarbIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 21V8" />
    <path d="M8 9c0-3 4-6 4-6s4 3 4 6" />
    <path d="M7 14c-2-1-3-3-3-5 3 0 6 2 8 5" />
    <path d="M17 14c2-1 3-3 3-5-3 0-6 2-8 5" />
  </svg>
);

export const FatIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 21c4 0 7-3 7-7 0-5-7-11-7-11S5 9 5 14c0 4 3 7 7 7Z" />
    <path d="M9 14c0 1.7 1.3 3 3 3" />
  </svg>
);

export const BreakfastIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="5" />
    <path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.9 4.9l1.4 1.4" /><path d="M17.7 17.7l1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.9 19.1l1.4-1.4" /><path d="M17.7 6.3l1.4-1.4" />
  </svg>
);

export const LunchIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <rect x="4" y="6" width="16" height="12" rx="3" />
    <path d="M8 6V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" />
    <path d="M7 11h10" />
    <path d="M9 15h6" />
  </svg>
);

export const DinnerIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const SnackIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M7 10c0-3 2-5 5-5s5 2 5 5c0 5-5 9-5 9s-5-4-5-9Z" />
    <path d="M10 10h.01" /><path d="M14 10h.01" />
  </svg>
);

export const ZapIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => <EnergyIcon className={className} {...props} />;

export const SparklesIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M3 6h18" />
    <path d="M8 6V4h8v2" />
    <path d="M19 6l-1 15H6L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

export const ScaleIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 3v18" />
    <path d="M5 7h14" />
    <path d="M6 7l-3 6h6L6 7Z" />
    <path d="M18 7l-3 6h6l-3-6Z" />
  </svg>
);

export const ChartIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 16v-5" />
    <path d="M12 16V8" />
    <path d="M16 16v-3" />
  </svg>
);

export const WarningIcon: React.FC<IconProps> = ({ className = 'w-5 h-5', ...props }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 3 2.5 20h19L12 3Z" />
    <path d="M12 9v5" />
    <path d="M12 17h.01" />
  </svg>
);
