"use client";

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { QrCode, Truck, ChevronRight, X, PackageCheck } from 'lucide-react';
import { PickupQrCard } from '../tracking/PickupQrCard';

interface NearbyPickupBannerProps {
  /** The customer's pickups (any status); this picks out the ones that need attention now. */
  pickups: any[];
  onOpenDetails: (pickup: any) => void;
}

const idOf = (p: any): string => String(p?._id || p?.id || '');
const executiveOf = (p: any): string => String(p?.assignment?.employeeName || '').trim() || 'Your pickup executive';

/** Statuses after the QR has been scanned, up to the closing code: the pickup is happening right now. */
const IN_PROGRESS = ['VERIFIED', 'IN_PROGRESS', 'MEASURED', 'SUMMARY_READY', 'CUSTOMER_CONFIRMED', 'PAYMENT_PENDING', 'SETTLED'];

/**
 * Top of Home: whatever pickup needs the customer right now.
 *  - Executive nearby (ARRIVED): a prominent card whose button opens the pickup QR straight away.
 *  - On the way: a lighter card to follow it.
 *  - Collection under way: a card to open it (summary approval, completion code).
 */
export const NearbyPickupBanner: React.FC<NearbyPickupBannerProps> = ({ pickups, onOpenDetails }) => {
  const [qrPickupId, setQrPickupId] = useState<string | null>(null);

  const arrived = pickups.filter((p) => p.status === 'ARRIVED');
  const onTheWay = pickups.filter((p) => p.status === 'ON_THE_WAY');
  const underway = pickups.filter((p) => IN_PROGRESS.includes(p.status));

  // The QR sheet follows the live pickup: once the executive has scanned it, there is nothing left to show.
  const qrPickup = pickups.find((p) => idOf(p) === qrPickupId && p.status === 'ARRIVED') || null;
  useEffect(() => {
    if (qrPickupId && !qrPickup) setQrPickupId(null);
  }, [qrPickupId, qrPickup]);

  if (arrived.length + onTheWay.length + underway.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {arrived.map((p) => (
        <div
          key={idOf(p)}
          className="rounded-3xl bg-gradient-to-br from-[#0A3D2B] via-[#0E4D36] to-[#062418] text-white p-4 shadow-xl space-y-3 relative overflow-hidden"
        >
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-emerald-400/15 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-start gap-3 relative">
            <span className="w-11 h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <QrCode className="w-6 h-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Pickup {p.pickupCode}</p>
              <h3 className="text-base font-black leading-tight mt-0.5">Your pickup executive is nearby</h3>
              <p className="text-xs text-emerald-100/90 mt-1 leading-relaxed">
                {executiveOf(p)} is here. Show your pickup QR code to continue.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-[2fr_1fr] gap-2 relative">
            <button
              type="button"
              onClick={() => setQrPickupId(idOf(p))}
              className="py-3 rounded-2xl bg-[#F59E0B] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/30 cursor-pointer active:scale-[0.98] transition"
            >
              <QrCode className="w-4.5 h-4.5" />
              Show QR code
            </button>
            <button
              type="button"
              onClick={() => onOpenDetails(p)}
              className="py-3 rounded-2xl bg-white/10 border border-emerald-400/40 text-emerald-100 font-bold text-xs cursor-pointer hover:bg-white/20 transition"
            >
              Details
            </button>
          </div>
        </div>
      ))}

      {onTheWay.map((p) => (
        <button
          key={idOf(p)}
          type="button"
          onClick={() => onOpenDetails(p)}
          className="w-full text-left rounded-2xl bg-amber-50 border border-amber-200 p-3.5 flex items-center gap-3 cursor-pointer hover:bg-amber-100/60 transition"
        >
          <span className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Pickup {p.pickupCode}</span>
            <span className="text-sm font-black text-slate-900 block leading-tight">Picker is on the way</span>
            <span className="text-[11px] text-slate-600 block mt-0.5">
              {executiveOf(p)} has started. Keep your scrap ready.
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-amber-700 shrink-0" />
        </button>
      ))}

      {underway.map((p) => (
        <button
          key={idOf(p)}
          type="button"
          onClick={() => onOpenDetails(p)}
          className="w-full text-left rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center gap-3 cursor-pointer hover:bg-emerald-100/60 transition"
        >
          <span className="w-10 h-10 rounded-xl bg-[#0A3D2B] text-white flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Pickup {p.pickupCode}</span>
            <span className="text-sm font-black text-slate-900 block leading-tight">Collection in progress</span>
            <span className="text-[11px] text-slate-600 block mt-0.5">Tap to review the summary or see your completion code.</span>
          </span>
          <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0" />
        </button>
      ))}

      {qrPickup &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center animate-in fade-in"
            role="dialog"
            aria-label="Pickup QR code"
          >
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pickup {qrPickup.pickupCode}</p>
                  <h3 className="text-sm font-black text-slate-900">Show this to {executiveOf(qrPickup)}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setQrPickupId(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <PickupQrCard
                pickupId={idOf(qrPickup)}
                pickupCode={qrPickup.pickupCode}
                status={qrPickup.status}
                emphasized
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
