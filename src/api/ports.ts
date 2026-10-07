import { apiClient, TIMEOUTS } from './client';
import type { PortInfo } from '../types/firmware';

export async function listPorts(): Promise<PortInfo[]> {
  return apiClient.get<PortInfo[]>('/api/ports', TIMEOUTS.fast);
}
