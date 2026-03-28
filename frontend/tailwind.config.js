/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        arena: "#0a0a0f",
        claude: "#7F77DD",
        gpt: "#1D9E75",
        gemini: "#EF9F27",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      boxShadow: {
        glass: "0 24px 80px rgba(0, 0, 0, 0.45)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)"
      },
      animation: {
        pulseWarn: "pulseWarn 1s ease-in-out infinite",
        flicker: "flicker 2.2s linear infinite",
        riseIn: "riseIn 500ms ease-out both"
      },
      keyframes: {
        pulseWarn: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.38" }
        },
        flicker: {
          "0%, 19%, 21%, 23%, 80%, 100%": { opacity: "1" },
          "20%, 22%, 79%": { opacity: "0.75" }
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      }
    }
  },
  plugins: [],
};
