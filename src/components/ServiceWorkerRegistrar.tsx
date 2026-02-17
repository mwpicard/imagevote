"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("[SW] Registration failed:", err);
    });

    // When coming back online, ask SW to flush the offline queue
    function handleOnline() {
      navigator.serviceWorker.ready.then((reg) => {
        if ("sync" in reg) {
          (reg as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register("flush-queue");
        } else {
          // Fallback: post message to SW
          reg.active?.postMessage("flush-queue");
        }
      });
    }

    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
