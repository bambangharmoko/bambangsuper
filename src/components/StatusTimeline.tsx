import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Alur status normal (Cancelled disisipkan sebelum Close,
// karena Close = unit sudah diambil/tidak ada di toko,
// sedangkan Cancelled = tiket batal tapi unit bisa masih ada di toko)
const STATUS_ORDER = [
  "Diterima",
  "Diagnosa",
  "Menunggu Persetujuan Pelanggan",
  "Menunggu Sparepart",
  "Perbaikan",
  "Selesai",
  "Siap diAmbil",
  "Cancelled",
  "Close",
];

const isInstallServiceType = (serviceType?: string) => {
  if (!serviceType) return false;
  return serviceType.includes("Install Software") || serviceType.includes("Install Hardware");
};

// Untuk Install: Cancelled juga disisipkan sebelum Close
const INSTALL_STATUS_ORDER = [
  { status: "Diterima", label: "Diterima" },
  { status: "Perbaikan", label: "Sedang Dikerjakan" },
  { status: "Menunggu Sparepart", label: "Menunggu Sparepart", optional: true },
  { status: "Selesai", label: "Selesai" },
  { status: "Siap diAmbil", label: "Siap Diambil" },
  { status: "Cancelled", label: "Cancelled", optional: true },
  { status: "Close", label: "Close" },
];

interface Update {
  status: string;
  description: string | null;
  created_at: string;
  cancel_type?: string | null;
}

export function StatusTimeline({
  updates,
  currentStatus,
  serviceType,
}: {
  updates: Update[];
  currentStatus: string;
  serviceType?: string;
}) {
  const isCancelled = currentStatus === "Cancelled";
  const latestUpdateByStatus = updates.reduce<Record<string, Update>>((acc, update) => {
    acc[update.status] = update;
    return acc;
  }, {});
  const isInstallService = isInstallServiceType(serviceType);

  // Bangun daftar step timeline:
  // - Untuk tiket install: saring step Pending & Cancelled yang tidak relevan
  // - Untuk tiket normal: tampilkan semua step, tapi sembunyikan "Cancelled"
  //   jika tiket tidak pernah di-cancel (tidak ada update Cancelled)
  const timelineSteps = isInstallService
    ? INSTALL_STATUS_ORDER.filter((step) => {
      if (step.status === "Menunggu Sparepart") return latestUpdateByStatus[step.status] || currentStatus === "Menunggu Sparepart";
      // Tampilkan Cancelled hanya jika tiket pernah di-cancel
      if (step.status === "Cancelled") return isCancelled || !!latestUpdateByStatus["Cancelled"];
      return true;
    })
    : STATUS_ORDER
      .filter((status) => {
        // Tampilkan step Cancelled hanya jika tiket pernah/sedang di-cancel
        if (status === "Cancelled") return isCancelled || !!latestUpdateByStatus["Cancelled"];
        return true;
      })
      .map((status) => ({ status, label: status }));

  const currentIndex = timelineSteps.findIndex((step) => step.status === currentStatus);

  return (
    <div className="space-y-0">
      {timelineSteps.map((step, index) => {
        const update = latestUpdateByStatus[step.status];
        const isCurrent = step.status === currentStatus;
        const isCompleted = !isCurrent && index < currentIndex && update !== undefined;
        const showDetails = isCurrent || isCompleted;
        const isCancelStep = step.status === "Cancelled";

        return (
          <div key={step.status} className="flex gap-3">
            <div className="flex flex-col items-center">
              {isCurrent && isCancelStep ? (
                // Step aktif Cancel: gunakan ikon X merah
                <XCircle className="h-5 w-5 text-destructive shrink-0" />
              ) : isCurrent ? (
                <Circle className="h-5 w-5 text-primary shrink-0 fill-primary" />
              ) : isCompleted && isCancelStep ? (
                // Step Cancel yang sudah selesai (misalnya unit sudah diambil setelah cancel)
                <XCircle className="h-5 w-5 text-destructive/60 shrink-0" />
              ) : isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
              )}
              {index < timelineSteps.length - 1 && (
                <div className={cn(
                  "w-0.5 h-8",
                  index < currentIndex ? (isCancelStep ? "bg-destructive/40" : "bg-success") : "bg-border"
                )} />
              )}
            </div>
            <div className="pb-6 -mt-0.5">
              <p className={cn(
                "text-sm font-medium",
                isCurrent && isCancelStep
                  ? "text-destructive"
                  : showDetails
                    ? "text-foreground"
                    : "text-muted-foreground"
              )}>
                {step.label}
              </p>
              {showDetails && update && (
                <>
                  {isCancelStep && update.cancel_type && (
                    <p className="text-xs text-destructive/80 mt-0.5">{update.cancel_type}</p>
                  )}
                  {update.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{update.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {new Date(update.created_at).toLocaleString("id-ID")}
                  </p>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
