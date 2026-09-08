import { config } from "../config";
import type { ValidationError } from "../validators";
import { ApiError, NETWORK_ERROR_STATUS } from "./apiError";
import { notifySessionExpired } from "./session";

const API_BASE_URL = config.apiUrl;

const COMMUNICATION_ERROR_MESSAGE = "Erro na comunicação com o servidor";

type ErrorPayload = {
  message?: string | string[];
  error?: string;
  errors?: ValidationError[];
};

export type RequestOptions = {
  /**
   * Whether a 401 should expire the session. Defaults to true; the auth
   * endpoints opt out because there a 401 means "wrong credentials", not
   * "your session ended".
   */
  handleUnauthorized?: boolean;
  /** Query string values. Empty ones are dropped instead of sent as blank. */
  params?: Record<string, unknown>;
};

function buildQueryString(params?: Record<string, unknown>): string {
  if (!params) return "";

  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value));
    }
  });

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

async function readBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const text = await response.text();
  if (!text) return undefined;

  return JSON.parse(text);
}

async function readErrorPayload(response: Response): Promise<ErrorPayload> {
  try {
    const payload = await readBody(response);
    return payload && typeof payload === "object"
      ? (payload as ErrorPayload)
      : {};
  } catch {
    return {};
  }
}

function readErrorMessage(payload: ErrorPayload): string {
  if (Array.isArray(payload.message)) {
    return payload.message.join("\n");
  }

  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  if (typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return COMMUNICATION_ERROR_MESSAGE;
}

async function toApiError(response: Response): Promise<ApiError> {
  if (response.status >= 500) {
    return new ApiError(response.status, COMMUNICATION_ERROR_MESSAGE);
  }

  const payload = await readErrorPayload(response);

  return new ApiError(
    response.status,
    readErrorMessage(payload),
    Array.isArray(payload.errors) ? payload.errors : [],
  );
}

async function request<T>(
  method: string,
  endpoint: string,
  body?: unknown,
  { handleUnauthorized = true, params }: RequestOptions = {},
): Promise<T> {
  let response: Response;
  const url = `${API_BASE_URL}${endpoint}${buildQueryString(params)}`;

  try {
    response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_STATUS, COMMUNICATION_ERROR_MESSAGE);
  }

  if (response.status === 401 && handleUnauthorized) {
    notifySessionExpired();
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  try {
    return (await readBody(response)) as T;
  } catch {
    throw new ApiError(response.status, COMMUNICATION_ERROR_MESSAGE);
  }
}

export const api = {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>("GET", endpoint, undefined, options);
  },

  post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return request<T>("POST", endpoint, body, options);
  },

  patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return request<T>("PATCH", endpoint, body, options);
  },

  delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return request<T>("DELETE", endpoint, undefined, options);
  },
};
