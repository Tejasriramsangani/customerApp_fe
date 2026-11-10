"use client";

import { Button } from '../ui';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sparkles, ArrowRight, Truck, Scale, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

interface HeroPromoCarouselProps {
  areaName: string;
  onBookPickup: () => void;
}

export const HeroPromoCarousel: React.FC<HeroPromoCarouselProps> = ({
  areaName,
  onBookPickup,
}) => {
  const [activeBanner, setActiveBanner] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const reducedMotion = useReducedMotion();

  const banners = [
    {
      id: 1,
      badge: "REAL WEIGHT. REAL VALUE.",
      headline: "Turn Your Scrap Into Real Value",
      subtext: `Book certified doorstep scrap pickup in ${areaName || 'Vijayawada'} with live market rates.`,
      cta: "Book a Pickup",
      icon: <Truck className="w-36 h-36 text-emerald-400 stroke-[1]" />,
    },
    {
      id: 2,
      badge: "DIGITAL PRECISION",
      headline: "Zero Weight Fraud Guarantee",
      subtext: "ISO certified Bluetooth weighing scales with digital receipt generated on the spot.",
      cta: "Schedule Now",
      icon: <Scale className="w-36 h-36 text-amber-400 stroke-[1]" />,
    },
    {
      id: 3,
      badge: "INSTANT SETTLEMENT",
      headline: "Cash or Direct UPI Payout",
      subtext: "Receive money in your hand or UPI account the instant your scrap is weighed.",
      cta: "Sell Scrap Today",
      icon: <ShieldCheck className="w-36 h-36 text-teal-300 stroke-[1]" />,
    },
  ];

  // Auto-advance banner every 6s
  useEffect(() => {
    if (isPaused || reducedMotion) return;
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [banners.length, isPaused, reducedMotion]);

  return (
    <div className="relative w-full rounded-2xl bg-brand text-white p-6 shadow-sm overflow-hidden">
      {/* Ambient Radial Highlights */}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeBanner}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 max-w-[85%] md:max-w-lg"
        >
          {/* Brand Logo in Banner */}
          <div className="mb-2.5">
            <BrandLogo variant="light" size="sm" />
          </div>

          {/* Headline */}
          <h2 className="text-2xl md:text-3xl font-extrabold leading-tight">
            {banners[activeBanner].headline}
          </h2>

          {/* Subtext */}
          <p className="text-xs text-emerald-100/80 mt-1.5 leading-relaxed">
            {banners[activeBanner].subtext}
          </p>

          {/* CTA Button */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onBookPickup}
            className="mt-3.5 px-4 py-2 rounded-xl bg-gold text-slate-950 text-xs font-bold shadow-lg  flex items-center gap-1.5 hover:brightness-105 transition-all"
          >
            <span>{banners[activeBanner].cta}</span>
            <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </motion.button>
        </motion.div>
      </AnimatePresence>

      {/* Decorative SVG Graphic */}
      <div className="absolute -right-6 -bottom-4 opacity-30 pointer-events-none">
        {banners[activeBanner].icon}
      </div>

      {/* Pagination Dots */}
      <div className="relative mt-3 flex items-center justify-between z-20">
        <Button className="text-xs text-white px-2" onClick={() => setIsPaused(value => !value)} aria-pressed={isPaused}>{isPaused ? 'Play slides' : 'Pause slides'}</Button>
        <div className="flex items-center">
        {banners.map((_, idx) => (
          <Button
            key={idx}
            onClick={() => setActiveBanner(idx)}
            className="w-11 h-11 bg-transparent"
            aria-label={`Slide ${idx + 1}`}
            aria-current={activeBanner === idx ? 'step' : undefined}
          ><span className={`block h-1.5 rounded-full transition-all ${activeBanner === idx ? 'w-5 bg-gold' : 'w-1.5 bg-emerald-300'}`} /></Button>
        ))}
        </div>
      </div>
    </div>
  );
};
