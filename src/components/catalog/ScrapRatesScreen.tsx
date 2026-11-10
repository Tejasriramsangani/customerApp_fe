"use client";

import { Button, Skeleton } from '../ui';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, ArrowRight, Tag } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

interface ScrapRatesScreenProps {
  areaName: string;
  onBookPickup: () => void;
}

interface ScrapRateItem {
  id: string;
  name: string;
  category: string;
  subLabel: string;
  pricePerKg: number;
  unit: string;
  emoji: string;
}

interface CategoryPill {
  id: string;
  label: string;
}

export const ScrapRatesScreen: React.FC<ScrapRatesScreenProps> = ({
  areaName,
  onBookPickup,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [rates, setRates] = useState<ScrapRateItem[]>([]);
  const [categoryPills, setCategoryPills] = useState<CategoryPill[]>([{ id: 'all', label: 'All' }]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch live catalog from backend
  useEffect(() => {
    async function fetchLiveCatalog() {
      setIsLoading(true);
      try {
        const res = await apiClient.get('/catalog');
        if (res.success && Array.isArray(res.data)) {
          const mapped: ScrapRateItem[] = [];
          const pills: CategoryPill[] = [{ id: 'all', label: 'All' }];
          // /catalog only returns admin-enabled categories/products, with margin-inclusive rates.
          res.data.forEach((cat: any) => {
            const catId = String(cat._id || cat.id);
            if (Array.isArray(cat.products)) {
              let hasPricedProduct = false;
              cat.products.forEach((p: any) => {
                const price = p.activeRate?.ratePerKgRupees ??
                  (p.activeRate?.ratePerKgPaise != null ? p.activeRate.ratePerKgPaise / 100 : null);
                if (price == null) return;
                hasPricedProduct = true;
                mapped.push({
                  id: p._id || p.id,
                  name: p.name,
                  category: catId,
                  subLabel: `Verified ${cat.name} material`,
                  pricePerKg: Number(price),
                  unit: p.unit || 'kg',
                  emoji: p.emoji || cat.emoji || '♻️',
                });
              });
              if (hasPricedProduct) pills.push({ id: catId, label: cat.name });
            }
          });
          setRates(mapped);
          setCategoryPills(pills);
        }
      } catch {
        setRates([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLiveCatalog();
  }, []);

  const filteredRates = useMemo(() => {
    return rates.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.subLabel.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [rates, selectedCategory, searchQuery]);

  return (
    <div className="space-y-4 pb-20">
      {/* Title & Locality Info */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Scrap Rates</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live doorstep rates in <span className="font-bold text-emerald-800">{areaName || 'Vijayawada'}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-bold text-emerald-800">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Updated Today</span>
        </div>
      </div>

      {/* Search Bar */}
      <label htmlFor="scrap-rate-search" className="block text-sm font-semibold text-copy">Find a material</label>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input id="scrap-rate-search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search newspaper, iron, copper, plastic..."
          className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all shadow-xs"
        />
        {searchQuery && (
          <Button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
          >
            ✕
          </Button>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
        {categoryPills.map((cat) => (
          <Button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
              selectedCategory === cat.id
                ? 'bg-brand text-white shadow-md '
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Itemized Rates List */}
      <div className="grid grid-cols-1 gap-3" aria-busy={isLoading}>
        {isLoading && <div role="status" aria-label="Loading scrap rates" className="col-span-full grid grid-cols-1 gap-3">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-24" />)}</div>}
        {filteredRates.map((item) => (
          <motion.div
            key={item.id}
            whileTap={{ scale: 0.99 }}
            className="p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between hover:border-emerald-300 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-2xl shrink-0">
                {item.emoji}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                  {item.name}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.subLabel}</p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="data-value text-base text-brand block">
                ₹{item.pricePerKg}
                <span className="text-[11px] font-normal text-slate-500">/{item.unit}</span>
              </span>
              <span className="text-[11px] text-slate-400">Trend —</span>
            </div>
          </motion.div>
        ))}

        {!isLoading && filteredRates.length === 0 && (
          <div className="text-center py-10 text-slate-400 bg-white rounded-3xl border border-slate-100">
            <Tag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-semibold">No materials found for "{searchQuery}"</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Try searching for iron, paper or plastic</p>
          </div>
        )}
      </div>

      {/* Sticky Bottom Floating Booking CTA */}
      <div className="customer-rates-action fixed left-0 right-0 max-w-[430px] mx-auto px-4 z-20 pointer-events-none">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onBookPickup}
          className="w-full py-3.5 rounded-2xl bg-brand text-white font-bold text-xs shadow-xl  flex items-center justify-center gap-2 pointer-events-auto hover:bg-[var(--brand-hover)] transition-all"
        >
          <span>Book A Scrap Pickup Now</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </motion.button>
      </div>
    </div>
  );
};
