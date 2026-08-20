// src/services/api.ts
import { config } from "../config";

const API_BASE_URL = config.apiUrl;

export const api = {
  async get(endpoint: string) {
    const token = localStorage.getItem("token") || "";
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`Erro na requisição: ${response.status}`);
    }

    return response.json();
  },
  
};
