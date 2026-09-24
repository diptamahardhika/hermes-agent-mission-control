import { useEffect, useState, useRef } from "react";
import type { HomeData } from "@/types/home-dashboard";

interface WSOptions {
  /** Enable WebSocket fallback to polling if connection fails */
  fallbackToPolling?: boolean;
  /** Retry interval in ms for reconnection attempts */
  retryInterval?: number;
  /** Maximum retry attempts before giving up */
  maxRetries?: number;
}

export function useDashboardWS(options: WSOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [ws, setWs] = useState<EventSource | null>(null);
  const retryCount = useRef<number>(0);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ws) ws.close();
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [ws]);

  function startPolling() {
    setLoading(true);

    const fetchData = async () => {
      try {
        const res = await fetch("/api/home");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setData(data);
        setLoading(false);
        retryCount.current = 0; // Reset retry count on successful poll
      } catch (err) {
        console.error("Polling failed:", err);
        setError(err as Error);
        setLoading(false);

        // Retry polling if we haven't exceeded max retries
        const maxRetriesVal = optionsRef.current.maxRetries ?? 5;
        const retryIntervalVal = optionsRef.current.retryInterval ?? 3000;
        if (retryCount.current < maxRetriesVal) {
          retryCount.current++;
          setTimeout(fetchData, retryCount.current * retryIntervalVal);
        }
      }
    };

    // Initial fetch
    fetchData();

    // Set up interval
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    pollingInterval.current = setInterval(fetchData, 30_000);
  }

  function initConnection() {
    // Reset loading state
    setLoading(true);
    setError(null);

    try {
      // Try EventSource (SSE) first
      const eventSource = new EventSource("/api/ws");
      setWs(eventSource);

      eventSource.onopen = () => {
        console.log("Dashboard SSE connection opened");
        retryCount.current = 0;
        setLoading(false);

        // Clear polling interval if it exists
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          setData(parsedData);
          setLoading(false);
        } catch (e) {
          console.error("Failed to parse SSE message:", e);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error:", err);
        eventSource.close();

        const { fallbackToPolling: fp, maxRetries: mr, retryInterval: ri } = optionsRef.current;
        if (fp && retryCount.current < (mr ?? 5)) {
          retryCount.current++;
          setTimeout(() => {
            console.log(`Retrying connection attempt ${retryCount.current}/${mr ?? 5}`);
            initConnection();
          }, retryCount.current * (ri ?? 3000));
        } else {
          // Fall back to polling or show error
          if (fp) {
            console.log("Falling back to polling");
            startPolling();
          } else {
            setError(new Error("Failed to establish real-time connection"));
            setLoading(false);
          }
        }
      };

      return () => {
        eventSource.close();
      };
    } catch (err) {
      console.error("Failed to create EventSource:", err);
      if (optionsRef.current.fallbackToPolling) {
        startPolling();
      } else {
        setError(err as Error);
        setLoading(false);
      }
    }
  }

  // Initialize connection
  useEffect(() => {
    initConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error };
}