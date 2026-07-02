import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  Diterima: { label: "Diterima", className: "bg-info text-info-foreground" },
  Diagnosa: { label: "Diagnosa", className: "bg-warning text-warning-foreground" },
  "Menunggu Persetujuan Pelanggan": { label: "Menunggu Persetujuan Pelanggan", className: "bg-accent text-accent-foreground" },
  "Menunggu Sparepart": { label: "Menunggu Sparepart", className: "bg-muted text-muted-foreground" },
  Perbaikan: { label: "Perbaikan", className: "bg-primary text-primary-foreground" },
  Selesai: { label: "Selesai", className: "bg-success text-success-foreground" },
  "Siap diAmbil": { label: "Siap diAmbil", className: "bg-success text-success-foreground" },
  Close: { label: "Close", className: "bg-muted text-muted-foreground" },
  Cancelled: { label: "Cancelled", className: "bg-destructive text-destructive-foreground" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
  return <Badge className={config.className}>{config.label}</Badge>;
}
