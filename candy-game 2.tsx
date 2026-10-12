"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import {
  GOAL,
  MOVES,
  SIZE,
  collapse,
  findMatches,
  findMove,
  generateBoard,
  swapTiles,
  toGrid,
  type Tile,
} from "@/lib/game";

/* ---------- visual config ---------- */

const PALETTE = [
  { name: "Blue", from: "#5aa9ff", to: "#0a5cff", glow: "rgba(10,92,255,0.55)" },
  { name: "Pink", from: "#ff6fb1", to: "#e0006f", glow: "rgba(224,0,111,0.5)" },
  { name: "Amber", from: "#ffd166", to: "#f59300", glow: "rgba(245,147,0,0.5)" },
  { name: "Mint", from: "#7bf5d9", to: "#00a884", glow: "rgba(0,168,132,0.5)" },
  { name: "Violet", from: "#b894ff", to: "#6d28d9", glow: "rgba(109,40,217,0.55)" },
] as const;

const SHAPES = ["circle", "square", "triangle", "diamond", "hexagon"] as const;

function Shape({ kind, mode }: { kind: number; mode: "base" | "shine" }) {
  const common =
    mode === "base"
      ? {
          fill: `url(#prism-g${kind})`,
          stroke: `url(#prism-g${kind})`,
          strokeWidth: 10,
          strokeLinejoin: "round" as const,
        }
      : { fill: "url(#prism-shine)", stroke: "none" };

  switch (kind) {
    case 0:
      return <circle cx="50" cy="50" r="33" {...common} />;
    case 1:
      return <rect x="19" y="19" width="62" height="62" rx="18" {...common} />;
    case 2:
      return <polygon points="50,20 81,76 19,76" {...common} />;
    case 3:
      return <polygon points="50,17 83,50 50,83 17,50" {...common} />;
    default:
      return <polygon points="50,15 80,32.5 80,67.5 50,85 20,67.5 20,32.5" {...common} />;
  }
}

function Gem({ kind }: { kind: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className="animate-pop size-full"
      style={{ filter: `drop-shadow(0 4px 10px ${PALETTE[kind].glow})` }}
      aria-hidden
    >
      <Shape kind={kind} mode="base" />
      <Shape kind={kind} mode="shine" />
    </svg>
  );
}

function GemDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        {PALETTE.map((p, i) => (
          <linearGradient key={p.name} id={`prism-g${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={p.from} />
            <stop offset="1" stopColor={p.to} />
          </linearGradient>
        ))}
        <linearGradient id="prism-shine" x1="0" y1="0" x2="0.75" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ---------- helpers ---------- */

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const BEST_KEY = "prism:best";
const fmt = (n: number) => n.toLocaleString("en-US");

function useCountUp(value: number, ms = 450) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(a + (value - a) * eased);
      from.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return display;
}

type Popup = { id: number; x: number; y: number; text: string };

/* ---------- component ---------- */

export function CandyGame() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MOVES);
  const [best, setBest] = useState(0);
  const [combo, setCombo] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<number[]>([]);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<"playing" | "over">("playing");

  // Mirrors of state so async game loops always read the latest values.
  const tilesRef = useRef<Tile[]>([]);
  const scoreRef = useRef(0);
  const movesRef = useRef(MOVES);
  const bestRef = useRef(0);
  const selectedRef = useRef<number | null>(null);
  const statusRef = useRef<"playing" | "over">("playing");
  const busyRef = useRef(false);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const popupId = useRef(0);
  const swapRef = useRef<(a: number, b: number) => Promise<void>>(async () => {});

  const shownScore = useCountUp(score);

  const commit = (next: Tile[]) => {
    tilesRef.current = next;
    setTiles(next);
  };
  const pick = (id: number | null) => {
    selectedRef.current = id;
    setSelected(id);
  };
  const flash = (text: string) => {
    setNotice(text);
    setTimeout(() => setNotice((n) => (n === text ? null : n)), 2600);
  };

  /* --- game flow --- */

  const newGame = () => {
    busyRef.current = false;
    statusRef.current = "playing";
    scoreRef.current = 0;
    movesRef.current = MOVES;
    setStatus("playing");
    setScore(0);
    setMoves(MOVES);
    setCombo(0);
    setHint([]);
    setNotice(null);
    pick(null);
    commit(generateBoard());
  };

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(BEST_KEY) ?? 0);
      bestRef.current = saved;
      setBest(saved);
    } catch {
      /* storage unavailable */
    }
    newGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    statusRef.current = "over";
    setStatus("over");
    if (scoreRef.current > bestRef.current) {
      bestRef.current = scoreRef.current;
      setBest(scoreRef.current);
      try {
        localStorage.setItem(BEST_KEY, String(scoreRef.current));
      } catch {
        /* ignore */
      }
    }
  };

  /** Clear matches, drop tiles, refill, repeat until the board is stable. */
  const resolve = async () => {
    let level = 0;

    while (true) {
      const groups = findMatches(toGrid(tilesRef.current));
      if (groups.length === 0) break;
      level++;

      const hit = new Set(groups.flat().map((t) => t.id));
      const gained = hit.size * 10 * level;
      scoreRef.current += gained;
      setScore(scoreRef.current);
      setCombo(level);

      const cleared = tilesRef.current.filter((t) => hit.has(t.id));
      const cx = cleared.reduce((s, t) => s + t.col, 0) / cleared.length;
      const cy = cleared.reduce((s, t) => s + t.row, 0) / cleared.length;
      const pid = ++popupId.current;
      setPopups((p) => [...p, { id: pid, x: cx, y: cy, text: `+${gained}` }]);
      setTimeout(() => setPopups((p) => p.filter((x) => x.id !== pid)), 950);

      commit(tilesRef.current.map((t) => (hit.has(t.id) ? { ...t, clearing: true } : t)));
      await sleep(280);

      const remaining = tilesRef.current.filter((t) => !hit.has(t.id));
      const { final, entering } = collapse(remaining);
      commit([...remaining, ...entering]); // new tiles mount above the board…
      await sleep(50);
      commit(final); // …then everything falls into place
      await sleep(360);
    }

    setTimeout(() => setCombo(0), 700);
  };

  const attemptSwap = async (aId: number, bId: number) => {
    if (busyRef.current || statusRef.current !== "playing") return;
    busyRef.current = true;
    pick(null);
    setHint([]);

    commit(swapTiles(tilesRef.current, aId, bId));
    await sleep(280);

    if (findMatches(toGrid(tilesRef.current)).length === 0) {
      // not a valid move: slide back, no move spent
      commit(swapTiles(tilesRef.current, aId, bId));
      await sleep(280);
      busyRef.current = false;
      return;
    }

    movesRef.current -= 1;
    setMoves(movesRef.current);
    await resolve();

    if (movesRef.current === 0) {
      finish();
    } else if (!findMove(toGrid(tilesRef.current))) {
      flash("No moves left, so the board was reshuffled.");
      commit(generateBoard());
      await sleep(300);
    }
    busyRef.current = false;
  };
  swapRef.current = attemptSwap;

  /* --- input --- */

  const select = (tile: Tile) => {
    if (busyRef.current || statusRef.current !== "playing") return;
    const current = selectedRef.current;

    if (current === tile.id) return pick(null);

    if (current !== null) {
      const other = tilesRef.current.find((t) => t.id === current);
      if (other && Math.abs(other.row - tile.row) + Math.abs(other.col - tile.col) === 1) {
        void attemptSwap(other.id, tile.id);
        return;
      }
    }
    pick(tile.id);
  };

  const onPointerDown = (e: React.PointerEvent, tile: Tile) => {
    select(tile);
    if (selectedRef.current === tile.id) {
      dragRef.current = { id: tile.id, x: e.clientX, y: e.clientY };
    }
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      dragRef.current = null;

      const src = tilesRef.current.find((t) => t.id === d.id);
      if (!src) return;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      const row = src.row + (horizontal ? 0 : Math.sign(dy));
      const col = src.col + (horizontal ? Math.sign(dx) : 0);
      const dst = tilesRef.current.find((t) => t.row === row && t.col === col);
      if (dst) void swapRef.current(src.id, dst.id);
    };
    const end = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  const showHint = () => {
    if (busyRef.current || statusRef.current !== "playing") return;
    const grid = toGrid(tilesRef.current);
    const move = findMove(grid);
    if (!move) return;
    const ids = move.map((p) => grid[p.row][p.col]!.id);
    setHint(ids);
    setTimeout(() => setHint((h) => (h === ids || h.join() === ids.join() ? [] : h)), 2600);
  };

  /* --- derived --- */

  const progress = Math.min(1, score / GOAL);
  const reached = score >= GOAL;
  const lowMoves = moves <= 5;

  return (
    <div className="mx-auto grid w-full max-w-[880px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-6">
      <GemDefs />

      {/* ---------- board ---------- */}
      <div className="relative mx-auto w-full max-w-[560px]">
        <div
          aria-hidden
          className="absolute -inset-8 -z-10 rounded-[40px] bg-gradient-to-br from-blue-600/25 via-transparent to-pink-600/20 blur-3xl"
        />
        <div className="rounded-3xl bg-gradient-to-b from-white/20 via-white/[0.06] to-white/[0.02] p-px shadow-2xl shadow-black/60">
          <div className="rounded-[23px] bg-neutral-950 p-2.5 sm:p-3">
            <div
              role="group"
              aria-label="Game board"
              className="relative aspect-square w-full touch-none overflow-hidden rounded-2xl select-none"
            >
              {/* cell backdrop */}
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
                {Array.from({ length: SIZE * SIZE }, (_, i) => (
                  <div key={i} className="p-[4%]">
                    <div className="size-full rounded-xl bg-white/[0.035]" />
                  </div>
                ))}
              </div>

              {/* tiles */}
              {tiles.map((t) => {
                const isSel = selected === t.id;
                const isHint = hint.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    tabIndex={t.row < 0 ? -1 : 0}
                    aria-label={`${PALETTE[t.kind].name} ${SHAPES[t.kind]}, row ${t.row + 1}, column ${t.col + 1}`}
                    aria-pressed={isSel}
                    onPointerDown={(e) => onPointerDown(e, t)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(t);
                      }
                    }}
                    className="group absolute top-0 left-0 cursor-pointer p-[7%] outline-none"
                    style={{
                      width: `${100 / SIZE}%`,
                      height: `${100 / SIZE}%`,
                      transform: `translate(${t.col * 100}%, ${t.row * 100}%)`,
                      transition: "transform 300ms cubic-bezier(0.3, 1.15, 0.5, 1)",
                    }}
                  >
                    <div
                      className={cn(
                        "size-full rounded-xl transition-[scale,opacity,rotate,background-color,box-shadow] duration-200 ease-out",
                        "group-focus-visible:ring-2 group-focus-visible:ring-white",
                        isSel && "scale-110 bg-white/10 ring-1 ring-white/40",
                        isHint && "animate-hint",
                        t.clearing && "scale-0 rotate-90 opacity-0",
                      )}
                    >
                      <Gem kind={t.kind} />
                    </div>
                  </button>
                );
              })}

              {/* score popups */}
              {popups.map((p) => (
                <span
                  key={p.id}
                  className="animate-float-up pointer-events-none absolute z-10 font-mono text-lg font-semibold text-white tabular-nums [text-shadow:0_2px_12px_rgb(0_0_0/0.7)]"
                  style={{
                    left: `${((p.x + 0.5) / SIZE) * 100}%`,
                    top: `${((p.y + 0.5) / SIZE) * 100}%`,
                  }}
                >
                  {p.text}
                </span>
              ))}

              {/* notice */}
              {notice && (
                <div
                  role="status"
                  className="animate-fade-in absolute inset-x-0 top-3 z-20 mx-auto w-fit max-w-[90%] rounded-full border border-white/15 bg-black/70 px-4 py-1.5 text-center text-[13px] text-neutral-200 backdrop-blur-md"
                >
                  {notice}
                </div>
              )}

              {/* game over */}
              {status === "over" && (
                <div className="animate-fade-in absolute inset-0 z-30 flex items-center justify-center bg-black/65 p-6 backdrop-blur-md">
                  <div className="w-full max-w-xs text-center">
                    <p className="text-sm text-neutral-400">
                      {reached ? "Goal reached" : "Out of moves"}
                    </p>
                    <p className="mt-2 bg-gradient-to-b from-white to-white/50 bg-clip-text text-6xl font-semibold tracking-tighter text-transparent tabular-nums">
                      {fmt(score)}
                    </p>
                    <p className="mt-2 text-sm text-neutral-400">
                      {score > 0 && score >= best
                        ? "New best score"
                        : `Best score ${fmt(best)}`}
                    </p>
                    <button
                      type="button"
                      onClick={newGame}
                      className="mt-6 inline-flex h-10 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-black transition-colors hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
                    >
                      Play again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mt-4 text-center text-[13px] text-neutral-500">
          Click two neighbours or drag a tile to swap. Keyboard: Tab, then Enter.
        </p>
      </div>

      {/* ---------- panel ---------- */}
      <aside className="order-first grid grid-cols-2 gap-3 lg:order-last lg:grid-cols-1">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[13px] text-neutral-400">Score</p>
          <p className="mt-1 font-mono text-3xl font-medium tracking-tight tabular-nums">
            {fmt(shownScore)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-[13px] text-neutral-400">Moves left</p>
          <p
            className={cn(
              "mt-1 font-mono text-3xl font-medium tracking-tight tabular-nums transition-colors",
              lowMoves && "text-amber-400",
            )}
          >
            {moves}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 lg:col-span-1">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-neutral-400">{reached ? "Goal reached" : "Goal"}</span>
            <span className="font-mono text-neutral-300 tabular-nums">
              {fmt(Math.min(score, GOAL))} / {fmt(GOAL)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={GOAL}
            aria-valuenow={Math.min(score, GOAL)}
            aria-label="Progress to goal"
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-pink-500 transition-[width] duration-500 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-3 flex h-6 items-center justify-between text-[13px]">
            <span className="text-neutral-500">Best {fmt(best)}</span>
            {combo >= 2 && (
              <span
                key={combo}
                className="animate-pop rounded-full bg-gradient-to-r from-blue-500/25 to-pink-500/25 px-2.5 py-0.5 font-mono text-xs font-medium text-white ring-1 ring-white/15"
              >
                Chain ×{combo}
              </span>
            )}
          </div>
        </div>

        <div className="col-span-2 flex gap-3 lg:col-span-1 lg:flex-col">
          <button
            type="button"
            onClick={showHint}
            disabled={status !== "playing"}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full border border-white/15 text-sm font-medium text-white transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none disabled:opacity-40"
          >
            Show a move
          </button>
          <button
            type="button"
            onClick={newGame}
            className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-white text-sm font-medium text-black transition-colors hover:bg-neutral-200 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black focus-visible:outline-none"
          >
            New game
          </button>
        </div>
      </aside>
    </div>
  );
}
