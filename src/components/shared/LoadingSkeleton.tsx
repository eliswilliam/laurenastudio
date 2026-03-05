import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LoadingSkeletonProps {
  tipo?: 'card' | 'tabela' | 'grafico' | 'lista' | 'formulario';
  quantidade?: number;
  className?: string;
}

export function LoadingSkeleton({
  tipo = 'card',
  quantidade = 4,
  className,
}: LoadingSkeletonProps) {
  if (tipo === 'card') {
    return (
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
        {Array.from({ length: quantidade }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-6 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (tipo === 'grafico') {
    return (
      <div className={cn('rounded-xl border bg-card p-6 space-y-4', className)}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (tipo === 'tabela') {
    return (
      <div className={cn('rounded-xl border bg-card p-6 space-y-3', className)}>
        <Skeleton className="h-10 w-full rounded-lg" />
        {Array.from({ length: quantidade }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (tipo === 'lista') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: quantidade }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tipo === 'formulario') {
    return (
      <div className={cn('space-y-6', className)}>
        {Array.from({ length: quantidade }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return null;
}
