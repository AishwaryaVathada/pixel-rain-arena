import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";

type Drop = {
  x: number;
  y: number;
  speed: number;
  length: number;
  bright: boolean;
};

type Splash = {
  x: number;
  y: number;
  life: number;
  vx: number;
  vy: number;
};

type PixelRainCanvasProps = {
  paused: boolean;
  resetToken: number;
  onGroundHits: (hits: number) => void;
  onRainRate: (rate: number) => void;
  onActivity: (text: string) => void;
  onPauseChange: (paused: boolean, reason: string) => void;
};

const DROP_COUNT = 110;

export function PixelRainCanvas({
  paused,
  resetToken,
  onGroundHits,
  onRainRate,
  onActivity,
  onPauseChange,
}: PixelRainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pausedRef = useRef(paused);
  const dropsRef = useRef<Drop[]>([]);
  const splashesRef = useRef<Splash[]>([]);
  const hitsRef = useRef(0);
  const lastRateWindowRef = useRef({ ts: performance.now(), hits: 0 });
  const lastActivityRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    hitsRef.current = 0;
    onGroundHits(0);
    onRainRate(0);
    splashesRef.current = [];
  }, [resetToken, onGroundHits, onRainRate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const canvasEl = canvas;
    const context = ctx;
    let animationId = 0;
    let lastTs = performance.now();

    function resize() {
      const rect = canvasEl.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      canvasEl.width = Math.max(320, Math.floor(rect.width * scale));
      canvasEl.height = Math.max(260, Math.floor(rect.height * scale));
      context.imageSmoothingEnabled = false;
      seedDrops(canvasEl.width, canvasEl.height);
    }

    function seedDrops(width: number, height: number) {
      if (dropsRef.current.length > 0) {
        return;
      }

      dropsRef.current = Array.from({ length: DROP_COUNT }, () => makeDrop(width, height, true));
    }

    function frame(ts: number) {
      const delta = Math.min(32, ts - lastTs);
      lastTs = ts;

      draw(context, canvasEl.width, canvasEl.height, delta, ts);
      animationId = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    animationId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  function makeDrop(width: number, height: number, randomY = false): Drop {
    return {
      x: Math.floor(Math.random() * width),
      y: randomY ? Math.floor(Math.random() * height) : -Math.random() * 120,
      speed: 140 + Math.random() * 260,
      length: 10 + Math.random() * 24,
      bright: Math.random() > 0.82,
    };
  }

  function draw(ctx: CanvasRenderingContext2D, width: number, height: number, delta: number, ts: number) {
    const groundY = height - 34;
    const pixel = Math.max(2, Math.floor(width / 180));

    ctx.fillStyle = "#070a1c";
    ctx.fillRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#111845");
    bg.addColorStop(0.52, "#0b102d");
    bg.addColorStop(1, "#060814");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    drawClouds(ctx, width, pixel, ts);
    drawScanlines(ctx, width, height, pixel);

    if (!pausedRef.current) {
      updateDrops(width, groundY, delta, pixel, ts);
    }

    for (const drop of dropsRef.current) {
      ctx.fillStyle = drop.bright ? "#f6d365" : "#20e3d2";
      ctx.fillRect(Math.floor(drop.x / pixel) * pixel, Math.floor(drop.y / pixel) * pixel, pixel * 2, drop.length);
      ctx.fillStyle = drop.bright ? "rgba(246, 211, 101, 0.22)" : "rgba(32, 227, 210, 0.18)";
      ctx.fillRect(Math.floor(drop.x / pixel) * pixel, Math.floor(drop.y / pixel) * pixel - pixel * 3, pixel, pixel * 3);
    }

    drawSplashes(ctx, pixel, delta, !pausedRef.current);
    drawGround(ctx, width, groundY, pixel, pausedRef.current);
    drawPauseOverlay(ctx, width, height, pausedRef.current);
  }

  function updateDrops(width: number, groundY: number, delta: number, pixel: number, ts: number) {
    let hitBatch = 0;

    dropsRef.current = dropsRef.current.map((drop) => {
      const next = { ...drop, y: drop.y + (drop.speed * delta) / 1000 };

      if (next.y + next.length >= groundY) {
        hitBatch += 1;
        spawnSplash(next.x, groundY, pixel);
        return makeDrop(width, groundY);
      }

      return next;
    });

    if (hitBatch > 0) {
      hitsRef.current += hitBatch;
      onGroundHits(hitsRef.current);
    }

    const rateWindow = lastRateWindowRef.current;
    if (ts - rateWindow.ts >= 1000) {
      const rate = Math.round(((hitsRef.current - rateWindow.hits) / (ts - rateWindow.ts)) * 1000);
      lastRateWindowRef.current = { ts, hits: hitsRef.current };
      onRainRate(rate);

      if (hitsRef.current > 0 && ts - lastActivityRef.current > 2400) {
        lastActivityRef.current = ts;
        onActivity("drop batch reached ground");
      }
    }
  }

  function spawnSplash(x: number, y: number, pixel: number) {
    for (let index = 0; index < 3; index += 1) {
      splashesRef.current.push({
        x,
        y,
        life: 1,
        vx: (Math.random() - 0.5) * pixel * 7,
        vy: -Math.random() * pixel * 6,
      });
    }
  }

  function drawSplashes(ctx: CanvasRenderingContext2D, pixel: number, delta: number, active: boolean) {
    splashesRef.current = splashesRef.current
      .map((splash) => ({
        ...splash,
        x: active ? splash.x + splash.vx : splash.x,
        y: active ? splash.y + splash.vy : splash.y,
        vy: active ? splash.vy + pixel * 0.28 : splash.vy,
        life: active ? splash.life - delta / 480 : splash.life,
      }))
      .filter((splash) => splash.life > 0);

    for (const splash of splashesRef.current) {
      ctx.fillStyle = `rgba(122, 252, 255, ${Math.max(0, splash.life)})`;
      ctx.fillRect(Math.floor(splash.x), Math.floor(splash.y), pixel * 2, pixel * 2);
    }
  }

  function drawClouds(ctx: CanvasRenderingContext2D, width: number, pixel: number, ts: number) {
    ctx.fillStyle = "rgba(55, 67, 134, 0.36)";
    const drift = Math.floor((ts / 80) % (width + 240));

    for (const base of [40, 180, 360]) {
      const x = (base + drift) % (width + 240) - 180;
      const y = 32 + (base % 3) * 18;
      ctx.fillRect(x, y, pixel * 18, pixel * 5);
      ctx.fillRect(x + pixel * 8, y - pixel * 4, pixel * 16, pixel * 5);
      ctx.fillRect(x + pixel * 25, y + pixel * 2, pixel * 12, pixel * 4);
    }
  }

  function drawScanlines(ctx: CanvasRenderingContext2D, width: number, height: number, pixel: number) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
    for (let y = 0; y < height; y += pixel * 6) {
      ctx.fillRect(0, y, width, pixel);
    }
  }

  function drawGround(ctx: CanvasRenderingContext2D, width: number, groundY: number, pixel: number, isPaused: boolean) {
    ctx.shadowColor = isPaused ? "#f6d365" : "#20e3d2";
    ctx.shadowBlur = pixel * 8;
    ctx.fillStyle = isPaused ? "#f6d365" : "#20e3d2";
    ctx.fillRect(0, groundY, width, pixel * 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(32, 227, 210, 0.12)";
    ctx.fillRect(0, groundY + pixel * 4, width, pixel * 10);
  }

  function drawPauseOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, isPaused: boolean) {
    if (!isPaused) {
      return;
    }

    ctx.fillStyle = "rgba(5, 8, 22, 0.44)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f6d365";
    ctx.font = `${Math.max(18, Math.floor(width / 22))}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("RAIN PAUSED", width / 2, height / 2);
  }

  function pauseByPointer(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onPauseChange(true, "rain paused by touch");
  }

  function resumeByPointer(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    onPauseChange(false, "rain resumed");
  }

  return (
    <canvas
      ref={canvasRef}
      className="rain-canvas"
      aria-label="Pixel rain game canvas"
      onPointerDown={pauseByPointer}
      onPointerUp={resumeByPointer}
      onPointerCancel={resumeByPointer}
      onPointerLeave={resumeByPointer}
    />
  );
}
