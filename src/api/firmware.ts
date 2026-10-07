import { apiClient, TIMEOUTS } from './client';
import type {
  GenerateAndFlashRequest,
  GenerateAndFlashResponse,
  GenerateRequest,
  GenerateResponse,
  FlashRequest,
  FlashResponse,
  VerifyRequest,
  BuildCheck,
} from '../types/firmware';

// All of these resolve on HTTP 200 — including soft failures where the body
// carries status "error" (see FlashResponse/BuildCheck). Callers must check
// the body status field, not just that the promise resolved.
// HTTP-level failures (404/400/502/500/503) reject with ApiError.

export async function generateFirmware(request: GenerateRequest): Promise<GenerateResponse> {
  return apiClient.post<GenerateResponse>('/api/generate', request, TIMEOUTS.generate);
}

export async function verifyFirmware(request: VerifyRequest): Promise<BuildCheck> {
  return apiClient.post<BuildCheck>('/api/verify', request, TIMEOUTS.verify);
}

export async function flashFirmware(request: FlashRequest): Promise<FlashResponse> {
  return apiClient.post<FlashResponse>('/api/flash', request, TIMEOUTS.flash);
}

// Legacy one-shot pipeline — lives at the root, NOT under /api/.
export async function generateAndFlash(
  request: GenerateAndFlashRequest
): Promise<GenerateAndFlashResponse> {
  return apiClient.post<GenerateAndFlashResponse>('/generate-and-flash', request, TIMEOUTS.generate);
}
