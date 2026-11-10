"use client";

import { useEffect } from 'react';

/** Layout only: follow the visible viewport when the browser chrome or keyboard changes. */
export function MobileViewport() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    const resize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = window.visualViewport?.height ?? window.innerHeight;
        root.style.setProperty('--customer-viewport-height', `${height}px`);
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.matches('input, textarea, select')) {
          active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      });
    };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      root.style.removeProperty('--customer-viewport-height');
    };
  }, []);
  return null;
}
