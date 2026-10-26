"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, getApiErrorMessage } from '../lib/api-client';

export interface ScrapCategoryItem {
  id: string;
  name: string;
  code: string;
  emoji: string;
  description: string;
}

export interface WeightRangeItem {
  id: string;
  label: string;
  description: string;
  bags: string;
  minKg: number;
  maxKg: number;
  isBulk: boolean;
}

export interface TimeSlotItem {
  id: string;
  period: 'morning' | 'afternoon' | 'evening';
  displayLabel: string;
  startTime: string;
  endTime: string;
}

export interface BookingState {
  step: 1 | 2 | 3 | 4 | 5;
  selectedCategoryIds: string[];
  selectedWeightRangeId: string;
  selectedDate: string; // YYYY-MM-DD
  selectedSlotId: string;
  paymentPreference: 'CASH' | 'UPI' | 'DONATE';
  addressId?: string;
  remarks?: string;
  confirmedPickup?: any;
}

interface PickupBookingContextType {
  state: BookingState;
  categories: ScrapCategoryItem[];
  weightRanges: WeightRangeItem[];
  bulkLimitKg: number;
  timeSlots: TimeSlotItem[];
  isCatalogLoading: boolean;
  catalogError: string;
  refreshCatalog: () => Promise<void>;
  setStep: (step: 1 | 2 | 3 | 4 | 5) => void;
  toggleCategory: (categoryId: string) => void;
  setWeightRange: (rangeId: string) => void;
  setDate: (date: string) => void;
  setSlot: (slotId: string) => void;
  setAddressId: (addressId: string) => void;
  setPaymentPreference: (pref: 'CASH' | 'UPI' | 'DONATE') => void;
  setRemarks: (remarks: string) => void;
  setConfirmedPickup: (pickup: any) => void;
  resetBooking: () => void;
}

const getTomorrowDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
};

const bagHintForRange = (minGrams: number, maxGrams: number): string => {
  const maxKg = maxGrams / 1000;
  if (maxKg <= 10) return '1–2 bags';
  if (maxKg <= 20) return '2–3 bags';
  if (maxKg <= 30) return '4–5 bags';
  if (maxKg <= 50) return 'Multiple boxes';
  return 'Truck / bulk load';
};

const descriptionForRange = (minGrams: number, maxGrams: number): string => {
  const maxKg = maxGrams / 1000;
  if (maxKg <= 10) return 'Small amount';
  if (maxKg <= 20) return 'A few bags';
  if (maxKg <= 30) return 'Medium amount';
  if (maxKg <= 50) return 'Large amount';
  return 'Bulk amount';
};

const initialState: BookingState = {
  step: 1,
  selectedCategoryIds: [],
  selectedWeightRangeId: '',
  selectedDate: getTomorrowDate(),
  selectedSlotId: '',
  paymentPreference: 'CASH',
  remarks: '',
  confirmedPickup: null,
};

const PickupBookingContext = createContext<PickupBookingContextType | undefined>(undefined);

export function PickupBookingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState);
  const [categories, setCategories] = useState<ScrapCategoryItem[]>([]);
  const [weightRanges, setWeightRanges] = useState<WeightRangeItem[]>([]);
  const [bulkLimitKg, setBulkLimitKg] = useState(50);
  const [timeSlots, setTimeSlots] = useState<TimeSlotItem[]>([]);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const refreshCatalog = useCallback(async () => {
    setIsCatalogLoading(true);
    setCatalogError('');
    try {
      const [catRes, weightRes, slotRes] = await Promise.all([
        apiClient.get('/catalog/categories'),
        apiClient.get('/catalog/weight-ranges'),
        apiClient.get('/catalog/slots'),
      ]);

      if (catRes.success && Array.isArray(catRes.data) && catRes.data.length > 0) {
        const mappedCats: ScrapCategoryItem[] = catRes.data.map((c: any) => ({
          id: String(c._id || c.id),
          name: c.name,
          code: c.code,
          emoji:
            c.code === 'PAPER'
              ? '📄'
              : c.code === 'PLASTIC'
              ? '🍾'
              : c.code === 'METAL'
              ? '⚙️'
              : c.code === 'E_WASTE'
              ? '💻'
              : c.code === 'RUBBER'
              ? '🛞'
              : '📦',
          description: `Verified ${c.name} materials`,
        }));
        setCategories(mappedCats);
      } else {
        setCategories([]);
      }

      if (weightRes.success && weightRes.data != null) {
        const payload = weightRes.data as any;
        // Live API may return either:
        // 1) WeightRange[] (current running server)
        // 2) { bulkLimitKg, ranges: WeightRange[] } (newer catalog payload)
        const rawRanges: any[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.ranges)
            ? payload.ranges
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
        const limitKg =
          !Array.isArray(payload) && Number(payload?.bulkLimitKg) > 0
            ? Number(payload.bulkLimitKg)
            : 50;
        setBulkLimitKg(limitKg);

        if (rawRanges.length > 0) {
          const mappedWeights: WeightRangeItem[] = rawRanges.map((w: any) => {
            const minGrams = Number(
              w.minGrams != null ? w.minGrams : (Number(w.minKg) || 0) * 1000,
            );
            const maxGrams = Number(
              w.maxGrams != null ? w.maxGrams : (Number(w.maxKg) || 0) * 1000,
            );
            const minKg = minGrams / 1000;
            const maxKg = maxGrams / 1000;
            const isOpenEnded = maxKg >= 1000;
            const isBulk =
              typeof w.isBulk === 'boolean' ? w.isBulk : minKg >= limitKg;
            return {
              id: String(w._id || w.id),
              label:
                w.displayLabel ||
                w.name ||
                (isOpenEnded ? `${minKg}+ kg` : `${minKg} – ${maxKg} kg`),
              description: descriptionForRange(minGrams, maxGrams),
              bags: bagHintForRange(minGrams, maxGrams),
              minKg,
              maxKg,
              isBulk,
            };
          });
          setWeightRanges(mappedWeights);
          setState((prev) =>
            prev.selectedWeightRangeId &&
            mappedWeights.some((w) => w.id === prev.selectedWeightRangeId)
              ? prev
              : { ...prev, selectedWeightRangeId: mappedWeights[0].id },
          );
        } else {
          setWeightRanges([]);
          setCatalogError(
            'No weight ranges in the catalog yet. Ask admin to open Settings → weight ranges, or restart the API after seeding.',
          );
        }
      } else {
        setWeightRanges([]);
        if (!weightRes.success) {
          setCatalogError(getApiErrorMessage(weightRes.error, 'Unable to load weight ranges.'));
        }
      }

      if (slotRes.success && Array.isArray(slotRes.data) && slotRes.data.length > 0) {
        const mappedSlots: TimeSlotItem[] = slotRes.data.map((s: any) => {
          const hour = parseInt(String(s.startTime || '10').split(':')[0], 10);
          const period: TimeSlotItem['period'] =
            hour < 12 ? 'morning' : hour < 16 ? 'afternoon' : 'evening';
          return {
            id: String(s._id || s.id),
            period,
            displayLabel: s.displayLabel || `${s.startTime} - ${s.endTime}`,
            startTime: s.startTime,
            endTime: s.endTime,
          };
        });
        setTimeSlots(mappedSlots);
        setState((prev) =>
          prev.selectedSlotId ? prev : { ...prev, selectedSlotId: mappedSlots[0].id },
        );
      } else {
        setTimeSlots([]);
      }
    } catch (err: any) {
      setCatalogError(err?.message || 'Unable to load booking catalog.');
    } finally {
      setIsCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  const setStep = (step: 1 | 2 | 3 | 4 | 5) => {
    setState((prev) => ({ ...prev, step }));
  };

  const toggleCategory = (categoryId: string) => {
    setState((prev) => {
      const exists = prev.selectedCategoryIds.includes(categoryId);
      const updated = exists
        ? prev.selectedCategoryIds.filter((id) => id !== categoryId)
        : [...prev.selectedCategoryIds, categoryId];
      return { ...prev, selectedCategoryIds: updated };
    });
  };

  const setWeightRange = (rangeId: string) => {
    setState((prev) => ({ ...prev, selectedWeightRangeId: rangeId }));
  };

  const setDate = (date: string) => {
    setState((prev) => ({ ...prev, selectedDate: date }));
  };

  const setSlot = (slotId: string) => {
    setState((prev) => ({ ...prev, selectedSlotId: slotId }));
  };

  const setAddressId = (addressId: string) => {
    setState((prev) => ({ ...prev, addressId }));
  };

  const setPaymentPreference = (pref: 'CASH' | 'UPI' | 'DONATE') => {
    setState((prev) => ({ ...prev, paymentPreference: pref }));
  };

  const setRemarks = (remarks: string) => {
    setState((prev) => ({ ...prev, remarks }));
  };

  const setConfirmedPickup = (pickup: any) => {
    setState((prev) => ({ ...prev, confirmedPickup: pickup }));
  };

  const resetBooking = () => {
    setState({ ...initialState, selectedDate: getTomorrowDate() });
  };

  return (
    <PickupBookingContext.Provider
      value={{
        state,
        categories,
        weightRanges,
        bulkLimitKg,
        timeSlots,
        isCatalogLoading,
        catalogError,
        refreshCatalog,
        setStep,
        toggleCategory,
        setWeightRange,
        setDate,
        setSlot,
        setAddressId,
        setPaymentPreference,
        setRemarks,
        setConfirmedPickup,
        resetBooking,
      }}
    >
      {children}
    </PickupBookingContext.Provider>
  );
}

export function usePickupBooking() {
  const context = useContext(PickupBookingContext);
  if (!context) {
    throw new Error('usePickupBooking must be used within a PickupBookingProvider');
  }
  return context;
}
