import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "Wystąpił błąd",
  message = "Nie udało się załadować danych. Spróbuj ponownie.",
  onRetry,
  retryLabel = "Spróbuj ponownie",
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10 mb-4">
        <AlertCircle className="w-10 h-10 text-destructive" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
        {message}
      </p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
