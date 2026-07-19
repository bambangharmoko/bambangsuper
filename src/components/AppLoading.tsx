import { Loader2 } from "lucide-react";

export function AppLoading() {
  return (
    <div id="app-loading-spinner" className="flex h-full min-h-[50vh] w-full items-center justify-center p-4">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
    </div>
  );
}