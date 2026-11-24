/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      colors: {
        navy: { DEFAULT: "#103B50", dark: "#082D40" },
        teal: { DEFAULT: "#167D83", soft: "#E8F3F2", hover: "#11686D" },
        canvas: "#F6F8FA",
        ink: { DEFAULT: "#172B3A", muted: "#718096" },
        line: "#E4E9EE",
        success: { DEFAULT: "#26845B", soft: "#E6F3EC" },
        warning: { DEFAULT: "#D99A36", soft: "#FBF3E4", ink: "#94651A" },
        danger: { DEFAULT: "#D9534F", soft: "#FBEAEA", ink: "#B03A36" },
      },
      borderRadius: { lg: "10px", md: "8px", sm: "6px" },
      boxShadow: { card: "0 1px 2px rgba(16,59,80,0.04)", pop: "0 8px 24px rgba(16,59,80,0.12)" },
    },
  },
  plugins: [],
};
