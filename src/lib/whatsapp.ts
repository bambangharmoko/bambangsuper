/**
 * Utility to launch WhatsApp directly without intermediate browser redirect pages.
 * - On Mobile (Android/iOS): launches native WhatsApp app via deep link `whatsapp://send?phone=...&text=...` with web fallback.
 * - On Desktop (PC/Mac/Linux): launches `https://web.whatsapp.com/send?phone=...&text=...` directly into the chat room.
 */

export function openDirectWhatsApp(phone: string, text: string = "") {
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
  const encodedText = encodeURIComponent(text);

  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Native app protocol for mobile
    const nativeAppUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`;
    const webFallbackUrl = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;

    // Attempt native app
    window.location.href = nativeAppUrl;

    // Fallback if app is not installed
    const timeout = setTimeout(() => {
      if (!document.hidden) {
        window.open(webFallbackUrl, "_blank");
      }
    }, 1200);

    const onBlur = () => {
      clearTimeout(timeout);
      window.removeEventListener("blur", onBlur);
    };
    window.addEventListener("blur", onBlur);
  } else {
    // On Desktop: directly open web.whatsapp.com chat
    const webUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;
    window.open(webUrl, "_blank", "noopener,noreferrer");
  }
}

export function openDirectWhatsAppFromUrl(rawUrl: string, defaultPhone = "628115404999") {
  let phone = defaultPhone;
  let text = "";

  try {
    const urlObj = new URL(rawUrl.startsWith("http") || rawUrl.startsWith("whatsapp:") ? rawUrl : `https://${rawUrl}`);
    const searchParams = urlObj.searchParams;
    text = searchParams.get("text") || "";

    if (urlObj.pathname) {
      const pathPhone = urlObj.pathname.replace(/\D/g, "");
      if (pathPhone && pathPhone.length >= 8) phone = pathPhone;
    }
    if (searchParams.get("phone")) {
      const qPhone = searchParams.get("phone")!.replace(/\D/g, "");
      if (qPhone && qPhone.length >= 8) phone = qPhone;
    }
  } catch (e) {
    const phoneMatch = rawUrl.match(/(?:phone=|wa\.me\/|send\?phone=)(\d+)/);
    if (phoneMatch) phone = phoneMatch[1];
    const textMatch = rawUrl.match(/[?&]text=([^&]+)/);
    if (textMatch) {
      try {
        text = decodeURIComponent(textMatch[1]);
      } catch (e) {
        text = textMatch[1];
      }
    }
  }

  openDirectWhatsApp(phone, text);
}
