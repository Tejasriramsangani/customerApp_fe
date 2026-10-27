"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, QrCode, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiClient, getApiErrorMessage } from '../../lib/api-client';

interface PickupQrCardProps {
  pickupId: string;
  pickupCode: string;
  status: string;
  /** Place higher / emphasize when executive has arrived */
  emphasized?: boolean;
}

export const PickupQrCard: React.FC<PickupQrCardProps> = ({
  pickupId,
  pickupCode,
  status,
  emphasized = false,
}) => {
  const [qrToken, setQrToken] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canShow = ['ASSIGNED', 'ON_THE_WAY', 'ARRIVED'].includes(status);

  const loadQr = useCallback(async () => {
    if (!pickupId || !canShow) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.getQr<{
        qrToken?: string;
        token?: string;
        expiresAt?: string;
        pickupCode?: string;
      }>(pickupId);
      if (res.success && res.data) {
        const token = res.data.qrToken || res.data.token || '';
        setQrToken(token);
        setExpiresAt(res.data.expiresAt ? String(res.data.expiresAt) : null);
        if (!token) setError('QR token was empty. Tap refresh.');
      } else {
        setQrToken('');
        setError(getApiErrorMessage(res.error, 'Could not load pickup QR.'));
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load pickup QR.');
    } finally {
      setLoading(false);
    }
  }, [pickupId, canShow]);

  useEffect(() => {
    loadQr();
  }, [loadQr]);

  // Auto-refresh ~1 min before expiry (tokens last 30 min)
  useEffect(() => {
    if (!expiresAt || !canShow) return;
    const ms = new Date(expiresAt).getTime() - Date.now() - 60_000;
    if (ms <= 0) {
      loadQr();
      return;
    }
    const t = window.setTimeout(() => loadQr(), ms);
    return () => window.clearTimeout(t);
  }, [expiresAt, canShow, loadQr]);

  if (!canShow) return null;

  const expiresLabel = expiresAt
    ? new Date(expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className={`w-full rounded-3xl border-2 p-4 space-y-3 ${
        emphasized
          ? 'border-[#0A3D2B] bg-emerald-50/80 shadow-md ring-1 ring-[#0A3D2B]/20'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-slate-900">
            <QrCode className="w-4 h-4 text-emerald-800" />
            Show this QR to the pickup executive
          </div>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            When they arrive, ask them to scan this code to verify the pickup and start weighing.
          </p>
        </div>
        <button
          type="button"
          onClick={loadQr}
          disabled={loading}
          className="shrink-0 p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
          title="Refresh QR"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        {loading && !qrToken ? (
          <div className="py-10 flex flex-col items-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-700" />
            <span className="text-xs font-bold">Generating secure QR…</span>
          </div>
        ) : error && !qrToken ? (
          <div className="w-full p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
            {error}
          </div>
        ) : qrToken ? (
          <>
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
              <QRCodeSVG
                value={qrToken}
                size={emphasized ? 220 : 200}
                level="M"
                includeMargin
                bgColor="#FFFFFF"
                fgColor="#04160E"
              />
            </div>
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                Pickup {pickupCode}
              </div>
              {expiresLabel && (
                <p className="text-[10px] text-slate-400 font-semibold">
                  Valid until {expiresLabel} · refresh for a new code
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
