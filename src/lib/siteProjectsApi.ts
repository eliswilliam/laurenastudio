import api from '@/lib/api';

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
