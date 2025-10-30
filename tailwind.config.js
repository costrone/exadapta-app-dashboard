/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html","./src/**/*.{ts,tsx}"],
  darkMode: ["class", "[data-theme='dark']"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Ubuntu", "Cantarell", "Noto Sans", "Helvetica Neue", "Arial", "sans-serif"],
      },
      colors: {
        blue: {
          50: "#E3F2FD",
          100: "#D6EAF8",
          200: "#AED6F1",
          300: "#85C1E9",
          400: "#5DADE2",
          500: "#2E86C1",
          600: "#004379", // UCAM primary blue
          700: "#255F78", // Darker blue
          800: "#1C4A5D",
          900: "#123646",
        },
        gray: {
          50: "#EEEEEE",
          100: "#F5F5F5",
          200: "#E5E7EB",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#565656", // medium gray from origin
          700: "#444444",
          800: "#2D2D2D",
          900: "#1F2937",
        },
        gold: {
          500: "#EDAB00",
          600: "#D99A00",
        },
        success: "#007D57",
        warning: "#FCC631",
        error: "#DC002E",
      },
      boxShadow: {
        brand: "0 4px 20px rgba(0, 67, 121, 0.08)",
        brandHover: "0 4px 20px rgba(0, 67, 121, 0.12)",
      },
      borderRadius: {
        xl: "12px",
        '2xl': "16px",
      },
    }
  },
  plugins: [],
}
