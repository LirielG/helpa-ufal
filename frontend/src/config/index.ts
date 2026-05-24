const isDevelopment = import.meta.env.MODE === "development";

export const config = {
  apiUrl:
    import.meta.env.VITE_API_URL ||
    (isDevelopment ? "http://localhost:3333" : "https://api.helpa.com"),
};
