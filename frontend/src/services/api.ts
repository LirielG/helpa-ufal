import { config } from "../config";

const API_BASE_URL = config.apiUrl;

const getToken = () => {
  try {
    const authStorage = localStorage.getItem("helpa-auth");
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed.state?.token || "";
    }
  } catch {
    return "";
  }
  return "";
};

export const api = {
  async get(endpoint: string) {
    const token = getToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "token": token }), 
      },
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    return response.json();
  },

  async post(endpoint: string, body: any) {
    const token = getToken();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "token": token }), 
      },
      credentials: "include",
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    return response.json();
  },
};