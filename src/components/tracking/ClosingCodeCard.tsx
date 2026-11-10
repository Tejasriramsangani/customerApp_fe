"use client";

import { Button } from '../ui';
import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../lib/api-client';

interface ClosingCodeCardProps {
  pickupId: string;
  pickupCode: string;
  status: string;
  /** Identifies the weighing summary on screen: a new summary (re-weigh) means a new code. */
  summaryHash?: string;
}

/** The code is available from the moment the weighing summary is ready until the pickup is completed. */
const SHOW_FOR = ['SUMMARY_READY', 'CUSTOMER_CONFIRMED', 'PAYMENT_PENDING', 'SETTLED'];

/**
 * The completion code the pickup executive asks for at the very end. It is shown here, like the pickup
 * QR, instead of being texted: the customer reads it out once they have been paid.
 */
export const ClosingCodeCard: React.FC<ClosingCodeCardProps> = ({ pickupId, pickupCode, status, summaryHash }) => {
  const [code, setCode] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canShow = SHOW_FOR.includes(status);

  const load = useCallback(
    async (refresh = false) => {
      if (!pickupId || !canShow) return;
      setLoading(true);
      setError('');
      try {
        const res = refresh ? await apiClient.resendClosingOtp<any>(pickupId) : await apiClient.getClosingCode<any>(pickupId);
        if (res.success && res.data?.code) {
          setCode(String(res.data.code));
          setExpiresAt(res.data.expiresAt ? String(res.data.expiresAt) : null);
        } else {
          setCode('');
          setError(getApiErrorMessage(res.error, 'Could not load your completion code.'));
        }
      } catch (e: any) {
        setError(e?.message || 'Could not load your completion code.');
      } finally {
        setLoading(false);
      }
    },
    [pickupId, canShow],
  );

  useEffect(() => {
    load();
    // a different summary needs its own code, so ask again when it changes
  }, [load, summaryHash]);

  // When the code runs out, ask for the next one (the server issues a new code once the old one expired).
  useEffect(() => {
    if (!expiresAt || !canShow) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    const t = window.setTimeout(() => load(), Math.max(ms, 1000));
    return () => window.clearTimeout(t);
  }, [expiresAt, canShow, load]);

  if (!canShow) return null;

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="w-full rounded-3xl border-2 border-brand bg-emerald-50/80 p-4 space-y-3 shadow-md ring-1 ring-brand/20">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <KeyRound className="w-4 h-4 text-emerald-800" />
            Confirm with your code
          </div>
          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
            If you agree with the weighing summary above, share this OTP with the pickup executive to confirm the
            handover and that you received the amount.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="shrink-0 p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
          title="Get a new code"
          aria-label="Get a new completion code"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && !code ? (
        <div className="py-6 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          <span className="text-xs font-bold">Getting your code…</span>
        </div>
      ) : error && !code ? (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">{error}</div>
      ) : (
        <div className="flex items-center justify-center gap-2" aria-label={`Completion code ${code.split('').join(' ')}`}>
          {code.split('').map((digit, i) => (
            <span
              key={i}
              className="w-11 h-14 rounded-2xl bg-white border-2 border-emerald-300 shadow-sm flex items-center justify-center font-mono font-bold text-2xl text-brand"
            >
              {digit}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
          Tell this code to the pickup executive <strong>only after you have received your payment</strong>. It
          completes pickup {pickupCode} and cannot be undone.
        </p>
      </div>

      {expiresLabel && code && (
        <p className="text-[11px] text-center text-slate-400 font-semibold">
          Valid until {expiresLabel} · tap refresh for a new code
        </p>
      )}
    </div>
  );
};
