import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './src/index.html'],
  theme: {
    extend: {
      colors: {
        base: '#1e1e2e',
        mantle: '#181825',
        surface0: '#313244',
        surface1: '#45475a',
        surface2: '#585b70',
        text: '#cdd6f4',
        subtext: '#a6adc8',
        blue: '#89b4fa',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        red: '#f38ba8',
        peach: '#fab387',
        overlay: 'rgba(17, 17, 27, 0.9)',
      },
    },
  },
  plugins: [],
};

export default config;
