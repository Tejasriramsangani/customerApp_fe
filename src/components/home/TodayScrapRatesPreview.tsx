"use client";

import React, { useState, useEffect } from 'react';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '../../lib/api-client';

interface TodayScrapRatesPreviewProps {
  onViewAll: () => void;
}

interface DynamicRateItem {
  id: string;
  name: string;
  price: string;
  unit: string;
  emoji: string;
  category: string;
}

const getEmojiForCategory = (catName: string) => {
  const c = catName.toLowerCase();
  if (c.includes('metal') || c.includes('iron') || c.includes('copper')) return '⚙️';
  if (c.includes('paper') || c.includes('carton')) return '📦';
  if (c.includes('plastic')) return '🍾';
  if (c.includes('ewaste') || c.includes('electronic')) return '💻';
  return '♻️';
};

export const TodayScrapRatesPreview: React.FC<TodayScrapRatesPreviewProps> = ({
  onViewAll,
}) => {
  const [rates, setRates] = useState<DynamicRateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/catalog')
      .then((res) => {
        if (!isMounted) return;
        if (res.success && Array.isArray(res.data)) {
          const items: DynamicRateItem[] = [];
          res.data.forEach((cat: any) => {
            if (Array.isArray(cat.products)) {
              cat.products.forEach((p: any) => {
                const rupees = p.activeRate?.ratePerKgRupees ??
                  (p.activeRate?.ratePerKgPaise != null ? p.activeRate.ratePerKgPaise / 100 : null);
                if (rupees == null) return;
                const price = `₹${Number(rupees).toFixed(2)}`;
                items.push({
                  id: p._id || p.id,
                  name: p.name,
                  price,
                  unit: p.unit || 'kg',
                  emoji: getEmojiForCategory(cat.name),
                  category: cat.name,
                });
              });
            }
          });
          setRates(items.slice(0, 8));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/80">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100/80 text-emerald-800 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-900 leading-tight">Today's Scrap Rates</h3>
            <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live market pricing
            </span>
          </div>
        </div>

        <button
          onClick={onViewAll}
          className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-0.5 bg-emerald-50 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
        >
          <span>View All</span>
          <ArrowRight className="w-3 h-3 stroke-[2.5]" />
        </button>
      </div>

      {/* Horizontal Scrolling Rate Cards */}
      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
        {loading ? (
          <div className="py-4 px-2 text-xs text-slate-400">Loading live scrap rates...</div>
        ) : rates.length === 0 ? (
          <div className="py-4 px-2 text-xs text-slate-400">Rates currently synchronizing...</div>
        ) : (
          rates.map((item) => (
            <motion.div
              key={item.id}
              whileTap={{ scale: 0.96 }}
              onClick={onViewAll}
              className="min-w-[115px] p-3 rounded-2xl bg-slate-50 border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all flex flex-col items-center text-center shrink-0 cursor-pointer shadow-xs"
            >
              <span className="text-2xl mb-1">{item.emoji}</span>
              <p className="text-[11px] font-extrabold text-slate-800 truncate w-full">
                {item.name}
              </p>
              <p className="text-xs font-black text-[#0A3D2B] mt-0.5">
                {item.price}
                <span className="text-[9px] font-normal text-slate-500">/{item.unit.toLowerCase()}</span>
              </p>
              <span className="text-[9px] font-bold mt-1 px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                Verified Mandi
              </span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
