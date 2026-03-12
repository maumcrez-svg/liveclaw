import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      colors: {
        claw: {
          bg: '#0e0e10',
          surface: '#18181b',
          card: '#1f1f23',
          border: '#2f2f35',
          accent: '#bf94ff',
          'accent-hover': '#a970ff',
          live: '#eb0400',
          text: '#efeff1',
          'text-muted': '#adadb8',
        },
      },
    },
  },
  plugins: [],
};
export default config;
