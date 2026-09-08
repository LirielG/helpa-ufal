import { config } from "../config";

const API_BASE_URL = config.apiUrl;

export class ApiError extends Error {
  public status: number;
  public data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

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

const buildQueryString = (params?: Record<string, unknown>) => {
  if (!params) return "";
  const query = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value));
    }
  });
  
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

export const api = {
  async get(endpoint: string, params?: Record<string, unknown>) {
    const token = getToken();
    const queryString = buildQueryString(params);
    const url = `${API_BASE_URL}${endpoint}${queryString}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token && { "token": token }), 
      },
      credentials: "include",
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }
      throw new ApiError(
        response.status, 
        errorData?.message || `Erro na requisição: ${response.status}`, 
        errorData
      );
    }

    return response.json();
  },

  async post(endpoint: string, body: unknown) {
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
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = null;
      }
      throw new ApiError(
        response.status, 
        errorData?.message || `Erro na requisição: ${response.status}`, 
        errorData
      );
    }

    return response.json();
  },
};
