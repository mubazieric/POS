/** IWAT POS design tokens — signal orange on warm grey. */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#1F1D1B', 900: '#151412', 800: '#1F1D1B', 700: '#2C2926', 600: '#3B3733' },
        brand: { 50: '#FFF5ED', 100: '#FFE8D4', 200: '#FFCDA8', 300: '#FDAA70', 400: '#FA8638', 500: '#F26A1B', 600: '#DD5510', 700: '#B7400F', 800: '#923414' },
        steel: { 50: '#F7F7F6', 100: '#F0EFED', 200: '#E4E2DF', 300: '#CFCCC8', 400: '#A19D98', 500: '#75716C', 600: '#57534F', 700: '#403D3A', 800: '#2A2826', 900: '#1C1B19' },
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
