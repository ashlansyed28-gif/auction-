import { useEffect, useState } from "react";
import {
  exitFullscreenIfActive,
  isTouchOrMobileViewport,
  requestLandscapeFullscreen,
} from "../utils/orientation";

export function FullscreenLandscapeButton({ className = "" }: { className?: string }) {
  const [isFs, setIsFs] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFs(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const handleToggle = async () => {
    if (isFs) {
      await exitFullscreenIfActive();
    } else {
      await requestLandscapeFullscreen();
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      title="Fullscreen Landscape Mode (Mobile & Tablet)"
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-white/15 text-[11px] font-bold text-slate-200 hover:text-amber-300 cursor-pointer ${className}`}
    >
      <span>{isFs ? "🗗" : "⛶"}</span>
      <span className="hidden sm:inline">{isFs ? "Exit Fullscreen" : "Landscape"}</span>
    </button>
  );
}

export function LandscapeGuard({ children }: { children: React.ReactNode }) {
  const [showPortraitNotice, setShowPortraitNotice] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("ht_portrait_dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const check = () => {
      if (typeof window === "undefined") return;
      const isPortrait = window.innerHeight > window.innerWidth;
      const mobileOrTablet = isTouchOrMobileViewport() && window.innerWidth <= 920;
      setShowPortraitNotice(mobileOrTablet && isPortrait);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  const handleSwitchLandscape = async () => {
    await requestLandscapeFullscreen();
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("ht_portrait_dismissed", "1");
    } catch {}
  };

  return (
    <>
      {children}
      {showPortraitNotice && !dismissed && (
        <div className="fixed inset-0 z-[100] bg-[#070B16]/95 backdrop-blur-lg flex items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full rounded-3xl bg-slate-950 border border-amber-400/45 p-6 space-y-5 shadow-2xl">
            <div className="flex justify-center">
              <div className="w-16 h-24 rounded-2xl border-2 border-amber-400 bg-slate-900 flex flex-col items-center justify-between p-2 rotate-hint-anim shadow-lg shadow-amber-400/20">
                <div className="w-5 h-1 rounded-full bg-slate-600" />
                <span className="text-xl">🏏</span>
                <div className="w-2.5 h-2.5 rounded-full border border-slate-600" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">
                Mobile &amp; Tablet Broadcast View
              </div>
              <h2 className="text-xl font-black text-white">Rotate to Landscape</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Turn your phone or tablet sideways to view the side-by-side Custom Room squad board, live chat, and
                auction podium just like desktop.
              </p>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleSwitchLandscape}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
              >
                ⛶ Lock Fullscreen Landscape
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="w-full py-2 rounded-xl bg-slate-900 border border-white/15 text-[11px] font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Continue in Portrait Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
