import type { LocationData } from '../context/LocationContext';
import { apiClient } from './api-client';

export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

/** A customer can save this many addresses (Home, Work and one more); the server enforces it too. */
export const MAX_SAVED_ADDRESSES = 3;

export interface SavedAddress {
  _id?: string;
  id?: string;
  line1: string;
  houseNumber?: string;
  label?: AddressLabel;
  labelName?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string | null;
  isDefault?: boolean;
  location?: { coordinates?: number[] };
}

export const addressIdOf = (address: SavedAddress): string => String(address._id || address.id || '');

/** "Home", "Work", or the customer's own name for an Other address. */
export function addressTitle(address: SavedAddress): string {
  if (address.label === 'HOME') return 'Home';
  if (address.label === 'WORK') return 'Work';
  return address.labelName?.trim() || 'Other';
}

/** House / flat number first, then the address line: what a person reads out as "my address". */
export function addressLine(address: SavedAddress): string {
  return [address.houseNumber, address.line1].filter(Boolean).join(', ');
}

/** The name to suggest for the next address: Home, then Work, then Other. */
export function nextAddressLabel(addresses: SavedAddress[]): AddressLabel {
  if (!addresses.some((a) => a.label === 'HOME')) return 'HOME';
  if (!addresses.some((a) => a.label === 'WORK')) return 'WORK';
  return 'OTHER';
}

/** The customer's saved addresses, primary first. Empty when none or when the request fails. */
export async function fetchSavedAddresses(): Promise<SavedAddress[]> {
  try {
    const res = await apiClient.get<SavedAddress[]>('/customer/addresses');
    return res.success && Array.isArray(res.data) ? res.data : [];
  } catch {
    return [];
  }
}

/** The app-wide pickup location that corresponds to a saved address. */
export function addressToLocation(address: SavedAddress): LocationData {
  const [lng, lat] = address.location?.coordinates || [];
  return {
    areaName: address.line1.split(',')[0].trim(),
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    formattedAddress: address.line1,
    houseNumber: address.houseNumber || '',
    landmark: address.landmark || '',
    latitude: lat != null ? Number(lat) : undefined,
    longitude: lng != null ? Number(lng) : undefined,
    source: 'manual',
  };
}
