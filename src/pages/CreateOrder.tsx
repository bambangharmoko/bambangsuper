import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Upload, X, Search, Camera } from "lucide-react";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { cn } from "@/lib/utils";

const SERVICE_TYPES = ["Non Garansi", "Garansi Toko", "Garansi Partner", "Install Software/Hardware"];
const INSTALL_SERVICE_OPTIONS = ["Install OS", "Install Driver", "Install Software Aplikasi", "Install Hardware"];
const STANDARD_UNIT_CONDITIONS = [
  "Mati Total",
  "No Display",
  "Keyboard Problem",
  "LCD Problem",
  "Bluescreen",
  "Windows Problem",
  "Battery Problem",
  "Engsel Problem",
  "Problem Lainnya",
];
const NEEDS_PROBLEM_EXPLANATION = [
  "Keyboard Problem",
  "LCD Problem",
  "Windows Problem",
  "Battery Problem",
  "Engsel Problem",
  "Problem Lainnya",
];
const OS_OPTIONS = ["Windows 7", "Windows 8", "Windows 10", "Windows 11", "OS Lainnya"];
const SOFTWARE_OPTIONS = ["Aplikasi Program Standar", "Aplikasi Tambahan"];
const CHECK_ITEMS = ["Speaker", "Camera", "Touchpad", "Keyboard", "Wifi", "LCD Panel"];
const DEVICE_TYPES = ["Laptop", "PC", "AIO", "Printer", "Lainnya"];
const REQUEST_TIMEOUT_MS = 45000; // 45s — mobile connections can be slow
const CREATE_ORDER_ERROR_MESSAGE = "Gagal membuat pesanan. Periksa koneksi internet atau ukuran foto, lalu coba lagi.";

interface FormData {
  serviceType: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  rememberCustomer: boolean;
  deviceType: string;
  deviceTypeOther: string;
  deviceBrand: string;
  deviceModel: string;
  devicePassword: string;
  unitCondition: string;
  problemExplanation: string;
  damageDescription: string;
  unitAccessories: string;
  unitChecks: Record<string, boolean>;
  otherCheck: string;
  notes: string;
  serialNumber: string;
  installServices: string[];
  selectedOs: string;
  otherOs: string;
  driverDetails: string;
  softwareType: string;
  additionalSoftware: string;
  hardwareDetails: string;
}

interface PhotoFile {
  file: File;
  label: string;
  preview: string;
}

const PHOTO_LABELS = ["Atas", "Bawah", "Kondisi Terbuka"];

interface PendingUnit {
  deviceType: string;
  deviceTypeOther: string;
  deviceBrand: string;
  deviceModel: string;
  devicePassword: string;
  unitCondition: string;
  problemExplanation: string;
  damageDescription: string;
  unitAccessories: string;
  unitChecks: Record<string, boolean>;
  otherCheck: string;
  notes: string;
  serialNumber: string;
  installServices: string[];
  selectedOs: string;
  otherOs: string;
  driverDetails: string;
  softwareType: string;
  additionalSoftware: string;
  hardwareDetails: string;
  photos: PhotoFile[];
}

const UNIT_FIELD_RESET: Pick<
  FormData,
  | "deviceType"
  | "deviceTypeOther"
  | "deviceBrand"
  | "deviceModel"
  | "devicePassword"
  | "unitCondition"
  | "problemExplanation"
  | "damageDescription"
  | "unitAccessories"
  | "unitChecks"
  | "otherCheck"
  | "notes"
  | "serialNumber"
  | "installServices"
  | "selectedOs"
  | "otherOs"
  | "driverDetails"
  | "softwareType"
  | "additionalSoftware"
  | "hardwareDetails"
> = {
  deviceType: "",
  deviceTypeOther: "",
  deviceBrand: "",
  deviceModel: "",
  devicePassword: "",
  unitCondition: "",
  problemExplanation: "",
  damageDescription: "",
  unitAccessories: "",
  unitChecks: {},
  otherCheck: "",
  notes: "",
  serialNumber: "",
  installServices: [],
  selectedOs: "",
  otherOs: "",
  driverDetails: "",
  softwareType: "",
  additionalSoftware: "",
  hardwareDetails: "",
};

const withTimeout = async <T,>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

/**
 * Compress image using Canvas API with an 8-second timeout.
 * If the canvas operation hangs (common on mobile with large camera photos),
 * we fall back to the original file so the user is never stuck waiting.
 */
const compressImage = (file: File): Promise<File> => {
  if (!file.type.startsWith("image/")) return Promise.resolve(file);

  const compress = new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280; // Lower threshold for mobile stability
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width >= height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) { resolve(file); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.80,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });

  // Hard timeout: if canvas takes >8s (mobile memory pressure), use original file
  const timeout = new Promise<File>((resolve) => setTimeout(() => resolve(file), 8000));
  return Promise.race([compress, timeout]);
};


// IndexedDB for persisting photo File objects across page reloads
const DB_NAME = "super_komputer_order_drafts";
const STORE_NAME = "photos";

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "label" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const savePhotosToDB = async (orderPhotos: PhotoFile[]) => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => resolve();
      clearReq.onerror = () => reject(clearReq.error);
    });

    for (const photo of orderPhotos) {
      await new Promise<void>((resolve, reject) => {
        const putReq = store.put({ label: photo.label, file: photo.file });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });
    }
  } catch (e) {
    console.error("Failed to save photos to IndexedDB:", e);
  }
};

const loadPhotosFromDB = async (): Promise<PhotoFile[]> => {
  try {
    const db = await openDB();
    return await new Promise<PhotoFile[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const data = request.result || [];
        const restored: PhotoFile[] = data.map((item: any) => ({
          file: item.file,
          label: item.label,
          preview: URL.createObjectURL(item.file),
        }));
        resolve(restored);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Failed to load photos from IndexedDB:", e);
    return [];
  }
};

const clearPhotosFromDB = async () => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("Failed to clear photos from IndexedDB:", e);
  }
};

const getFriendlyErrorMessage = (err: any) => {
  const message = err?.message || "Terjadi kesalahan tidak diketahui.";
  const lowerMessage = message.toLowerCase();
  if (
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("network") ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("terlalu lama") ||
    lowerMessage.includes("upload") ||
    lowerMessage.includes("foto")
  ) {
    return CREATE_ORDER_ERROR_MESSAGE;
  }
  return message;
};

const getCreateOrderFeedback = (err: any) => {
  const message = getFriendlyErrorMessage(err);
  if (message === CREATE_ORDER_ERROR_MESSAGE) return message;

  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("upload") || lowerMessage.includes("storage") || lowerMessage.includes("foto")) {
    return `Gagal mengunggah foto: ${message}`;
  }

  if (lowerMessage.includes("koneksi") || lowerMessage.includes("network") || lowerMessage.includes("failed to fetch")) {
    return message;
  }

  return `Gagal membuat pesanan: ${message}`;
};

const uploadOrderPhotos = async (orderId: string, orderPhotos: PhotoFile[]) => {
  // Note: photos are already compressed in handlePhotoUpload, no need to compress again.
  await Promise.all(
    orderPhotos.map(async (photo) => {
      const extension = photo.file.name.split(".").pop() || "jpg";
      const filePath = `${orderId}/${photo.label}-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("unit-photos").upload(filePath, photo.file, {
        contentType: photo.file.type || "image/jpeg",
      });

      if (uploadError) throw new Error(`Upload foto ${photo.label} gagal: ${uploadError.message}`);

      const { data: urlData } = supabase.storage.from("unit-photos").getPublicUrl(filePath);
      const { error: photoError } = await supabase.from("service_photos").insert({
        order_id: orderId,
        photo_url: urlData.publicUrl,
        label: photo.label,
      });

      if (photoError) throw new Error(`Menyimpan data foto ${photo.label} gagal: ${photoError.message}`);
    }),
  );
};

/** Always returns a valid UUID v4, even on browsers that don't support crypto.randomUUID. */
const makeClientId = (): string => {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  // RFC 4122 compliant UUID v4 polyfill
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
};

const isInstallServiceType = (serviceType: string) => serviceType.includes("Install Software") || serviceType.includes("Install Hardware");

const formatWhatsAppPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("8")) return `62${digits}`;
  return digits;
};

const openTicketWhatsAppMessage = ({
  customerName,
  customerPhone,
  ticketNumber,
  entryDate,
  serviceType,
  deviceBrand,
  deviceModel,
  unitCondition,
  unitAccessories,
  currentStatus,
}: {
  customerName: string;
  customerPhone: string;
  ticketNumber: string;
  entryDate: string;
  serviceType: string;
  deviceBrand: string;
  deviceModel: string;
  unitCondition: string;
  unitAccessories: string;
  currentStatus: string;
}) => {
  const trackLink = `${window.location.origin}/track/${ticketNumber}`;
  const message = `Halo *${customerName}*, terima kasih telah mempercayakan perbaikan unit Anda di *Toko Super Komputer*. Berikut adalah rangkuman detail tiket penerimaan servis Anda:

🧾 *Nomor Tiket:* ${ticketNumber}
📅 *Tanggal Masuk:* ${entryDate}
🔧 *Tipe Servis:* ${serviceType}
💻 *Unit:* ${deviceBrand} ${deviceModel}
⚠️ *Kondisi Unit:* ${unitCondition}
🎒 *Kelengkapan:* ${unitAccessories}
📌 *Status Saat Ini:* ${currentStatus}

🔍 *Pantau Status Servis:*
Kakak bisa melacak proses pengerjaan secara real-time melalui link berikut:
👉 ${trackLink}

Kami akan segera menginformasikan jika ada update atau pengecekan lebih lanjut. Terima kasih! 🙏`;

  const waLink = `https://wa.me/${formatWhatsAppPhone(customerPhone)}?text=${encodeURIComponent(message)}`;
  window.open(waLink, "_blank");
};

interface MultiUnitTicketSummary {
  ticketNumber: string;
  serviceType: string;
  deviceBrand: string;
  deviceModel: string;
  unitCondition: string;
  unitAccessories: string;
  currentStatus: string;
}

const openMultiTicketWhatsAppMessage = ({
  customerName,
  customerPhone,
  entryDate,
  tickets,
}: {
  customerName: string;
  customerPhone: string;
  entryDate: string;
  tickets: MultiUnitTicketSummary[];
}) => {
  const trackBase = `${window.location.origin}/track`;
  const blocks = tickets
    .map(
      (t, i) => `— *Unit ${i + 1}* —
🧾 *Nomor Tiket:* ${t.ticketNumber}
🔧 *Tipe Servis:* ${t.serviceType}
💻 *Unit:* ${t.deviceBrand} ${t.deviceModel}
⚠️ *Kondisi Unit:* ${t.unitCondition}
🎒 *Kelengkapan:* ${t.unitAccessories}
📌 *Status Saat Ini:* ${t.currentStatus}
👉 ${trackBase}/${t.ticketNumber}`,
    )
    .join("\n\n");

  const message = `Halo *${customerName}*, terima kasih telah mempercayakan perbaikan unit Anda di *Toko Super Komputer*. Berikut adalah rangkuman ${tickets.length} tiket penerimaan servis Anda:

📅 *Tanggal Masuk:* ${entryDate}

${blocks}

🔍 *Pantau Status Servis:*
Kakak bisa melacak proses pengerjaan setiap unit secara real-time melalui link masing-masing di atas.

Kami akan segera menginformasikan jika ada update atau pengecekan lebih lanjut. Terima kasih! 🙏`;

  const waLink = `https://wa.me/${formatWhatsAppPhone(customerPhone)}?text=${encodeURIComponent(message)}`;
  window.open(waLink, "_blank");
};

export default function CreateOrderPage() {
  const [step, setStep] = useState(1);
  const [customerLocked, setCustomerLocked] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [emailLockedFromDb, setEmailLockedFromDb] = useState(false);
  const [form, setForm] = useState<FormData>({
    serviceType: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    rememberCustomer: false,
    deviceType: "",
    deviceTypeOther: "",
    deviceBrand: "",
    deviceModel: "",
    devicePassword: "",
    unitCondition: "",
    problemExplanation: "",
    damageDescription: "",
    unitAccessories: "",
    unitChecks: {},
    otherCheck: "",
    notes: "",
    serialNumber: "",
    installServices: [],
    selectedOs: "",
    otherOs: "",
    driverDetails: "",
    softwareType: "",
    additionalSoftware: "",
    hardwareDetails: "",
  });
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedCustomers, setSavedCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [pendingUnits, setPendingUnits] = useState<PendingUnit[]>([]);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [duplicateAlertOpen, setDuplicateAlertOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const searchRef = useRef<HTMLDivElement>(null);
  // Keep a ref to the latest photos so visibilitychange handler can access it without stale closure.
  const photosRef = useRef<PhotoFile[]>(photos);
  useEffect(() => { photosRef.current = photos; }, [photos]);


  const LOCAL_STORAGE_KEY_FORM = "super_komputer_create_order_form";
  const LOCAL_STORAGE_KEY_STEP = "super_komputer_create_order_step";
  const LOCAL_STORAGE_KEY_PENDING_UNITS = "super_komputer_create_order_pending_units";

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedForm = localStorage.getItem(LOCAL_STORAGE_KEY_FORM);
    const savedStep = localStorage.getItem(LOCAL_STORAGE_KEY_STEP);
    const savedPendingUnits = localStorage.getItem(LOCAL_STORAGE_KEY_PENDING_UNITS);

    if (savedForm) {
      try {
        setForm(JSON.parse(savedForm));
      } catch (e) {
        console.error("Failed to parse saved form", e);
      }
      if (savedStep) {
        try {
          const parsedStep = Number(savedStep);
          if (!isNaN(parsedStep)) {
            setStep(parsedStep);
          }
        } catch (e) {
          console.error("Failed to parse saved step", e);
        }
      }
    } else {
      // Jika tidak ada draft form yang disimpan, bersihkan state form ke default
      setForm({
        serviceType: "",
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        rememberCustomer: false,
        deviceType: "",
        deviceTypeOther: "",
        deviceBrand: "",
        deviceModel: "",
        devicePassword: "",
        unitCondition: "",
        problemExplanation: "",
        damageDescription: "",
        unitAccessories: "",
        unitChecks: {},
        otherCheck: "",
        notes: "",
        serialNumber: "",
        installServices: [],
        selectedOs: "",
        otherOs: "",
        driverDetails: "",
        softwareType: "",
        additionalSoftware: "",
        hardwareDetails: "",
      });
      setStep(1);
    }

    if (savedPendingUnits) {
      try {
        setPendingUnits(JSON.parse(savedPendingUnits));
      } catch (e) {
        console.error("Failed to parse saved pending units", e);
      }
    } else {
      setPendingUnits([]);
    }

    // Load persisted photos dari IndexedDB
    const loadPhotos = async () => {
      const restoredPhotos = await loadPhotosFromDB();
      if (restoredPhotos.length > 0) {
        setPhotos(restoredPhotos);
      } else {
        setPhotos([]);
      }
    };
    loadPhotos();
  }, []);

  // Save to localStorage when state changes
  useEffect(() => {
    if (step > 1 || form.serviceType !== "") {
      localStorage.setItem(LOCAL_STORAGE_KEY_FORM, JSON.stringify(form));
      localStorage.setItem(LOCAL_STORAGE_KEY_STEP, String(step));
      localStorage.setItem(LOCAL_STORAGE_KEY_PENDING_UNITS, JSON.stringify(pendingUnits));
    }
  }, [form, step, pendingUnits]);

  // Sync photos to IndexedDB when state changes
  useEffect(() => {
    if (photos.length > 0) {
      savePhotosToDB(photos);
    } else {
      clearPhotosFromDB();
    }
  }, [photos]);

  // Persist photos immediately when the user leaves the page (e.g. switching to camera app).
  // Mobile browsers can reload the page when returning from the camera, so we need IndexedDB
  // to have the latest photos before that happens.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && photosRef.current.length > 0) {
        savePhotosToDB(photosRef.current);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);


  const clearDraft = async () => {
    localStorage.removeItem(LOCAL_STORAGE_KEY_FORM);
    localStorage.removeItem(LOCAL_STORAGE_KEY_STEP);
    localStorage.removeItem(LOCAL_STORAGE_KEY_PENDING_UNITS);
    await clearPhotosFromDB();
    setPhotos([]);
    setForm({
      serviceType: "",
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      rememberCustomer: false,
      deviceType: "",
      deviceTypeOther: "",
      deviceBrand: "",
      deviceModel: "",
      devicePassword: "",
      unitCondition: "",
      problemExplanation: "",
      damageDescription: "",
      unitAccessories: "",
      unitChecks: {},
      otherCheck: "",
      notes: "",
      serialNumber: "",
      installServices: [],
      selectedOs: "",
      otherOs: "",
      driverDetails: "",
      softwareType: "",
      additionalSoftware: "",
      hardwareDetails: "",
    });
    setPendingUnits([]);
    setStep(1);
    setCustomerSearch("");
    setCustomerLocked(false);
    setSelectedCustomerId(null);
  };

  const update = (field: keyof FormData, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const hasInstallService = (service: string) => form.installServices.includes(service);

  const shouldShowProblemExplanation = !isInstallServiceType(form.serviceType) && NEEDS_PROBLEM_EXPLANATION.includes(form.unitCondition);

  const toggleInstallService = (service: string, checked: boolean) => {
    setForm((prev) => {
      const installServices = checked
        ? [...prev.installServices, service]
        : prev.installServices.filter((item) => item !== service);

      return {
        ...prev,
        installServices,
        selectedOs: service === "Install OS" && !checked ? "" : prev.selectedOs,
        otherOs: service === "Install OS" && !checked ? "" : prev.otherOs,
        driverDetails: service === "Install Driver" && !checked ? "" : prev.driverDetails,
        softwareType: service === "Install Software Aplikasi" && !checked ? "" : prev.softwareType,
        additionalSoftware: service === "Install Software Aplikasi" && !checked ? "" : prev.additionalSoftware,
        hardwareDetails: service === "Install Hardware" && !checked ? "" : prev.hardwareDetails,
      };
    });

    if (service === "Install Hardware" && !checked) {
      setPhotos((prev) => {
        prev.forEach((photo) => URL.revokeObjectURL(photo.preview));
        return [];
      });
    }
  };

  const getInstallDetails = () => {
    const details: string[] = [];
    if (hasInstallService("Install OS"))
      details.push(`OS: ${form.selectedOs === "OS Lainnya" ? form.otherOs : form.selectedOs}`);
    if (hasInstallService("Install Driver")) details.push(`Driver: ${form.driverDetails}`);
    if (hasInstallService("Install Software Aplikasi")) {
      details.push(
        `Software: ${form.softwareType}${form.softwareType === "Aplikasi Tambahan" ? ` - ${form.additionalSoftware}` : ""}`,
      );
    }
    if (hasInstallService("Install Hardware")) details.push(`Hardware: ${form.hardwareDetails}`);
    return details;
  };

  // Load saved customers on mount
  useEffect(() => {
    const loadCustomers = async () => {
      const { data } = await supabase.from("saved_customers").select("*").order("created_at", { ascending: false });
      setSavedCustomers(data || []);
    };
    loadCustomers();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCustomers = savedCustomers.filter(
    (c) =>
      c.customer_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.customer_phone.includes(customerSearch) ||
      (c.customer_email && c.customer_email.toLowerCase().includes(customerSearch.toLowerCase())),
  );

  const isDuplicateCustomer = () => {
    if (customerLocked) return false;

    const normalizePhone = (p: string) => {
      const digits = p.replace(/\D/g, "");
      if (digits.startsWith("0")) return `62${digits.slice(1)}`;
      if (digits.startsWith("8")) return `62${digits}`;
      return digits;
    };

    const currentPhone = form.customerPhone ? normalizePhone(form.customerPhone) : "";
    const currentEmail = form.customerEmail ? form.customerEmail.toLowerCase().trim() : "";

    if (!currentPhone && !currentEmail) return false;

    return savedCustomers.some(c => {
      const dbPhone = c.customer_phone ? normalizePhone(c.customer_phone) : "";
      const dbEmail = c.customer_email ? c.customer_email.toLowerCase().trim() : "";

      const phoneMatch = currentPhone && dbPhone && currentPhone === dbPhone;
      const emailMatch = currentEmail && dbEmail && currentEmail === dbEmail;

      return phoneMatch || emailMatch;
    });
  };

  const handleNextStep = () => {
    if (step === 2 && isDuplicateCustomer()) {
      setDuplicateAlertOpen(true);
      return;
    }
    setStep((s) => s + 1);
  };

  const selectCustomer = (c: any) => {
    update("customerName", c.customer_name);
    update("customerPhone", c.customer_phone);
    update("customerEmail", c.customer_email || "");
    setCustomerSearch(c.customer_name);
    setShowCustomerDropdown(false);
    setCustomerLocked(true);
    setSelectedCustomerId(c.id);
    setEmailLockedFromDb(!!c.customer_email);
  };

  const handlePhotoUpload = async (label: string, file: File) => {
    if (!file || file.size === 0) {
      toast.error("File foto tidak valid, coba ambil ulang.");
      return;
    }

    // Helper: merge new photo into the current photos list from photosRef
    const buildMerged = (photo: PhotoFile): PhotoFile[] => {
      const current = photosRef.current;
      const copy = [...current];
      const idx = copy.findIndex((p) => p.label === label);
      if (idx >= 0) { copy[idx] = photo; } else { copy.push(photo); }
      return copy;
    };

    // ── Step 1: Show photo IMMEDIATELY with raw file ──────────────────────────
    // Never wait for compression before updating UI. Mobile camera returns control
    // to the browser and the user must see their photo instantly.
    const rawPreview = URL.createObjectURL(file);
    const rawPhoto: PhotoFile = { file, label, preview: rawPreview };

    setPhotos((prev) => {
      const copy = [...prev];
      const idx = copy.findIndex((p) => p.label === label);
      if (idx >= 0) {
        if (copy[idx].preview !== rawPreview) URL.revokeObjectURL(copy[idx].preview);
        copy[idx] = rawPhoto;
      } else {
        copy.push(rawPhoto);
      }
      return copy;
    });

    // Save raw file to IndexedDB now so it survives any page reload
    await savePhotosToDB(buildMerged(rawPhoto));
    toast.success(`Foto ${label} tersimpan.`);

    // ── Step 2: Compress in background (non-blocking) ─────────────────────────
    // If compression fails or times out (8s), the raw photo is already saved & visible.
    compressImage(file).then(async (optimizedFile) => {
      if (optimizedFile === file) return; // No size benefit; keep raw
      const optimizedPreview = URL.createObjectURL(optimizedFile);
      const optimizedPhoto: PhotoFile = { file: optimizedFile, label, preview: optimizedPreview };
      setPhotos((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex((p) => p.label === label);
        if (idx >= 0) {
          URL.revokeObjectURL(copy[idx].preview);
          copy[idx] = optimizedPhoto;
        }
        return copy;
      });
      await savePhotosToDB(buildMerged(optimizedPhoto));
    }).catch((e) => console.warn("Background compression failed, keeping raw:", e));
  };



  const removePhoto = (label: string) => {
    setPhotos((prev) => prev.filter((p) => p.label !== label));
  };

  const getDeviceTypeValue = () => {
    if (form.deviceType === "Lainnya") return form.deviceTypeOther;
    return form.deviceType;
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return !!form.serviceType;
      case 2:
        return !!form.customerName && !!form.customerPhone;
      case 3: {
        const typeOk = form.deviceType === "Lainnya" ? !!form.deviceTypeOther : !!form.deviceType;
        const snOk = form.serviceType !== "Garansi Partner" || !!form.serialNumber;
        return typeOk && !!form.deviceBrand && !!form.deviceModel && snOk;
      }
      case 4: {
        if (!isInstallServiceType(form.serviceType)) {
          return (
            !!form.unitCondition &&
            (!shouldShowProblemExplanation || !!form.problemExplanation.trim()) &&
            !!form.damageDescription.trim() &&
            PHOTO_LABELS.every((l) => photos.some((p) => p.label === l)) &&
            !!form.unitAccessories.trim()
          );
        }

        const servicesOk = form.installServices.length > 0;
        const osOk =
          !hasInstallService("Install OS") ||
          (!!form.selectedOs && (form.selectedOs !== "OS Lainnya" || !!form.otherOs.trim()));
        const driverOk = !hasInstallService("Install Driver") || !!form.driverDetails.trim();
        const softwareOk =
          !hasInstallService("Install Software Aplikasi") ||
          (!!form.softwareType && (form.softwareType !== "Aplikasi Tambahan" || !!form.additionalSoftware.trim()));
        const hardwareOk = !hasInstallService("Install Hardware") || !!form.hardwareDetails.trim();
        const photosOk =
          !hasInstallService("Install Hardware") || PHOTO_LABELS.every((l) => photos.some((p) => p.label === l));
        const accessoriesOk = !!form.unitAccessories.trim();
        const checksOk =
          !hasInstallService("Install Hardware") ||
          Object.values(form.unitChecks).some(Boolean) ||
          !!form.otherCheck.trim();
        return servicesOk && osOk && driverOk && softwareOk && hardwareOk && photosOk && accessoriesOk && checksOk;
      }
      default:
        return true;
    }
  };

  const buildCurrentUnit = (): PendingUnit => ({
    deviceType: form.deviceType,
    deviceTypeOther: form.deviceTypeOther,
    deviceBrand: form.deviceBrand,
    deviceModel: form.deviceModel,
    devicePassword: form.devicePassword,
    unitCondition: form.unitCondition,
    problemExplanation: form.problemExplanation,
    damageDescription: form.damageDescription,
    unitAccessories: form.unitAccessories,
    unitChecks: { ...form.unitChecks },
    otherCheck: form.otherCheck,
    notes: form.notes,
    serialNumber: form.serialNumber,
    installServices: [...form.installServices],
    selectedOs: form.selectedOs,
    otherOs: form.otherOs,
    driverDetails: form.driverDetails,
    softwareType: form.softwareType,
    additionalSoftware: form.additionalSoftware,
    hardwareDetails: form.hardwareDetails,
    photos: [...photos],
  });

  const handleAddAnotherUnit = () => {
    setPendingUnits((prev) => [...prev, buildCurrentUnit()]);
    setForm((prev) => ({ ...prev, ...UNIT_FIELD_RESET }));
    setPhotos([]);
    setShowBarcodeScanner(false);
    setStep(3);
    toast.success("Data unit disimpan. Silakan input unit berikutnya.");
  };

  const removePendingUnit = (index: number) => {
    setPendingUnits((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      removed?.photos.forEach((p) => URL.revokeObjectURL(p.preview));
      return next;
    });
  };

  const buildOrderPayload = (unit: PendingUnit, orderId: string) => {
    const unitChecks: Record<string, boolean> = { ...unit.unitChecks };
    if (unit.otherCheck) unitChecks[unit.otherCheck] = true;

    const isInstallOrder = isInstallServiceType(form.serviceType);
    const installDetails: string[] = [];
    if (unit.installServices.includes("Install OS"))
      installDetails.push(`OS: ${unit.selectedOs === "OS Lainnya" ? unit.otherOs : unit.selectedOs}`);
    if (unit.installServices.includes("Install Driver")) installDetails.push(`Driver: ${unit.driverDetails}`);
    if (unit.installServices.includes("Install Software Aplikasi")) {
      installDetails.push(
        `Software: ${unit.softwareType}${unit.softwareType === "Aplikasi Tambahan" ? ` - ${unit.additionalSoftware}` : ""}`,
      );
    }
    if (unit.installServices.includes("Install Hardware")) installDetails.push(`Hardware: ${unit.hardwareDetails}`);

    const needsProblemExplanation = NEEDS_PROBLEM_EXPLANATION.includes(unit.unitCondition);
    const deviceType = unit.deviceType === "Lainnya" ? unit.deviceTypeOther : unit.deviceType;

    return {
      order_id: orderId,
      customer_name: form.customerName,
      customer_phone: form.customerPhone,
      customer_email: form.customerEmail || null,
      // saved_customer_id links the ticket to a saved_customers record.
      // null = manual customer (name/phone editable on the ticket).
      // non-null = linked customer (name/phone managed via Kelola Pelanggan).
      saved_customer_id: selectedCustomerId || null,
      device_type: deviceType,
      device_brand: unit.deviceBrand,
      device_model: unit.deviceModel,
      device_password: unit.devicePassword || null,
      damage_description: isInstallOrder
        ? installDetails.length
          ? installDetails.join("\n")
          : null
        : [
          needsProblemExplanation ? `Penjelasan Masalah Unit: ${unit.problemExplanation}` : null,
          `Deskripsi Keluhan Customer: ${unit.damageDescription}`,
        ]
          .filter(Boolean)
          .join("\n"),
      unit_condition: isInstallOrder ? unit.installServices.join(", ") : unit.unitCondition,
      unit_accessories: unit.unitAccessories || null,
      unit_checks: unitChecks,
      service_type: form.serviceType,
      notes: unit.notes || null,
      serial_number: form.serviceType === "Garansi Partner" ? unit.serialNumber || null : null,
    };
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const units: PendingUnit[] = [...pendingUnits, buildCurrentUnit()];
      const isInstallOrder = isInstallServiceType(form.serviceType);
      const entryDate = new Date().toLocaleDateString("id-ID");
      const initialStatus = isInstallOrder ? "Perbaikan" : "Diterima";

      const createdTickets: { id: string; ticket_number: string; unit: PendingUnit }[] = [];

      for (const unit of units) {
        const orderId = makeClientId();
        const payload = buildOrderPayload(unit, orderId);

        const { data: createData, error: orderError } = await withTimeout(
          supabase.functions.invoke("create-service-order", { body: payload }),
          REQUEST_TIMEOUT_MS,
          "Pembuatan tiket memakan waktu terlalu lama. Periksa koneksi internet lalu coba lagi.",
        );

        // supabase.functions.invoke: on non-2xx, 'error' is a FunctionsHttpError and 'data' is null.
        // The real error JSON body is inside error.context.json() — we parse it here.
        if (orderError) {
          let serverMsg = orderError.message;
          try {
            // FunctionsHttpError has a .context property (the raw Response object)
            const ctx = (orderError as any).context;
            if (ctx) {
              const errBody = await ctx.json();
              serverMsg = errBody?.error || serverMsg;
            }
          } catch (_) { }
          console.error("Edge function error:", serverMsg);
          throw new Error(serverMsg);
        }
        if (createData?.error) throw new Error(createData.error);

        const createdOrder = createData?.order || { id: orderId, ticket_number: "baru" };

        if (unit.photos.length > 0) {
          await withTimeout(uploadOrderPhotos(createdOrder.id, unit.photos), REQUEST_TIMEOUT_MS, CREATE_ORDER_ERROR_MESSAGE);
        }

        createdTickets.push({ id: createdOrder.id, ticket_number: createdOrder.ticket_number, unit });
      }

      if (selectedCustomerId && !emailLockedFromDb && form.customerEmail) {
        const { error: updateCustomerError } = await withTimeout(
          supabase.from("saved_customers").update({ customer_email: form.customerEmail }).eq("id", selectedCustomerId),
          REQUEST_TIMEOUT_MS,
          CREATE_ORDER_ERROR_MESSAGE,
        );
        if (updateCustomerError) throw updateCustomerError;
      }

      if (form.rememberCustomer) {
        const { error: saveCustomerError } = await withTimeout(
          supabase.from("saved_customers").insert({
            customer_name: form.customerName,
            customer_phone: form.customerPhone,
            customer_email: form.customerEmail || null,
            created_by: user.id,
          }),
          REQUEST_TIMEOUT_MS,
          CREATE_ORDER_ERROR_MESSAGE,
        );
        if (saveCustomerError) throw saveCustomerError;
      }
      localStorage.removeItem(LOCAL_STORAGE_KEY_FORM);
      localStorage.removeItem(LOCAL_STORAGE_KEY_STEP);
      localStorage.removeItem(LOCAL_STORAGE_KEY_PENDING_UNITS);
      await clearPhotosFromDB(); // await so IndexedDB is clean before navigating away
      setPhotos([]);
      setPendingUnits([]);

      if (createdTickets.length === 1) {
        const only = createdTickets[0];
        openTicketWhatsAppMessage({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          ticketNumber: only.ticket_number,
          entryDate,
          serviceType: form.serviceType,
          deviceBrand: only.unit.deviceBrand,
          deviceModel: only.unit.deviceModel,
          unitCondition: isInstallOrder ? only.unit.installServices.join(", ") : only.unit.unitCondition,
          unitAccessories: only.unit.unitAccessories || "-",
          currentStatus: initialStatus,
        });
        toast.success(`Pesanan berhasil dibuat! Tiket: ${only.ticket_number}`);
        navigate(`/dashboard/orders/${only.ticket_number}`);
      } else {
        openMultiTicketWhatsAppMessage({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          entryDate,
          tickets: createdTickets.map((t) => ({
            ticketNumber: t.ticket_number,
            serviceType: form.serviceType,
            deviceBrand: t.unit.deviceBrand,
            deviceModel: t.unit.deviceModel,
            unitCondition: isInstallOrder ? t.unit.installServices.join(", ") : t.unit.unitCondition,
            unitAccessories: t.unit.unitAccessories || "-",
            currentStatus: initialStatus,
          })),
        });
        toast.success(`${createdTickets.length} tiket berhasil dibuat!`);
        navigate(`/dashboard/orders`);
      }
    } catch (err: any) {
      console.error("Create order submit failed:", err);
      toast.error(getCreateOrderFeedback(err));
    } finally {
      setLoading(false);
    }
  };


  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/orders")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">Buat Pesanan</h1>
          </div>
          {(step > 1 || form.serviceType !== "" || pendingUnits.length > 0) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetConfirmOpen(true)}
            >
              Reset Form
            </Button>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-colors cursor-pointer",
                s <= step ? "gradient-primary" : "bg-muted",
              )}
              onClick={() => s < step && setStep(s)}
            />
          ))}
        </div>

        {/* Step 1: Service Type */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 1 — Tipe Servis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {SERVICE_TYPES.map((type) => (
                <div
                  key={type}
                  className={cn(
                    "p-4 rounded-lg border cursor-pointer transition-all",
                    form.serviceType === type ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                  )}
                  onClick={() => update("serviceType", type)}
                >
                  <p className="font-medium text-sm">{type}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Customer - with search bar */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 2 — Kontak Pelanggan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2" ref={searchRef}>
                <Label>Cari Pelanggan Tersimpan</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Ketik nama, nomor HP, atau email..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="pl-9"
                  />
                </div>
                {showCustomerDropdown && customerSearch.length > 0 && (
                  <div className="border border-border rounded-lg shadow-md bg-popover max-h-40 overflow-y-auto">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">Tidak ditemukan</div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          className="px-3 py-2 hover:bg-accent cursor-pointer text-sm transition-colors"
                          onClick={() => selectCustomer(c)}
                        >
                          <span className="font-medium">{c.customer_name}</span>
                          <span className="text-muted-foreground ml-2">— {c.customer_phone}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Nama *</Label>
                <Input
                  value={form.customerName}
                  onChange={(e) => update("customerName", e.target.value)}
                  disabled={customerLocked}
                  className={customerLocked ? "bg-muted" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label>No HP *</Label>
                <Input
                  value={form.customerPhone}
                  onChange={(e) => update("customerPhone", e.target.value)}
                  disabled={customerLocked}
                  className={customerLocked ? "bg-muted" : ""}
                />
              </div>
              {customerLocked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setCustomerLocked(false);
                    setSelectedCustomerId(null);
                    setEmailLockedFromDb(false);
                    update("customerName", "");
                    update("customerPhone", "");
                    update("customerEmail", "");
                    setCustomerSearch("");
                  }}
                >
                  ✕ Ganti Pelanggan
                </Button>
              )}
              <div className="space-y-2">
                <Label>Email (opsional)</Label>
                <Input
                  value={form.customerEmail}
                  onChange={(e) => update("customerEmail", e.target.value)}
                  disabled={customerLocked && emailLockedFromDb}
                  className={customerLocked && emailLockedFromDb ? "bg-muted" : ""}
                  placeholder={customerLocked && !emailLockedFromDb ? "Tambahkan email pelanggan..." : ""}
                />
                {customerLocked && !emailLockedFromDb && (
                  <p className="text-xs text-muted-foreground">
                    Email belum tersimpan — Anda dapat menambahkannya sekarang.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={form.rememberCustomer} onCheckedChange={(v) => update("rememberCustomer", !!v)} />
                <Label className="text-sm">Ingat data pelanggan</Label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Device - with dropdown category */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>Step 3 — Detail Unit</span>
                {pendingUnits.length > 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                    Unit ke-{pendingUnits.length + 1}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Kategori Perangkat *</Label>
                <Select
                  value={form.deviceType}
                  onValueChange={(v) => {
                    update("deviceType", v);
                    if (v !== "Lainnya") update("deviceTypeOther", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.deviceType === "Lainnya" && (
                  <Input
                    placeholder="Sebutkan jenis perangkat..."
                    value={form.deviceTypeOther}
                    onChange={(e) => update("deviceTypeOther", e.target.value)}
                    className="mt-2"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label>Merk *</Label>
                <Input value={form.deviceBrand} onChange={(e) => update("deviceBrand", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipe/Model *</Label>
                <Input value={form.deviceModel} onChange={(e) => update("deviceModel", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Password/PIN (opsional)</Label>
                <Input
                  value={form.devicePassword}
                  onChange={(e) => update("devicePassword", e.target.value)}
                  placeholder="Akan ditampilkan transparan untuk teknisi"
                />
              </div>

              {form.serviceType === "Garansi Partner" && (
                <div className="space-y-2">
                  <Label>Serial Number (SN) *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.serialNumber}
                      onChange={(e) => update("serialNumber", e.target.value)}
                      placeholder="Masukkan SN manual atau scan barcode"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant={showBarcodeScanner ? "secondary" : "outline"}
                      size="icon"
                      onClick={() => setShowBarcodeScanner(!showBarcodeScanner)}
                      title="Scan Barcode"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>

                  {showBarcodeScanner && (
                    <BarcodeScanner
                      onDetected={(val) => {
                        update("serialNumber", val);
                        setShowBarcodeScanner(false);
                      }}
                      onClose={() => setShowBarcodeScanner(false)}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>
                  Step 4 — {isInstallServiceType(form.serviceType) ? "Detail Layanan" : "Kondisi Unit"}
                </span>
                {pendingUnits.length > 0 && (
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                    Unit ke-{pendingUnits.length + 1}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isInstallServiceType(form.serviceType) && (
                <>
                  <div className="space-y-2">
                    <Label>Kondisi Unit *</Label>
                    <Select
                      value={form.unitCondition}
                      onValueChange={(v) => {
                        update("unitCondition", v);
                        if (!NEEDS_PROBLEM_EXPLANATION.includes(v)) update("problemExplanation", "");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih kondisi" />
                      </SelectTrigger>
                      <SelectContent>
                        {STANDARD_UNIT_CONDITIONS.map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {condition}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {shouldShowProblemExplanation && (
                    <div className="space-y-2">
                      <Label>Penjelasan Masalah Unit *</Label>
                      <Input
                        value={form.problemExplanation}
                        onChange={(e) => update("problemExplanation", e.target.value)}
                        placeholder="Jelaskan masalah pada unit"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Deskripsi Keluhan Customer *</Label>
                    <Textarea
                      value={form.damageDescription}
                      onChange={(e) => update("damageDescription", e.target.value)}
                      placeholder="Tuliskan detail keluhan konsumen"
                    />
                  </div>
                </>
              )}

              {isInstallServiceType(form.serviceType) && <div className="space-y-2">
                <Label>Jenis Layanan *</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {INSTALL_SERVICE_OPTIONS.map((item) => (
                    <label
                      key={item}
                      className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Checkbox
                        checked={hasInstallService(item)}
                        onCheckedChange={(v) => toggleInstallService(item, !!v)}
                      />
                      <span className="text-sm font-medium">{item}</span>
                    </label>
                  ))}
                </div>
              </div>}

              {isInstallServiceType(form.serviceType) && hasInstallService("Install OS") && (
                <div className="space-y-2">
                  <Label>Memilih OS *</Label>
                  <Select value={form.selectedOs} onValueChange={(v) => update("selectedOs", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih OS" />
                    </SelectTrigger>
                    <SelectContent>
                      {OS_OPTIONS.map((os) => (
                        <SelectItem key={os} value={os}>
                          {os}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.selectedOs === "OS Lainnya" && (
                    <Input
                      value={form.otherOs}
                      onChange={(e) => update("otherOs", e.target.value)}
                      placeholder="Nama OS"
                    />
                  )}
                </div>
              )}

              {isInstallServiceType(form.serviceType) && hasInstallService("Install Driver") && (
                <div className="space-y-2">
                  <Label>Detail Driver *</Label>
                  <Input
                    value={form.driverDetails}
                    onChange={(e) => update("driverDetails", e.target.value)}
                    placeholder="Driver yang ingin di-install"
                  />
                </div>
              )}

              {isInstallServiceType(form.serviceType) && hasInstallService("Install Software Aplikasi") && (
                <div className="space-y-2">
                  <Label>Memilih Software *</Label>
                  <Select value={form.softwareType} onValueChange={(v) => update("softwareType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih software" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOFTWARE_OPTIONS.map((software) => (
                        <SelectItem key={software} value={software}>
                          {software}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.softwareType === "Aplikasi Tambahan" && (
                    <Input
                      value={form.additionalSoftware}
                      onChange={(e) => update("additionalSoftware", e.target.value)}
                      placeholder="Aplikasi yang ingin di-install"
                    />
                  )}
                </div>
              )}

              {isInstallServiceType(form.serviceType) && hasInstallService("Install Hardware") && (
                <div className="space-y-2">
                  <Label>Upgrade Hardware *</Label>
                  <Input
                    value={form.hardwareDetails}
                    onChange={(e) => update("hardwareDetails", e.target.value)}
                    placeholder="Detail hardware yang ingin di-upgrade/dipasang"
                  />
                </div>
              )}

              {(!isInstallServiceType(form.serviceType) || hasInstallService("Install Hardware")) && (
                <div className="space-y-2">
                  <Label>Foto Unit (3 posisi) *</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {PHOTO_LABELS.map((label) => {
                      const photo = photos.find((p) => p.label === label);
                      return (
                        <div key={label} className="space-y-1">
                          {photo ? (
                            <div className="relative">
                              <img
                                src={photo.preview}
                                className="w-full aspect-square object-cover rounded-lg"
                                alt={label}
                              />
                              <button
                                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
                                onClick={() => removePhoto(label)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-full aspect-square border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors space-y-1">
                              <button
                                type="button"
                                className="flex flex-col items-center"
                                onClick={() => fileInputRefs.current[label]?.click()}
                              >
                                <Upload className="h-5 w-5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">Galeri</span>
                              </button>
                              <button
                                type="button"
                                className="flex flex-col items-center"
                                onClick={() => {
                                  // Reset input value first so onChange always fires,
                                  // even if the same-slot camera was opened before.
                                  const input = fileInputRefs.current[`camera-${label}`];
                                  if (input) { input.value = ""; input.click(); }
                                }}
                              >
                                <Camera className="h-5 w-5 text-muted-foreground" />
                                <span className="text-[10px] text-muted-foreground">Kamera</span>
                              </button>
                              <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                            </div>
                          )}
                          <input
                            ref={(el) => (fileInputRefs.current[label] = el)}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handlePhotoUpload(label, f);
                              // Reset so the same file can be re-selected if needed
                              e.target.value = "";
                            }}
                          />
                          <input
                            ref={(el) => (fileInputRefs.current[`camera-${label}`] = el)}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handlePhotoUpload(label, f);
                              // CRITICAL: Reset input value after capture.
                              // On Android Chrome, if the same camera input is used again
                              // without resetting, onChange may not fire on subsequent captures.
                              e.target.value = "";
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    💡 <em>Tips: Jika kamera ponsel Anda menyebabkan halaman web memuat ulang (reload) secara otomatis karena kehabisan memori, silakan ambil foto unit terlebih dahulu menggunakan aplikasi kamera biasa di ponsel Anda, lalu gunakan opsi <strong>Galeri</strong> untuk memilih dan mengunggah foto tersebut.</em>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Kelengkapan Unit *</Label>
                <Input
                  value={form.unitAccessories}
                  onChange={(e) => update("unitAccessories", e.target.value)}
                  placeholder="Charger, tas, dll"
                />
              </div>

              <div className="space-y-2">
                <Label>Cek Unit {hasInstallService("Install Hardware") ? "*" : "(opsional)"}</Label>
                <p className="text-xs text-muted-foreground">
                  ✅ Centang = Kondisi Baik | ⬜ Tanpa centang = Tidak Dapat dicek/Tidak Berfungsi
                </p>
                <div className="flex flex-wrap gap-3">
                  {CHECK_ITEMS.map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <Checkbox
                        checked={!!form.unitChecks[item]}
                        onCheckedChange={(v) => update("unitChecks", { ...form.unitChecks, [item]: !!v })}
                      />
                      <Label className="text-sm">{item}</Label>
                    </div>
                  ))}
                </div>
                <Input
                  placeholder="Lainnya (ketik manual)"
                  value={form.otherCheck}
                  onChange={(e) => update("otherCheck", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Catatan Tambahan (opsional)</Label>
                <Textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Preview */}
        {step === 5 && (() => {
          const isInstallOrder = isInstallServiceType(form.serviceType);
          const allUnits: PendingUnit[] = [...pendingUnits, buildCurrentUnit()];

          const renderUnit = (unit: PendingUnit, index: number, isCurrent: boolean) => {
            const deviceTypeLabel = unit.deviceType === "Lainnya" ? unit.deviceTypeOther : unit.deviceType;
            const installDetails: string[] = [];
            if (unit.installServices.includes("Install OS"))
              installDetails.push(`OS: ${unit.selectedOs === "OS Lainnya" ? unit.otherOs : unit.selectedOs}`);
            if (unit.installServices.includes("Install Driver"))
              installDetails.push(`Driver: ${unit.driverDetails}`);
            if (unit.installServices.includes("Install Software Aplikasi"))
              installDetails.push(
                `Software: ${unit.softwareType}${unit.softwareType === "Aplikasi Tambahan" ? ` - ${unit.additionalSoftware}` : ""}`,
              );
            if (unit.installServices.includes("Install Hardware"))
              installDetails.push(`Hardware: ${unit.hardwareDetails}`);

            const checkedItems = Object.entries(unit.unitChecks)
              .filter(([, v]) => v)
              .map(([k]) => k);
            if (unit.otherCheck) checkedItems.push(unit.otherCheck);
            const uncheckedItems = CHECK_ITEMS.filter((item) => !unit.unitChecks[item]);
            const needsProblemExplanation = NEEDS_PROBLEM_EXPLANATION.includes(unit.unitCondition);

            return (
              <div
                key={index}
                className={cn(
                  "rounded-lg border p-3 space-y-3",
                  isCurrent ? "border-primary bg-primary/5" : "border-border bg-muted/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                    Unit ke-{index + 1}{isCurrent && allUnits.length > 1 ? " (saat ini)" : ""}
                  </span>
                  {!isCurrent && (
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => removePendingUnit(index)}
                    >
                      Hapus
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Perangkat:</span>
                    <p className="font-medium">{deviceTypeLabel || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Merk:</span>
                    <p className="font-medium">{unit.deviceBrand || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <p className="font-medium">{unit.deviceModel || "-"}</p>
                  </div>
                  {unit.devicePassword && (
                    <div>
                      <span className="text-muted-foreground">Password/PIN:</span>
                      <p className="font-medium font-mono">{unit.devicePassword}</p>
                    </div>
                  )}
                  {form.serviceType === "Garansi Partner" && unit.serialNumber && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Serial Number:</span>
                      <p className="font-medium font-mono">{unit.serialNumber}</p>
                    </div>
                  )}
                </div>

                {isInstallOrder ? (
                  <>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Jenis Layanan:</span>
                      <p className="font-medium">{unit.installServices.join(", ") || "-"}</p>
                    </div>
                    {installDetails.length > 0 && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Detail Layanan:</span>
                        <p className="font-medium whitespace-pre-line">{installDetails.join("\n")}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-xs">
                      <span className="text-muted-foreground">Kondisi Unit:</span>
                      <p className="font-medium">{unit.unitCondition || "-"}</p>
                    </div>
                    {needsProblemExplanation && unit.problemExplanation && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Penjelasan Masalah:</span>
                        <p className="font-medium whitespace-pre-line">{unit.problemExplanation}</p>
                      </div>
                    )}
                    {unit.damageDescription && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Deskripsi Keluhan:</span>
                        <p className="font-medium whitespace-pre-line">{unit.damageDescription}</p>
                      </div>
                    )}
                  </>
                )}

                <div className="text-xs">
                  <span className="text-muted-foreground">Kelengkapan:</span>
                  <p className="font-medium">{unit.unitAccessories || "-"}</p>
                </div>

                {(checkedItems.length > 0 || uncheckedItems.length > 0) && (
                  <div className="text-xs space-y-1">
                    <span className="text-muted-foreground">Cek Unit:</span>
                    {checkedItems.length > 0 && (
                      <p className="font-medium">
                        <span className="text-green-600">✅ Baik:</span> {checkedItems.join(", ")}
                      </p>
                    )}
                    {uncheckedItems.length > 0 && (
                      <p className="font-medium">
                        <span className="text-muted-foreground">⬜ Tidak Dapat dicek/Tidak Berfungsi:</span> {uncheckedItems.join(", ")}
                      </p>
                    )}
                  </div>
                )}

                {unit.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {unit.photos.map((p, i) => (
                      <div key={i}>
                        <img src={p.preview} className="w-full aspect-square object-cover rounded-lg" alt={p.label} />
                        <p className="text-[10px] text-center text-muted-foreground mt-1">{p.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {unit.notes && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Catatan:</span>
                    <p className="font-medium whitespace-pre-line">{unit.notes}</p>
                  </div>
                )}
              </div>
            );
          };

          return (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between gap-2">
                  <span>Step 5 — Preview</span>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary">
                    Total {allUnits.length} unit
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {/* Step 1 & 2 — Service Type & Customer */}
                <div className="rounded-lg border border-border p-3 space-y-3 bg-card">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Informasi Pelanggan & Servis
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Tipe Servis:</span>
                      <p className="font-medium">{form.serviceType || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Nama:</span>
                      <p className="font-medium">{form.customerName || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">No HP:</span>
                      <p className="font-medium">{form.customerPhone || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{form.customerEmail || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Step 3 & 4 — list all units */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Daftar Unit ({allUnits.length})
                  </p>
                  {allUnits.map((u, i) => renderUnit(u, i, i === allUnits.length - 1))}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Navigation */}
        <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || loading}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Kembali
          </Button>
          {step < 5 ? (
            <Button onClick={handleNextStep} disabled={!canProceed()} className="gradient-primary">
              Lanjut <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleAddAnotherUnit} disabled={loading}>
                + Tambah Unit Selanjutnya
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="gradient-primary">
                {loading
                  ? "Membuat..."
                  : pendingUnits.length > 0
                    ? `Buat ${pendingUnits.length + 1} Tiket Servis`
                    : "Buat Tiket Servis"}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Reset Form Confirmation Dialog */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Semua Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua data yang sudah diisi pada formulir ini akan dihapus dan kembali ke awal. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setResetConfirmOpen(false);
                clearDraft();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Reset Form
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate Customer Alert Dialog */}
      <AlertDialog open={duplicateAlertOpen} onOpenChange={setDuplicateAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Data Sudah Ada</AlertDialogTitle>
            <AlertDialogDescription>
              Nomor HP atau Email yang Anda masukkan sudah terdaftar di sistem. Silakan gunakan fitur <strong>Cari Pelanggan Tersimpan</strong> atau periksa kembali input Anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDuplicateAlertOpen(false)}>
              Mengerti
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
