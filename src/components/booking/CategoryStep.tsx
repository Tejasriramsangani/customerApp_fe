"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, RefreshCw, AlertCircle } from 'lucide-react';
import { usePickupBooking } from '../../context/PickupBookingContext';

interface CategoryStepProps {
  onBack: () => void;
  onNext: () => void;
}

export const CategoryStep: React.FC<CategoryStepProps> = ({ onBack, onNext }) => {
  const { state, categories, isCatalogLoading, catalogError, toggleCategory, refreshCatalog } =
    usePickupBooking();

  const isAnySelected = state.selectedCategoryIds.length > 0;

  return (
    <div className="flex flex-col justify-between min-h-[calc(100vh-140px)]">
      <div>
        <div className="mb-5">
          <h2 className="text-xl font-black text-slate-900 leading-tight">
            What type of scrap do you have?
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            You can select multiple categories for a single doorstep pickup.
          </p>
        </div>

        {isCatalogLoading && categories.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
            <p className="text-xs font-bold uppercase tracking-wider">Loading scrap categories…</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="py-10 px-4 rounded-3xl border border-amber-200 bg-amber-50/80 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800">No scrap categories available</p>
            <p className="text-xs text-slate-500">
              {catalogError || 'Please retry or check that the catalog is seeded on the server.'}
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
          <div className="grid grid-cols-2 gap-3 pb-6">
            {categories.map((cat) => {
              const isSelected = state.selectedCategoryIds.includes(cat.id);
              return (
                <motion.div
                  key={cat.id}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => toggleCategory(cat.id)}
                  className={`p-4 rounded-3xl border-2 cursor-pointer transition-all flex flex-col justify-between relative shadow-xs ${
                    isSelected
                      ? 'border-[#0A3D2B] bg-emerald-50/70 shadow-sm ring-1 ring-[#0A3D2B]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{cat.emoji}</span>
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#0A3D2B] text-white'
                          : 'border-2 border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <div>
                    <h3 className={`text-sm font-extrabold ${isSelected ? 'text-[#0A3D2B]' : 'text-slate-900'}`}>
                      {cat.name}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                      {cat.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200/80">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          disabled={!isAnySelected}
          className={`w-full py-4 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all ${
            isAnySelected
              ? 'bg-[#0A3D2B] text-white shadow-emerald-950/20 hover:bg-[#0E4D36]'
              : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
          }`}
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
