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
    <div className="relative rounded-lg overflow-hidden border border-border bg-black">
      <div className="flex items-center justify-between p-2 bg-muted">
        <span className="text-xs font-medium flex items-center gap-1">
          <Camera className="h-3 w-3" /> Scan Barcode
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3 w-3 mr-1" /> Upload
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { stopStream(); onClose(); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      {error ? (
        <div className="p-4 text-center space-y-2">
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3 mr-1" /> Upload Gambar Barcode
          </Button>
        </div>
      ) : (
        <video ref={videoRef} className="w-full aspect-video object-cover" playsInline muted />
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
