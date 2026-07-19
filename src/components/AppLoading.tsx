import { Loader2 } from "lucide-react";
import { AppLogo } from "./AppLogo";

export function AppLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-5" role="status" aria-live="polite">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-primary/20" />
          <div className="absolute inset-2 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
          <div className="absolute inset-5 rounded-full bg-card shadow-lg shadow-primary/20" />
          <AppLogo className="relative h-16 w-16 animate-pulse" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Memuat aplikasi...</p>
      </div>
    </div>
  );
}