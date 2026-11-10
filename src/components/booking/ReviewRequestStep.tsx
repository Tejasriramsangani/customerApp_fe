"use client";

import { Button } from '../ui';
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Package,
  Scale,
  Calendar,
  Banknote,
  Edit2,
  Loader2,
  ArrowRight,
  MessageSquare,
  Heart,
} from 'lucide-react';
import { usePickupBooking } from '../../context/PickupBookingContext';
import { apiClient, getApiErrorMessage } from '../../lib/api-client';
import {
  SavedAddress,
  addressIdOf,
  addressLine,
  addressTitle,
  fetchSavedAddresses,
} from '../../lib/address-helpers';
import { isValidMongoId, resolveSlotForRouteDay } from '../../lib/booking-helpers';
import { ScrapPhotoUploader } from './ScrapPhotoUploader';

interface ReviewRequestStepProps {
  onBack: () => void;
  onEditStep: (stepNumber: 1 | 2 | 3) => void;
  onSuccess: (confirmedData: any) => void;
}

export const ReviewRequestStep: React.FC<ReviewRequestStepProps> = ({
  onBack,
  onEditStep,
  onSuccess,
}) => {
  const {
    state,
    categories,
    weightRanges,
    timeSlots,
    setPaymentPreference,
    setRemarks,
    setPhotoUrls,
    setSlot,
  } = usePickupBooking();
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // The address chosen on the previous step, shown here so it can be checked before booking.
  useEffect(() => {
    let cancelled = false;
    fetchSavedAddresses().then((list) => {
      if (!cancelled) setAddress(list.find((a) => addressIdOf(a) === state.addressId) || null);
    });
    return () => {
      cancelled = true;
    };
  }, [state.addressId]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedCategories = categories.filter((c) =>
    state.selectedCategoryIds.includes(c.id),
  );

  const selectedWeight = weightRanges.find((w) => w.id === state.selectedWeightRangeId);

  const selectedSlot =
    timeSlots.find((s) => s.id === state.selectedSlotId) ||
    (state.selectedSlotId
      ? { id: state.selectedSlotId, displayLabel: 'Selected window', period: 'morning' as const, startTime: '', endTime: '' }
      : null);

  const formattedDate = state.selectedDate
    ? new Date(state.selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—';

  const handleConfirmBooking = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const finalAddressId = state.addressId || '';
    if (!isValidMongoId(finalAddressId)) {
      setErrorMessage('Choose a pickup address first: tap Edit on the address card.');
      setIsLoading(false);
      return;
    }

    let finalSlotId = state.selectedSlotId;
    if (!isValidMongoId(finalSlotId)) {
      finalSlotId = resolveSlotForRouteDay(timeSlots, undefined, finalSlotId);
      if (finalSlotId) setSlot(finalSlotId);
    }

    const finalWeightRangeId = state.selectedWeightRangeId;
    const finalCategoryIds = state.selectedCategoryIds;

    if (
      !isValidMongoId(finalAddressId) ||
      !isValidMongoId(finalSlotId) ||
      !finalWeightRangeId ||
      !finalCategoryIds.length ||
      !state.selectedDate
    ) {
      setErrorMessage(
        !isValidMongoId(finalSlotId)
          ? 'No time slot available. Go back and pick a date/slot, or ask admin to seed catalog slots.'
          : 'Complete all booking selections before submitting.',
      );
      setIsLoading(false);
      return;
    }

    const bookingPayload = {
      addressId: finalAddressId,
      scheduledDate: state.selectedDate,
      timeSlotId: finalSlotId,
      estimatedWeightRangeId: finalWeightRangeId,
      categoryIds: finalCategoryIds,
      settlementPreference: state.paymentPreference,
      remarks: state.remarks?.trim() || undefined,
      photoUrls: state.photoUrls && state.photoUrls.length > 0 ? state.photoUrls : undefined,
    };

    try {
      const res = await apiClient.post('/customer/pickups/request', bookingPayload);

      if (res.success && res.data) {
        onSuccess(res.data);
      } else {
        setErrorMessage(
          getApiErrorMessage(res.error, 'Failed to submit pickup request. Please try again.'),
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Network error while booking pickup. Please check your connection.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="customer-booking-step flex flex-col justify-between ">
      <div className="customer-booking-step-body space-y-4 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">Review your request</h2>
          <p className="text-xs text-slate-500 mt-1">
            Please check your details before requesting the doorstep pickup.
          </p>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-brand flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Pickup Address
              </span>
              {address ? (
                <>
                  <h4 className="text-base font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                    {addressTitle(address)}
                    {address.isDefault && (
                      <span className="text-[11px] font-bold uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">
                        Primary
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{addressLine(address)}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {address.city} - {address.pincode}
                    {address.landmark ? ` · Near ${address.landmark}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                  No address chosen. Tap Edit to pick one.
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onEditStep(3)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 p-1 shrink-0"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-gold flex items-center justify-center shrink-0 mt-0.5">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Scrap Categories
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {selectedCategories.map((c) => (
                  <span
                    key={c.id}
                    className="text-[11px] font-extrabold text-brand bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200"
                  >
                    {c.emoji} {c.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onEditStep(1)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 p-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Estimated Weight
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">
                {selectedWeight?.label || '—'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedWeight?.description} ({selectedWeight?.bags})
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onEditStep(2)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 p-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Pickup Schedule
              </span>
              <h4 className="text-base font-bold text-slate-900 mt-0.5">{formattedDate}</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {selectedSlot?.displayLabel || 'Collection window to be confirmed'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={() => onEditStep(3)}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 p-1"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </Button>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-2 mb-2.5">
            <Banknote className="w-4 h-4 text-emerald-800" />
            <span className="text-xs font-extrabold text-slate-900">
              Payment Method (Received on pickup)
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              onClick={() => setPaymentPreference('CASH')}
              className={`py-2.5 px-2 rounded-2xl border-2 text-[11px] font-bold transition-all text-center ${
                state.paymentPreference === 'CASH'
                  ? 'border-brand bg-emerald-50 text-brand ring-1 ring-brand'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              Cash
            </Button>
            <Button
              type="button"
              onClick={() => setPaymentPreference('UPI')}
              className={`py-2.5 px-2 rounded-2xl border-2 text-[11px] font-bold transition-all text-center ${
                state.paymentPreference === 'UPI'
                  ? 'border-brand bg-emerald-50 text-brand ring-1 ring-brand'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              UPI
            </Button>
            <Button
              type="button"
              onClick={() => setPaymentPreference('DONATE')}
              className={`py-2.5 px-2 rounded-2xl border-2 text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 ${
                state.paymentPreference === 'DONATE'
                  ? 'border-brand bg-emerald-50 text-brand ring-1 ring-brand'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              <Heart className="w-3 h-3" />
              Donate
            </Button>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-slate-600" />
            <span className="text-xs font-extrabold text-slate-900">
              Remarks <span className="font-medium text-slate-400">(optional)</span>
            </span>
          </div>
          <textarea aria-label="Gate code, landmark, preferred contact, etc."
            value={state.remarks || ''}
            onChange={(e) => setRemarks(e.target.value.slice(0, 300))}
            placeholder="Gate code, landmark, preferred contact, etc."
            rows={3}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          <p className="text-[11px] text-slate-400 mt-1 text-right">
            {(state.remarks || '').length}/300
          </p>
        </div>

        {/* Optional photos of the scrap (hidden if the server has no photo storage) */}
        <ScrapPhotoUploader urls={state.photoUrls || []} onChange={setPhotoUrls} />

        {errorMessage && (
          <p className="text-xs font-semibold text-rose-600 px-1">⚠️ {errorMessage}</p>
        )}
      </div>

      <div className="customer-booking-actions pt-4 border-t border-slate-200/80">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleConfirmBooking}
          disabled={isLoading}
          className="w-full py-4 rounded-2xl bg-brand text-white font-bold text-sm shadow-xl  hover:bg-[var(--brand-hover)] flex items-center justify-center gap-2 transition-all disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Scheduling Your Pickup...</span>
            </>
          ) : (
            <>
              <span>Request Pickup Schedule</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </>
          )}
        </motion.button>
        <Button type="button" className="sr-only" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
};
