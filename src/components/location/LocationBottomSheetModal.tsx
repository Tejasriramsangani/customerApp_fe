"use client";

import type { LocationData } from "../../context/LocationContext";
import { LocationSelectionFlow } from "./LocationSelectionFlow";

interface LocationBottomSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation?: (location: LocationData) => void;
  initialHint?: string;
}

/** Retains existing entry points while presenting one shared full-screen location flow. */
export function LocationBottomSheetModal({
  isOpen,
  ...props
}: LocationBottomSheetModalProps) {
  return isOpen ? <LocationSelectionFlow {...props} /> : null;
}
