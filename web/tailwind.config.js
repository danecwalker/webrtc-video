module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx,css,md,mdx,html,json,scss}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(-20deg)' },
        },

        fader: {
          '0%': { opacity: 1 },
          '100%': { opacity: 0 },
        },

        inner: {
          '0%': { transform: 'transformY(-100%)' },
          '100%': { transform: 'transformY(0%)' },
        }
      },
      animation: {
        wiggle: 'wiggle 400ms ease-in-out infinite',
        "slow-spin": 'spin 3s linear infinite',
        "fade": 'fader 1s ease-out',
        "come-in": 'inner 1s ease-in-out',
      }
    },
  },
  plugins: [],
};
