"use client";

import { Button } from '../ui';
import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Sun,
  Loader2,
  Sparkles,
  AlertCircle,
  Sunrise,
  Sunset,
  Clock,
  Check,
  CalendarCheck,
  UserCheck,
} from 'lucide-react';
import { usePickupBooking, TimeSlotItem } from '../../context/PickupBookingContext';
import { useLocation } from '../../context/LocationContext';
import { apiClient } from '../../lib/api-client';
import { addressIdOf, addressToLocation, SavedAddress } from '../../lib/address-helpers';
import { PickupAddressSelector } from './PickupAddressSelector';
import {
  buildNextSevenDates,
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

/** A slot must start at least this long from now (a picker needs time to be assigned and travel). */
const MIN_LEAD_MINUTES = 60;

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PERIODS: Array<{ key: TimeSlotItem['period']; label: string; hint: string; Icon: typeof Sun; tone: string }> = [
  { key: 'morning', label: 'Morning', hint: 'Before 12 PM', Icon: Sunrise, tone: 'text-amber-600 bg-amber-50' },
  { key: 'afternoon', label: 'Afternoon', hint: '12 PM – 4 PM', Icon: Sun, tone: 'text-orange-600 bg-orange-50' },
  { key: 'evening', label: 'Evening', hint: 'After 4 PM', Icon: Sunset, tone: 'text-indigo-600 bg-indigo-50' },
];

export const ScheduleSlotStep: React.FC<ScheduleSlotStepProps> = ({ onBack, onNext }) => {
  const { state, timeSlots, setDate, setSlot, setAddressId } = usePickupBooking();
  const { location, setLocation } = useLocation();

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

  // The address chosen in the selector at the top of this step (primary by default).
  const addressReady = isValidMongoId(state.addressId);

  const handleSelectAddress = (address: SavedAddress) => {
    setAddressId(addressIdOf(address));
    // Keep the app-wide pickup location in step with the chosen address.
    setLocation(addressToLocation(address));
  };

  // Clock tick so "today" slots that have passed or are too close switch off while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const todayIso = localIso(new Date(now));

  const isSlotBookable = (iso: string, startTime: string) => {
    if (iso !== todayIso) return true;
    const [h, m] = startTime.split(':').map(Number);
    const start = new Date(now);
    start.setHours(h || 0, m || 0, 0, 0);
    return start.getTime() - now >= MIN_LEAD_MINUTES * 60_000;
  };
  const hasBookableSlot = (iso: string) => availableSlots.some((sl) => isSlotBookable(iso, sl.startTime));

  useEffect(() => setAvailableSlots(timeSlots), [timeSlots]);

  useEffect(() => {
    let isMounted = true;

    async function fetchAvailability() {
      setLoading(true);
      setAvailabilityError('');
      setOutOfCoverage(false);

      try {
        // No address chosen yet: the selector above asks for one, so there is nothing to load.
        if (!addressReady) {
          if (isMounted) setLoading(false);
          return;
        }

        const addressId = state.addressId as string;
        const weightRangeId = state.selectedWeightRangeId;
        if (!weightRangeId) {
          if (isMounted) {
            setAvailabilityError('Select an estimated weight first.');
            setLoading(false);
          }
          return;
        }

        const res = await apiClient.getAvailability<any>(addressId, weightRangeId);

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

          // Build dates from the customer's own clock so "Today" is right in their timezone.
          const dates = buildNextSevenDates();
          setAvailableDates(dates);

          if (dates.length && !dates.some((d: any) => d.iso === state.selectedDate)) {
            setDate(dates[0].iso);
          }
          if (slots.length && !slots.some((s) => s.id === state.selectedSlotId)) {
            setSlot('');
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
          } else {
            // No collection route covers this address. We do not run fixed route days yet, so fall
            // back to the same date + time slot picker; admin assigns a picker for the chosen slot.
            setAvailabilityMode('SLOTS');
            setOutOfCoverage(false);
            setHelperText('');
            setAvailableSlots(timeSlots);
            setAvailableDates(buildNextSevenDates());
            setSlot('');
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
  }, [state.selectedWeightRangeId, state.addressId, addressReady]);

  // Keep the selection valid: never leave a passed slot selected, and move to the next day when
  // nothing is left today. The customer picks the time themselves rather than us guessing one.
  useEffect(() => {
    if (availabilityMode !== 'SLOTS' || availableSlots.length === 0) return;
    const dates = availableDates.length > 0 ? availableDates : buildNextSevenDates();
    let date = state.selectedDate;
    if (!date || !dates.some((d) => d.iso === date) || !hasBookableSlot(date)) {
      const next = dates.find((d) => hasBookableSlot(d.iso));
      if (next && next.iso !== date) {
        date = next.iso;
        setDate(next.iso);
      }
    }
    const chosen = availableSlots.find((sl) => sl.id === state.selectedSlotId);
    if (chosen && date && !isSlotBookable(date, chosen.startTime)) setSlot('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityMode, availableSlots, availableDates, state.selectedDate, state.selectedSlotId, now]);

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
    }
    onNext();
  };

  const canContinueRoute =
    availabilityMode === 'ROUTE_DAYS' &&
    (Boolean(state.selectedDate && routeDates.length) ||
      (outOfCoverage && Boolean(state.selectedDate || timeSlots.length)));

  const selectedSlot = availableSlots.find((sl) => sl.id === state.selectedSlotId);
  const selectedDateItem = displayDates.find((d) => d.iso === state.selectedDate);
  const canContinueSlots =
    availabilityMode === 'SLOTS' &&
    Boolean(state.selectedDate && selectedSlot && isSlotBookable(state.selectedDate, selectedSlot.startTime));

  const isContinueEnabled =
    !loading &&
    !availabilityError &&
    addressReady &&
    (canContinueRoute || canContinueSlots || (outOfCoverage && addressReady));

  return (
    <div className="customer-booking-step flex flex-col justify-between ">
      <div className="customer-booking-step-body space-y-5 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 leading-tight">
            When would you like us to pick it up?
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {availabilityMode === 'ROUTE_DAYS'
              ? 'Select your preferred collection date for your area.'
              : 'Choose a date and time window that suits you. We will assign a picker for it.'}
          </p>
        </div>

        {/* Where to pick up from: saved addresses (primary selected), or add a new one */}
        <PickupAddressSelector selectedId={state.addressId} onSelect={handleSelectAddress} />

        {!addressReady ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Choose a pickup address above to see the available dates and time slots.
          </p>
        ) : loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
            <span className="text-xs font-semibold">Loading available slots...</span>
          </div>
        ) : availabilityError ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
            <p className="text-xs text-rose-700">{availabilityError}</p>
            <p className="text-[11px] text-rose-600/80">Try another address above if this keeps happening.</p>
          </div>
        ) : availabilityMode === 'ROUTE_DAYS' ? (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/90 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-brand mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-brand">
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
                          ? 'border-brand bg-emerald-50/70 shadow-sm ring-1 ring-brand'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-colors ${
                            isSelected
                              ? 'bg-brand text-white shadow-md'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="text-[11px] font-bold uppercase tracking-wider leading-none">
                            {item.weekday}
                          </span>
                          <span className="text-base font-bold my-0.5 leading-none">
                            {item.dayNum}
                          </span>
                          <span className="text-[11px] font-medium leading-none opacity-80">
                            {item.monthStr}
                          </span>
                        </div>

                        <div>
                          <h4
                            className={`text-xs font-extrabold ${
                              isSelected ? 'text-brand' : 'text-slate-900'
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
                          isSelected ? 'border-brand bg-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-brand" />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : outOfCoverage ? (
              <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-700 mx-auto" />
                <h4 className="text-base font-extrabold text-amber-900">Coverage Note</h4>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  We will confirm a collection day for your area shortly. You can proceed with your
                  request, and our operations team will coordinate your pickup.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Date strip */}
            <section>
              <div className="flex items-center justify-between mb-2.5 px-0.5">
                <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-wider">Pickup date</h3>
                {selectedDateItem && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {selectedDateItem.weekday}, {selectedDateItem.dayNum} {selectedDateItem.monthStr}
                  </span>
                )}
              </div>
              <div className="flex items-stretch gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1">
                {displayDates.map((item) => {
                  const isSelected = state.selectedDate === item.iso;
                  const full = !hasBookableSlot(item.iso);
                  return (
                    <motion.button
                      key={item.iso}
                      type="button"
                      disabled={full}
                      whileTap={full ? undefined : { scale: 0.95 }}
                      onClick={() => setDate(item.iso)}
                      aria-pressed={isSelected}
                      className={`shrink-0 w-[68px] py-2.5 rounded-2xl border-2 flex flex-col items-center transition-all ${
                        full
                          ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                          : isSelected
                            ? 'border-brand bg-brand text-white shadow-md '
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider ${
                          full ? 'text-slate-300' : isSelected ? 'text-gold' : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                      <span className="text-xl font-bold leading-none my-1">{item.dayNum}</span>
                      <span className={`text-[11px] font-medium ${isSelected ? 'text-emerald-100' : ''}`}>
                        {item.monthStr}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </section>

            {/* Time slots grouped by part of day */}
            <section className="space-y-4">
              <h3 className="text-lg font-extrabold text-slate-800 uppercase tracking-wider px-0.5">Time slot</h3>

              {availableSlots.length === 0 ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  No time slots are configured yet. Please retry later or contact support.
                </div>
              ) : (
                PERIODS.map(({ key, label, hint, Icon, tone }) => {
                  const group = availableSlots.filter((sl) => sl.period === key);
                  if (group.length === 0) return null;
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${tone}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">{label}</span>
                        <span className="text-[11px] font-medium text-slate-400">{hint}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {group.map((slot) => {
                          const isSelected = state.selectedSlotId === slot.id;
                          const bookable = isSlotBookable(state.selectedDate, slot.startTime);
                          return (
                            <Button
                              key={slot.id}
                              type="button"
                              disabled={!bookable}
                              onClick={() => setSlot(slot.id)}
                              aria-pressed={isSelected}
                              className={`relative py-3 px-3 rounded-2xl border-2 text-left transition-all ${
                                !bookable
                                  ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-brand bg-emerald-50/70 ring-1 ring-brand/30'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                <Clock
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isSelected ? 'text-brand' : bookable ? 'text-slate-400' : 'text-slate-300'
                                  }`}
                                />
                                <span
                                  className={`text-xs font-extrabold leading-tight ${
                                    isSelected ? 'text-brand' : bookable ? 'text-slate-800' : 'text-slate-300'
                                  }`}
                                >
                                  {slot.displayLabel}
                                </span>
                              </span>
                              {!bookable && (
                                <span className="block text-[11px] font-semibold text-slate-400 mt-1">
                                  Not available today
                                </span>
                              )}
                              {isSelected && (
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand text-white flex items-center justify-center shadow">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                </span>
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            {/* Selection summary + what happens next */}
            <div
              className={`rounded-2xl border p-3.5 flex items-start gap-3 transition-colors ${
                canContinueSlots ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  canContinueSlots ? 'bg-brand text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                {canContinueSlots && selectedDateItem && selectedSlot ? (
                  <>
                    <p className="text-xs font-medium text-brand">
                      {selectedDateItem.weekday}, {selectedDateItem.dayNum} {selectedDateItem.monthStr} ·{' '}
                      {selectedSlot.displayLabel}
                    </p>
                    <p className="text-[11px] text-emerald-800/80 mt-0.5 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 shrink-0" />
                      Our team will assign a picker and confirm with you.
                    </p>
                  </>
                ) : (
                  <p className="text-xs font-semibold text-slate-500 pt-2">Pick a date and a time slot to continue.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="customer-booking-actions pt-4 border-t border-slate-200/80">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleContinue}
          disabled={!isContinueEnabled}
          className={`w-full py-4 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all ${
            isContinueEnabled
              ? 'bg-brand text-white  hover:bg-[var(--brand-hover)] cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          <span>{outOfCoverage && routeDates.length === 0 ? 'Continue anyway' : 'Continue'}</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </motion.button>
        <Button type="button" className="sr-only" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
};
