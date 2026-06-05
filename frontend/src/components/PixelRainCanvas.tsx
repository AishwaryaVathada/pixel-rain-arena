import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";

type Drop = {
  x: number;
  y: number;
  speed: number;
  length: number;
  bright: boolean;
};

type Leaf = {
  x: number;
  y: number;
  radius: number;
  angle: number;
  tone: string;
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
const LEAVES: Leaf[] = [
  { x: 0.18, y: 0.72, radius: 0.055, angle: -0.45, tone: "#74a64d" },
  { x: 0.33, y: 0.5, radius: 0.045, angle: 0.2, tone: "#92b65f" },
  { x: 0.72, y: 0.36, radius: 0.05, angle: 0.18, tone: "#6f9b42" },
  { x: 0.84, y: 0.68, radius: 0.042, angle: -0.22, tone: "#8dbb61" },
];

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
      speed: 80 + Math.random() * 170,
      length: 8 + Math.random() * 18,
      bright: Math.random() > 0.88,
    };
  }

  function draw(ctx: CanvasRenderingContext2D, width: number, height: number, delta: number, ts: number) {
    const groundY = height - Math.max(30, Math.floor(height * 0.08));
    const pixel = Math.max(2, Math.floor(width / 180));

    ctx.fillStyle = "#07140f";
    ctx.fillRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#183225");
    bg.addColorStop(0.44, "#122d2b");
    bg.addColorStop(0.78, "#1a3d42");
    bg.addColorStop(1, "#0b1713");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    drawFoliage(ctx, width, height, pixel, ts);
    drawPond(ctx, width, height, groundY, pixel, ts);
    drawMist(ctx, width, height, pixel, ts);

    if (!pausedRef.current) {
      updateDrops(width, groundY, delta, pixel, ts);
    }

    for (const drop of dropsRef.current) {
      ctx.fillStyle = drop.bright ? "#eef8ed" : "#a7d5d8";
      ctx.fillRect(Math.floor(drop.x / pixel) * pixel, Math.floor(drop.y / pixel) * pixel, pixel * 2, drop.length);
      ctx.fillStyle = drop.bright ? "rgba(238, 248, 237, 0.26)" : "rgba(167, 213, 216, 0.18)";
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
      ctx.fillStyle = `rgba(214, 238, 234, ${Math.max(0, splash.life)})`;
      ctx.fillRect(Math.floor(splash.x), Math.floor(splash.y), pixel * 2, pixel * 2);
    }
  }

  function drawFoliage(ctx: CanvasRenderingContext2D, width: number, height: number, pixel: number, ts: number) {
    const sway = Math.sin(ts / 1700) * pixel * 2;
    const clusters = [
      { x: width * 0.02, y: height * 0.05, w: width * 0.32, h: height * 0.28, color: "#2c5c38" },
      { x: width * 0.62, y: height * 0.02, w: width * 0.38, h: height * 0.32, color: "#355f3e" },
      { x: width * 0.05, y: height * 0.76, w: width * 0.38, h: height * 0.2, color: "#3a7647" },
    ];

    for (const cluster of clusters) {
      ctx.fillStyle = cluster.color;
      ctx.fillRect(cluster.x, cluster.y, cluster.w, cluster.h);
      ctx.fillStyle = "rgba(13, 31, 23, 0.58)";
      ctx.fillRect(cluster.x + cluster.w * 0.12, cluster.y + cluster.h * 0.16, cluster.w * 0.74, cluster.h * 0.76);
    }

    for (let index = 0; index < 11; index += 1) {
      const x = ((index * 97) % width) + sway * (index % 3);
      const y = height * (index % 2 === 0 ? 0.07 : 0.82) + index * pixel;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(index % 2 === 0 ? -0.35 : 0.18);
      ctx.fillStyle = index % 3 === 0 ? "#5b8b4e" : "#44734a";
      ctx.fillRect(0, 0, pixel * 8, pixel * 34);
      ctx.fillStyle = "rgba(191, 222, 179, 0.18)";
      ctx.fillRect(pixel * 2, pixel * 2, pixel * 2, pixel * 25);
      ctx.restore();
    }
  }

  function drawPond(ctx: CanvasRenderingContext2D, width: number, height: number, groundY: number, pixel: number, ts: number) {
    const pondTop = height * 0.32;
    const water = ctx.createLinearGradient(0, pondTop, 0, groundY + pixel * 12);
    water.addColorStop(0, "rgba(41, 83, 88, 0.82)");
    water.addColorStop(0.56, "rgba(45, 91, 99, 0.92)");
    water.addColorStop(1, "rgba(18, 42, 39, 0.94)");
    ctx.fillStyle = water;
    ctx.fillRect(0, pondTop, width, groundY - pondTop + pixel * 12);

    ctx.fillStyle = "rgba(181, 220, 218, 0.16)";
    for (let index = 0; index < 9; index += 1) {
      const x = ((index * 137 + ts / 38) % (width + 90)) - 45;
      const y = pondTop + ((index * 47) % Math.max(1, groundY - pondTop - pixel * 10));
      ctx.fillRect(Math.floor(x), Math.floor(y), pixel * (8 + (index % 4) * 6), pixel * 2);
    }

    for (const leaf of LEAVES) {
      drawLeaf(ctx, width * leaf.x, height * leaf.y, width * leaf.radius, leaf.angle, leaf.tone, pixel);
    }

    drawRipples(ctx, width, height, pondTop, groundY, pixel, ts);
  }

  function drawLeaf(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    angle: number,
    tone: string,
    pixel: number,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.55, radius * 0.62, 0, 0.25, Math.PI * 1.92);
    ctx.lineTo(radius * 0.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(28, 67, 35, 0.75)";
    ctx.lineWidth = pixel;
    ctx.stroke();
    ctx.fillStyle = "rgba(221, 240, 199, 0.28)";
    ctx.fillRect(-radius * 0.5, -pixel, radius * 0.86, pixel);
    ctx.restore();
  }

  function drawRipples(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    pondTop: number,
    groundY: number,
    pixel: number,
    ts: number,
  ) {
    ctx.strokeStyle = "rgba(196, 229, 229, 0.46)";
    ctx.lineWidth = pixel;

    for (let index = 0; index < 7; index += 1) {
      const phase = (ts / 1300 + index * 0.19) % 1;
      const x = ((index * 149) % width) + Math.sin(ts / 1200 + index) * pixel * 8;
      const y = pondTop + ((index * 83) % Math.max(1, groundY - pondTop));
      const rx = pixel * (7 + phase * 16 + (index % 3) * 4);
      const ry = rx * 0.38;
      ctx.globalAlpha = 1 - phase * 0.78;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, Math.PI * 0.14, Math.PI * 1.75);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  function drawMist(ctx: CanvasRenderingContext2D, width: number, height: number, pixel: number, ts: number) {
    ctx.fillStyle = "rgba(238, 248, 237, 0.08)";
    for (let index = 0; index < 24; index += 1) {
      const drift = (ts / (70 + index * 8)) % (width + pixel * 24);
      const x = (index * 61 + drift) % (width + pixel * 24) - pixel * 12;
      const y = (index * 43) % height;
      const size = pixel * (index % 4 === 0 ? 3 : 2);
      ctx.fillRect(Math.floor(x), Math.floor(y), size, size);
    }
  }

  function drawGround(ctx: CanvasRenderingContext2D, width: number, groundY: number, pixel: number, isPaused: boolean) {
    ctx.shadowColor = isPaused ? "#f1e6c4" : "#8ecbd1";
    ctx.shadowBlur = pixel * 5;
    ctx.fillStyle = isPaused ? "#f1e6c4" : "#8ecbd1";
    ctx.fillRect(0, groundY, width, pixel);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(156, 195, 107, 0.16)";
    ctx.fillRect(0, groundY + pixel * 3, width, pixel * 9);
  }

  function drawPauseOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, isPaused: boolean) {
    if (!isPaused) {
      return;
    }

    ctx.fillStyle = "rgba(7, 20, 15, 0.48)";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#f1e6c4";
    ctx.font = `700 ${Math.max(18, Math.floor(width / 24))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("RAIN RESTING", width / 2, height / 2);
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
      aria-label="Pixel rain pond game canvas"
      onPointerDown={pauseByPointer}
      onPointerUp={resumeByPointer}
      onPointerCancel={resumeByPointer}
      onPointerLeave={resumeByPointer}
    />
  );
}
