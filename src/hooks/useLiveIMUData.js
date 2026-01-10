import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CONFIG } from "../config";
import { createFakeIMUGenerator } from "../utils/fakeIMUGenerator";

const formatPacket = (packet) => {
  const timestamp = packet.timestamp ?? Date.now();
  const orientation = packet.orientation ?? {};
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
    roll: orientation.roll ?? packet.roll ?? null,
    pitch: orientation.pitch ?? packet.pitch ?? null,
    yaw: orientation.yaw ?? packet.yaw ?? null,
  };
};

export const useLiveIMUData = ({
  sampleRateHz = CONFIG.SAMPLE_RATE_HZ,
  smoothingFactor = CONFIG.SMOOTHING_FACTOR,
} = {}) => {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const historyRef = useRef([]);
  const reconnectRef = useRef(null);
  const bufferRef = useRef([]);
  const flushTimerRef = useRef(null);
  const smoothingRef = useRef(null);
  const smoothingFactorRef = useRef(smoothingFactor);
  const sampleRateRef = useRef(sampleRateHz);

  const applySmoothing = useCallback((packet) => {
    const factor = Math.min(Math.max(smoothingFactorRef.current ?? 0, 0), 0.95);
    if (!factor || factor <= 0) {
      return packet;
    }

    if (!smoothingRef.current) {
      smoothingRef.current = { ...packet };
      return packet;
    }

    const smoothValue = (key) => {
      const value = packet[key];
      if (!Number.isFinite(value)) {
        return value;
      }
      const prevValue = smoothingRef.current[key] ?? value;
      const smoothed = value * (1 - factor) + prevValue * factor;
      smoothingRef.current[key] = smoothed;
      return smoothed;
    };

    return {
      ...packet,
      ax: smoothValue("ax"),
      ay: smoothValue("ay"),
      az: smoothValue("az"),
      gx: smoothValue("gx"),
      gy: smoothValue("gy"),
      gz: smoothValue("gz"),
      velocity: smoothValue("velocity"),
    };
  }, []);

  const pushDataBatch = useCallback((packets) => {
    if (!packets.length) return;
    const formatted = packets.map(formatPacket);
    const smoothed = formatted.map(applySmoothing);
    const latest = smoothed[smoothed.length - 1];
    setData(latest);
    setHistory((prev) => {
      const next = [...prev, ...smoothed];
      if (next.length > CONFIG.MAX_HISTORY) {
        next.splice(0, next.length - CONFIG.MAX_HISTORY);
      }
      historyRef.current = next;
      return next;
    });
  }, [applySmoothing]);

  const startFlushLoop = useCallback(() => {
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
    }
    const intervalMs = 1000 / Math.max(sampleRateRef.current || 1, 1);
    flushTimerRef.current = setInterval(() => {
      if (!bufferRef.current.length) return;
      const batch = bufferRef.current;
      bufferRef.current = [];
      pushDataBatch(batch);
    }, intervalMs);
  }, [pushDataBatch]);

  const clearHistory = useCallback(() => {
    historyRef.current = [];
    smoothingRef.current = null;
    setHistory([]);
  }, []);

  const snapshot = useCallback(() => {
    return [...historyRef.current];
  }, []);

  useEffect(() => {
    sampleRateRef.current = sampleRateHz;
    if (flushTimerRef.current) {
      startFlushLoop();
    }
  }, [sampleRateHz, startFlushLoop]);

  useEffect(() => {
    smoothingFactorRef.current = smoothingFactor;
    smoothingRef.current = null;
  }, [smoothingFactor]);

  useEffect(() => {
    if (!CONFIG.DEBUG_MODE) return undefined;

    const generator = createFakeIMUGenerator(sampleRateHz);
    setIsConnected(true);
    setError(null);

    const interval = setInterval(() => {
      pushDataBatch([generator()]);
    }, 1000 / sampleRateHz);

    return () => {
      clearInterval(interval);
      setIsConnected(false);
    };
  }, [pushDataBatch, sampleRateHz]);

  useEffect(() => {
    if (CONFIG.DEBUG_MODE) return undefined;

    let ws;
    let stopped = false;

    const connect = () => {
      if (stopped) {
        return;
      }

      ws = new WebSocket(CONFIG.WEBSOCKET_URL);

      ws.onopen = () => {
        setIsConnected(true);
        setError(null);
        smoothingRef.current = null;
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
  }, [pushDataBatch, startFlushLoop]);

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
