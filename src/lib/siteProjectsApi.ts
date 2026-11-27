import api from '@/lib/api';
import type { JobStatus } from '@/lib/criarSiteChat';

/** GET /sites/ */
export interface SiteProjectSummary {
  id: string;
  name: string;
  status: string;
  created_at: string;
  has_site: boolean;
  publish_slug?: string | null;
}

/** GET /sites/{projectId} */
export interface SitePromptRow {
  id: string;
  role: string;
  content: string;
}

export interface SiteProjectStatus {
  project_id: string;
  project_name: string;
  status: string;
  preview_url: string | null;
  structure_json: string | null;
  error_message: string | null;
  user_prompt: string | null;
  publish_slug: string | null;
  github_repo_url: string | null;
  cloud_run_url: string | null;
  cloud_run_service_name: string | null;
  site_url: string | null;
  publication_status: string | null;
  prompts: SitePromptRow[];
}

export async function fetchSiteProjectsList(): Promise<SiteProjectSummary[]> {
  const { data } = await api.get<SiteProjectSummary[]>('/sites/');
  return data;
}

export async function fetchSiteProjectStatus(projectId: string): Promise<SiteProjectStatus> {
  const { data } = await api.get<SiteProjectStatus>(`/sites/${projectId}`);
  return data;
}

export interface PublishedSiteItem {
  deployment_id: string;
  project_id: string;
  project_name: string;
  status: string;
  created_at: string;
  slug?: string | null;
  site_url?: string | null;
  github_repo_url?: string | null;
  cloud_run_service_name?: string | null;
  cloud_run_url?: string | null;
  error_message?: string | null;
}

export interface DeletePublishedSiteEnqueueResponse {
  jobId: string;
  message: string;
}

export async function fetchPublishedSites(): Promise<PublishedSiteItem[]> {
  const { data } = await api.get<PublishedSiteItem[]>('/sites/published-sites');
  return data;
}

export async function deletePublishedSite(deploymentId: string): Promise<DeletePublishedSiteEnqueueResponse> {
  const { data } = await api.post<DeletePublishedSiteEnqueueResponse>(`/sites/published-sites/${deploymentId}/delete`);
  return data;
}

export async function getDeletePublishedSiteJobStatus(jobId: string): Promise<JobStatus> {
  const { data } = await api.get<JobStatus>(`/sites/published-sites/jobs/${jobId}`);
  return data;
}
