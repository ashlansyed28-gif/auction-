export async function requestLandscapeFullscreen(): Promise<boolean> {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  let locked = false;
  try {
    const docEl = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!document.fullscreenElement) {
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
      } else if (docEl.webkitRequestFullscreen) {
        await docEl.webkitRequestFullscreen();
      }
    }
  } catch {
    // Fullscreen may be blocked outside user gesture or on iOS Safari
  }
  try {
    const orientation = window.screen?.orientation as ScreenOrientation & {
      lock?: (orientation: "landscape" | "landscape-primary") => Promise<void>;
    };
    if (orientation?.lock) {
      await orientation.lock("landscape");
      locked = true;
    }
  } catch {
    // Some browsers disallow orientation.lock outside standalone PWA
  }
  return locked;
}

export async function exitFullscreenIfActive(): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {}
}

export function isTouchOrMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const touchPoints = navigator.maxTouchPoints > 0;
  return coarse || touchPoints || window.innerWidth <= 1024;
}
