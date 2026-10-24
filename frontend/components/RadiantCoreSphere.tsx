'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface RadiantCoreSphereProps {
  isInspecting?: boolean;
  isProcessing?: boolean;
}

export function RadiantCoreSphere({
  isInspecting = false,
  isProcessing = false,
}: RadiantCoreSphereProps) {
  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center z-10 select-none">
      {/* 1. Serene Chidakash Radiant Aura (Warm Celestial Gold-White) */}
      <div
        className="absolute w-[640px] h-[640px] sm:w-[780px] sm:h-[780px] rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 animate-chidakash"
        style={{
          background:
            'radial-gradient(circle, rgba(255, 244, 214, 0.12) 0%, rgba(243, 229, 171, 0.05) 42%, rgba(6, 7, 11, 0) 72%)',
          filter: 'blur(60px)',
        }}
      />

      {/* 2. Secondary Distant Cosmic Corona */}
      <div
        className="absolute w-[920px] h-[920px] rounded-full -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 opacity-25"
        style={{
          background:
            'radial-gradient(circle, rgba(243, 229, 171, 0.08) 0%, rgba(130, 140, 255, 0.02) 48%, rgba(0, 0, 0, 0) 75%)',
          filter: 'blur(90px)',
        }}
      />

      {/* 3. The Main Radiant Singularity Sphere (Refined Swaminarayan Tatvajnana Chidakash Core) */}
      <motion.div
        animate={{
          scale: isInspecting ? [1, 1.04, 0.98, 1.02] : isProcessing ? [1, 1.015, 1] : [1, 1.015, 1],
          boxShadow: isInspecting
            ? [
                '0 0 60px rgba(255, 244, 214, 0.5), inset 0 0 45px rgba(243, 229, 171, 0.4)',
                '0 0 90px rgba(255, 244, 214, 0.7), inset 0 0 60px rgba(245, 158, 11, 0.55)',
                '0 0 60px rgba(255, 244, 214, 0.5), inset 0 0 45px rgba(243, 229, 171, 0.4)',
              ]
            : [
                '0 0 45px rgba(243, 229, 171, 0.32), 0 0 90px rgba(245, 158, 11, 0.15), inset 0 0 35px rgba(243, 229, 171, 0.25)',
                '0 0 65px rgba(243, 229, 171, 0.45), 0 0 115px rgba(245, 158, 11, 0.22), inset 0 0 45px rgba(243, 229, 171, 0.35)',
                '0 0 45px rgba(243, 229, 171, 0.32), 0 0 90px rgba(245, 158, 11, 0.15), inset 0 0 35px rgba(243, 229, 171, 0.25)',
              ],
        }}
        transition={{
          duration: isInspecting ? 1.4 : 9,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="relative w-72 h-72 sm:w-88 sm:h-88 md:w-[380px] md:h-[380px] rounded-full border border-[#F3E5AB]/75 flex items-center justify-center overflow-hidden transition-all"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(55, 38, 18, 0.35) 0%, rgba(22, 14, 6, 0.65) 45%, #050609 82%)',
        }}
      >
        {/* Glowing Rim Edge (Starlight Gold Event Horizon) */}
        <div className="absolute inset-0 rounded-full border border-white/20 pointer-events-none" />
        <div className="absolute inset-[1px] rounded-full border border-[#F3E5AB]/35 pointer-events-none" />

        {/* Orbital Cosmic Filaments */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 48, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[128%] h-[128%] rounded-full border border-[#F3E5AB]/[0.08] border-dashed"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[112%] h-[112%] rounded-full border border-white/[0.07]"
        />

        {/* Central Divine Stillness Void */}
        <div
          className="w-48 h-48 sm:w-56 sm:h-56 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(14, 10, 4, 0.75) 0%, rgba(5, 6, 9, 0.95) 75%, #030406 100%)',
          }}
        />

        {/* Active Probing Flare */}
        {isInspecting && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#F3E5AB] border-r-white shadow-[0_0_35px_rgba(243,229,171,0.85)]"
          />
        )}
      </motion.div>
    </div>
  );
}
