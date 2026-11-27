/** IWAT POS design tokens — harbour blue on steel grey. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#0E2240', 900: '#0A1A31', 800: '#0E2240', 700: '#16305A', 600: '#1F3E70' },
        brand: { 50: '#EEF3FE', 100: '#DCE6FC', 200: '#B7CCF8', 300: '#87A8F1', 400: '#5480E6', 500: '#2357D9', 600: '#1A45B5', 700: '#163A92', 800: '#132F74' },
        steel: { 50: '#F5F7FA', 100: '#EDF0F5', 200: '#E1E6EE', 300: '#C9D1DD', 400: '#97A3B5', 500: '#6A788D', 600: '#4F5C70', 700: '#3A4556', 800: '#262F3D', 900: '#1B2330' },
        ok: '#12A971', warn: '#E8A317', bad: '#D64545',
      },
      boxShadow: {
        card: '0 1px 2px rgba(14,34,64,.06), 0 0 0 1px rgba(14,34,64,.05)',
        lift: '0 12px 32px -12px rgba(14,34,64,.28)',
        ticket: '0 18px 50px -20px rgba(14,34,64,.35)',
      },
      fontVariantNumeric: { tab: 'tabular-nums' },
    },
  },
  plugins: [],
};
