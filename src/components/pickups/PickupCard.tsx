"use client";

import { Button, StatusBadge } from '../ui';
import React from 'react';
import { Clock, MapPin, ChevronRight } from 'lucide-react';

export interface PickupItemData {
  _id?: string;
  id?: string;
  pickupCode: string;
  status:
    | 'REQUESTED'
    | 'SCHEDULED'
    | 'ASSIGNED'
    | 'ON_THE_WAY'
    | 'ARRIVED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'SETTLED'
    | 'CANCELLED'
    | 'FAILED'
    | string;
  scheduledDate: string; // YYYY-MM-DD or formatted
  timeSlotSnapshot?: {
    displayLabel: string;
    startTime?: string;
    endTime?: string;
  };
  addressSnapshot?: {
    houseNumber?: string;
    line1?: string;
    city?: string;
    landmark?: string | null;
  };
  locationLabel?: string;
  categories?: any[];
  assignment?: {
    employeeName?: string;
    employeeCode?: string;
  };
  totals?: {
    netWeightGrams?: number;
    totalAmount?: number;
  };
}

interface PickupCardProps {
  pickup: PickupItemData;
  onClick: () => void;
  onInvoice?: () => void;
}

export const PickupCard: React.FC<PickupCardProps> = ({ pickup, onClick, onInvoice }) => {
  // Parse date into day, monthYear, and weekday
  const { day, monthYear, weekday } = React.useMemo(() => {
    try {
      const d = new Date(pickup.scheduledDate);
      if (isNaN(d.getTime())) {
        // Fallback for custom formatted strings
        return { day: '—', monthYear: '—', weekday: '—' };
      }
      return {
        day: d.getDate().toString().padStart(2, '0'),
        monthYear: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
        weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
      };
    } catch {
      return { day: '—', monthYear: '—', weekday: '—' };
    }
  }, [pickup.scheduledDate]);

  const isCancelled = pickup.status === 'CANCELLED' || pickup.status === 'FAILED';
  const isCompleted = pickup.status === 'COMPLETED' || pickup.status === 'SETTLED';

  const renderStatusBadge = () => {
    const labels: Record<string, string> = {
      REQUESTED: 'Requested', SCHEDULED: 'Scheduled', ASSIGNED: 'Employee assigned',
      ON_THE_WAY: 'On the way', ARRIVED: 'Arrived', IN_PROGRESS: 'In progress',
      COMPLETED: 'Completed', SETTLED: 'Completed', CANCELLED: 'Cancelled', FAILED: 'Failed',
    };
    return <StatusBadge status={pickup.status}>{labels[pickup.status] ?? pickup.status}</StatusBadge>;
  };

  const locationText =
    pickup.locationLabel ||
    (pickup.addressSnapshot
      ? [pickup.addressSnapshot.houseNumber, pickup.addressSnapshot.line1, pickup.addressSnapshot.city].filter(Boolean).join(', ') || '—'
      : '—');

  const slotText = pickup.timeSlotSnapshot?.displayLabel || '—';

  return (
    <article
      className="relative w-full bg-white rounded-2xl p-3.5 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer flex items-center justify-between gap-3 group"
    >
      {/* Left Date Badge (Image 5) */}
      <div
        className={`w-16 h-18 rounded-xl flex flex-col items-center justify-center shrink-0 border transition-colors ${
          isCancelled
            ? 'bg-[#FFF1F2] border-[#FFE4E6] text-[#BE123C]'
            : 'bg-canvas border-soft text-brand'
        }`}
      >
        <span className="text-xl font-bold leading-none mb-0.5">{day}</span>
        <span className="text-[11px] font-bold opacity-80 leading-tight">{monthYear}</span>
        <span className="text-[11px] font-semibold opacity-70 leading-tight">{weekday}</span>
      </div>

      {/* Middle Content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <h3 className="text-lg font-bold text-slate-900 tracking-tight truncate">
            <span className="data-value">{pickup.pickupCode}</span>
          </h3>
          {renderStatusBadge()}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{slotText}</span>
          </div>
          {isCompleted && onInvoice && (
            <Button
              onClick={(event) => { event.stopPropagation(); onInvoice(); }}
              className="relative z-10 text-[11px] font-bold text-emerald-800 underline"
            >
              View invoice
            </Button>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{locationText}</span>
          </div>
        </div>
      </div>

      {/* Right Navigation Arrow */}
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all shrink-0">
        <ChevronRight className="w-5 h-5 stroke-[2.2]" />
      </div>
      <Button onClick={onClick} aria-label={`View pickup ${pickup.pickupCode}`} className="absolute inset-0 w-full rounded-2xl" />
    </article>
  );
};
