'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SingularityOrbProps {
  isInspecting?: boolean;
}

export function SingularityOrb({ isInspecting = false }: SingularityOrbProps) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
      {/* Noise / Grain overlay */}
      <div className="absolute inset-0 cosmic-grain pointer-events-none z-10" />

      {/* Primary Event Horizon Breathing Glow */}
      <div
        className="absolute top-1/2 left-1/2 w-[720px] h-[720px] rounded-full animate-horizon -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            'radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(130, 140, 255, 0.05) 35%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* Secondary Distant Cosmic Corona */}
      <div
        className="absolute top-1/2 left-1/2 w-[1100px] h-[1100px] rounded-full -translate-x-1/2 -translate-y-1/2 opacity-20"
        style={{
          background:
            'radial-gradient(circle, rgba(99, 102, 241, 0.06) 0%, rgba(168, 85, 247, 0.02) 40%, rgba(0, 0, 0, 0) 70%)',
          filter: 'blur(80px)',
        }}
      />

      {/* Faint Orbital Photon Dust Rings */}
      <div className="absolute top-1/2 left-1/2 w-[520px] h-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.03] animate-spin-slow" />
      <div className="absolute top-1/2 left-1/2 w-[340px] h-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04] border-dashed animate-spin-reverse" />

      {/* Central Gravitational Well Core */}
      <motion.div
        animate={{
          scale: isInspecting ? [1, 1.25, 0.9, 1] : [1, 1.05, 1],
          opacity: isInspecting ? 0.9 : 0.4,
        }}
        transition={{
          duration: isInspecting ? 1.6 : 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/2 left-1/2 w-48 h-48 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.01) 50%, rgba(0, 0, 0, 0) 100%)',
          filter: 'blur(20px)',
        }}
      />
    </div>
  );
}
