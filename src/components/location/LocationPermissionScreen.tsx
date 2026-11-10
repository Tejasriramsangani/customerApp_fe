"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Button } from '../ui';
import styles from './LocationPermissionScreen.module.css';
import { useLocation, LocationData } from '../../context/LocationContext';
import { LocationBottomSheetModal } from './LocationBottomSheetModal';
import { isCompleteBookingAddress } from '../../lib/booking-helpers';

interface LocationPermissionScreenProps {
  onLocationConfirmed: (location: LocationData) => void;
}

export const LocationPermissionScreen: React.FC<LocationPermissionScreenProps> = ({
  onLocationConfirmed,
}) => {
  const { requestCurrentLocation } = useLocation();
  const [isManualSheetOpen, setIsManualSheetOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [sheetHint, setSheetHint] = useState('');

  const handleAllowLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const detected = await requestCurrentLocation();
      if (detected && isCompleteBookingAddress(detected)) {
        onLocationConfirmed(detected);
      } else {
        setSheetHint(detected
          ? 'We found your position but could not work out the address. Please pick your locality.'
          : 'Location access is unavailable. Please enter your location manually.');
        setIsManualSheetOpen(true);
      }
    } catch {
      setSheetHint('We could not detect your location. Please enter it manually.');
      setIsManualSheetOpen(true);
    } finally {
      setIsLocating(false);
    }
  };

  const handleManualSelection = (selectedLoc: LocationData) => {
    setIsManualSheetOpen(false);
    onLocationConfirmed(selectedLoc);
  };

  return (
    <section className={styles.screen} aria-labelledby="location-access-heading">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} className={styles.illustration}>
        <Image
          src="/onboarding/location-pickup.png"
          alt="A yellow and green scrap collection auto beneath a location pin in a leafy residential neighborhood."
          fill
          sizes="(max-width: 430px) 100vw, 430px"
          priority
          className={styles.artwork}
        />
        <div className={styles.introduction}>
          <h1 id="location-access-heading">Set your location<br />to get started</h1>
          <p>Allow your location or enter it manually to find the best pickup service available near you.</p>
        </div>
      </motion.div>

      <footer className={styles.actions}>
        <Button type="button" onClick={handleAllowLocation} disabled={isLocating} aria-busy={isLocating} className={styles.allow}>
          <span role="status">{isLocating ? 'Detecting your location...' : 'Allow Current Location'}</span>
        </Button>
        <Button type="button" onClick={() => { setSheetHint(''); setIsManualSheetOpen(true); }} className={styles.manual}>
          <span>Enter Location Manually</span>
        </Button>
      </footer>

      <LocationBottomSheetModal
        isOpen={isManualSheetOpen}
        onClose={() => setIsManualSheetOpen(false)}
        onSelectLocation={handleManualSelection}
        initialHint={sheetHint}
      />
    </section>
  );
};
