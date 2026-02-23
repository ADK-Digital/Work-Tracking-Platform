import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)"
      }
    }
  },
  plugins: []
} satisfies Config;
