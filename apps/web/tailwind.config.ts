import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      animation: {
        marquee: 'marquee 30s linear infinite',
        float: 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0px)' },
        },
      },
      colors: {
        claw: {
          bg: 'rgb(var(--claw-bg) / <alpha-value>)',
          surface: 'rgb(var(--claw-surface) / <alpha-value>)',
          card: 'rgb(var(--claw-card) / <alpha-value>)',
          border: 'rgb(var(--claw-border) / <alpha-value>)',
          accent: 'rgb(var(--claw-accent) / <alpha-value>)',
          'accent-hover': 'rgb(var(--claw-accent-hover) / <alpha-value>)',
          live: 'rgb(var(--claw-live) / <alpha-value>)',
          text: 'rgb(var(--claw-text) / <alpha-value>)',
          'text-muted': 'rgb(var(--claw-text-muted) / <alpha-value>)',
          glow: 'rgb(var(--claw-glow) / <alpha-value>)',
          neon: 'rgb(var(--claw-neon) / <alpha-value>)',
          coral: 'rgb(var(--claw-coral) / <alpha-value>)',
          'inline-code': 'rgb(var(--claw-inline-code) / <alpha-value>)',
          'inline-code-text': 'rgb(var(--claw-inline-code-text) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
export default config;
