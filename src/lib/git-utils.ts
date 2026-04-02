import { getGitSnapshots, type SnapshotItem } from "@/lib/novidadeApi";

export type GitSnapshot = SnapshotItem;

export async function listGitSnapshots(projectId: string): Promise<GitSnapshot[]> {
  return getGitSnapshots(projectId);
}
