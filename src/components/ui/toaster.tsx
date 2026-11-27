import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

const DEFAULT_TOAST_MS = 4000;

function ToastLeadingIcon({ variant }: { variant?: "default" | "destructive" | "success" | "warning" | "info" | null }) {
  switch (variant) {
    case "success":
      return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2} aria-hidden />;
    case "destructive":
      return <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" strokeWidth={2} aria-hidden />;
    case "warning":
      return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--warning))]" strokeWidth={2} aria-hidden />;
    case "info":
      return <Info className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--info))]" strokeWidth={2} aria-hidden />;
    default:
      return null;
  }
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={DEFAULT_TOAST_MS} swipeDirection="right">
      {toasts.map(function ({ id, title, description, action, duration: durationProp, closable = true, ...props }) {
        const duration = durationProp ?? DEFAULT_TOAST_MS;
        const variant = props.variant ?? "default";
        const icon = <ToastLeadingIcon variant={variant} />;
        return (
          <Toast key={id} duration={duration} {...props}>
            {icon}
            <div className="grid min-w-0 flex-1 gap-1 pr-1">
              {title && <ToastTitle className="font-semibold tracking-tight leading-snug">{title}</ToastTitle>}
              {description && (
                <ToastDescription className="text-muted-foreground text-[13px] leading-relaxed">{description}</ToastDescription>
              )}
            </div>
            {action}
            {closable ? <ToastClose /> : null}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
