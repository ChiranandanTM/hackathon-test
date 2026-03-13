/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        guard: {
          dark: "#000000",        // Pure black
          card: "#000000",        // Pure black (same as dark)
          border: "#1a1a1a",      // Neutral dark gray for borders only
          accent: "#00d9ff",      // Cyan (ETH-inspired)
          danger: "#ff006e",      // Hot pink
          safe: "#00ff88",        // Neon green
          warning: "#ffa500",     // Vibrant orange
          purple: "#8b5cf6",      // Vibrant purple
          indigo: "#6366f1",      // Indigo
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float-up": "float-up 3s ease-in-out infinite",
        "drift": "drift 4s ease-in-out infinite",
        "glow-rotate": "glow-rotate 8s linear infinite",
        "shimmer": "shimmer 2s infinite",
        "slide-in": "slide-in 0.5s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
        "pulse-eth": "pulse-eth 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "typing": "typing 0.7s steps(40, end)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1", "box-shadow": "0 0 20px rgba(0, 217, 255, 0)" },
          "50%": { opacity: "0.8", "box-shadow": "0 0 40px rgba(0, 217, 255, 0.5)" },
        },
        "float-up": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        "drift": {
          "0%, 100%": { transform: "translateX(0px)" },
          "50%": { transform: "translateX(10px)" },
        },
        "glow-rotate": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-eth": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "typing": {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
      },
      boxShadow: {
        "glow-cyan": "0 0 30px rgba(0, 217, 255, 0.3)",
        "glow-green": "0 0 30px rgba(0, 255, 136, 0.3)",
        "glow-pink": "0 0 30px rgba(255, 0, 110, 0.3)",
        "glow-purple": "0 0 30px rgba(139, 92, 246, 0.3)",
        "glow-strong": "0 0 50px rgba(0, 217, 255, 0.5)",
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};
