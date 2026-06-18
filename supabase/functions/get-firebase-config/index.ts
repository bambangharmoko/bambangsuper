// Mengembalikan konfigurasi Firebase Web (PUBLIK by design) ke frontend.
// Field ini aman di-expose karena keamanan FCM bertumpu pada VAPID + project rules.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const config = {
    apiKey: Deno.env.get("FIREBASE_API_KEY") || "",
    authDomain: Deno.env.get("FIREBASE_AUTH_DOMAIN") || "",
    projectId: Deno.env.get("FIREBASE_PROJECT_ID") || "",
    messagingSenderId: Deno.env.get("FIREBASE_MESSAGING_SENDER_ID") || "",
    appId: Deno.env.get("FIREBASE_APP_ID") || "",
    vapidKey: Deno.env.get("FIREBASE_VAPID_KEY") || "",
  };

  return new Response(JSON.stringify(config), {
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
});
