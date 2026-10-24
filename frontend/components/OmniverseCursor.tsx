'use client';

import React, { useEffect, useState, useRef } from 'react';

export function OmniverseCursor() {
  const [isClient, setIsClient] = useState(false);
  const [isFinePointer, setIsFinePointer] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const mouseCoords = useRef({ x: -100, y: -100 });
  const ringCoords = useRef({ x: -100, y: -100 });
  const animFrameId = useRef<number | null>(null);

  useEffect(() => {
    setIsClient(true);
    // 1. Check if user is on a desktop/mouse device with fine pointer
    const mediaQuery = window.matchMedia('(pointer: fine)');
    setIsFinePointer(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsFinePointer(e.matches);
    };

    mediaQuery.addEventListener('change', handleMediaChange);

    if (!mediaQuery.matches) return;

    // 2. Mouse tracking and interactive hover detection
    const onMouseMove = (e: MouseEvent) => {
      mouseCoords.current.x = e.clientX;
      mouseCoords.current.y = e.clientY;

      if (!isVisible) setIsVisible(true);

      // Check if hovering over interactive elements
      const target = e.target as HTMLElement | null;
      const interactive = !!target?.closest(
        'button, a, input, select, textarea, [role="button"], label, .cursor-pointer, kbd'
      );
      setIsHovered(interactive);
    };

    const onMouseDown = () => setIsMouseDown(true);
    const onMouseUp = () => setIsMouseDown(false);
    const onMouseLeave = () => setIsVisible(false);
    const onMouseEnter = () => setIsVisible(true);

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    // 3. Smooth 60/120fps render loop with lerp and transform3d
    const render = () => {
      // Lerp ring towards mouse with gentle celestial spring
      const lerpFactor = 0.18;
      ringCoords.current.x += (mouseCoords.current.x - ringCoords.current.x) * lerpFactor;
      ringCoords.current.y += (mouseCoords.current.y - ringCoords.current.y) * lerpFactor;

      // Update Paramanu Core Dot (instant exact coordinate, offset by half size: 3px)
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseCoords.current.x - 3}px, ${mouseCoords.current.y - 3}px, 0)`;
      }

      // Update Chidakash Aura Ring (smooth lagging coordinate, offset by half size: 16px)
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringCoords.current.x - 16}px, ${ringCoords.current.y - 16}px, 0)`;
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      mediaQuery.removeEventListener('change', handleMediaChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
    };
  }, [isVisible]);

  // If SSR or mobile touch device, do not render cursor
  if (!isClient || !isFinePointer) return null;

  return (
    <div
      className={`fixed inset-0 pointer-events-none z-[9999] transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      aria-hidden="true"
    >
      {/* 1. The Chidakash Aura (Smooth Lagging Starlight Gold Glow Ring) */}
      <div
        ref={ringRef}
        className={`absolute top-0 left-0 w-8 h-8 rounded-full border transition-all duration-200 ease-out will-change-transform ${
          isHovered
            ? 'scale-135 border-[#F3E5AB]/85 bg-[#F3E5AB]/[0.08] shadow-[0_0_24px_rgba(243,229,171,0.4)]'
            : isMouseDown
            ? 'scale-85 border-[#F3E5AB] bg-[#F3E5AB]/[0.15] shadow-[0_0_20px_rgba(243,229,171,0.3)]'
            : 'scale-100 border-[#F3E5AB]/40 bg-[#F3E5AB]/[0.025] shadow-[0_0_14px_rgba(243,229,171,0.15)]'
        }`}
        style={{
          backdropFilter: 'blur(1px)',
        }}
      />

      {/* 2. The Paramanu (Tiny, Sharp, Solid White Central Core Focal Point) */}
      <div
        ref={dotRef}
        className={`absolute top-0 left-0 w-1.5 h-1.5 rounded-full bg-white transition-transform duration-100 will-change-transform shadow-[0_0_6px_rgba(255,255,255,0.95)] ${
          isHovered ? 'scale-125' : isMouseDown ? 'scale-75' : 'scale-100'
        }`}
      />
    </div>
  );
}
