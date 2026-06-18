import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type BuildChannel = () => RealtimeChannel;

export function useReconnectableChannel(
  enabled: boolean,
  buildChannel: BuildChannel,
  onReconnect?: () => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let disposed = false;

    const clearRetry = () => {
      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
        retryRef.current = null;
      }
    };

    const removeCurrentChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };

    const connect = () => {
      if (disposed) return;
      clearRetry();
      removeCurrentChannel();

      const channel = buildChannel();
      channelRef.current = channel;
      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (!disposed) retryRef.current = window.setTimeout(connect, 3000);
        }
      });
    };

    const reconnect = () => {
      connect();
      onReconnect?.();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") reconnect();
    };
    const handleStaffDataRefresh = () => onReconnect?.();

    connect();
    window.addEventListener("focus", reconnect);
    window.addEventListener("staff-data-refresh", handleStaffDataRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      clearRetry();
      window.removeEventListener("focus", reconnect);
      window.removeEventListener("staff-data-refresh", handleStaffDataRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      removeCurrentChannel();
    };
  }, [enabled, buildChannel, onReconnect]);
}