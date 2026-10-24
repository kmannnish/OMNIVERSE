'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface BlackHoleSphereProps {
  isInspecting?: boolean;
  isProcessing?: boolean;
  progress?: number;
}

export function BlackHoleSphere({
  isInspecting = false,
  isProcessing = false,
  progress = 0,
}: BlackHoleSphereProps) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-10 select-none">
      {/* 1. Deep Cosmic Warm Ambient Halo (Reference Image Tone) */}
      <div
        className="absolute w-[620px] h-[620px] sm:w-[750px] sm:h-[750px] rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 animate-horizon"
        style={{
          background:
            'radial-gradient(circle, rgba(217, 119, 6, 0.18) 0%, rgba(180, 83, 9, 0.08) 40%, rgba(3, 3, 4, 0) 70%)',
          filter: 'blur(55px)',
        }}
      />

      {/* 2. Secondary Distant Violet/Amber Relativistic Corona */}
      <div
        className="absolute w-[900px] h-[900px] rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 opacity-30"
        style={{
          background:
            'radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, rgba(99, 102, 241, 0.04) 45%, rgba(0, 0, 0, 0) 75%)',
          filter: 'blur(80px)',
        }}
      />

      {/* 3. The Main Black Hole Sphere (Direct Re-creation of Reference Photo) */}
      <motion.div
        animate={{
          scale: isInspecting ? [1, 1.05, 0.98, 1.02] : isProcessing ? [1, 1.02, 1] : [1, 1.02, 1],
          boxShadow: isInspecting
            ? [
                '0 0 60px rgba(251, 191, 36, 0.5), inset 0 0 45px rgba(217, 119, 6, 0.45)',
                '0 0 90px rgba(251, 191, 36, 0.75), inset 0 0 65px rgba(245, 158, 11, 0.65)',
                '0 0 60px rgba(251, 191, 36, 0.5), inset 0 0 45px rgba(217, 119, 6, 0.45)',
              ]
            : [
                '0 0 40px rgba(245, 158, 11, 0.35), 0 0 80px rgba(217, 119, 6, 0.2), inset 0 0 35px rgba(180, 83, 9, 0.35)',
                '0 0 60px rgba(245, 158, 11, 0.5), 0 0 110px rgba(217, 119, 6, 0.28), inset 0 0 50px rgba(180, 83, 9, 0.45)',
                '0 0 40px rgba(245, 158, 11, 0.35), 0 0 80px rgba(217, 119, 6, 0.2), inset 0 0 35px rgba(180, 83, 9, 0.35)',
              ],
        }}
        transition={{
          duration: isInspecting ? 1.4 : 7,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative w-72 h-72 sm:w-88 sm:h-88 md:w-[380px] md:h-[380px] rounded-full border border-amber-200/80 flex items-center justify-center overflow-hidden transition-all"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(68, 36, 12, 0.42) 0%, rgba(30, 15, 4, 0.75) 45%, #020203 82%)',
        }}
      >
        {/* Glowing Rim Edge (Event Horizon Light Ring) */}
        <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
        <div className="absolute inset-[1px] rounded-full border border-amber-400/30 pointer-events-none" />

        {/* Accretion Disk Orbital Dust Rings */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[130%] h-[130%] rounded-full border border-amber-300/[0.07] border-dashed"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[112%] h-[112%] rounded-full border border-white/[0.08]"
        />

        {/* Gravitational Core Void */}
        <div
          className="w-48 h-48 sm:w-56 sm:h-56 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(15, 8, 2, 0.85) 0%, rgba(3, 3, 4, 0.98) 75%, #000000 100%)',
          }}
        />

        {/* State Flare when inspecting */}
        {isInspecting && (
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.15, 1] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-300 border-r-white shadow-[0_0_30px_rgba(251,191,36,0.8)]"
          />
        )}
      </motion.div>
    </div>
  );
}
