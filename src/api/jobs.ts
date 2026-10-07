import { apiClient, TIMEOUTS } from './client';
import type { JobDetail, JobSummary } from '../types/firmware';

export async function listJobs(): Promise<JobSummary[]> {
  return apiClient.get<JobSummary[]>('/api/jobs', TIMEOUTS.fast);
}

export async function getJob(jobId: string): Promise<JobDetail> {
  return apiClient.get<JobDetail>(`/api/jobs/${encodeURIComponent(jobId)}`, TIMEOUTS.fast);
}
