"use client";

import { Button } from '../ui';
import React, { useEffect, useRef, useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { GoogleAttribution } from './GoogleAttribution';

interface NearbyLandmark {
  name: string;
  kind: string;
  distanceMeters: number;
}

interface LandmarkPickerProps {
  latitude?: number;
  longitude?: number;
  value: string;
  onChange: (landmark: string) => void;
  /** Fill the nearest landmark in by itself (editable) when nothing is entered yet. */
  autoFill?: boolean;
  label?: string;
}

const distanceLabel = (m: number) => (m <= 0 ? '' : m < 1000 ? ` · ${Math.round(m / 10) * 10} m` : ` · ${(m / 1000).toFixed(1)} km`);

/**
 * "Nearby landmark": named places around the picked point (temple, school, bank, ...) as tap-to-use
 * suggestions, plus a free-text box. Shows no suggestions, and never blocks, when none can be found.
 */
export const LandmarkPicker: React.FC<LandmarkPickerProps> = ({
  latitude,
  longitude,
  value,
  onChange,
  autoFill = true,
  label = 'Nearby landmark',
}) => {
  const [items, setItems] = useState<NearbyLandmark[]>([]);
  const [loading, setLoading] = useState(false);

  // Once the customer has typed or tapped, never overwrite their choice with a suggestion.
  const touched = useRef(false);
  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (latitude == null || longitude == null) {
      setItems([]);
      return;
    }
    let stale = false;
    setLoading(true);
    setItems([]);
    apiClient
      .nearbyLandmarks<NearbyLandmark[]>(latitude, longitude)
      .then((res) => {
        if (stale) return;
        const list = res.success && Array.isArray(res.data) ? res.data : [];
        setItems(list);
        if (autoFill && !touched.current && !valueRef.current.trim() && list.length > 0) {
          onChangeRef.current(list[0].name);
        }
      })
      .catch(() => {
        if (!stale) setItems([]);
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
    // a new point means new suggestions; value/onChange are read through refs on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude, autoFill]);

  return (
    <div>
      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
        <Landmark className="w-3.5 h-3.5" />
        {label} <span className="font-medium normal-case text-slate-400">(optional)</span>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
      </label>
      <input aria-label="e.g. Near Sri Venkateswara Temple"
        type="text"
        value={value}
        onChange={(e) => {
          touched.current = true;
          onChange(e.target.value.slice(0, 120));
        }}
        placeholder="e.g. Near Sri Venkateswara Temple"
        className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all"
      />
      {items.length > 0 && <GoogleAttribution />}
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Landmarks near you">
          {items.map((item) => {
            const active = value.trim().toLowerCase() === item.name.toLowerCase();
            return (
              <Button
                key={`${item.name}-${item.distanceMeters}`}
                type="button"
                onClick={() => {
                  touched.current = true;
                  onChange(item.name);
                }}
                className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold text-left cursor-pointer transition-colors ${
                  active
                    ? 'bg-brand border-brand text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400'
                }`}
              >
                {item.name}
                <span className={active ? 'text-emerald-200' : 'text-slate-400'}>
                  {' '}
                  ({item.kind}
                  {distanceLabel(item.distanceMeters)})
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
};
