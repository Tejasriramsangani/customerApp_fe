"use client";

import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, RefreshCw, AlertCircle, ShoppingBag, Package, Boxes, Container, Truck } from 'lucide-react';
import { usePickupBooking, WeightRangeItem } from '../../context/PickupBookingContext';

interface WeightRangeStepProps {
  onBack: () => void;
  onNext: () => void;
}

/** Icon + tint per size tier, small bag -> large load. Keeps the list scannable at a glance. */
const TIERS = [
  { Icon: ShoppingBag, tint: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { Icon: Package, tint: 'bg-lime-50 text-lime-700 border-lime-100' },
  { Icon: Boxes, tint: 'bg-amber-50 text-amber-700 border-amber-100' },
  { Icon: Container, tint: 'bg-orange-50 text-orange-700 border-orange-100' },
  { Icon: Truck, tint: 'bg-rose-50 text-rose-700 border-rose-100' },
] as const;

const tierIndex = (minKg: number) => (minKg >= 50 ? 4 : minKg >= 30 ? 3 : minKg >= 20 ? 2 : minKg >= 10 ? 1 : 0);

const WeightVisual: React.FC<{ item: WeightRangeItem; selected: boolean }> = ({ item, selected }) => {
  const { Icon, tint } = TIERS[tierIndex(item.minKg)];
  return (
    <div
      className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${
        selected ? 'bg-[#0A3D2B] text-white border-[#0A3D2B] shadow-md shadow-emerald-950/20' : tint
      }`}
      aria-hidden
    >
      <Icon className="w-6 h-6 stroke-[1.9]" />
    </div>
  );
};

export const WeightRangeStep: React.FC<WeightRangeStepProps> = ({ onBack, onNext }) => {
  const {
    state,
    weightRanges,
    isCatalogLoading,
    catalogError,
    setWeightRange,
    refreshCatalog,
  } = usePickupBooking();

  useEffect(() => {
    if (!isCatalogLoading && weightRanges.length === 0) {
      refreshCatalog();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col justify-between min-h-[calc(100vh-140px)]">
      <div>
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-900 leading-tight">
            What is the estimated weight of your scrap?
          </h2>
          <p className="text-xs text-slate-500 mt-1">This helps us plan your pickup.</p>
        </div>

        {isCatalogLoading && weightRanges.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading weight options…</p>
          </div>
        ) : weightRanges.length === 0 ? (
          <div className="py-10 px-4 rounded-3xl border border-amber-200 bg-amber-50/80 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Weight options are not available yet</p>
            <p className="text-xs text-slate-500">
              {catalogError || 'Please retry. If this continues, restart the API so weight ranges can seed.'}
            </p>
            <button
              type="button"
              onClick={() => refreshCatalog()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0A3D2B] text-white text-xs font-bold"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-2.5 pb-6">
            {weightRanges.map((item) => {
              const isSelected = state.selectedWeightRangeId === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setWeightRange(item.id)}
                  className={`w-full p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-3 text-left shadow-xs ${
                    isSelected
                      ? 'border-[#0A3D2B] bg-emerald-50/60 shadow-sm ring-1 ring-[#0A3D2B]/30'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <WeightVisual item={item} selected={isSelected} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3
                        className={`text-sm font-extrabold ${
                          isSelected ? 'text-[#0A3D2B]' : 'text-slate-900'
                        }`}
                      >
                        {item.label}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.description}
                      {item.bags ? ` · ${item.bags}` : ''}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'border-[#0A3D2B] bg-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected && <div className="w-3.5 h-3.5 rounded-full bg-[#0A3D2B]" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200/80">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          disabled={!state.selectedWeightRangeId || weightRanges.length === 0}
          className="w-full py-4 rounded-2xl bg-[#0A3D2B] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm shadow-xl shadow-emerald-950/20 hover:bg-[#0E4D36] flex items-center justify-center gap-2 transition-all"
        >
          <span>Continue</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </motion.button>
        <button type="button" className="sr-only" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
};
