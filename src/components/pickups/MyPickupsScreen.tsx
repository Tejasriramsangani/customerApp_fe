"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PickupCard, PickupItemData } from './PickupCard';
import { EmptyCancelledState } from './EmptyCancelledState';
import { InvoiceModal } from './InvoiceModal';
import { apiClient } from '../../lib/api-client';
import { RefreshCw, Plus, Package } from 'lucide-react';

export type PickupTab = 'scheduled' | 'completed' | 'cancelled';

interface MyPickupsScreenProps {
  onOpenPickupDetails: (pickup: PickupItemData) => void;
  onRequestNewPickup: () => void;
}

export const MyPickupsScreen: React.FC<MyPickupsScreenProps> = ({
  onOpenPickupDetails,
  onRequestNewPickup,
}) => {
  const [activeTab, setActiveTab] = useState<PickupTab>('scheduled');
  const [livePickups, setLivePickups] = useState<PickupItemData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoicePickup, setSelectedInvoicePickup] = useState<PickupItemData | null>(null);

  // Fetch real pickups from backend API
  const fetchPickups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<any[]>('/customer/pickups');
      if (res.success && Array.isArray(res.data)) {
        const mapped: PickupItemData[] = res.data.map((item: any) => ({
          id: item._id || item.id,
          pickupCode: item.pickupCode || '—',
          status: item.status || 'REQUESTED',
          scheduledDate: item.scheduledDate || '',
          timeSlotSnapshot: item.timeSlotSnapshot,
          addressSnapshot: item.addressSnapshot,
          assignment: item.assignment,
          totals: item.totals,
        }));
        setLivePickups(mapped);
      } else {
        setLivePickups([]);
      }
    } catch {
      setLivePickups([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  // Real database dynamic lists
  const scheduledList = useMemo(() => {
    return livePickups.filter((p) =>
      ['REQUESTED', 'SCHEDULED', 'ASSIGNED', 'ON_THE_WAY', 'ARRIVED', 'IN_PROGRESS', 'MEASURED', 'SUMMARY_READY', 'CUSTOMER_CONFIRMED', 'VERIFIED'].includes(p.status)
    );
  }, [livePickups]);

  const completedList = useMemo(() => {
    return livePickups.filter((p) => ['COMPLETED', 'SETTLED'].includes(p.status));
  }, [livePickups]);

  const cancelledList = useMemo(() => {
    return livePickups.filter((p) => p.status === 'CANCELLED');
  }, [livePickups]);

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">My Pickups</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track active scrap bookings and view invoice receipts
          </p>
        </div>

        <button
          onClick={fetchPickups}
          disabled={isLoading}
          className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
          title="Refresh pickups"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-800' : ''}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl">
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'scheduled'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Scheduled {scheduledList.length > 0 && `(${scheduledList.length})`}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Completed {completedList.length > 0 && `(${completedList.length})`}
        </button>
        <button
          onClick={() => setActiveTab('cancelled')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeTab === 'cancelled'
              ? 'bg-white text-emerald-900 shadow-xs'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Cancelled
        </button>
      </div>

      {/* Tab Contents */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-400">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs font-medium">Loading your bookings...</p>
        </div>
      ) : activeTab === 'scheduled' ? (
        scheduledList.length > 0 ? (
          <div className="space-y-3">
            {scheduledList.map((pickup) => (
              <PickupCard
                key={pickup.id}
                pickup={pickup}
                onClick={() => onOpenPickupDetails(pickup)}
              />
            ))}
          </div>
        ) : (
          <div className="py-14 text-center px-4 bg-white rounded-3xl border border-slate-100 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 stroke-[1.8]" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">No Active Pickups</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
              You don't have any pending scrap collections scheduled right now.
            </p>
            <button
              onClick={onRequestNewPickup}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0A3D2B] text-white text-xs font-bold shadow-md hover:bg-[#072c1f] transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Scrap Pickup</span>
            </button>
          </div>
        )
      ) : activeTab === 'completed' ? (
        completedList.length > 0 ? (
          <div className="space-y-3">
            {completedList.map((pickup) => (
              <PickupCard
                key={pickup.id}
                pickup={pickup}
                onClick={() => onOpenPickupDetails(pickup)}
                onInvoice={() => setSelectedInvoicePickup(pickup)}
              />
            ))}
          </div>
        ) : (
          <div className="py-14 text-center px-4 bg-white rounded-3xl border border-slate-100 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 stroke-[1.8]" />
            </div>
            <h4 className="text-sm font-bold text-slate-800 mb-1">No Completed Orders Yet</h4>
            <p className="text-xs text-slate-500 max-w-xs mx-auto">
              Once scrap is weighed and paid at your doorstep, digital receipts will appear here.
            </p>
          </div>
        )
      ) : cancelledList.length > 0 ? (
        <div className="space-y-3">
          {cancelledList.map((pickup) => (
            <PickupCard
              key={pickup.id}
              pickup={pickup}
              onClick={() => onOpenPickupDetails(pickup)}
            />
          ))}
        </div>
      ) : (
        <EmptyCancelledState />
      )}

      {/* Invoice Modal */}
      {selectedInvoicePickup && (
        <InvoiceModal
          isOpen={Boolean(selectedInvoicePickup)}
          pickupId={selectedInvoicePickup._id || selectedInvoicePickup.id || ''}
          pickupCode={selectedInvoicePickup.pickupCode}
          onClose={() => setSelectedInvoicePickup(null)}
        />
      )}
    </div>
  );
};
