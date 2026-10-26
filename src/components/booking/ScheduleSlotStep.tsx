"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Sun,
  CloudSun,
  Moon,
  Loader2,
  Sparkles,
  AlertCircle,
  MapPin,
} from 'lucide-react';
import { usePickupBooking, TimeSlotItem } from '../../context/PickupBookingContext';
import { useLocation } from '../../context/LocationContext';
import { apiClient } from '../../lib/api-client';
import {
  buildNextSevenDates,
  isCompleteBookingAddress,
  isValidMongoId,
  resolveSlotForRouteDay,
} from '../../lib/booking-helpers';

interface ScheduleSlotStepProps {
  onBack: () => void;
  onNext: () => void;
}

interface RouteDateItem {
  iso: string;
  weekday: string;
  dayNum: number;
  monthStr: string;
  windowLabel: string;
  startTime: string;
  endTime: string;
  routeScheduleId?: string;
}

export const ScheduleSlotStep: React.FC<ScheduleSlotStepProps> = ({ onBack, onNext }) => {
  const { state, timeSlots, setDate, setSlot, setAddressId } = usePickupBooking();
  const { location, openSheet } = useLocation();

  const [loading, setLoading] = useState(false);
  const [availabilityMode, setAvailabilityMode] = useState<'SLOTS' | 'ROUTE_DAYS'>('SLOTS');
  const [helperText, setHelperText] = useState<string>('');
  const [routeDates, setRouteDates] = useState<RouteDateItem[]>([]);
  const [outOfCoverage, setOutOfCoverage] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlotItem[]>(timeSlots);
  const [availableDates, setAvailableDates] = useState<
    Array<{ iso: string; label: string; dayNum: number; monthStr: string; weekday: string }>
  >([]);

  const addressReady = isCompleteBookingAddress(location);

  useEffect(() => setAvailableSlots(timeSlots), [timeSlots]);

  // Invalidate cached address when the user changes locality (pincode / coords).
  useEffect(() => {
    setAddressId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pincode, location.latitude, location.longitude, location.formattedAddress]);

  useEffect(() => {
    let isMounted = true;

    async function fetchAvailability() {
      setLoading(true);
      setAvailabilityError('');
      setOutOfCoverage(false);

      try {
        if (!addressReady) {
          if (isMounted) {
            setAvailabilityError(
              'Select a complete pickup address (locality with 6-digit pincode and GPS) to check availability.',
            );
            setLoading(false);
          }
          return;
        }

        let addressId = state.addressId;
        if (!isValidMongoId(addressId)) {
          try {
            const addrRes = await apiClient.get<any[]>('/customer/addresses');
            if (addrRes.success && Array.isArray(addrRes.data) && addrRes.data.length > 0) {
              const match = addrRes.data.find(
                (a: any) =>
                  String(a.pincode || '') === location.pincode ||
                  (Array.isArray(a.coordinates) &&
                    Math.abs(Number(a.coordinates[0]) - Number(location.longitude)) < 0.0005 &&
                    Math.abs(Number(a.coordinates[1]) - Number(location.latitude)) < 0.0005),
              );
              addressId = (match || addrRes.data[0])._id || (match || addrRes.data[0]).id;
            } else {
              const createRes = await apiClient.post<any>('/customer/addresses', {
                line1: location.formattedAddress,
                city: location.city,
                state: location.state,
                pincode: location.pincode,
                coordinates: [location.longitude, location.latitude],
              });
              if (createRes.success) addressId = createRes.data?._id || createRes.data?.id;
            }
          } catch {
            /* fall through */
          }
        }

        const weightRangeId = state.selectedWeightRangeId;
        if (!isValidMongoId(addressId) || !weightRangeId) {
          if (isMounted) {
            setAvailabilityError(
              !weightRangeId
                ? 'Select an estimated weight first.'
                : 'Could not save pickup address. Please re-select your locality.',
            );
            setLoading(false);
          }
          return;
        }
        setAddressId(addressId!);

        const res = await apiClient.getAvailability<any>(addressId!, weightRangeId);

        if (!isMounted || !res.success || !res.data) {
          if (isMounted) setAvailabilityError('Could not load pickup availability.');
          return;
        }

        const data = res.data;
        setAvailabilityMode(data.mode);
        setHelperText(data.helperText || '');
        setOutOfCoverage(!!data.outOfCoverage);

        if (data.mode === 'SLOTS') {
          const rawSlots = Array.isArray(data.slotsMode?.timeSlots)
            ? data.slotsMode.timeSlots
            : [];
          const slots: TimeSlotItem[] =
            rawSlots.length > 0
              ? rawSlots.map((s: any) => {
                  const start = s.startTime || '10:00';
                  const hour = Number(start.split(':')[0]);
                  const period: TimeSlotItem['period'] =
                    hour < 12 ? 'morning' : hour < 16 ? 'afternoon' : 'evening';
                  return {
                    id: s._id || s.id,
                    period,
                    displayLabel: s.displayLabel || `${s.startTime} - ${s.endTime}`,
                    startTime: s.startTime,
                    endTime: s.endTime,
                  };
                })
              : timeSlots;

          setAvailableSlots(slots);

          const apiDates = Array.isArray(data.slotsMode?.dates) ? data.slotsMode.dates : [];
          const dates = apiDates.length > 0 ? apiDates : buildNextSevenDates();
          setAvailableDates(dates);

          if (dates.length && !dates.some((d: any) => d.iso === state.selectedDate)) {
            setDate(dates[0].iso);
          }
          if (slots.length && !slots.some((s) => s.id === state.selectedSlotId)) {
            setSlot(slots[0].id);
          }
        }

        if (data.mode === 'ROUTE_DAYS') {
          const dates: RouteDateItem[] = Array.isArray(data.routeDaysMode?.dates)
            ? data.routeDaysMode.dates
            : [];
          setRouteDates(dates);
          setAvailableSlots(timeSlots);

          if (dates.length > 0) {
            const pick =
              dates.find((d) => d.iso === state.selectedDate) || dates[0];
            if (pick.iso !== state.selectedDate) setDate(pick.iso);
            const slotId = resolveSlotForRouteDay(
              timeSlots,
              pick.startTime,
              state.selectedSlotId,
            );
            if (slotId) setSlot(slotId);
          } else if (data.outOfCoverage) {
            // Allow request anyway: tomorrow + first catalog slot
            const fallbackDates = buildNextSevenDates();
            setAvailableDates(fallbackDates);
            if (!state.selectedDate) setDate(fallbackDates[1]?.iso || fallbackDates[0].iso);
            if (timeSlots[0] && !state.selectedSlotId) setSlot(timeSlots[0].id);
          }
        }
      } catch {
        if (isMounted) setAvailabilityError('Could not load pickup availability.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchAvailability();
    return () => {
      isMounted = false;
    };
    // Intentionally omit selectedDate/slot to avoid re-fetch loops on selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.selectedWeightRangeId,
    state.addressId,
    location.formattedAddress,
    location.city,
    location.state,
    location.pincode,
    location.longitude,
    location.latitude,
    addressReady,
  ]);

  const morningSlots = availableSlots.filter((s) => s.period === 'morning');
  const afternoonSlots = availableSlots.filter((s) => s.period === 'afternoon');
  const eveningSlots = availableSlots.filter((s) => s.period === 'evening');

  const displayDates = useMemo(() => {
    if (availabilityMode === 'SLOTS') {
      return availableDates.length > 0 ? availableDates : buildNextSevenDates();
    }
    return availableDates;
  }, [availabilityMode, availableDates]);

  const handleSelectRouteDate = (item: RouteDateItem) => {
    setDate(item.iso);
    const slotId = resolveSlotForRouteDay(timeSlots.length ? timeSlots : availableSlots, item.startTime);
    if (slotId) setSlot(slotId);
  };

  const handleContinue = () => {
    if (availabilityMode === 'ROUTE_DAYS') {
      const selectedRoute = routeDates.find((d) => d.iso === state.selectedDate);
      const slotId = resolveSlotForRouteDay(
        timeSlots.length ? timeSlots : availableSlots,
        selectedRoute?.startTime,
        state.selectedSlotId,
      );
      if (slotId) setSlot(slotId);
      if (!state.selectedDate) {
        const fallback = routeDates[0]?.iso || buildNextSevenDates()[1]?.iso;
        if (fallback) setDate(fallback);
      }
    } else if (!state.selectedSlotId && availableSlots[0]) {
      setSlot(availableSlots[0].id);
    }
    onNext();
  };

  const canContinueRoute =
    availabilityMode === 'ROUTE_DAYS' &&
    (Boolean(state.selectedDate && routeDates.length) ||
      (outOfCoverage && Boolean(state.selectedDate || timeSlots.length)));

  const canContinueSlots =
    availabilityMode === 'SLOTS' &&
    Boolean(state.selectedDate && (state.selectedSlotId || availableSlots[0]));

  const isContinueEnabled =
    !loading &&
    !availabilityError &&
    addressReady &&
    (canContinueRoute || canContinueSlots || (outOfCoverage && addressReady));

  return (
    <div className="flex flex-col justify-between min-h-[calc(100vh-140px)]">
      <div className="space-y-5 pb-6">
        <div>
          <h2 className="text-xl font-black text-slate-900 leading-tight">
            When would you like us to pick it up?
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {availabilityMode === 'ROUTE_DAYS'
              ? 'Select your preferred collection date for your area.'
              : 'Choose your preferred date and convenient time window.'}
          </p>
        </div>

        {!addressReady && !loading && (
          <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900">Pickup address incomplete</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Choose a covered locality with a valid 6-digit pincode so we can check collection days.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openSheet}
              className="w-full py-2.5 rounded-xl bg-[#0A3D2B] text-white text-xs font-bold"
            >
              Select pickup locality
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-[#0A3D2B]" />
            <span className="text-xs font-semibold">Checking area schedule...</span>
          </div>
        ) : availabilityError && addressReady ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-3">
            <p className="text-xs text-rose-700">{availabilityError}</p>
            <button
              type="button"
              onClick={openSheet}
              className="text-xs font-bold text-rose-800 underline"
            >
              Update address
            </button>
          </div>
        ) : availabilityMode === 'ROUTE_DAYS' ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[#0A3D2B] mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#0A3D2B]">
                  {helperText || `We collect from ${location.areaName || 'your area'} on these days.`}
                </p>
                <p className="text-[11px] text-emerald-800/80 mt-0.5">
                  Pick a convenient day. Our collection vehicle will visit during the scheduled window.
                </p>
              </div>
            </div>

            {routeDates.length > 0 ? (
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-700 block px-0.5">
                  Upcoming Collection Days
                </label>
                {routeDates.map((item) => {
                  const isSelected = state.selectedDate === item.iso;
                  return (
                    <motion.div
                      key={item.iso}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectRouteDate(item)}
                      className={`p-4 rounded-3xl border-2 flex items-center justify-between cursor-pointer transition-all shadow-xs ${
                        isSelected
                          ? 'border-[#0A3D2B] bg-emerald-50/70 shadow-sm ring-1 ring-[#0A3D2B]'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-[#0A3D2B] text-white shadow-md'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wider leading-none">
                            {item.weekday}
                          </span>
                          <span className="text-base font-black my-0.5 leading-none">
                            {item.dayNum}
                          </span>
                          <span className="text-[9px] font-medium leading-none opacity-80">
                            {item.monthStr}
                          </span>
                        </div>

                        <div>
                          <h4
                            className={`text-xs font-extrabold ${
                              isSelected ? 'text-[#0A3D2B]' : 'text-slate-900'
                            }`}
                          >
                            {item.weekday}, {item.dayNum} {item.monthStr}
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                            Collection Window:{' '}
                            <span className="font-bold text-slate-700">{item.windowLabel}</span>
                          </p>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-[#0A3D2B] bg-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-[#0A3D2B]" />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : outOfCoverage ? (
              <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-700 mx-auto" />
                <h4 className="text-xs font-extrabold text-amber-900">Coverage Note</h4>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  We will confirm a collection day for your area shortly. You can proceed with your
                  request, and our operations team will coordinate your pickup.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2 px-0.5">
                Select Pickup Date
              </label>
              <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
                {displayDates.map((item) => {
                  const isSelected = state.selectedDate === item.iso;
                  return (
                    <motion.div
                      key={item.iso}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setDate(item.iso)}
                      className={`min-w-[76px] py-3 px-2 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer transition-all shadow-xs ${
                        isSelected
                          ? 'border-[#0A3D2B] bg-[#0A3D2B] text-white shadow-md shadow-emerald-950/20'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isSelected ? 'text-[#F59E0B]' : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="text-lg font-black my-0.5 leading-none">{item.dayNum}</span>
                      <span
                        className={`text-[10px] font-medium ${
                          isSelected ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {item.monthStr}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-700 block px-0.5 -mb-2">
                Select Time Slot
              </label>

              {availableSlots.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No time slots are configured yet. Please retry later or contact support.
                </div>
              ) : (
                <>
                  {morningSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-700">
                        <Sun className="w-3.5 h-3.5" />
                        <span>Morning Slots</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {morningSlots.map((slot) => {
                          const isSelected = state.selectedSlotId === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSlot(slot.id)}
                              className={`py-3 px-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
                                isSelected
                                  ? 'border-[#0A3D2B] bg-[#0A3D2B] text-white shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {slot.displayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {afternoonSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-800">
                        <CloudSun className="w-3.5 h-3.5" />
                        <span>Afternoon Slots</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {afternoonSlots.map((slot) => {
                          const isSelected = state.selectedSlotId === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSlot(slot.id)}
                              className={`py-3 px-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
                                isSelected
                                  ? 'border-[#0A3D2B] bg-[#0A3D2B] text-white shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {slot.displayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {eveningSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-indigo-950">
                        <Moon className="w-3.5 h-3.5" />
                        <span>Evening Slots</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {eveningSlots.map((slot) => {
                          const isSelected = state.selectedSlotId === slot.id;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSlot(slot.id)}
                              className={`py-3 px-3 rounded-2xl border-2 text-xs font-bold transition-all text-center ${
                                isSelected
                                  ? 'border-[#0A3D2B] bg-[#0A3D2B] text-white shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                              }`}
                            >
                              {slot.displayLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-slate-200/80">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={!isContinueEnabled}
          className={`w-full py-4 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all ${
            isContinueEnabled
              ? 'bg-[#0A3D2B] text-white shadow-emerald-950/20 hover:bg-[#0E4D36] cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          <span>{outOfCoverage && routeDates.length === 0 ? 'Continue anyway' : 'Continue'}</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </motion.button>
        <button type="button" className="sr-only" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
};
