'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

interface DistantCosmos {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  arms: number;
  tilt: number;
  color: string;
}

interface GeodesicRing {
  radiusX: number;
  radiusY: number;
  tilt: number;
  rotation: number;
  rotationSpeed: number;
  pointCount: number;
  color: string;
}

export function LuminousExpanseCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePos = useRef({ x: -1000, y: -1000, targetX: -1000, targetY: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.targetX = e.clientX;
      mousePos.current.targetY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // 1. Weightless Micro-particles (Atoms floating in pure light - Vachanamrut Gadhada I-41)
    const particles: Particle[] = [];
    const particleCount = 130; // 85% empty space, calm and uncluttered

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: -Math.random() * 0.25 - 0.05, // Slow upward drift like weightless dust in light
        size: Math.random() * 1.5 + 0.4,
        alpha: Math.random() * 0.5 + 0.2,
        baseAlpha: Math.random() * 0.45 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.006,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // 2. Distant Luminous Cosmoses (Infinite Brahmands floating in the Expanse)
    const cosmoses: DistantCosmos[] = [
      {
        x: width * 0.84,
        y: height * 0.2,
        radius: Math.min(width, height) * 0.22,
        rotation: 0.5,
        rotationSpeed: 0.0003,
        arms: 2,
        tilt: 0.55,
        color: 'rgba(255, 244, 214, 0.2)',
      },
      {
        x: width * 0.14,
        y: height * 0.8,
        radius: Math.min(width, height) * 0.18,
        rotation: 1.4,
        rotationSpeed: -0.00025,
        arms: 2,
        tilt: 0.48,
        color: 'rgba(243, 229, 171, 0.16)',
      },
      {
        x: width * 0.22,
        y: height * 0.18,
        radius: Math.min(width, height) * 0.12,
        rotation: 2.2,
        rotationSpeed: 0.0002,
        arms: 2,
        tilt: 0.65,
        color: 'rgba(254, 243, 199, 0.14)',
      },
    ];

    // 3. Delicate Abstract Geodesic Lines (Magnetic Filaments of Chidakash)
    const rings: GeodesicRing[] = [
      {
        radiusX: 280,
        radiusY: 170,
        tilt: -0.2,
        rotation: 0,
        rotationSpeed: 0.0006,
        pointCount: 72,
        color: 'rgba(243, 229, 171, 0.16)',
      },
      {
        radiusX: 370,
        radiusY: 220,
        tilt: 0.15,
        rotation: 0.8,
        rotationSpeed: -0.00045,
        pointCount: 84,
        color: 'rgba(255, 244, 214, 0.12)',
      },
      {
        radiusX: 470,
        radiusY: 270,
        tilt: -0.28,
        rotation: 1.6,
        rotationSpeed: 0.00035,
        pointCount: 96,
        color: 'rgba(243, 229, 171, 0.09)',
      },
      {
        radiusX: 580,
        radiusY: 330,
        tilt: 0.22,
        rotation: 2.3,
        rotationSpeed: -0.00025,
        pointCount: 108,
        color: 'rgba(255, 255, 255, 0.07)',
      },
    ];

    let time = 0;

    const render = () => {
      time += 0.016;

      // Smooth mouse position lerping
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.07;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.07;

      const mx = mousePos.current.x;
      const my = mousePos.current.y;
      const centerX = width / 2;
      const centerY = height / 2;

      // Base: Deep Cosmic Obsidian (#06070B)
      ctx.fillStyle = '#06070B';
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 1: Radiant Core (Chidakash Centered Ambient Effulgence) ---
      const radiantCore = ctx.createRadialGradient(
        centerX,
        centerY,
        20,
        centerX,
        centerY,
        Math.max(width, height) * 0.6
      );
      radiantCore.addColorStop(0, 'rgba(255, 244, 214, 0.07)'); // Warm celestial gold-white
      radiantCore.addColorStop(0.3, 'rgba(243, 229, 171, 0.04)');
      radiantCore.addColorStop(0.65, 'rgba(18, 16, 26, 0.02)');
      radiantCore.addColorStop(1, 'rgba(6, 7, 11, 0)');

      ctx.fillStyle = radiantCore;
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 2: Mouse Cursor Luminous Spotlight (Starlight Gold) ---
      if (mx > -500 && my > -500) {
        const cursorGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 280);
        cursorGlow.addColorStop(0, 'rgba(255, 244, 214, 0.1)'); // Pure warm starlight
        cursorGlow.addColorStop(0.4, 'rgba(243, 229, 171, 0.035)');
        cursorGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = cursorGlow;
        ctx.fillRect(0, 0, width, height);
      }

      // --- LAYER 3: Distant Infinite Cosmoses (Brahmands) ---
      cosmoses.forEach((c) => {
        c.rotation += c.rotationSpeed;

        const parallaxX = (mx - centerX) * 0.015;
        const parallaxY = (my - centerY) * 0.015;

        ctx.save();
        ctx.translate(c.x + parallaxX, c.y + parallaxY);
        ctx.rotate(c.rotation);
        ctx.scale(1, c.tilt);

        // Core glow
        const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, c.radius * 0.4);
        glow.addColorStop(0, c.color);
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, c.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Spiral dust particles
        for (let a = 0; a < c.arms; a++) {
          const armAngle = (a * Math.PI * 2) / c.arms;
          const count = 45;
          for (let p = 0; p < count; p++) {
            const ratio = p / count;
            const r = ratio * c.radius;
            const theta = armAngle + ratio * 3.2;
            const px = Math.cos(theta) * r;
            const py = Math.sin(theta) * r;
            const alpha = (1 - ratio) * 0.28;

            ctx.fillStyle = `rgba(255, 244, 214, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      });

      // --- LAYER 4: Weightless Micro-particles (Atoms in pure light) ---
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around screen boundaries seamlessly
        if (p.y < 0) p.y = height;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;

        const twinkle = Math.sin(time * p.twinkleSpeed * 10 + p.phase);
        const alpha = Math.max(0.08, p.baseAlpha + twinkle * 0.18);

        ctx.fillStyle = `rgba(255, 244, 214, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- LAYER 5: Interactive Magnetic Geodesic Lines (Filaments of Chidakash) ---
      rings.forEach((ring) => {
        ring.rotation += ring.rotationSpeed;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ring.tilt);

        ctx.beginPath();
        const points: { x: number; y: number }[] = [];

        for (let i = 0; i <= ring.pointCount; i++) {
          const angle = (i / ring.pointCount) * Math.PI * 2 + ring.rotation;
          let bx = Math.cos(angle) * ring.radiusX;
          let by = Math.sin(angle) * ring.radiusY;

          // Convert to world space to evaluate mouse distance
          const cosT = Math.cos(ring.tilt);
          const sinT = Math.sin(ring.tilt);
          const worldX = centerX + (bx * cosT - by * sinT);
          const worldY = centerY + (bx * sinT + by * cosT);

          const dx = worldX - mx;
          const dy = worldY - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const radiusOfEffect = 190;

          // Gentle magnetic gravitational lensing
          if (dist < radiusOfEffect && dist > 1) {
            const strength = (1 - dist / radiusOfEffect) * 32;
            const warpX = (dx / dist) * strength;
            const warpY = (dy / dist) * strength;

            bx += warpX * cosT + warpY * sinT;
            by += -warpX * sinT + warpY * cosT;
          }

          points.push({ x: bx, y: by });
        }

        if (points.length > 0) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
        }

        ctx.closePath();
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.restore();
      });

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 block w-full h-full"
    />
  );
}
