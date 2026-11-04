"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Plus, X } from 'lucide-react';
import { UploadConfig, loadUploadConfig, uploadPhoto } from '../../lib/photo-upload';

interface ScrapPhotoUploaderProps {
  urls: string[];
  onChange: (urls: string[]) => void;
}

/**
 * Optional photos of the scrap on the Review screen. Hidden altogether when the server has no photo
 * storage set up, so customers never see a button that cannot work.
 */
export const ScrapPhotoUploader: React.FC<ScrapPhotoUploaderProps> = ({ urls, onChange }) => {
  const [config, setConfig] = useState<UploadConfig | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Uploads finish out of order, so always add to the latest list rather than the one from when they began.
  const urlsRef = useRef(urls);
  urlsRef.current = urls;

  useEffect(() => {
    let cancelled = false;
    loadUploadConfig().then((c) => {
      if (!cancelled) setConfig(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!config?.enabled) return null;

  const room = config.maxPhotos - urls.length - uploading;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    const chosen = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > chosen.length) setError(`You can add up to ${config.maxPhotos} photos.`);

    await Promise.all(
      chosen.map(async (file) => {
        setUploading((n) => n + 1);
        try {
          const url = await uploadPhoto(file, config.maxMb);
          if (!urlsRef.current.includes(url)) onChange([...urlsRef.current, url].slice(0, config.maxPhotos));
        } catch (e: any) {
          setError(e?.message || 'Upload failed. Please try again.');
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs">
      <div className="flex items-center gap-2 mb-1">
        <Camera className="w-4 h-4 text-slate-600" />
        <span className="text-xs font-extrabold text-slate-900">
          Photos <span className="font-medium text-slate-400">(optional)</span>
        </span>
      </div>
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        Add up to {config.maxPhotos} clear photos of your scrap so the pickup executive knows what to bring.
      </p>

      <div className="flex flex-wrap gap-2.5">
        {urls.map((url) => (
          <div key={url} className="relative w-20 h-20 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Scrap photo" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(urls.filter((u) => u !== url))}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/75 text-white flex items-center justify-center cursor-pointer"
              aria-label="Remove photo"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {Array.from({ length: uploading }).map((_, i) => (
          <div
            key={`uploading-${i}`}
            className="w-20 h-20 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 flex items-center justify-center"
            aria-label="Uploading photo"
          >
            <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
          </div>
        ))}

        {room > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-600 text-slate-500 hover:text-emerald-800 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[10px] font-bold">Add photo</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && <p className="text-[11px] font-semibold text-rose-600 mt-2">⚠️ {error}</p>}
    </div>
  );
};
