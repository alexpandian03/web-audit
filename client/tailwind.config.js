/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Requested Color Palette
        // 1. #0a0a0a - Deep canvas obsidian black
        // 2. #007ba7 - Cerulean blue (brand primary)
        // 3. #ff2095 - Neon electric pink (vibrant accent)
        cerulean: {
          50: '#eef9fd',
          100: '#d7f0fa',
          200: '#b4e3f6',
          300: '#7eceef',
          400: '#3eb2e2',
          500: '#007ba7', // Primary Brand
          600: '#006c94',
          700: '#005a7b',
          800: '#004c68',
          900: '#033f57',
        },
        neon: {
          50: '#fff0f7',
          100: '#ffe4f2',
          200: '#fecdd3',
          300: '#fe9cc2',
          400: '#ff5ea7',
          500: '#ff2095', // Vivid Accent
          600: '#e6007e',
          700: '#b80064',
          800: '#980053',
        },
        canvas: {
          DEFAULT: '#0a0a0a', // Canvas root
          card: '#121215',    // Card background
          surface: '#16161b', // Input/hover surface
          border: '#23232a',  // Clean subtle border
          borderLight: '#2e2e38',
        },
        // Backwards compatibility mappings for existing utility references
        plum: {
          50: '#0d1e26',
          100: '#132b36',
          200: '#1b3f4f',
          600: '#006c94',
          700: '#005a7b',
          800: '#007ba7', // Brand Primary Cerulean
          900: '#004c68',
        },
        gold: {
          50: '#260515',
          100: '#3d0a23',
          400: '#ff5ea7',
          500: '#ff2095', // Accent Neon Pink
          600: '#e6007e',
          700: '#b80064',
        },
        cloud: {
          50: '#111114',
          100: '#16161b',
          200: '#23232a', // Subtle dark border
          300: '#2e2e38',
          400: '#71717a',
        },
      },
    },
  },
  plugins: [],
};
