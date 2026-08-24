import { useRef, useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";

interface BarcodeScannerProps {
  onDetected: (value: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState("");
  const scanning = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopStream = useCallback(() => {
    scanning.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ("BarcodeDetector" in window) {
          const detector = new (window as any).BarcodeDetector({
            formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
          });

          const scan = async () => {
            if (!scanning.current || !videoRef.current) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                onDetected(barcodes[0].rawValue);
                stopStream();
                return;
              }
            } catch {}
            if (scanning.current) requestAnimationFrame(scan);
          };
          scan();
        } else {
          setError("Browser tidak mendukung BarcodeDetector. Gunakan upload gambar barcode.");
        }
      } catch {
        setError("Tidak dapat mengakses kamera. Periksa izin kamera atau gunakan upload gambar.");
      }
    };

    start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [onDetected, stopStream]);

  const handleImageUpload = async (file: File) => {
    if (!("BarcodeDetector" in window)) {
      setError("Browser tidak mendukung BarcodeDetector untuk scan gambar.");
      return;
    }

    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = async () => {
      try {
        const detector = new (window as any).BarcodeDetector({
          formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
        });
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0) {
          onDetected(barcodes[0].rawValue);
          stopStream();
        } else {
          setError("Tidak dapat mendeteksi barcode dari gambar. Coba gambar lain atau input manual.");
        }
      } catch {
        setError("Gagal memproses gambar barcode.");
      }
      URL.revokeObjectURL(img.src);
    };
  };

  return (
    <div className="relative rounded-lg overflow-hidden border border-border bg-black text-foreground">
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/90 backdrop-blur border-b border-border">
        <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
          <Camera className="h-3.5 w-3.5 text-primary" /> Scan Barcode / QR
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2.5 bg-background/80"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" /> Upload
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => {
              stopStream();
              onClose();
            }}
            title="Tutup Scanner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {error ? (
        <div className="p-6 text-center space-y-3 bg-card">
          <p className="text-xs text-destructive leading-relaxed">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Gambar Barcode
          </Button>
        </div>
      ) : (
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          {/* Target Box Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-3/4 h-3/5 border border-primary/50 rounded-lg relative">
              <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-primary rounded-tl" />
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-primary rounded-tr" />
              <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-primary rounded-bl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-primary rounded-br" />
              {/* Laser Line */}
              <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse top-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
            <span className="text-[10px] text-white/90 bg-black/60 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
              Arahkan kamera ke barcode / QR code
            </span>
          </div>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
        }}
      />
    </div>
  );
}
