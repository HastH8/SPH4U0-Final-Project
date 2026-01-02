import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "SF Pro Text",
          "SF Pro Display",
          "SF Pro",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: ["SF Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        "2xl": "1.5rem",
      },
      boxShadow: {
        glow: "0 0 24px rgba(0, 247, 255, 0.35)",
        soft: "0 10px 40px rgba(0, 0, 0, 0.2)",
      },
      colors: {
        "glass-light": "rgba(255, 255, 255, 0.18)",
        "glass-dark": "rgba(12, 16, 24, 0.55)",
        "neon-cyan": "#00f7ff",
        "neon-blue": "#0051ff",
        "neon-pink": "#ff4fd8",
        "neon-green": "#5bffb0",
      },
      backdropBlur: {
        glass: "24px",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [animate],
};
