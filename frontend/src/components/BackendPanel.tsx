import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { buildShareUrl, clearSavedWsUrl, currentCleanPageUrl, normalizeWsUrl, saveWsUrl } from "../lib/url";
import type { ConnectionStatus } from "../types";

type BackendPanelProps = {
  initialUrl: string;
  activeWsUrl: string;
  status: ConnectionStatus;
  lastError: string;
  onConnect: (url: string) => void;
  onDisconnect: () => void;
  onClear: () => void;
};

export function BackendPanel({
  initialUrl,
  activeWsUrl,
  status,
  lastError,
  onConnect,
  onDisconnect,
  onClear,
}: BackendPanelProps) {
  const [input, setInput] = useState(initialUrl);
  const [normalized, setNormalized] = useState("");
  const [formError, setFormError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const shareUrl = activeWsUrl ? buildShareUrl(activeWsUrl) : currentCleanPageUrl();

  useEffect(() => {
    setInput(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    QRCode.toDataURL(shareUrl, {
      margin: 1,
      scale: 6,
      color: { dark: "#10241f", light: "#eef8ed" },
    }).then(setQrDataUrl);
  }, [shareUrl]);

  function preview(value: string) {
    setInput(value);
    setFormError("");

    if (!value.trim()) {
      setNormalized("");
      return;
    }

    try {
      setNormalized(normalizeWsUrl(value));
    } catch (error) {
      setNormalized("");
      setFormError(error instanceof Error ? error.message : "Invalid URL.");
    }
  }

  function connect() {
    try {
      const url = normalizeWsUrl(input);
      saveWsUrl(url);
      setNormalized(url);
      setFormError("");
      onConnect(url);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid URL.");
    }
  }

  function clear() {
    clearSavedWsUrl();
    setInput("");
    setNormalized("");
    onClear();
  }

  return (
    <section className="panel backend-panel">
      <div className="panel-title">
        <h2>Live backend connection</h2>
        <span className={`status-dot ${status}`}>{status}</span>
      </div>

      <label className="field">
        Backend or WebSocket URL
        <input
          value={input}
          onChange={(event) => preview(event.target.value)}
          placeholder="https://random.trycloudflare.com"
          spellCheck={false}
        />
      </label>

      <p className="hint">
        Accepts localhost, Cloudflare Quick Tunnel, ngrok, ws://, and wss:// URLs. HTTP(S) is converted to /ws
        automatically.
      </p>

      {normalized ? <code className="copy-box">{normalized}</code> : null}
      {formError || lastError ? <p className="error-text">{formError || lastError}</p> : null}

      <div className="button-row">
        <button type="button" onClick={connect}>
          Connect
        </button>
        <button type="button" className="ghost" onClick={onDisconnect}>
          Disconnect
        </button>
        <button type="button" className="ghost" onClick={clear}>
          Clear saved backend
        </button>
      </div>

      <label className="field">
        Share URL
        <input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
      </label>

      <div className="qr-wrap">
        {qrDataUrl ? <img src={qrDataUrl} alt="QR code for joining Pixel Rain Arena" /> : null}
        <p>{activeWsUrl ? "Scan to join this live backend session." : "Scan to open local-only mode."}</p>
      </div>
    </section>
  );
}
