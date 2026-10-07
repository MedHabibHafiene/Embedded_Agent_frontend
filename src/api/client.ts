// Empty by default: requests go same-origin and the Vite dev proxy
// (vite.config.ts) forwards /api, /health and /generate-and-flash to the
// backend. This avoids CORS entirely regardless of which port Vite picks.
// Set VITE_API_BASE_URL (or the Settings dialog) to target the backend
// directly, e.g. when serving a production build from another origin.
const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const REQUEST_TIMEOUT = parseInt(import.meta.env.VITE_REQUEST_TIMEOUT || '300000', 10);

// Per-endpoint timeouts (ms). POST /api/generate is the long pole: the LLM
// timeout is 300s with up to 3 attempts, plus a 120s PlatformIO compile check
// when verify=true, so it needs far more headroom than everything else.
export const TIMEOUTS = {
  health: 10_000,
  fast: 15_000, // ports, job list/detail
  chat: 360_000, // RAG retrieval + one LLM answer
  verify: 300_000, // PlatformIO compile check
  flash: 300_000, // build + upload
  generate: 900_000, // LLM (up to 3 x 300s) + compile check
} as const;

// Mutable so the Settings dialog can retarget the backend at runtime.
// An empty value means same-origin (dev-server proxy).
let baseUrl = DEFAULT_BASE_URL;

export function setApiBaseUrl(url: string): void {
  baseUrl = url.trim().replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return baseUrl;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = REQUEST_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408);
    }
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error',
      0,
      error
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    const errorData = isJson ? await response.json() : await response.text();
    throw new ApiError(
      isJson && typeof errorData === 'object' && errorData !== null && 'detail' in errorData
        ? String((errorData as { detail: unknown }).detail)
        : `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorData
    );
  }

  if (isJson) {
    return response.json();
  }
  return response.text() as Promise<T>;
}

export const apiClient = {
  async get<T>(endpoint: string, timeout: number = REQUEST_TIMEOUT): Promise<T> {
    const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
      method: 'GET',
    }, timeout);
    return handleResponse<T>(response);
  },

  async post<T>(endpoint: string, data: unknown, timeout: number = REQUEST_TIMEOUT): Promise<T> {
    const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }, timeout);
    return handleResponse<T>(response);
  },

  async delete<T>(endpoint: string, timeout: number = REQUEST_TIMEOUT): Promise<T> {
    const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
      method: 'DELETE',
    }, timeout);
    // 204 No Content and other empty bodies must not hit the JSON parser.
    if (response.status === 204) {
      return undefined as T;
    }
    return handleResponse<T>(response);
  },
};
