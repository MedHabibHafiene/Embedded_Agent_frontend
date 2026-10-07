import { apiClient, TIMEOUTS } from './client';
import type { HealthResponse } from '../types/firmware';

export async function checkHealth(verbose = false): Promise<HealthResponse> {
  // /health is at the root, NOT under /api/.
  return apiClient.get<HealthResponse>(`/health${verbose ? '?verbose=1' : ''}`, TIMEOUTS.health);
}

export async function checkHealthSafe(): Promise<{ healthy: boolean; error?: string }> {
  try {
    const response = await checkHealth();
    return { healthy: response.status === 'healthy' };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
