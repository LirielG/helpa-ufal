const isDevelopment = import.meta.env.MODE === "development";

export const config = {
  apiUrl: isDevelopment
    ? import.meta.env.VITE_API_URL || "http://localhost:3001/api"
    : import.meta.env.VITE_API_URL || "https://api.helpa.com/api",
};
