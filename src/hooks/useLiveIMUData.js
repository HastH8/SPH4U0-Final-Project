import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "../config";
import { createFakeIMUGenerator } from "../utils/fakeIMUGenerator";

const formatPacket = (packet) => {
  const timestamp = packet.timestamp ?? Date.now();
  return {
    timestamp,
    ax: packet.accel?.x ?? 0,
    ay: packet.accel?.y ?? 0,
    az: packet.accel?.z ?? 0,
    gx: packet.gyro?.x ?? 0,
    gy: packet.gyro?.y ?? 0,
    gz: packet.gyro?.z ?? 0,
    velocity: packet.velocity ?? 0,
    impact: packet.impact ?? 0,
  };
};

export const useLiveIMUData = () => {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const historyRef = useRef([]);
  const reconnectRef = useRef(null);
  const bufferRef = useRef([]);
  const flushTimerRef = useRef(null);

  const pushDataBatch = useCallback((packets) => {
    if (!packets.length) return;
    const formatted = packets.map(formatPacket);
    const latest = formatted[formatted.length - 1];
    setData(latest);
    setHistory((prev) => {
      const next = [...prev, ...formatted];
      if (next.length > CONFIG.MAX_HISTORY) {
        next.splice(0, next.length - CONFIG.MAX_HISTORY);
      }
      historyRef.current = next;
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    setHistory([]);
  }, []);

  const snapshot = useCallback(() => {
    return [...historyRef.current];
  }, []);

  useEffect(() => {
    let ws;
    let stopped = false;

    if (CONFIG.DEBUG_MODE) {
      const generator = createFakeIMUGenerator(CONFIG.SAMPLE_RATE_HZ);
      setIsConnected(true);
      setError(null);

      const interval = setInterval(() => {
        pushDataBatch([generator()]);
      }, 1000 / CONFIG.SAMPLE_RATE_HZ);

      return () => {
        clearInterval(interval);
        setIsConnected(false);
      };
    }

    const startFlushLoop = () => {
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
      }
      flushTimerRef.current = setInterval(() => {
        if (!bufferRef.current.length) return;
        const batch = bufferRef.current;
        bufferRef.current = [];
        pushDataBatch(batch);
      }, 1000 / CONFIG.SAMPLE_RATE_HZ);
    };

    const connect = () => {
      if (stopped) {
        return;
      }

      ws = new WebSocket(CONFIG.WEBSOCKET_URL);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        startFlushLoop();
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          bufferRef.current.push(packet);
        } catch (err) {
          setError("Invalid sensor packet");
        }
      };

      ws.onerror = () => {
        setError("WebSocket error");
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!stopped) {
          reconnectRef.current = setTimeout(connect, 1200);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      if (flushTimerRef.current) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [pushDataBatch]);

  return useMemo(
    () => ({
      data,
      history,
      isConnected,
      error,
      clearHistory,
      snapshot,
    }),
    [data, history, isConnected, error, clearHistory, snapshot]
  );
};
