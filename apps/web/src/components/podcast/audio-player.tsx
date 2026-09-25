"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Chapter {
  title: string;
  start_seconds: number;
  end_seconds: number;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  arxivId,
  chapters = [],
  duration: knownDuration,
}: {
  src: string;
  arxivId: string;
  chapters?: Chapter[];
  duration?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(knownDuration ?? 0);
  const [speed, setSpeed] = useState<number>(1);
  const [ready, setReady] = useState(false);
  const playReported = useRef(false);

  const storageKey = `podcast-progress:${arxivId}`;

  // Restaura posição salva
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    const seconds = Number.parseFloat(saved);
    // Ignora se estava quase no fim — quem terminou quer recomeçar
    if (Number.isFinite(seconds) && seconds > 5) {
      setCurrent(seconds);
      if (audioRef.current) audioRef.current.currentTime = seconds;
    }
  }, [storageKey]);

  // Salva a cada 5 segundos de reprodução
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.currentTime > 5 && audio.currentTime < audio.duration - 10) {
        localStorage.setItem(storageKey, String(audio.currentTime));
      } else if (audio.currentTime >= audio.duration - 10) {
        localStorage.removeItem(storageKey);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [playing, storageKey]);

  // Media Session — controles na tela de bloqueio do celular
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;

    navigator.mediaSession.setActionHandler("play", () => void play());
    navigator.mediaSession.setActionHandler("pause", () => pause());
    navigator.mediaSession.setActionHandler("seekbackward", () => skip(-15));
    navigator.mediaSession.setActionHandler("seekforward", () => skip(30));

    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
    };
  }, []);

  const reportPlay = useCallback(() => {
    if (playReported.current) return;
    playReported.current = true;
    const base = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/+$/, "");
    void fetch(`${base}/v1/podcasts/${arxivId}/play`, { method: "POST" }).catch(
      () => {},
    );
  }, [arxivId]);

  async function play() {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setPlaying(true);
      reportPlay();
    } catch {
      // Autoplay bloqueado — o usuário precisa clicar
    }
  }

  function pause() {
    audioRef.current?.pause();
    setPlaying(false);
  }

  function toggle() {
    if (playing) pause();
    else void play();
  }

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.currentTime + seconds, audio.duration || 0),
    );
  }

  function seekTo(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setCurrent(seconds);
  }

  function changeSpeed(next: number) {
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  const activeChapter = chapters.findIndex(
    (c) => current >= c.start_seconds && current < c.end_seconds,
  );

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const audio = e.currentTarget;
          if (Number.isFinite(audio.duration)) setDuration(audio.duration);
          setReady(true);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          localStorage.removeItem(storageKey);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />

      {/* Controles: o botão redondo ecoa o anel do cursor */}
      <div className="flex flex-wrap items-center gap-x-[calc(22*var(--px))] gap-y-3">
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? "Pause" : "Play"}
          className="op-play"
        >
          {playing ? (
            <svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="4.5" height="16" />
              <rect x="9.5" y="0" width="4.5" height="16" />
            </svg>
          ) : (
            <svg width="12" height="14" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true">
              <path d="M1 0 L14 8 L1 16 Z" />
            </svg>
          )}
        </button>

        <button type="button" onClick={() => skip(-15)} disabled={!ready} className="op-link">
          −15
        </button>
        <button type="button" onClick={() => skip(30)} disabled={!ready} className="op-link">
          +30
        </button>

        <span className="op-label tnum ml-auto">
          {formatTime(current)} / {formatTime(duration)}
        </span>

        <div className="op-label flex gap-[calc(12*var(--px))]" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => changeSpeed(s)}
              aria-pressed={speed === s}
              className={`tnum border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] transition-colors ${
                speed === s ? "text-accent" : "text-subtle hover:text-foreground"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Trilho de progresso: um fio, marcas de capítulo em ink-3 */}
      <div
        className="op-track mt-[calc(22*var(--px))]"
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") skip(5);
          if (e.key === "ArrowLeft") skip(-5);
        }}
        onClick={(e) => {
          if (duration <= 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          seekTo(ratio * duration);
        }}
      >
        <div className="op-track-fill" style={{ width: `${progress}%` }} />
        {duration > 0 &&
          chapters.map((c) => (
            <div
              key={c.title}
              className="op-track-tick"
              style={{ left: `${(c.start_seconds / duration) * 100}%` }}
            />
          ))}
      </div>

      {/* Capítulos */}
      {chapters.length > 0 && (
        <ol className="m-0 mt-[calc(18*var(--px))] list-none border-b border-border p-0">
          {chapters.map((c, i) => (
            <li key={c.title}>
              <button
                type="button"
                onClick={() => {
                  seekTo(c.start_seconds);
                  if (!playing) void play();
                }}
                aria-current={activeChapter === i ? "true" : undefined}
                className="op-chapter"
              >
                <span className="op-label tnum flex-none">{formatTime(c.start_seconds)}</span>
                <span>{c.title}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
