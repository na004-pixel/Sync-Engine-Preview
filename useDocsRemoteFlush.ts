"use client";

import { useEffect, useRef, useState } from "react";

// Mock interfaces to replace exact IP hooks
const getLocalSyncState = async (pageId: string) => ({ isFullySynced: false });
const markSyncSuccess = async (pageId: string, version: number) => {};
const markSyncFailure = async (pageId: string, version: number) => {};
const reserveNextPayload = async (pageId: string) => ({ version: 1, payload: {} });

export function useOfflineFirstSync(pageId: string) {
  const [status, setStatus] = useState("idle");
  const isFlushing = useRef(false);

  const performFlush = async (isKeepAlive: boolean = false) => {
    if (isFlushing.current) return;
    
    // 1. Offline-first check
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStatus("paused-offline");
      return;
    }

    isFlushing.current = true;
    try {
      const localState = await getLocalSyncState(pageId);
      if (!localState || localState.isFullySynced) {
        setStatus("synced");
        return;
      }

      // 2. Fetch the next candidate from the local IndexedDB queue
      const candidate = await reserveNextPayload(pageId);
      if (!candidate) return;

      setStatus("flushing");

      // 3. Idempotent API Call
      const response = await fetch(`/api/workspace/sync/${pageId}`, {
        method: "POST",
        body: JSON.stringify(candidate),
        keepalive: isKeepAlive, // Ensure network requests survive page unloads
      });

      if (!response.ok) {
        await markSyncFailure(pageId, candidate.version);
        setStatus("retrying-soon");
        return;
      }

      await markSyncSuccess(pageId, candidate.version);
      setStatus("synced");

    } catch (error) {
      setStatus("error-retrying");
    } finally {
      isFlushing.current = false;
    }
  };

  // 4. Setup interval-based fallback + lifecycle hooks for seamless syncing
  useEffect(() => {
    const interval = window.setInterval(() => performFlush(false), 15000);
    
    const handleOnline = () => performFlush(false);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") performFlush(true);
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [pageId]);

  return { status };
}
