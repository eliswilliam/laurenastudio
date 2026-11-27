import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { formatApiError } from '@/lib/api';
import {
  deletePublishedSite,
  fetchPublishedSites,
  getDeletePublishedSiteJobStatus,
  type PublishedSiteItem,
} from '@/lib/siteProjectsApi';

const POLL_MS = 2500;

function statusClass(status: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'success') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'pending' || s === 'processing') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (s === 'deleting') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (s === 'deleted') return 'bg-slate-200 text-slate-700 border-slate-300';
  if (s === 'delete_failed' || s === 'failed') return 'bg-rose-100 text-rose-800 border-rose-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function isActiveDeployment(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'pending' || s === 'processing';
}

export default function SitesPublicados() {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  const [items, setItems] = useState<PublishedSiteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selected, setSelected] = useState<PublishedSiteItem | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [deletingDeploymentId, setDeletingDeploymentId] = useState<string | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const loadItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    try {
      const data = await fetchPublishedSites();
      setItems(data);
    } catch (error) {
      const message = formatApiError(error);
      toast({
        title: t('pages.sitePublished.loadErrorTitle'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // Auto-refresh every 5 s while any deployment is pending/processing.
  useEffect(() => {
    const hasActive = items.some((item) => isActiveDeployment(item.status));
    if (hasActive) {
      autoRefreshRef.current = setInterval(() => void loadItems(true), 5000);
    } else {
      if (autoRefreshRef.current !== undefined) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = undefined;
      }
    }
    return () => {
      if (autoRefreshRef.current !== undefined) clearInterval(autoRefreshRef.current);
    };
  }, [items, loadItems]);

  useEffect(() => {
    if (!deleteJobId) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const finish = () => {
      if (intervalId !== undefined) clearInterval(intervalId);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        const job = await getDeletePublishedSiteJobStatus(deleteJobId);
        if (cancelled) return;

        if (job.status === 'success') {
          finish();
          const result = (job.result ?? {}) as Record<string, unknown>;
          const githubDeleted = result.githubDeleted !== false;
          const githubDeleteError =
            typeof result.githubDeleteError === 'string' ? result.githubDeleteError : null;

          toast({
            title: t('pages.sitePublished.deleteSuccessTitle'),
            description: t('pages.sitePublished.deleteSuccessDescription'),
          });
          if (!githubDeleted && githubDeleteError) {
            toast({
              title: t('pages.sitePublished.deleteErrorTitle'),
              description: githubDeleteError,
              variant: 'destructive',
            });
          }
          setDeleteJobId(null);
          setDeletingDeploymentId(null);
          void loadItems(true);
          return;
        }

        if (job.status === 'failed') {
          finish();
          throw new Error(job.error || t('pages.sitePublished.deleteFailed'));
        }
      } catch (error) {
        if (cancelled) return;
        finish();
        const message = formatApiError(error);
        toast({
          title: t('pages.sitePublished.deleteErrorTitle'),
          description: message,
          variant: 'destructive',
        });
        setDeleteJobId(null);
        setDeletingDeploymentId(null);
        void loadItems(true);
      }
    };

    void tick();
    intervalId = setInterval(() => void tick(), POLL_MS);

    return () => {
      cancelled = true;
      finish();
    };
  }, [deleteJobId, loadItems, t, toast]);

  const selectedUrl = useMemo(() => (selected?.site_url || '').trim(), [selected]);

  const openDeleteModal = (item: PublishedSiteItem) => {
    setSelected(item);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selected) return;
    try {
      const response = await deletePublishedSite(selected.deployment_id);
      setDeleteModalOpen(false);
      setDeletingDeploymentId(selected.deployment_id);
      setDeleteJobId(response.jobId);
      toast({
        title: t('pages.sitePublished.deleteQueuedTitle'),
        description: t('pages.sitePublished.deleteQueuedDescription'),
      });
    } catch (error) {
      const message = formatApiError(error);
      toast({
        title: t('pages.sitePublished.deleteErrorTitle'),
        description: message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{t('nav.sitePublished')}</CardTitle>
            <CardDescription>{t('pages.sitePublished.subtitle')}</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void loadItems(true)}
            disabled={refreshing || loading}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t('pages.sitePublished.refresh')}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('pages.sitePublished.loading')}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('pages.sitePublished.empty')}</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const rowDeleting = deletingDeploymentId === item.deployment_id || item.status === 'deleting';
                const created = new Date(item.created_at);
                const dateText = Number.isNaN(created.valueOf())
                  ? item.created_at
                  : created.toLocaleString(i18n.language || undefined);

                return (
                  <div
                    key={item.deployment_id}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={`flex items-center gap-1 ${statusClass(item.status)}`}>
                            {isActiveDeployment(item.status) && (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            )}
                            {item.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {t('pages.sitePublished.project')}: {item.project_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t('pages.sitePublished.publishedAt')}: {dateText}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-sm font-medium">{t('pages.sitePublished.siteUrl')}</p>
                          {item.site_url ? (
                            <a
                              href={item.site_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
                            >
                              {item.site_url}
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground">{t('pages.sitePublished.noUrl')}</p>
                          )}
                        </div>

                        {item.slug ? (
                          <p className="text-xs text-muted-foreground">
                            {t('pages.sitePublished.slug')}: {item.slug}
                          </p>
                        ) : null}

                        {item.error_message ? (
                          <p className="text-xs text-rose-600">{item.error_message}</p>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="gap-2"
                          onClick={() => openDeleteModal(item)}
                          disabled={rowDeleting || item.status === 'deleted'}
                        >
                          {rowDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          {rowDeleting ? t('pages.sitePublished.deleting') : t('pages.sitePublished.deleteButton')}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('pages.sitePublished.deleteConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('pages.sitePublished.deleteConfirmDescription')}
              {selectedUrl ? ` ${selectedUrl}` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('pages.sitePublished.deleteButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
