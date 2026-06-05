const STORAGE_KEY = "pixel-rain-arena.ws-url";

export function normalizeWsUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    return "";
  }

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  } else if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  } else if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("Use http, https, ws, or wss.");
  }

  if (!parsed.pathname || parsed.pathname === "/") {
    parsed.pathname = "/ws";
  }

  return parsed.toString();
}

export function getQueryWsUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const ws = params.get("ws");
  return ws ? normalizeWsUrl(ws) : "";
}

export function getSavedWsUrl(): string {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function saveWsUrl(url: string): void {
  localStorage.setItem(STORAGE_KEY, url);
}

export function clearSavedWsUrl(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function buildShareUrl(wsUrl: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("ws", wsUrl);
  return url.toString();
}

export function currentCleanPageUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete("ws");
  return url.toString();
}

