"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PrompterScript = { itemId: number; titulo: string; bloques: string[] };

/**
 * Teleprompter a pantalla completa para grabar por lotes: solo el texto que se
 * dice, letra grande y desplazamiento automático.
 * Teclas: espacio = pausa/sigue · ↑/↓ = velocidad · ←/→ = pieza anterior/siguiente · Esc = salir.
 */
export default function Teleprompter({
  scripts,
  onClose,
  onRecorded,
}: {
  scripts: PrompterScript[];
  onClose: () => void;
  onRecorded: (itemId: number) => Promise<void>;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(3); // 1-10
  const [fontSize, setFontSize] = useState(44);
  const [mirror, setMirror] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const script = scripts[idx];

  const go = useCallback(
    (to: number) => {
      if (to < 0 || to >= scripts.length) return;
      setIdx(to);
      setPlaying(false);
      scroller.current?.scrollTo({ top: 0 });
    },
    [scripts.length]
  );

  // Desplazamiento continuo mientras está en marcha.
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const el = scroller.current;
      if (el) {
        el.scrollTop += ((now - last) / 1000) * speed * 12;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) setPlaying(false);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSpeed((s) => Math.min(10, s + 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSpeed((s) => Math.max(1, s - 1));
      } else if (e.key === "ArrowRight") go(idx + 1);
      else if (e.key === "ArrowLeft") go(idx - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, go, onClose]);

  async function recorded() {
    await onRecorded(script.itemId);
    setDone((d) => new Set(d).add(script.itemId));
    if (idx < scripts.length - 1) go(idx + 1);
  }

  if (!script) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-2 text-sm">
        <span className="text-white/50 tabular-nums">
          {idx + 1}/{scripts.length}
        </span>
        <span className="mr-auto max-w-[40ch] truncate font-medium">{script.titulo}</span>
        <button onClick={() => go(idx - 1)} disabled={idx === 0} className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30">
          ← Anterior
        </button>
        <button onClick={() => setPlaying((p) => !p)} className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">
          {playing ? "Pausa" : "▶ Empezar"}
        </button>
        <label className="flex items-center gap-1 text-white/60">
          Velocidad
          <input type="range" min={1} max={10} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} />
        </label>
        <button onClick={() => setFontSize((f) => Math.max(24, f - 6))} className="rounded px-2 py-1 hover:bg-white/10">
          A−
        </button>
        <button onClick={() => setFontSize((f) => Math.min(96, f + 6))} className="rounded px-2 py-1 hover:bg-white/10">
          A+
        </button>
        <button
          onClick={() => setMirror((m) => !m)}
          className={`rounded px-2 py-1 hover:bg-white/10 ${mirror ? "bg-white/10" : ""}`}
          title="Espejo para cristal de teleprompter"
        >
          Espejo
        </button>
        <button
          onClick={recorded}
          disabled={done.has(script.itemId)}
          className="rounded bg-emerald-600 px-3 py-1 font-medium hover:bg-emerald-500 disabled:opacity-50"
        >
          {done.has(script.itemId) ? "✓ Grabado" : "Marcar grabado"}
        </button>
        <button onClick={() => go(idx + 1)} disabled={idx === scripts.length - 1} className="rounded px-2 py-1 hover:bg-white/10 disabled:opacity-30">
          Siguiente →
        </button>
        <button onClick={onClose} className="rounded px-2 py-1 text-white/60 hover:bg-white/10">
          Salir
        </button>
      </div>

      <div ref={scroller} className="relative flex-1 overflow-y-auto">
        {/* Línea de lectura */}
        <div className="pointer-events-none sticky top-[30%] z-10 h-0 border-t border-indigo-500/60" />
        <div
          className="mx-auto max-w-4xl px-6 pb-[70vh] pt-[30vh] leading-snug"
          style={{ fontSize, transform: mirror ? "scaleX(-1)" : undefined }}
        >
          {script.bloques.map((b, i) => (
            <p key={i} className="mb-[1.2em] whitespace-pre-wrap">
              {b}
            </p>
          ))}
        </div>
      </div>
      <p className="border-t border-white/10 px-4 py-1.5 text-center text-xs text-white/40">
        Espacio: pausa · ↑↓: velocidad · ←→: pieza · Esc: salir
      </p>
    </div>
  );
}
