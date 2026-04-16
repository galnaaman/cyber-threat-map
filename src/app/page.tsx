"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ================================================================== */
/*  DATA                                                               */
/* ================================================================== */
interface Country {
  name: string;
  code: string;
  lat: number;
  lng: number;
  threat: "high" | "medium" | "low";
}

const COUNTRIES: Country[] = [
  { name: "United States", code: "US", lat: 38, lng: -97, threat: "high" },
  { name: "Russia", code: "RU", lat: 56, lng: 38, threat: "high" },
  { name: "China", code: "CN", lat: 35, lng: 105, threat: "high" },
  { name: "Iran", code: "IR", lat: 32, lng: 53, threat: "high" },
  { name: "North Korea", code: "KP", lat: 40, lng: 127, threat: "high" },
  { name: "Israel", code: "IL", lat: 31.5, lng: 34.8, threat: "medium" },
  { name: "Germany", code: "DE", lat: 51, lng: 10, threat: "medium" },
  { name: "UK", code: "GB", lat: 54, lng: -2, threat: "medium" },
  { name: "Brazil", code: "BR", lat: -14, lng: -51, threat: "medium" },
  { name: "India", code: "IN", lat: 21, lng: 78, threat: "medium" },
  { name: "Japan", code: "JP", lat: 36, lng: 138, threat: "low" },
  { name: "Australia", code: "AU", lat: -25, lng: 134, threat: "low" },
  { name: "France", code: "FR", lat: 46, lng: 2, threat: "medium" },
  { name: "Ukraine", code: "UA", lat: 49, lng: 32, threat: "high" },
  { name: "South Korea", code: "KR", lat: 36, lng: 128, threat: "medium" },
  { name: "Turkey", code: "TR", lat: 39, lng: 35, threat: "medium" },
  { name: "Nigeria", code: "NG", lat: 10, lng: 8, threat: "low" },
  { name: "South Africa", code: "ZA", lat: -30, lng: 25, threat: "low" },
  { name: "Canada", code: "CA", lat: 56, lng: -106, threat: "low" },
  { name: "Singapore", code: "SG", lat: 1.3, lng: 103.8, threat: "medium" },
];

const ATTACK_TYPES = [
  { name: "DDoS", color: "#f43f5e", weight: 30 },
  { name: "Ransomware", color: "#f97316", weight: 20 },
  { name: "Phishing", color: "#eab308", weight: 25 },
  { name: "Brute Force", color: "#a855f7", weight: 15 },
  { name: "SQL Injection", color: "#3b82f6", weight: 5 },
  { name: "Zero-Day", color: "#ef4444", weight: 3 },
  { name: "APT", color: "#ec4899", weight: 2 },
];

interface Attack {
  id: number;
  from: Country;
  to: Country;
  type: (typeof ATTACK_TYPES)[number];
  progress: number;
  port: number;
  ip: string;
}

interface LogEntry {
  id: number;
  time: string;
  from: string;
  to: string;
  type: string;
  color: string;
  ip: string;
  port: number;
}

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randIP() {
  return `${randInt(1, 255)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* Mercator projection */
function project(lat: number, lng: number, w: number, h: number): [number, number] {
  const x = (lng + 180) * (w / 360);
  const latRad = (lat * Math.PI) / 180;
  const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
  const y = h / 2 - (w * mercN) / (2 * Math.PI);
  return [x, y];
}

function nowStr() {
  return new Date().toISOString().slice(11, 19);
}

/* ================================================================== */
/*  COMPONENT                                                          */
/* ================================================================== */
export default function CyberMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const attacks = useRef<Attack[]>([]);
  const logs = useRef<LogEntry[]>([]);
  const [logState, setLogState] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, perSec: 0 });
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
  const idCounter = useRef(0);
  const totalCount = useRef(0);
  const recentTimestamps = useRef<number[]>([]);
  const worldImg = useRef<HTMLCanvasElement | null>(null);

  /* ── generate world map on canvas ── */
  const generateWorldMap = useCallback((w: number, h: number): HTMLCanvasElement => {
    const offscreen = document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext("2d")!;

    // dark bg with grid
    ctx.fillStyle = "#030712";
    ctx.fillRect(0, 0, w, h);

    // grid lines
    ctx.strokeStyle = "rgba(16,185,129,0.04)";
    ctx.lineWidth = 0.5;
    for (let lat = -80; lat <= 80; lat += 20) {
      const [, y] = project(lat, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    for (let lng = -180; lng <= 180; lng += 30) {
      const [x] = project(0, lng, w, h);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // country dots
    COUNTRIES.forEach((c) => {
      const [x, y] = project(c.lat, c.lng, w, h);
      // outer glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 20);
      const glowColor = c.threat === "high" ? "rgba(239,68,68," : c.threat === "medium" ? "rgba(234,179,8," : "rgba(16,185,129,";
      grad.addColorStop(0, glowColor + "0.15)");
      grad.addColorStop(1, glowColor + "0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      // dot
      ctx.fillStyle = c.threat === "high" ? "#ef4444" : c.threat === "medium" ? "#eab308" : "#10b981";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      // label
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.font = "9px monospace";
      ctx.fillText(c.code, x + 6, y + 3);
    });

    return offscreen;
  }, []);

  /* ── spawn attack ── */
  const spawnAttack = useCallback(() => {
    let from = pick(COUNTRIES);
    let to = pick(COUNTRIES);
    while (to.code === from.code) to = pick(COUNTRIES);
    const type = pickWeighted(ATTACK_TYPES);
    const port = pick([22, 80, 443, 3306, 3389, 8080, 445, 53, 25, 8443]);
    const ip = randIP();

    const atk: Attack = {
      id: ++idCounter.current,
      from, to, type,
      progress: 0,
      port, ip,
    };
    attacks.current.push(atk);
    totalCount.current++;
    recentTimestamps.current.push(Date.now());

    // log
    const entry: LogEntry = {
      id: atk.id,
      time: nowStr(),
      from: from.code,
      to: to.code,
      type: type.name,
      color: type.color,
      ip, port,
    };
    logs.current = [entry, ...logs.current].slice(0, 50);
    setLogState([...logs.current].slice(0, 12));

    // type counts
    setTypeCounts((prev) => ({
      ...prev,
      [type.name]: (prev[type.name] || 0) + 1,
    }));
  }, []);

  /* ── draw frame ── */
  const draw = useCallback(
    (w: number, h: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      // clear with world map
      if (worldImg.current) {
        ctx.drawImage(worldImg.current, 0, 0);
      } else {
        ctx.fillStyle = "#030712";
        ctx.fillRect(0, 0, w, h);
      }

      // draw active attacks
      const now = Date.now();
      attacks.current = attacks.current.filter((a) => a.progress <= 1.3);

      attacks.current.forEach((atk) => {
        atk.progress += 0.008;
        const [x1, y1] = project(atk.from.lat, atk.from.lng, w, h);
        const [x2, y2] = project(atk.to.lat, atk.to.lng, w, h);

        // curved path
        const cp = { x: (x1 + x2) / 2, y: Math.min(y1, y2) - 60 - Math.abs(x2 - x1) * 0.12 };
        const t = Math.min(atk.progress, 1);

        // trail
        ctx.strokeStyle = atk.type.color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const steps = Math.floor(t * 30);
        for (let i = 1; i <= steps; i++) {
          const st = i / 30;
          const bx = (1 - st) * (1 - st) * x1 + 2 * (1 - st) * st * cp.x + st * st * x2;
          const by = (1 - st) * (1 - st) * y1 + 2 * (1 - st) * st * cp.y + st * st * y2;
          ctx.lineTo(bx, by);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;

        // head dot
        if (t < 1) {
          const hx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cp.x + t * t * x2;
          const hy = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cp.y + t * t * y2;
          ctx.shadowColor = atk.type.color;
          ctx.shadowBlur = 10;
          ctx.fillStyle = atk.type.color;
          ctx.beginPath();
          ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // impact
        if (atk.progress >= 1 && atk.progress < 1.3) {
          const impactAlpha = 1 - (atk.progress - 1) / 0.3;
          const impactR = 15 * (1 - impactAlpha) + 3;
          ctx.strokeStyle = atk.type.color;
          ctx.globalAlpha = impactAlpha * 0.5;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x2, y2, impactR, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      // clean old timestamps for per-sec calc
      recentTimestamps.current = recentTimestamps.current.filter((t) => now - t < 5000);
      const perSec = Math.round(recentTimestamps.current.length / 5);

      setStats({
        total: totalCount.current,
        active: attacks.current.filter((a) => a.progress < 1).length,
        perSec,
      });
    },
    []
  );

  /* ── init ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      worldImg.current = generateWorldMap(canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // spawn attacks at random intervals
    const spawnLoop = () => {
      spawnAttack();
      setTimeout(spawnLoop, randInt(200, 800));
    };
    spawnLoop();

    // render loop
    let raf: number;
    const animate = () => {
      draw(canvas.width, canvas.height);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [draw, spawnAttack, generateWorldMap]);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.015]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* Top bar */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between border-b border-white/[0.04] bg-zinc-950/60 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          <h1 className="font-mono text-sm font-bold tracking-tight text-white/80">
            CYBER THREAT MAP
          </h1>
          <span className="font-mono text-[10px] tracking-wider text-white/20">
            // 8200 DEMO
          </span>
        </div>
        <div className="flex items-center gap-6">
          <Stat label="TOTAL" value={stats.total} />
          <Stat label="ACTIVE" value={stats.active} accent />
          <Stat label="ATK/s" value={stats.perSec} />
        </div>
      </div>

      {/* Attack type legend */}
      <div className="absolute left-5 top-16 z-10 mt-2 flex flex-col gap-1.5">
        {ATTACK_TYPES.map((t) => (
          <div key={t.name} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="font-mono text-[9px] tracking-wider text-white/25">
              {t.name.toUpperCase()}
            </span>
            <span className="font-mono text-[9px] tabular-nums text-white/15">
              {typeCounts[t.name] || 0}
            </span>
          </div>
        ))}
      </div>

      {/* Live log */}
      <div className="absolute bottom-0 right-0 z-10 w-[420px] max-w-[45vw] border-l border-t border-white/[0.04] bg-zinc-950/70 backdrop-blur-md">
        <div className="border-b border-white/[0.04] px-4 py-2">
          <p className="font-mono text-[10px] font-semibold tracking-[0.15em] text-white/30">
            LIVE ATTACK LOG
          </p>
        </div>
        <div className="max-h-[300px] overflow-hidden px-4 py-2">
          {logState.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 border-b border-white/[0.02] py-1.5 font-mono text-[10px]"
            >
              <span className="text-white/15 tabular-nums">{entry.time}</span>
              <span
                className="w-[70px] truncate font-semibold"
                style={{ color: entry.color }}
              >
                {entry.type}
              </span>
              <span className="text-white/30">
                {entry.from}
              </span>
              <span className="text-emerald-400/40">→</span>
              <span className="text-white/30">
                {entry.to}
              </span>
              <span className="text-white/10 tabular-nums">
                {entry.ip}:{entry.port}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom left — built by */}
      <div className="absolute bottom-4 left-5 z-10">
        <p className="font-mono text-[9px] tracking-[0.15em] text-white/10">
          BUILT BY AI AGENT // ZERO HUMAN CODE // DEPLOYED IN MINUTES
        </p>
      </div>
    </div>
  );
}

/* ── Stat pill ── */
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className="font-mono text-[9px] tracking-[0.2em] text-white/20">{label}</p>
      <p
        className={`font-mono text-base font-bold tabular-nums ${
          accent ? "text-emerald-400" : "text-white/70"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}
