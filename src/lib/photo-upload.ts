import { apiClient, getApiErrorMessage } from './api-client';

export interface UploadConfig {
  enabled: boolean;
  maxPhotos: number;
  maxMb: number;
}

/** Whether photo upload is set up on the server (and its limits). null = could not find out. */
export async function loadUploadConfig(): Promise<UploadConfig | null> {
  try {
    const res = await apiClient.get<UploadConfig>('/uploads/config');
    return res.success && res.data ? res.data : null;
  } catch {
    return null;
  }
}

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Phone photos are often 5-10 MB. Shrink them to ~1600 px JPEG first: far quicker on mobile data, and the
 * picker only needs to see what the scrap is. Falls back to the original file if the browser cannot decode it.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Uploads one photo straight to Cloudinary using a short-lived signature from our backend (the API secret
 * never reaches the phone). Resolves to the photo's https link; throws an Error with a message to show.
 */
export async function uploadPhoto(file: File, maxMb: number): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a photo (JPG, PNG or WebP).');

  const body = await shrink(file);
  if (body.size > maxMb * 1024 * 1024) throw new Error(`That photo is too large. Please use one under ${maxMb} MB.`);

  const signed = await apiClient.post<any>('/uploads/sign');
  if (!signed.success || !signed.data) {
    throw new Error(getApiErrorMessage(signed.error, 'Photo upload is not available right now.'));
  }
  const s = signed.data;

  const form = new FormData();
  form.append('file', body, 'scrap.jpg');
  form.append('api_key', s.apiKey);
  form.append('timestamp', String(s.timestamp));
  form.append('folder', s.folder);
  form.append('allowed_formats', s.allowedFormats);
  form.append('signature', s.signature);

  let json: any = null;
  try {
    const res = await fetch(s.uploadUrl, { method: 'POST', body: form });
    json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message || 'Upload failed.');
  } catch (e: any) {
    throw new Error(e?.message && e.message !== 'Failed to fetch' ? e.message : 'Upload failed. Check your connection and try again.');
  }
  if (!json?.secure_url) throw new Error('Upload failed. Please try again.');
  return String(json.secure_url);
}
