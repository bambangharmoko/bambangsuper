import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Sparkles,
  Bot,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Send,
  Loader2,
  BookOpen,
  Sliders,
  HelpCircle,
  Play,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  Phone,
  Lightbulb,
} from "lucide-react";
import { toast } from "sonner";

interface QaExample {
  id: string;
  question: string;
  answer: string;
}

interface AiConfigData {
  knowledge_base: string;
  system_prompt: string;
  qa_examples: QaExample[];
  temperature: number;
  stale_unassigned_hours: number;
  stale_inprogress_hours: number;
  wa_admin_phone: string;
  updated_at?: string;
}

const KNOWLEDGE_TEMPLATES = {
  store_info: `
# PROFIL SUPER KOMPUTER BALIKPAPAN
- Alamat Toko: Jl. Ahmad Yani No.118, Gunung Sari Ilir, Balikpapan Tengah, Kota Balikpapan, Kalimantan Timur 76121.
- Kontak Telepon / WhatsApp: 0811-540-4999 (08115404999)
- Jam Operasional:
  * Senin s/d Sabtu: 09.00 - 20.00 WITA
  * Minggu & Hari Libur: Tutup
- Google Maps: https://maps.app.goo.gl/37n98csWeGpB4siH8`,

  asus_warranty: `
# LAYANAN AUTHORIZED SERVICE RESMI ASUS
- Super Komputer adalah Authorized Service Center Resmi ASUS di Balikpapan.
- Melayani klaim garansi resmi dan servis produk ASUS: ROG, TUF Gaming, ZenBook, VivoBook, ExpertBook, All-in-One PC.
- 100% GRATIS biaya jasa dan suku cadang jika masih dalam masa garansi resmi ASUS.
- Pelanggan dapat mengecek masa garansi di: https://www.asus.com/id/support/warranty-status-inquiry/
- Bantuan Pengecekan: Kirimkan foto Serial Number (SN) ke WhatsApp CS 0811-540-4999.`,

  service_pricing: `
# DAFTAR LAYANAN SERVIS & ESTIMASI BIAYA
1. Cleaning Fan & Thermal Paste Premium: Mulai Rp 100.000 - Rp 250.000
2. Install Ulang OS Windows 11/10 + Software Standar: Rp 100.000 - Rp 150.000
3. Servis Mainboard / Mati Total / Reballing IC Power: Mulai Rp 350.000 (tergantung tingkat kerusakan setelah diagnosa)
4. Penggantian Keyboard / Baterai / LCD: Biaya sparepart + jasa pasang (Estimasi diberikan sebelum pengerjaan)
5. Upgrade SSD NVMe / RAM: Biaya unit SSD/RAM + free instalasi/cloning data
6. Servis Printer (Head Buntu / Blinking / Reset Waste Pad): Mulai Rp 75.000 - Rp 200.000`,

  sop_rules: `
# SOP & ATURAN SERVIS TOKO
- Diagnosa dan pengecekan unit dilakukan maksimal 1-3 hari kerja tergantung antrean unit masuk.
- Seluruh tindakan perbaikan berbayar WAJIB mendapatkan persetujuan (konfirmasi harga) dari pelanggan terlebih dahulu sebelum dieksekusi.
- Garansi servis toko untuk perbaikan non-garansi resmi adalah 30 hari hingga 90 hari sejak unit diambil.
- Nota / bukti tanda terima servis wajib dibawa atau ditunjukkan saat pengambilan unit.`,
};

export default function AiTraining() {
  const [config, setConfig] = useState<AiConfigData>({
    knowledge_base: "",
    system_prompt: "",
    qa_examples: [],
    temperature: 0.1,
    stale_unassigned_hours: 24,
    stale_inprogress_hours: 48,
    wa_admin_phone: "628115404999",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("knowledge");

  // Simulator chat state
  const [testMessages, setTestMessages] = useState<{ role: "user" | "bot"; text: string; time: string }[]>([
    {
      role: "bot",
      text: "Halo! Saya SuperBot Simulator. Anda dapat menguji coba instruksi dan knowledge base yang baru saja Anda latih di sini sebelum disimpan.",
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputTest, setInputTest] = useState("");
  const [testingAi, setTestingAi] = useState(false);

  // Fetch current AI settings
  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-ai-settings", {
        method: "GET",
      });

      if (error) throw error;
      if (data?.data) {
        setConfig({
          knowledge_base: data.data.knowledge_base || "",
          system_prompt: data.data.system_prompt || "",
          qa_examples: Array.isArray(data.data.qa_examples) ? data.data.qa_examples : [],
          temperature: typeof data.data.temperature === "number" ? data.data.temperature : 0.1,
          stale_unassigned_hours: data.data.stale_unassigned_hours || 24,
          stale_inprogress_hours: data.data.stale_inprogress_hours || 48,
          wa_admin_phone: data.data.wa_admin_phone || "628115404999",
          updated_at: data.data.updated_at,
        });
      }
    } catch (err: any) {
      console.error("Gagal memuat pengaturan AI:", err);
      toast.error(err?.message || "Gagal memuat konfigurasi AI");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Save AI Settings
  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-ai-settings", {
        body: {
          action: "save",
          ...config,
        },
      });

      if (error) throw error;
      toast.success(data?.message || "Pelatihan AI berhasil disimpan dan aktif seketika!");
      setConfig((prev) => ({ ...prev, updated_at: new Date().toISOString() }));
    } catch (err: any) {
      console.error("Gagal menyimpan pengaturan AI:", err);
      toast.error(err?.message || "Gagal menyimpan pelatihan AI");
    } finally {
      setSaving(false);
    }
  };

  // Reset to Default
  const handleResetDefault = async () => {
    if (!confirm("Apakah Anda yakin ingin mengembalikan seluruh pelatihan AI ke pengaturan standar bawaan sistem?")) {
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-ai-settings", {
        body: { action: "reset_default" },
      });
      if (error) throw error;
      toast.success("Pengaturan AI berhasil dikembalikan ke standar awal.");
      if (data?.data) {
        setConfig(data.data);
      }
    } catch (err: any) {
      toast.error(err?.message || "Gagal reset pengaturan AI");
    } finally {
      setSaving(false);
    }
  };

  // Template inserter
  const insertTemplate = (templateKey: keyof typeof KNOWLEDGE_TEMPLATES) => {
    const textToInsert = KNOWLEDGE_TEMPLATES[templateKey];
    setConfig((prev) => ({
      ...prev,
      knowledge_base: prev.knowledge_base.trim() ? `${prev.knowledge_base}\n\n${textToInsert.trim()}` : textToInsert.trim(),
    }));
    toast.success("Template berhasil ditambahkan ke Knowledge Base!");
  };

  // Q&A Example Handlers
  const addQaExample = () => {
    const newId = `qa-${Date.now()}`;
    setConfig((prev) => ({
      ...prev,
      qa_examples: [
        ...prev.qa_examples,
        { id: newId, question: "", answer: "" },
      ],
    }));
  };

  const updateQaExample = (id: string, field: "question" | "answer", val: string) => {
    setConfig((prev) => ({
      ...prev,
      qa_examples: prev.qa_examples.map((item) => (item.id === id ? { ...item, [field]: val } : item)),
    }));
  };

  const removeQaExample = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      qa_examples: prev.qa_examples.filter((item) => item.id !== id),
    }));
  };

  // Simulator Test Message
  const handleSendTestMessage = async (customText?: string) => {
    const textToSend = customText || inputTest.trim();
    if (!textToSend || testingAi) return;

    const userMsg = {
      role: "user" as const,
      text: textToSend,
      time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setTestMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputTest("");
    setTestingAi(true);

    try {
      const { data, error } = await supabase.functions.invoke("manage-ai-settings", {
        body: {
          action: "test_prompt",
          test_message: textToSend,
          knowledge_base: config.knowledge_base,
          system_prompt: config.system_prompt,
          qa_examples: config.qa_examples,
          temperature: config.temperature,
        },
      });

      if (error) throw error;

      const botReply = data?.reply || "Gagal mendapatkan respon dari AI.";
      setTestMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: botReply,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err: any) {
      setTestMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `⚠️ Terjadi kesalahan pengujian: ${err?.message || "Model tidak merespon"}`,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setTestingAi(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat Studio Pelatihan AI...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-primary to-blue-600 text-white shadow-md shadow-primary/20">
                <Sparkles className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Studio Pelatihan AI Agent</h1>
              <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30 text-primary">
                Owner Only
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Latih otak AI SuperBot dengan informasi toko terbaru, kebijakan garansi, SOP pengerjaan, dan contoh jawaban ideal tanpa perlu coding.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetDefault}
              disabled={saving}
              className="text-xs gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Standar
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-white shadow-md shadow-primary/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Menyimpan..." : "Simpan Pelatihan AI"}
            </Button>
          </div>
        </div>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 p-1 bg-muted/60 rounded-xl h-auto gap-1">
            <TabsTrigger value="knowledge" className="gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>Knowledge Base</span>
            </TabsTrigger>
            <TabsTrigger value="persona" className="gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Sliders className="h-4 w-4 text-primary" />
              <span>Aturan & Persona</span>
            </TabsTrigger>
            <TabsTrigger value="qa" className="gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>Contoh Tanya-Jawab</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {config.qa_examples.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="simulator" className="gap-2 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Play className="h-4 w-4 text-emerald-500" />
              <span>Uji Coba AI Live</span>
            </TabsTrigger>
          </TabsList>

          {/* ════ TAB 1: KNOWLEDGE BASE ════ */}
          <TabsContent value="knowledge" className="space-y-4 focus-visible:outline-none">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Basis Pengetahuan Toko (Knowledge Base RAG)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      AI akan membaca dokumen ini sebagai buku panduan utama saat menjawab pertanyaan pelanggan.
                    </CardDescription>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {config.knowledge_base.length} Karakter · {config.knowledge_base.split(/\s+/).filter(Boolean).length} Kata
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template Quick Inserter */}
                <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                    Sisipkan Template Cepat:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertTemplate("store_info")}
                      className="h-7 text-xs gap-1 bg-background"
                    >
                      <Plus className="h-3 w-3" /> Info Toko & Jam Buka
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertTemplate("asus_warranty")}
                      className="h-7 text-xs gap-1 bg-background"
                    >
                      <Plus className="h-3 w-3" /> Garansi Resmi ASUS
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertTemplate("service_pricing")}
                      className="h-7 text-xs gap-1 bg-background"
                    >
                      <Plus className="h-3 w-3" /> Daftar Tarif Servis
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => insertTemplate("sop_rules")}
                      className="h-7 text-xs gap-1 bg-background"
                    >
                      <Plus className="h-3 w-3" /> SOP & Kebijakan
                    </Button>
                  </div>
                </div>

                {/* Editor Textarea */}
                <div className="space-y-1.5">
                  <Label htmlFor="kb-editor" className="text-xs font-medium">
                    Konten Knowledge Base (Format Markdown Didukung)
                  </Label>
                  <Textarea
                    id="kb-editor"
                    value={config.knowledge_base}
                    onChange={(e) => setConfig((prev) => ({ ...prev, knowledge_base: e.target.value }))}
                    placeholder="Ketik profil toko, alamat, ketentuan servis, harga, dan solusi troubleshooting di sini..."
                    className="font-mono text-xs leading-relaxed min-h-[420px] resize-y bg-background"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ TAB 2: ATURAN & PERSONA ════ */}
          <TabsContent value="persona" className="space-y-4 focus-visible:outline-none">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Column: System Persona Prompt */}
              <Card className="md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sliders className="h-5 w-5 text-primary" />
                    Instruksi Kepribadian & Gaya Bahasa AI
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Perintah sistem untuk mengatur kepribadian, batasan privasi, format tautan, dan nada komunikasi SuperBot.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="prompt-editor" className="text-xs font-medium">
                      Instruksi Sistem (System Prompt)
                    </Label>
                    <Textarea
                      id="prompt-editor"
                      value={config.system_prompt}
                      onChange={(e) => setConfig((prev) => ({ ...prev, system_prompt: e.target.value }))}
                      placeholder="Tuliskan instruksi sistem untuk AI..."
                      className="font-mono text-xs leading-relaxed min-h-[380px] resize-y bg-background"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Right Column: Parameters & Thresholds */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="h-4 w-4 text-warning" />
                      Batas Waktu Pengingat
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Batas "Belum Dikerjakan" (Jam)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={168}
                          value={config.stale_unassigned_hours}
                          onChange={(e) => setConfig((prev) => ({ ...prev, stale_unassigned_hours: Number(e.target.value) || 24 }))}
                          className="h-8 text-xs"
                        />
                        <span className="text-muted-foreground whitespace-nowrap">Jam</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Jika unit berstatus Diterima melewati durasi ini, AI menawarkan chat WA Admin.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Batas "Sedang Dikerjakan" (Jam)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={360}
                          value={config.stale_inprogress_hours}
                          onChange={(e) => setConfig((prev) => ({ ...prev, stale_inprogress_hours: Number(e.target.value) || 48 }))}
                          className="h-8 text-xs"
                        />
                        <span className="text-muted-foreground whitespace-nowrap">Jam ({Math.round(config.stale_inprogress_hours / 24)} hari)</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Jika status pengerjaan tidak ada update melewati durasi ini, AI memunculkan tombol Reminder ke Teknisi.
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-border/60">
                      <Label className="text-xs font-medium">Nomor WhatsApp Admin (Format 62xxx)</Label>
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-emerald-500" />
                        <Input
                          type="text"
                          value={config.wa_admin_phone}
                          onChange={(e) => setConfig((prev) => ({ ...prev, wa_admin_phone: e.target.value.trim() }))}
                          className="h-8 text-xs font-mono"
                          placeholder="628115404999"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>Kreativitas Jawaban</span>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {config.temperature.toFixed(2)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Slider
                      value={[config.temperature]}
                      min={0.0}
                      max={0.8}
                      step={0.05}
                      onValueChange={(val) => setConfig((prev) => ({ ...prev, temperature: val[0] }))}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0.0 (Presisi & Faktual)</span>
                      <span>0.8 (Kreatif)</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ════ TAB 3: CONTOH TANYA JAWAB (FEW-SHOT) ════ */}
          <TabsContent value="qa" className="space-y-4 focus-visible:outline-none">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-primary" />
                      Pelatihan Contoh Tanya-Jawab (Few-Shot Q&A)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      AI akan meniru pola, intonasi, dan jawaban spesifik yang Anda contohkan di bawah ini.
                    </CardDescription>
                  </div>
                  <Button size="sm" onClick={addQaExample} className="gap-1.5 text-xs">
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Contoh Baru
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {config.qa_examples.length === 0 ? (
                  <div className="p-8 text-center border border-dashed rounded-xl border-border space-y-2">
                    <HelpCircle className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm font-medium">Belum ada contoh tanya-jawab.</p>
                    <p className="text-xs text-muted-foreground">
                      Klik tombol "Tambah Contoh Baru" untuk melatih AI merespon pertanyaan pelanggan sesuai standar toko Anda.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.qa_examples.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-border/80 bg-card hover:border-primary/40 transition-colors space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[11px] font-semibold text-primary">
                            Contoh #{index + 1}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeQaExample(item.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title="Hapus Contoh"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-foreground">
                            Pertanyaan Pelanggan:
                          </Label>
                          <Input
                            value={item.question}
                            onChange={(e) => updateQaExample(item.id, "question", e.target.value)}
                            placeholder="Contoh: Berapa lama waktu servis laptop mati total?"
                            className="text-xs bg-background"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-semibold text-primary">
                            Jawaban Ideal dari Toko:
                          </Label>
                          <Textarea
                            value={item.answer}
                            onChange={(e) => updateQaExample(item.id, "answer", e.target.value)}
                            placeholder="Tuliskan jawaban yang ramah, jelas, dan akurat..."
                            className="text-xs min-h-[70px] bg-background"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ════ TAB 4: LIVE AI PLAYGROUND SIMULATOR ════ */}
          <TabsContent value="simulator" className="space-y-4 focus-visible:outline-none">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Simulator Chat Window */}
              <Card className="lg:col-span-2 flex flex-col h-[540px]">
                <CardHeader className="py-3 px-4 border-b border-border/60 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">SuperBot Sandbox Simulator</h3>
                      <p className="text-[10px] text-muted-foreground">Menguji data pelatihan terkini secara langsung</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setTestMessages([
                        {
                          role: "bot",
                          text: "Percakapan simulator telah direset. Silakan ajukan pertanyaan untuk menguji AI.",
                          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
                        },
                      ])
                    }
                    className="h-7 text-xs text-muted-foreground"
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Bersihkan
                  </Button>
                </CardHeader>

                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/20 text-xs">
                  {testMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "bot" && (
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                          <Bot className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 leading-relaxed whitespace-pre-wrap ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-card border border-border text-card-foreground rounded-tl-none shadow-sm"
                        }`}
                      >
                        {msg.text}
                        <div className={`text-[9px] mt-1 text-right ${msg.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                          {msg.time}
                        </div>
                      </div>
                    </div>
                  ))}
                  {testingAi && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs p-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>SuperBot sedang merespon simulasi...</span>
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-border/60 flex items-center gap-2 bg-card">
                  <Input
                    value={inputTest}
                    onChange={(e) => setInputTest(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendTestMessage()}
                    placeholder="Ketik pertanyaan untuk mengetes AI (contoh: apakah bisa klaim garansi ASUS?)..."
                    className="text-xs"
                    disabled={testingAi}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSendTestMessage()}
                    disabled={testingAi || !inputTest.trim()}
                    className="h-9 px-3 gap-1"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>

              {/* Sample Prompts & Tips */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Lightbulb className="h-4 w-4 text-amber-500" />
                      Uji Pertanyaan Populer
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Klik salah satu pertanyaan di bawah untuk langsung mengujinya:
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    {[
                      "Apakah toko Super Komputer buka hari Minggu?",
                      "Bagaimana cara klaim garansi laptop ASUS ROG saya?",
                      "Berapa biaya ganti keyboard laptop Lenovo?",
                      "Apakah bisa servis printer Epson yang blinking?",
                      "Dimana alamat lengkap toko dan nomor teleponnya?",
                    ].map((prompt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendTestMessage(prompt)}
                        disabled={testingAi}
                        className="w-full text-left p-2 rounded-lg text-xs bg-muted/40 hover:bg-muted border border-border/50 transition-colors flex items-center justify-between group"
                      >
                        <span className="line-clamp-1">{prompt}</span>
                        <Play className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0 ml-1" />
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 text-xs space-y-2 text-muted-foreground">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Tips Pelatihan AI Efektif:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Gunakan poin-poin bertanda bullet (-) agar AI lebih mudah membaca struktur data.</li>
                      <li>Sertakan info spesifik seperti nomor telepon, jam operasional, dan merk-merk yang didukung.</li>
                      <li>Jika ada perubahan kebijakan atau harga baru, cukup ubah teks di tab Knowledge Base lalu klik <strong>Simpan</strong>.</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
