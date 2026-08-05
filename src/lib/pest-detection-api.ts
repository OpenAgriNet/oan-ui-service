import axios from 'axios';
import apiService from '@/lib/api';

// ---- Interfaces ----

export interface CropItem {
  crop_id: number;
  crop_name: string;
  crop_name_mr?: string;
  crop_name_hi?: string;
}

export interface PredictionEntry {
  disease_type: string;
  disease_id: string;
  confidence_score: number;
}

export interface PredictionResult {
  success: boolean;
  message: string;
  data: {
    crop_id: number;
    crop_type: string;
    sowing_date: string;
    predictions: PredictionEntry[];
    created_at: string;
  };
}

export interface AdvisoryResult {
  crop_id?: number;
  crop_name?: string;
  disease_pest?: string;
  disease_pest_mr?: string;
  disease_pest_hi?: string;
  disease_pest_en?: string;
  preventive_measures: string;
  preventive_measures_en?: string;
  preventive_measures_mr?: string;
  preventive_measures_hi?: string;
  curative_measures: string;
  curative_measures_en?: string;
  curative_measures_mr?: string;
  curative_measures_hi?: string;
  note?: string;
  [key: string]: unknown;
}

interface PestCropApiItem {
  id: number;
  name: string;
  name_mr?: string;
  name_hi?: string;
}

interface PestCropApiEnvelope {
  status: number;
  response: string;
  data: PestCropApiItem[];
}

// ---- API Base URLs ----

const PEST_FEEDBACK_API_BASE = 'https://farmers-app-api.mahapocra.gov.in';

const asArray = <T>(payload: unknown): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === 'object' && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: T[] }).data;
  }
  return [];
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const toString = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const normalizeCrop = (item: CropApiItem): CropItem | null => {
  const cropId = toNumber(item.crop_id ?? item.id);
  const cropName = toString(item.crop_name ?? item.name);
  if (cropId === undefined || !cropName) return null;

  return {
    crop_id: cropId,
    crop_name: cropName,
    crop_name_mr: toString(item.crop_name_mr ?? item.name_mr),
    crop_name_hi: toString(item.crop_name_hi ?? item.name_hi),
  };
};

// ---- Fallback Crops (used when API is unavailable) ----

export const FALLBACK_CROPS: CropItem[] = [
  { crop_id: 67, crop_name: 'Kharif Maize' },
  { crop_id: 86, crop_name: 'Paddy' },
  { crop_id: 70, crop_name: 'Wheat' },
  { crop_id: 68, crop_name: 'Kharif Sorghum' },
  { crop_id: 58, crop_name: 'Gram' },
  { crop_id: 33, crop_name: 'Pigeon pea (Tur)' },
  { crop_id: 74, crop_name: 'Groundnut' },
  { crop_id: 30, crop_name: 'Soybean' },
  { crop_id: 97, crop_name: 'Mustard' },
  { crop_id: 8, crop_name: 'Sugarcane (Adsali)' },
  { crop_id: 25, crop_name: 'Cotton' },
  { crop_id: 7, crop_name: 'Potato' },
  { crop_id: 39, crop_name: 'Veg- Onion' },
  { crop_id: 42, crop_name: 'Veg- Tomato ' },
  { crop_id: 3, crop_name: 'Brinjal' },
  { crop_id: 183, crop_name: 'Apple' },
  { crop_id: 48, crop_name: 'Mango' },
];

// ---- Service Functions ----

/**
 * Get available crops for pest detection dropdown.
 * API returns { status, data: [{ id, name, name_mr?, name_hi? }, ...] }.
 */
export async function getCrops(): Promise<CropItem[]> {
  const response = await axios.get(
    `${PEST_API_BASE}/pestdetectionServices/get-crops-for-pest-detection`
  );

  // Supports both legacy array response and current envelope response.
  const payload = response.data as PestCropApiEnvelope | PestCropApiItem[] | null | undefined;
  const crops = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  return crops.map((crop) => ({
    crop_id: crop.id,
    crop_name: crop.name,
    crop_name_mr: crop.name_mr,
    crop_name_hi: crop.name_hi,
  }));
}

/**
 * Store user feedback for a pest detection response (upload id from /api/upload/).
 */
export async function storePestFeedback(
  uploadId: string,
  feedback: string
): Promise<unknown> {
  const formData = new FormData();
  formData.append('id', uploadId.trim());
  formData.append('feedback', feedback.trim());

  const response = await axios.post(
    `${PEST_FEEDBACK_API_BASE}/pestdetectionServices/store-feedback`,
    formData
  );
  return response.data;
}
