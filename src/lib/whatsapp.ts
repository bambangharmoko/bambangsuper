/**
 * Utility to launch WhatsApp with intelligent app-first priority:
 * 1. Priority 1 (App): Attempts to launch native WhatsApp Desktop (Windows/Mac) or WhatsApp Mobile (Android/iOS) via `whatsapp://send?phone=...&text=...`.
 * 2. Priority 2 (Web): If the native application is not installed / doesn't respond, fallbacks smoothly to WhatsApp Web `https://web.whatsapp.com/send?phone=...&text=...`.
 */

export function openDirectWhatsApp(phone: string, text: string = "") {
  const cleanPhone = phone.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;
  const encodedText = encodeURIComponent(text);

  const nativeAppUrl = `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`;
  const webFallbackUrl = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`;

  let appOpened = false;

  const handleBlur = () => {
    appOpened = true;
    cleanup();
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      appOpened = true;
      cleanup();
    }
  };

  const cleanup = () => {
    window.removeEventListener("blur", handleBlur);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };

  window.addEventListener("blur", handleBlur);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // 1. Prioritize native WhatsApp Desktop / Mobile application
  try {
    const hiddenLink = document.createElement("a");
    hiddenLink.href = nativeAppUrl;
    hiddenLink.style.display = "none";
    document.body.appendChild(hiddenLink);
    hiddenLink.click();
    setTimeout(() => {
      if (document.body.contains(hiddenLink)) {
        document.body.removeChild(hiddenLink);
      }
    }, 500);
  } catch (e) {
    try {
      window.location.assign(nativeAppUrl);
    } catch (err) {
      window.location.href = nativeAppUrl;
    }
  }

  // 2. Fallback to WhatsApp Web if WhatsApp Desktop / App is not installed (window remains focused)
  setTimeout(() => {
    cleanup();
    if (!appOpened && !document.hidden) {
      window.open(webFallbackUrl, "_blank", "noopener,noreferrer");
    }
  }, 1600);
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
