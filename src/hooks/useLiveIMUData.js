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
  const [compareMode, setCompareMode] = useState(false);

  const historyRef = useRef([]);
  const reconnectRef = useRef(null);

  const pushData = useCallback((packet) => {
    const formatted = formatPacket(packet);
    setData(formatted);
    setHistory((prev) => {
      const next = [...prev, formatted];
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
        pushData(generator());
      }, 1000 / CONFIG.SAMPLE_RATE_HZ);

      return () => {
        clearInterval(interval);
        setIsConnected(false);
      };
    }

    const connect = () => {
      if (stopped) {
        return;
      }

      ws = new WebSocket(CONFIG.WEBSOCKET_URL);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          pushData(packet);
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
      if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [pushData]);

  return useMemo(
    () => ({
      data,
      history,
      isConnected,
      error,
      clearHistory,
      snapshot,
      compareMode,
      setCompareMode,
    }),
    [data, history, isConnected, error, clearHistory, snapshot, compareMode, setCompareMode]
  );
};
