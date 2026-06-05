import { useEffect, useState } from "react";
import { BackendPanel } from "./components/BackendPanel";
import { HudCard } from "./components/HudCard";
import { LatencySparkline } from "./components/LatencySparkline";
import { PixelRainCanvas } from "./components/PixelRainCanvas";
import { useActivityLog } from "./hooks/useActivityLog";
import { usePixelSocket } from "./hooks/usePixelSocket";
import { getQueryWsUrl, getSavedWsUrl } from "./lib/url";

function latencyLabel(latency: number | null) {
  if (latency === null) {
    return "waiting";
  }

  if (latency < 80) {
    return "smooth";
  }

  if (latency <= 200) {
    return "okay";
  }

  return "laggy";
}

export default function App() {
  const { activity, addActivity } = useActivityLog();
  const socket = usePixelSocket({ onActivity: addActivity });
  const [localGroundHits, setLocalGroundHits] = useState(0);
  const [localRainRate, setLocalRainRate] = useState(0);
  const [localPaused, setLocalPaused] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [initialBackendUrl, setInitialBackendUrl] = useState("");

  const connected = socket.status === "connected" && socket.state !== null;
  const effectivePaused = connected ? socket.state?.paused ?? localPaused : localPaused;
  const groundHits = connected ? socket.state?.groundHits ?? localGroundHits : localGroundHits;
  const rainRate = connected ? socket.state?.rainRate ?? localRainRate : localRainRate;
  const mode = connected ? "live backend" : "local-only";
  const backendSummary = connected ? "live" : socket.status === "disconnected" ? "offline" : socket.status;

  useEffect(() => {
    const queryUrl = getQueryWsUrl();
    const savedUrl = getSavedWsUrl();
    const startingUrl = queryUrl || savedUrl;
    setInitialBackendUrl(startingUrl);

    if (queryUrl) {
      socket.connect(queryUrl);
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        event.preventDefault();
        handlePauseChange(!effectivePaused, effectivePaused ? "rain resumed" : "rain paused by touch");
      }

      if (event.key.toLowerCase() === "r") {
        reset();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function handlePauseChange(paused: boolean, reason: string) {
    setLocalPaused(paused);
    addActivity(reason);
    socket.send({ type: "control", paused, clientTs: Date.now() });
  }

  function reset() {
    setLocalGroundHits(0);
    setLocalRainRate(0);
    setResetToken((token) => token + 1);
    addActivity("rain counter reset");
    socket.send({ type: "reset", clientTs: Date.now() });
  }

  function disconnect() {
    socket.disconnect();
    addActivity("local fallback mode active");
  }

  const latestLatency = socket.latestLatency;
  const averageLatency = socket.averageLatency;
  const maxLatency = socket.maxLatency;
  const latencyText = latencyLabel(latestLatency);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Realtime rain garden / static-first demo</p>
          <h1>Pixel Rain Arena</h1>
          <p className="subtitle">A soft pond of pixels, gentle rain, and live latency.</p>
        </div>
        <button type="button" className="reset-button" onClick={reset}>
          Refresh Rain
        </button>
      </section>

      <p className="instruction-banner">Touch and hold the water to still the rain. Release to let the garden breathe again.</p>

      <section className="arena-grid">
        <div className="canvas-panel">
          <PixelRainCanvas
            paused={effectivePaused}
            resetToken={resetToken}
            onGroundHits={setLocalGroundHits}
            onRainRate={setLocalRainRate}
            onActivity={addActivity}
            onPauseChange={handlePauseChange}
          />
        </div>

        <aside className="side-column">
          <section className="hud-grid">
            <HudCard label="Drops met the pond" value={groundHits.toLocaleString()} detail="count rests while paused" />
            <HudCard label="Rain rate" value={`${rainRate}/s`} detail="drops per second" />
            <HudCard label="Rain state" value={effectivePaused ? "paused" : "flowing"} detail="touch, space, or backend control" />
            <HudCard label="Backend" value={backendSummary} detail={socket.wsUrl || "no backend required"} />
            <HudCard label="Latency" value={latestLatency === null ? "-- ms" : `${latestLatency} ms`} detail={latencyText} />
            <HudCard label="Mode" value={mode} detail={connected ? "shared pond state" : "browser garden active"} />
            <HudCard label="Clients" value={socket.state?.connectedClients ?? 1} detail="reported by backend when live" />
            <HudCard label="Packets/min" value={socket.packetCount} detail={`${socket.reconnectCount} reconnects`} />
          </section>

          <section className="panel latency-panel">
            <div className="panel-title">
              <h2>Latency meter</h2>
              <span>{latencyText}</span>
            </div>
            <LatencySparkline samples={socket.latencySamples} />
            <div className="latency-stats">
              <span>Latest: {latestLatency ?? "--"} ms</span>
              <span>Avg: {averageLatency ?? "--"} ms</span>
              <span>Max: {maxLatency ?? "--"} ms</span>
            </div>
          </section>

          <BackendPanel
            initialUrl={initialBackendUrl}
            activeWsUrl={connected ? socket.wsUrl : ""}
            status={socket.status}
            lastError={socket.lastError}
            onConnect={socket.connect}
            onDisconnect={disconnect}
            onClear={() => setInitialBackendUrl("")}
          />

          <section className="panel activity-panel">
            <div className="panel-title">
              <h2>Activity log</h2>
              <span>live</span>
            </div>
            <ol>
              {activity.map((entry) => (
                <li key={entry.id}>
                  <span>{new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  {entry.text}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </section>
    </main>
  );
}
