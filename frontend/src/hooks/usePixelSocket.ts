import { useEffect, useRef, useState } from "react";
import type { ClientMessage, ConnectionStatus, ServerMessage, ServerStateMessage } from "../types";

type PixelSocketOptions = {
  onActivity: (text: string) => void;
};

export function usePixelSocket({ onActivity }: PixelSocketOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [wsUrl, setWsUrl] = useState("");
  const [state, setState] = useState<ServerStateMessage | null>(null);
  const [latencySamples, setLatencySamples] = useState<number[]>([]);
  const [packetTimes, setPacketTimes] = useState<number[]>([]);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastError, setLastError] = useState("");

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const manualCloseRef = useRef(false);
  const attemptRef = useRef(0);
  const lastLatencyRef = useRef<number | null>(null);

  function rememberPacket() {
    const now = Date.now();
    setPacketTimes((times) => [...times.filter((time) => now - time < 60_000), now]);
  }

  function send(message: ClientMessage) {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }

  function connect(nextUrl: string) {
    closeSocketSilently();
    manualCloseRef.current = false;
    attemptRef.current = 0;
    setState(null);
    setWsUrl(nextUrl);
    setStatus("connecting");
    openSocket(nextUrl);
  }

  function openSocket(nextUrl: string) {
    try {
      const socket = new WebSocket(nextUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setStatus("connected");
        setLastError("");
        onActivity("backend connected");
      };

      socket.onmessage = (event) => {
        rememberPacket();
        const message = JSON.parse(event.data) as ServerMessage;

        if (message.type === "state") {
          setState(message);
          return;
        }

        if (message.type === "pong") {
          const latency = Math.max(0, Date.now() - message.clientTs);
          const previous = lastLatencyRef.current;
          lastLatencyRef.current = latency;
          setLatencySamples((samples) => [...samples.slice(-39), latency]);

          if (latency > 200 && (previous === null || previous <= 200)) {
            onActivity("latency spike detected");
          }
        }
      };

      socket.onerror = () => {
        setLastError("WebSocket error. Check the tunnel URL and backend logs.");
        setStatus("error");
      };

      socket.onclose = () => {
        socketRef.current = null;

        if (manualCloseRef.current) {
          setStatus("disconnected");
          onActivity("local fallback mode active");
          return;
        }

        scheduleReconnect(nextUrl);
      };
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "Unable to connect.");
      scheduleReconnect(nextUrl);
    }
  }

  function scheduleReconnect(nextUrl: string) {
    attemptRef.current += 1;
    setReconnectCount((count) => count + 1);
    setStatus("reconnecting");

    const delay = Math.min(1000 * 2 ** attemptRef.current, 10_000);
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = window.setTimeout(() => {
      openSocket(nextUrl);
    }, delay);
  }

  function clearTimers() {
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (pingTimerRef.current) {
      window.clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }

  function closeSocketSilently() {
    clearTimers();

    if (socketRef.current) {
      const socket = socketRef.current;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.onopen = null;
      socket.close();
      socketRef.current = null;
    }
  }

  function disconnect(markManual = true) {
    manualCloseRef.current = markManual;
    closeSocketSilently();

    if (markManual) {
      setStatus("disconnected");
      setState(null);
    }
  }

  useEffect(() => {
    if (status !== "connected") {
      return;
    }

    pingTimerRef.current = window.setInterval(() => {
      send({ type: "ping", clientTs: Date.now() });
    }, 1000);

    send({ type: "ping", clientTs: Date.now() });

    return () => {
      if (pingTimerRef.current) {
        window.clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    return () => disconnect(true);
  }, []);

  const latestLatency = latencySamples.length > 0 ? latencySamples[latencySamples.length - 1] : null;
  const averageLatency =
    latencySamples.length > 0
      ? Math.round(latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length)
      : null;
  const maxLatency = latencySamples.length > 0 ? Math.max(...latencySamples) : null;

  return {
    averageLatency,
    connect,
    disconnect,
    latestLatency,
    latencySamples,
    maxLatency,
    packetCount: packetTimes.length,
    reconnectCount,
    send,
    state,
    status,
    wsUrl,
    lastError,
  };
}
