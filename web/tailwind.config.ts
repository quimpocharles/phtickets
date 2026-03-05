import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary:  '#0133ae',
        danger:   '#df0017',
        accent:   '#fed000',
        offwhite: '#f5f4f0',
        offblack: '#1a1a1a',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        pulse_badge: {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.7' },
        },
        scan: {
          '0%':    { top: '4px' },
          '50%':   { top: 'calc(100% - 4px)' },
          '100%':  { top: '4px' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in-up':  'fade-in-up 0.25s ease-out',
        'pulse-badge': 'pulse_badge 1.5s ease-in-out infinite',
        'scan':        'scan 2s ease-in-out infinite',
        'slide-up':    'slide-up 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
