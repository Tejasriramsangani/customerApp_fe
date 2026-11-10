"use client";

import { Button } from '../ui';
import React from 'react';
import { Home, TrendingUp, Plus, PackageCheck, User } from 'lucide-react';
import { motion } from 'framer-motion';

export type NavTab = 'home' | 'rates' | 'request' | 'pickups' | 'profile';

interface BottomNavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingCount?: number;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({
  activeTab,
  onTabChange,
  pendingCount = 0,
}) => {
  return (
    <nav aria-label="Main navigation" className="customer-bottom-nav relative w-full z-40 bg-white/95  border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 pb-safe">
      <div className="flex items-center justify-between relative">
        {/* Tab 1: Home */}
        <Button
          aria-current={activeTab === 'home' ? 'page' : undefined}
          onClick={() => onTabChange('home')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all group"
        >
          <div className="relative">
            <Home
              className={`w-6 h-6 transition-colors ${
                activeTab === 'home'
                  ? 'text-brand stroke-[2.4]'
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            {activeTab === 'home' && (
              <motion.div
                layoutId="nav-dot"
                className="w-1.5 h-1.5 rounded-full bg-brand mx-auto mt-1"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span
            className={`text-[11px] mt-0.5 font-medium transition-colors ${
              activeTab === 'home' ? 'text-brand font-bold' : 'text-slate-500'
            }`}
          >
            Home
          </span>
        </Button>

        {/* Tab 2: Scrap Rates */}
        <Button
          aria-current={activeTab === 'rates' ? 'page' : undefined}
          onClick={() => onTabChange('rates')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all group"
        >
          <div className="relative">
            <TrendingUp
              className={`w-6 h-6 transition-colors ${
                activeTab === 'rates'
                  ? 'text-brand stroke-[2.4]'
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            {activeTab === 'rates' && (
              <motion.div
                layoutId="nav-dot"
                className="w-1.5 h-1.5 rounded-full bg-brand mx-auto mt-1"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span
            className={`text-[11px] mt-0.5 font-medium transition-colors ${
              activeTab === 'rates' ? 'text-brand font-bold' : 'text-slate-500'
            }`}
          >
            Scrap Rates
          </span>
        </Button>

        {/* Tab 3: Center Elevated Action (+ Request) */}
        <div className="flex-1 flex flex-col items-center -mt-6">
          <motion.button
            whileTap={{ scale: 0.92 }}
            aria-current={activeTab === 'request' ? 'page' : undefined}
          onClick={() => onTabChange('request')}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all border-4 border-white ${
              activeTab === 'request'
                ? 'bg-gradient-to-tr from-[var(--brand-dark)] to-[var(--brand-hover)] shadow-[0_8px_20px_rgba(10,61,43,0.45)] ring-2 ring-gold'
                : 'bg-gradient-to-tr from-brand to-brand shadow-[0_6px_16px_rgba(10,61,43,0.35)]'
            }`}
          >
            <Plus className="w-7 h-7 text-gold stroke-[3]" />
          </motion.button>
          <span className="text-[11px] font-bold text-brand mt-0.5">
            + Request
          </span>
        </div>

        {/* Tab 4: My Pickups */}
        <Button
          aria-current={activeTab === 'pickups' ? 'page' : undefined}
          onClick={() => onTabChange('pickups')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all group relative"
        >
          <div className="relative">
            <PackageCheck
              className={`w-6 h-6 transition-colors ${
                activeTab === 'pickups'
                  ? 'text-brand stroke-[2.4]'
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-[#E11D48] text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {pendingCount}
              </span>
            )}
            {activeTab === 'pickups' && (
              <motion.div
                layoutId="nav-dot"
                className="w-1.5 h-1.5 rounded-full bg-brand mx-auto mt-1"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span
            className={`text-[11px] mt-0.5 font-medium transition-colors ${
              activeTab === 'pickups' ? 'text-brand font-bold' : 'text-slate-500'
            }`}
          >
            My Pickups
          </span>
        </Button>

        {/* Tab 5: Profile */}
        <Button
          aria-current={activeTab === 'profile' ? 'page' : undefined}
          onClick={() => onTabChange('profile')}
          className="flex-1 flex flex-col items-center justify-center py-1 transition-all group"
        >
          <div className="relative">
            <User
              className={`w-6 h-6 transition-colors ${
                activeTab === 'profile'
                  ? 'text-brand stroke-[2.4]'
                  : 'text-slate-400 group-hover:text-slate-600'
              }`}
            />
            {activeTab === 'profile' && (
              <motion.div
                layoutId="nav-dot"
                className="w-1.5 h-1.5 rounded-full bg-brand mx-auto mt-1"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </div>
          <span
            className={`text-[11px] mt-0.5 font-medium transition-colors ${
              activeTab === 'profile' ? 'text-brand font-bold' : 'text-slate-500'
            }`}
          >
            Profile
          </span>
        </Button>
      </div>
    </nav>
  );
};
