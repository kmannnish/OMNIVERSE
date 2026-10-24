'use client';

import React, { useEffect, useRef } from 'react';

interface Galaxy {
  x: number;
  y: number;
  radius: number;
  rotation: number;
  rotationSpeed: number;
  arms: number;
  armSpread: number;
  coreColor: string;
  dustColor: string;
  particleCount: number;
  tilt: number;
}

interface Star {
  x: number;
  y: number;
  baseRadius: number;
  alpha: number;
  twinkleSpeed: number;
  phase: number;
  color: string;
  depth: number;
}

interface MagneticRing {
  baseRadiusX: number;
  baseRadiusY: number;
  tilt: number;
  rotation: number;
  rotationSpeed: number;
  pointCount: number;
  color: string;
}

export function InfiniteGalaxyCanvas() {
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

    // 1. Generate Multi-depth Starfield
    const stars: Star[] = [];
    const starCount = 320;
    const starColors = [
      'rgba(255, 255, 255, ',
      'rgba(254, 240, 138, ', // amber tint
      'rgba(224, 231, 255, ', // cool white
      'rgba(199, 210, 254, ', // soft indigo
    ];

    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseRadius: Math.random() * 1.3 + 0.3,
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.03 + 0.008,
        phase: Math.random() * Math.PI * 2,
        color: starColors[Math.floor(Math.random() * starColors.length)],
        depth: Math.random() * 0.6 + 0.4,
      });
    }

    // 2. Procedural Infinite Galaxies
    const galaxies: Galaxy[] = [
      // Galaxy 1: Grand Golden Spiral (Top Right)
      {
        x: width * 0.82,
        y: height * 0.22,
        radius: Math.min(width, height) * 0.26,
        rotation: 0.4,
        rotationSpeed: 0.0004,
        arms: 2,
        armSpread: 0.32,
        coreColor: 'rgba(251, 191, 36, 0.45)', // warm gold
        dustColor: 'rgba(245, 158, 11, 0.12)',
        particleCount: 220,
        tilt: 0.65,
      },
      // Galaxy 2: Deep Violet/Indigo Elliptical (Bottom Left)
      {
        x: width * 0.16,
        y: height * 0.78,
        radius: Math.min(width, height) * 0.22,
        rotation: 1.2,
        rotationSpeed: -0.0003,
        arms: 3,
        armSpread: 0.28,
        coreColor: 'rgba(192, 132, 252, 0.4)',
        dustColor: 'rgba(99, 102, 241, 0.1)',
        particleCount: 180,
        tilt: 0.45,
      },
      // Galaxy 3: Distant Golden Nebula Cloud (Top Left)
      {
        x: width * 0.24,
        y: height * 0.24,
        radius: Math.min(width, height) * 0.14,
        rotation: 2.1,
        rotationSpeed: 0.0002,
        arms: 2,
        armSpread: 0.4,
        coreColor: 'rgba(245, 158, 11, 0.3)',
        dustColor: 'rgba(217, 119, 6, 0.08)',
        particleCount: 120,
        tilt: 0.7,
      },
      // Galaxy 4: Deep Cosmic Cluster (Bottom Right)
      {
        x: width * 0.76,
        y: height * 0.78,
        radius: Math.min(width, height) * 0.16,
        rotation: 0.8,
        rotationSpeed: 0.0003,
        arms: 2,
        armSpread: 0.35,
        coreColor: 'rgba(253, 230, 138, 0.35)',
        dustColor: 'rgba(180, 83, 9, 0.09)',
        particleCount: 140,
        tilt: 0.55,
      },
    ];

    // 3. Interactive Abstract Magnetic Field Lines (Gravitational Geodesics)
    const magneticRings: MagneticRing[] = [
      {
        baseRadiusX: 260,
        baseRadiusY: 150,
        tilt: -0.22,
        rotation: 0,
        rotationSpeed: 0.0008,
        pointCount: 72,
        color: 'rgba(251, 191, 36, 0.22)',
      },
      {
        baseRadiusX: 340,
        baseRadiusY: 190,
        tilt: 0.18,
        rotation: 0.5,
        rotationSpeed: -0.0006,
        pointCount: 84,
        color: 'rgba(255, 255, 255, 0.16)',
      },
      {
        baseRadiusX: 430,
        baseRadiusY: 230,
        tilt: -0.35,
        rotation: 1.1,
        rotationSpeed: 0.0005,
        pointCount: 96,
        color: 'rgba(245, 158, 11, 0.18)',
      },
      {
        baseRadiusX: 520,
        baseRadiusY: 280,
        tilt: 0.28,
        rotation: 1.8,
        rotationSpeed: -0.0004,
        pointCount: 108,
        color: 'rgba(255, 255, 255, 0.12)',
      },
      {
        baseRadiusX: 620,
        baseRadiusY: 330,
        tilt: -0.15,
        rotation: 2.4,
        rotationSpeed: 0.0003,
        pointCount: 120,
        color: 'rgba(251, 191, 36, 0.14)',
      },
    ];

    let time = 0;

    const render = () => {
      time += 0.016;

      // Smooth mouse position lerping
      mousePos.current.x += (mousePos.current.targetX - mousePos.current.x) * 0.08;
      mousePos.current.y += (mousePos.current.targetY - mousePos.current.y) * 0.08;

      const mx = mousePos.current.x;
      const my = mousePos.current.y;
      const centerX = width / 2;
      const centerY = height / 2;

      // Clear with deep cosmic obsidian
      ctx.fillStyle = '#030304';
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 1: Deep Cosmic Ambient Dust (Warm Amber & Obsidian) ---
      const cosmicGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        40,
        centerX,
        centerY,
        Math.max(width, height) * 0.65
      );
      cosmicGlow.addColorStop(0, 'rgba(40, 24, 6, 0.45)'); // Warm amber core like the reference photo
      cosmicGlow.addColorStop(0.35, 'rgba(18, 12, 4, 0.3)');
      cosmicGlow.addColorStop(0.7, 'rgba(7, 6, 12, 0.2)');
      cosmicGlow.addColorStop(1, 'rgba(3, 3, 4, 0)');
      ctx.fillStyle = cosmicGlow;
      ctx.fillRect(0, 0, width, height);

      // --- LAYER 2: Mouse Cursor Dynamic Spotlight / Gravitational Lensing Light ---
      if (mx > -500 && my > -500) {
        const cursorSpotlight = ctx.createRadialGradient(mx, my, 0, mx, my, 340);
        cursorSpotlight.addColorStop(0, 'rgba(251, 191, 36, 0.14)'); // luminous gold halo
        cursorSpotlight.addColorStop(0.35, 'rgba(217, 119, 6, 0.06)');
        cursorSpotlight.addColorStop(0.7, 'rgba(99, 102, 241, 0.025)');
        cursorSpotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = cursorSpotlight;
        ctx.fillRect(0, 0, width, height);
      }

      // --- LAYER 3: Distant Infinite Galaxies ---
      galaxies.forEach((gal) => {
        gal.rotation += gal.rotationSpeed;

        // Subtle mouse parallax
        const parallaxX = (mx - centerX) * 0.02;
        const parallaxY = (my - centerY) * 0.02;
        const gx = gal.x + parallaxX;
        const gy = gal.y + parallaxY;

        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(gal.rotation);
        ctx.scale(1, gal.tilt);

        // Galactic Core Glow
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, gal.radius * 0.45);
        coreGrad.addColorStop(0, gal.coreColor);
        coreGrad.addColorStop(0.5, gal.dustColor);
        coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, gal.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();

        // Spiral Arms Particle Trails
        for (let a = 0; a < gal.arms; a++) {
          const armAngleOffset = (a * Math.PI * 2) / gal.arms;
          const particlesPerArm = Math.floor(gal.particleCount / gal.arms);

          for (let p = 0; p < particlesPerArm; p++) {
            const distanceRatio = p / particlesPerArm;
            const r = distanceRatio * gal.radius;
            const theta = armAngleOffset + distanceRatio * 3.8 + Math.sin(p * 0.5) * gal.armSpread;
            const px = Math.cos(theta) * r;
            const py = Math.sin(theta) * r;
            const size = (1 - distanceRatio) * 1.5 + 0.4;
            const alpha = (1 - distanceRatio) * 0.5 + 0.1;

            ctx.fillStyle = `rgba(254, 243, 199, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      });

      // --- LAYER 4: Multi-depth Starfield with Parallax Twinkle ---
      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed * 10 + star.phase);
        const currentAlpha = Math.max(0.1, star.alpha + twinkle * 0.25);
        const px = star.x + (mx - centerX) * 0.015 * star.depth;
        const py = star.y + (my - centerY) * 0.015 * star.depth;

        ctx.fillStyle = `${star.color}${currentAlpha})`;
        ctx.beginPath();
        ctx.arc(px, py, star.baseRadius, 0, Math.PI * 2);
        ctx.fill();
      });

      // --- LAYER 5: Interactive Abstract Magnetic Lines (Gravitational Geodesics) ---
      magneticRings.forEach((ring) => {
        ring.rotation += ring.rotationSpeed;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(ring.tilt);

        ctx.beginPath();
        const points: { x: number; y: number }[] = [];

        for (let i = 0; i <= ring.pointCount; i++) {
          const angle = (i / ring.pointCount) * Math.PI * 2 + ring.rotation;
          // Unperturbed base coordinates
          let bx = Math.cos(angle) * ring.baseRadiusX;
          let by = Math.sin(angle) * ring.baseRadiusY;

          // Screen space point position
          // Transform to world space to compute distance to mouse
          const cosT = Math.cos(ring.tilt);
          const sinT = Math.sin(ring.tilt);
          const worldX = centerX + (bx * cosT - by * sinT);
          const worldY = centerY + (bx * sinT + by * cosT);

          // Distance to mouse cursor
          const dx = worldX - mx;
          const dy = worldY - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const influenceRadius = 180;

          // Magnetic attraction / repulsion effect
          if (dist < influenceRadius && dist > 1) {
            const force = (1 - dist / influenceRadius) * 38;
            // Repel / warp away from cursor with magnetic flow
            const warpX = (dx / dist) * force;
            const warpY = (dy / dist) * force;

            // Project back to ring local space
            bx += warpX * cosT + warpY * sinT;
            by += -warpX * sinT + warpY * cosT;
          }

          points.push({ x: bx, y: by });
        }

        // Render smooth curve through points
        if (points.length > 0) {
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
        }

        ctx.closePath();
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1.2;
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
