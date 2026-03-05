import type { BadgeType } from '@/types';

const CONFIG: Record<BadgeType, { label: string; className: string }> = {
  'trending':         { label: 'Trending',        className: 'bg-accent text-offblack' },
  'fast-selling':     { label: 'Fast Selling',     className: 'bg-primary text-white' },
  'almost-sold-out':  { label: 'Almost Sold Out',  className: 'bg-offblack text-white' },
  'last-chance':      { label: 'Last Chance',      className: 'bg-danger text-white animate-pulse-badge' },
};

interface Props {
  type: BadgeType;
  size?: 'sm' | 'md';
}

export default function Badge({ type, size = 'md' }: Props) {
  const { label, className } = CONFIG[type];
  return (
    <span
      className={`inline-block font-bold uppercase tracking-wide rounded-full ${className} ${
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
    >
      {label}
    </span>
  );
}
