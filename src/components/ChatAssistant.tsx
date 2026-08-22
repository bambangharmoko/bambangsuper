import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  X,
  Send,
  RotateCcw,
  Sparkles,
  Bot,
  User,
  Loader2,
  ExternalLink,
  ChevronRight,
  Headphones,
  Maximize2,
  Minimize2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: string;
}

const INITIAL_GREETING: ChatMessage = {
  id: "welcome-msg",
  sender: "bot",
  text: `Halo! 👋 Selamat datang di **Super Komputer Balikpapan** (SUMTRA). Saya **SuperBot**, asisten AI pintar Anda.\n\nSaya bisa membantu Anda:\n- 🔍 **Cek Status Servis Real-time** (sebutkan nomor tiket Anda, contoh: *F26001*)\n- 💻 **Konsultasi Troubleshooting** Komputer, Laptop, Printer, & CCTV\n- 🛡️ **Info Layanan Authorized Service** ASUS\n- ⏱️ **Jam Operasional, Lokasi, & Biaya Servis**\n\nAda yang bisa saya bantu hari ini?`,
  timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
};

const QUICK_PROMPTS = [
  { label: "🔍 Cek Status Servis", prompt: "Saya ingin mengecek status pengerjaan tiket servis saya." },
  { label: "💻 Solusi Laptop Lambat", prompt: "Laptop saya terasa sangat lemot dan lambat, apa solusinya?" },
  { label: "🛡️ Garansi Resmi ASUS", prompt: "Bagaimana prosedur klaim garansi resmi ASUS di Super Komputer?" },
  { label: "📍 Jam Buka & Lokasi", prompt: "Dimana alamat toko Super Komputer Balikpapan dan jam operasionalnya?" },
  { label: "🖨️ Servis Printer", prompt: "Apakah melayani perbaikan printer Epson/Canon yang blinking dan head buntu?" },
];

export function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTeaser, setShowTeaser] = useState(true);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem("superbot_chat_history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [INITIAL_GREETING];
  });
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Save history to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("superbot_chat_history", JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Listen to external triggers to open chat
  useEffect(() => {
    const handleOpenChat = (e: any) => {
      setIsOpen(true);
      setShowTeaser(false);
      if (e.detail?.prompt) {
        handleSendMessage(e.detail.prompt);
      }
    };
    window.addEventListener("open-superbot-chat", handleOpenChat);
    return () => window.removeEventListener("open-superbot-chat", handleOpenChat);
  }, []);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
  }, [isOpen, messages, loading]);

  // Teaser auto-hide after 12 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTeaser(false);
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  const handleResetChat = () => {
    setMessages([
      {
        ...INITIAL_GREETING,
        id: `welcome-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputMessage("");
    setLoading(true);

    try {
      // Format history into Gemini format
      const geminiMessages = newMessages.map((m) => ({
        role: m.sender === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      let botReply = "";

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://wytbkueaymkpbwmbvkul.supabase.co";
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

        const res = await fetch(`${supabaseUrl}/functions/v1/chat-assistant`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ messages: geminiMessages }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        botReply = data?.reply || "Maaf, saya tidak menerima balasan. Silakan coba lagi.";
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === "AbortError") {
          throw new Error("Waktu koneksi habis (Timeout). Silakan kirim ulang pesan Anda.");
        }
        throw fetchErr;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: botReply,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error("Chat Assistant Error:", err);
      const errMsg: ChatMessage = {
        id: `bot-err-${Date.now()}`,
        sender: "bot",
        text: `Maaf, terjadi kendala saat memproses jawaban: **${err.message || "Koneksi terputus"}**\n\nSilakan coba tanyakan kembali, atau hubungi Customer Service kami di WhatsApp: [0811-540-4999](https://wa.me/628115404999).`,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to render formatted markdown-like text
  const renderMessageContent = (content: string) => {
    // Split into paragraphs / lines
    const lines = content.split("\n");

    return lines.map((line, idx) => {
      // Match markdown links [Label](url) robustly
      const linkRegex = /\[(.*?)\]\((.*?)\)/g;
      let lastIndex = 0;
      const elements: React.ReactNode[] = [];
      let match;

      while ((match = linkRegex.exec(line)) !== null) {
        const [fullMatch, rawLinkText, rawLinkUrl] = match;
        const textBefore = line.substring(lastIndex, match.index);

        if (textBefore) {
          elements.push(renderInlineFormatting(textBefore, `${idx}-tb-${lastIndex}`));
        }

        const linkText = rawLinkText.replace(/^\*\*|\*\*$/g, "").trim();
        const linkUrl = rawLinkUrl.trim();

        const isInternalTrackLink = linkUrl.startsWith("/track/");
        const isWhatsAppLink = linkUrl.includes("wa.me") || linkUrl.includes("whatsapp.com");

        if (isInternalTrackLink) {
          elements.push(
            <button
              key={`${idx}-link-${match.index}`}
              onClick={() => {
                navigate(linkUrl);
                setIsOpen(false);
              }}
              className="inline-flex items-center gap-1 my-1 px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary hover:text-primary-foreground rounded-md border border-primary/20 transition-all shadow-sm"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {linkText}
            </button>
          );
        } else if (isWhatsAppLink) {
          elements.push(
            <a
              key={`${idx}-link-${match.index}`}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 my-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl border border-emerald-700/30 transition-all shadow-md shadow-emerald-600/20"
            >
              <MessageCircle className="w-4 h-4 fill-current text-white shrink-0" />
              <span>{linkText}</span>
              <ExternalLink className="w-3 h-3 ml-0.5 opacity-80 shrink-0" />
            </a>
          );
        } else {
          elements.push(
            <a
              key={`${idx}-link-${match.index}`}
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs break-all"
            >
              {linkText} <ExternalLink className="w-3 h-3 inline" />
            </a>
          );
        }

        lastIndex = match.index + fullMatch.length;
      }

      const textAfter = line.substring(lastIndex);
      if (textAfter) {
        elements.push(renderInlineFormatting(textAfter, `${idx}-ta-${lastIndex}`));
      }

      // Check if line is bullet list item
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return (
          <div key={idx} className="flex items-start gap-2 my-1 text-xs sm:text-sm">
            <span className="text-primary font-bold mt-0.5">•</span>
            <div className="flex-1">{elements.length > 0 ? elements : line.replace(/^[-*]\s+/, "")}</div>
          </div>
        );
      }

      if (!line.trim()) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="my-0.5 leading-relaxed text-xs sm:text-sm">
          {elements.length > 0 ? elements : line}
        </p>
      );
    });
  };

  // Helper for bold and italic inline
  const renderInlineFormatting = (text: string, keyPrefix: string): React.ReactNode => {
    // Replace **bold**
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2);
        return <strong key={`${keyPrefix}-b-${pIdx}`} className="font-semibold text-foreground">{inner}</strong>;
      }
      return part;
    });
  };

  return (
    <>
      {/* ═══ Floating Trigger Button ═══ */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {/* Teaser Bubble */}
        <AnimatePresence>
          {!isOpen && showTeaser && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-card/95 backdrop-blur-md border border-border shadow-xl rounded-2xl p-3.5 max-w-[260px] text-left cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                setShowTeaser(false);
                setIsOpen(true);
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>SuperBot AI</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTeaser(false);
                  }}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                Halo! Ada yang perlu dicek? Tanya status servis, troubleshooting, atau harga ke SuperBot AI!
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setShowTeaser(false);
            setIsOpen((prev) => !prev);
          }}
          className="relative flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 via-primary to-blue-700 text-white rounded-full shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all group"
          aria-label="Buka Chatbot SuperBot AI"
        >
          <div className="relative">
            <Bot className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <span className="font-semibold text-sm tracking-wide hidden sm:inline">Tanya SuperBot</span>
        </motion.button>
      </div>

      {/* ═══ Chat Window Dialog / Sheet ═══ */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`fixed z-50 bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all ${
              isExpanded
                ? "inset-4 sm:inset-10"
                : "bottom-20 right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[420px] h-[580px] max-h-[calc(100vh-100px)]"
            }`}
          >
            {/* ═══ Header ═══ */}
            <div className="bg-gradient-to-r from-sidebar via-sidebar to-sidebar/95 text-sidebar-foreground px-4 py-3 border-b border-sidebar-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary relative">
                  <Bot className="w-5 h-5" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-sidebar" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-sidebar-primary-foreground">SuperBot AI</h3>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/30 text-primary">
                      Hybrid RAG + Tools
                    </Badge>
                  </div>
                  <p className="text-[11px] text-sidebar-foreground/60 leading-tight">
                    Customer Care & Tech Support Super Komputer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={handleResetChat}
                  title="Mulai Percakapan Baru"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent hidden sm:flex"
                  onClick={() => setIsExpanded((prev) => !prev)}
                  title={isExpanded ? "Perkecil" : "Perbesar"}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={() => setIsOpen(false)}
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* ═══ Messages Body ═══ */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-muted/20">
              {messages.map((msg) => {
                const isBot = msg.sender === "bot";
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isBot ? "justify-start" : "justify-end"}`}
                  >
                    {isBot && (
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isBot
                          ? "bg-card border border-border text-card-foreground rounded-tl-none"
                          : "bg-primary text-primary-foreground rounded-tr-none"
                      }`}
                    >
                      {renderMessageContent(msg.text)}
                      <div
                        className={`text-[10px] mt-1 text-right ${
                          isBot ? "text-muted-foreground/60" : "text-primary-foreground/70"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                    {!isBot && (
                      <div className="w-7 h-7 rounded-full bg-secondary border border-border flex items-center justify-center text-foreground shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Loading Thinking Indicator */}
              {loading && (
                <div className="flex items-start gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-card border border-border text-card-foreground rounded-2xl rounded-tl-none px-4 py-3 text-sm shadow-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">SuperBot sedang memeriksa data & menganalisa...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ═══ Quick Suggestions ═══ */}
            <div className="px-3 py-2 bg-background border-t border-border/60 overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q.label}
                  disabled={loading}
                  onClick={() => handleSendMessage(q.prompt)}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted/60 hover:bg-primary/10 hover:text-primary border border-border/80 transition-colors shrink-0 disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {/* ═══ Footer Input Area ═══ */}
            <div className="p-3 bg-card border-t border-border flex items-center gap-2">
              <Input
                ref={inputRef}
                placeholder="Tulis pesan atau nomor tiket (contoh: F26001)..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={loading}
                className="text-xs sm:text-sm bg-background border-border/80 h-10"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={loading || !inputMessage.trim()}
                size="icon"
                className="h-10 w-10 shrink-0 gradient-primary"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>

            {/* Sub-footer quick WA link */}
            <div className="px-3 py-1.5 bg-muted/40 text-[10px] text-muted-foreground flex items-center justify-between border-t border-border/30">
              <span className="flex items-center gap-1">
                <Info className="w-3 h-3 text-primary" /> Powered by Gemini & Supabase
              </span>
              <a
                href="https://wa.me/628115404999"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Headphones className="w-3 h-3" /> CS WhatsApp (08115404999)
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
