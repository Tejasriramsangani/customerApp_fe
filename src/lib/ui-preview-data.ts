import type { ApiResponse } from './api-client';
export const previewUser = { id: 'ui-preview-customer', mobile: '0000000000', fullName: 'UI Preview Customer' };
export const previewPlace = { areaName: 'Synthetic locality', city: 'Preview City', state: 'Preview State', pincode: '000000',
  formattedAddress: 'Synthetic preview address — not a real pickup location', latitude: 16.5, longitude: 80.6 };
export function createPreviewTransport() {
  let nextId = 10;
  let addresses: Record<string, unknown>[] = [{ _id: '640000000000000000000004', line1: previewPlace.formattedAddress,
    ...previewPlace, houseNumber: 'DEMO', label: 'HOME', isDefault: true, location: { coordinates: [80.6, 16.5] } }];
  let profile = { ...previewUser };
  const categories = ['Paper', 'Plastic', 'Metal'].map((name, i) => ({ _id: `64000000000000000000000${i + 1}`, name,
    code: name.toUpperCase(), startingRatePerKgRupees: 10 + i * 5, products: [{ _id: `65000000000000000000000${i + 1}`, name: name + ' (sample)', activeRate: { ratePerKgRupees: 10 + i * 5 } }] }));
  const slots = [{ _id: '640000000000000000000006', startTime: '10:00', endTime: '12:00', displayLabel: '10 AM–12 PM' }];
  return async (endpoint: string, options: RequestInit = {}): Promise<ApiResponse> => {
    const path = endpoint.split('?')[0], method = options.method || 'GET';
    const ok = (data: unknown): ApiResponse => ({ success: true, data: structuredClone(data), timestamp: new Date().toISOString() });
    const fail = (): ApiResponse => ({ success: false, data: null, error: { message: 'Unavailable in UI preview. No request was sent. Use the preview screen selector to continue.' }, timestamp: new Date().toISOString() });
    if (path.startsWith('/auth/')) return fail();
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
    if (path === '/customer/profile') { if (method === 'PUT' || method === 'PATCH') profile = { ...profile, fullName: String(body.fullName || profile.fullName) }; return ok(profile); }
    if (path === '/customer/addresses') {
      if (method === 'POST') addresses.push({ ...body, _id: String(nextId++).padStart(24, '0'), location: { coordinates: body.coordinates } });
      return ok(method === 'POST' ? addresses.at(-1) : addresses);
    }
    const match = path.match(/^\/customer\/addresses\/([^/]+)(\/primary)?$/);
    if (match) {
      const address = addresses.find(item => item._id === match[1]);
      if (!address) return fail();
      if (method === 'DELETE') addresses = addresses.filter(item => item !== address);
      else if (method === 'PUT' && match[2]) addresses.forEach(item => { item.isDefault = item === address; });
      return ok(address);
    }
    if (method === 'GET') {
      if (path === '/catalog') return ok(categories);
      if (path === '/catalog/weight-ranges') return ok([{ _id: '640000000000000000000005', label: '1–10 kg', minGrams: 1000, maxGrams: 10000 }]);
      if (path === '/catalog/slots') return ok(slots);
      if (path === '/availability') return ok({ mode: 'SLOTS', slotsMode: { timeSlots: slots } });
      if (path === '/uploads/config') return ok({ enabled: false, maxPhotos: 0, maxMb: 0 });
      if (path === '/customer/pickups' || path === '/catalog/donation-recipients') return ok([]);
    }
    return fail();
  };
}
