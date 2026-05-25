const isDevelopment = import.meta.env.MODE === "development";

export const config = {
  apiUrl: isDevelopment
    ? import.meta.env.VITE_API_URL || "http://localhost:3333"
    : import.meta.env.VITE_API_URL || "https://api.helpa.com/api",
};
