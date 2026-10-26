"use client";

import React, { useState } from 'react';
import { Info, Plus, X, Wrench, Check, Edit3 } from 'lucide-react';

interface AdditionalInfoSectionProps {
  initialTools?: string[];
  initialPhotos?: string[];
  initialRemarks?: string;
  isLocked?: boolean;
  onSavePreparation: (payload: {
    tools?: string[];
    remarks?: string;
    photoUrls?: string[];
  }) => Promise<void>;
}

const AVAILABLE_TOOLS = [
  { name: 'Ladder', icon: '🪜' },
  { name: 'Rope / Ties', icon: '🪢' },
  { name: 'Trolley', icon: '🛒' },
  { name: 'Gloves', icon: '🧤' },
];

export const AdditionalInfoSection: React.FC<AdditionalInfoSectionProps> = ({
  initialTools = ['Ladder'],
  initialRemarks = '',
  isLocked = false,
  onSavePreparation,
}) => {
  const [tools, setTools] = useState<string[]>(initialTools);
  const [remarks, setRemarks] = useState(initialRemarks);
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [tempRemarks, setTempRemarks] = useState(initialRemarks);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleRemoveTool = async (toolName: string) => {
    if (isLocked) return;
    const updated = tools.filter((t) => t !== toolName);
    setTools(updated);
    await onSavePreparation({ tools: updated });
  };

  const handleAddTool = async (toolName: string) => {
    if (isLocked || tools.includes(toolName)) return;
    const updated = [...tools, toolName];
    setTools(updated);
    setShowToolPicker(false);
    await onSavePreparation({ tools: updated });
  };

  const handleSaveRemarks = async () => {
    setIsSaving(true);
    try {
      setRemarks(tempRemarks);
      setIsEditingRemarks(false);
      await onSavePreparation({ remarks: tempRemarks });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl p-4 shadow-xs border border-slate-200/90 mb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
          <Info className="w-4 h-4" />
        </div>
        <h3 className="text-xs font-black text-slate-900 tracking-tight">
          Additional Information
        </h3>
      </div>

      {/* 1. Special Tools */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-slate-400" />
            Special Tools Needed
          </label>
          {!isLocked && (
            <button
              onClick={() => setShowToolPicker(!showToolPicker)}
              className="text-[10px] font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" />
              Add Tool
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => (
            <div
              key={tool}
              className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-800"
            >
              <span>🪜</span>
              <span>{tool}</span>
              {!isLocked && (
                <button
                  onClick={() => handleRemoveTool(tool)}
                  className="w-3.5 h-3.5 rounded-full hover:bg-rose-100 hover:text-rose-600 text-slate-400 flex items-center justify-center ml-0.5 cursor-pointer"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
          {tools.length === 0 && (
            <span className="text-xs text-slate-400 italic">No tools requested</span>
          )}
        </div>

        {/* Inline Tool Picker Popup */}
        {showToolPicker && (
          <div className="mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap gap-1.5 animate-in fade-in">
            {AVAILABLE_TOOLS.map((t) => (
              <button
                key={t.name}
                onClick={() => handleAddTool(t.name)}
                disabled={tools.includes(t.name)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                  tools.includes(t.name)
                    ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-emerald-500 text-slate-700 cursor-pointer'
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Doorstep Instructions / Notes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold text-slate-600">
            Doorstep Directions / Notes
          </label>
          {!isLocked && !isEditingRemarks && (
            <button
              onClick={() => setIsEditingRemarks(true)}
              className="text-[10px] font-bold text-emerald-800 hover:text-emerald-900 flex items-center gap-1"
            >
              <Edit3 className="w-3 h-3" />
              Edit
            </button>
          )}
        </div>

        {isEditingRemarks ? (
          <div className="space-y-2">
            <textarea
              value={tempRemarks}
              onChange={(e) => setTempRemarks(e.target.value)}
              placeholder="e.g. Scrap kept near main gate. Please call 10 mins before arrival."
              rows={2}
              className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-hidden focus:border-[#0A3D2B] text-slate-800"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setTempRemarks(remarks);
                  setIsEditingRemarks(false);
                }}
                className="px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRemarks}
                disabled={isSaving}
                className="px-3 py-1 text-xs font-bold bg-[#0A3D2B] text-white rounded-lg flex items-center gap-1 shadow-2xs"
              >
                <Check className="w-3 h-3" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 font-medium leading-relaxed">
            {remarks || <span className="text-slate-400 italic">No notes provided</span>}
          </div>
        )}
      </div>
    </div>
  );
};
