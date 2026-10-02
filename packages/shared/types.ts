export type RequestStatus = 'to_contact' | 'confirmed' | 'processing' | 'closed' | 'cancelled';
export type BroadSlot = 'morning' | 'afternoon';
export type TimeSlot = 'morning' | 'afternoon' | 'any';
export type BranchVolume = '少量' | '中量' | '大量' | '不確定';
export type DateFlexibility = '僅此日期方便' | '前後 3 天皆可' | '日期可以再與我聯絡確認';
export type AreaUnit = '分' | '甲' | '畝' | '坪';

export interface ServiceRequest {
  id: string;
  created_at: string;
  updated_at: string;
  contact_name: string;
  phone: string;
  service_type: string;
  crop_type: string;
  area_size: string;
  area_value?: string;
  area_unit?: string;
  branch_volume?: string;
  location_area: string;
  location_address: string;
  preferred_date: string;
  preferred_time_slot: TimeSlot;
  date_flexibility?: string;
  notes?: string;
  status: RequestStatus;
  admin_memo?: string;
  line_user_id?: string;
  scheduled_date?: string;
  scheduled_slot_code?: BroadSlot;
  scheduled_start_time?: string;
}

export interface CreateServiceRequestDto {
  contact_name: string;
  phone: string;
  service_type: string;
  crop_type: string;
  area_size?: string;
  area_value: string;
  area_unit: AreaUnit;
  branch_volume?: string;
  location_area: string;
  location_address: string;
  preferred_date: string;
  preferred_time_slot: TimeSlot;
  date_flexibility?: string;
  notes?: string;
  line_user_id?: string;
  id_token?: string;
  turnstile_token?: string;
}

export interface UpdateServiceRequestDto {
  status?: RequestStatus;
  admin_memo?: string;
}

export interface BlockedDate {
  date: string;
  reason?: string;
  created_at: string;
}

export const AREA_UNIT_OPTIONS: AreaUnit[] = ['分', '甲', '畝', '坪'];
export const BRANCH_VOLUME_OPTIONS: BranchVolume[] = ['少量', '中量', '大量', '不確定'];
export const DATE_FLEXIBILITY_OPTIONS: DateFlexibility[] = ['僅此日期方便', '前後 3 天皆可', '日期可以再與我聯絡確認'];

export const SERVICE_OPTIONS = [
  '果樹枝條粉碎',
  '果樹代耕',
  '農機出租',
  '其他農業服務'
] as const;

export const POPULAR_CROPS = [
  '芭樂',
  '蜜棗',
  '芒果',
  '竹子',
  '其他(在備註內填寫作物種類)'
] as const;

export const KAOHSIUNG_DISTRICTS = [
  '燕巢區',
  '大社區',
  '阿蓮區',
  '田寮區',
  '岡山區',
  '橋頭區',
  '楠梓區',
  '旗山區',
  '美濃區',
  '六龜區'
] as const;

// Ep03 Availability & Confirmation Scheduling Types
export interface SlotReservation {
  id: string;
  request_id: string;
  booking_date: string;
  slot_code: BroadSlot;
  scheduled_start_time: string;
  status: 'active' | 'released';
  created_at: string;
  released_at?: string | null;
  notes?: string | null;
}

export type SlotUnavailableReason = 
  | 'weekly_closed' 
  | 'blocked' 
  | 'reserved' 
  | 'past' 
  | 'lead_time' 
  | 'outside_horizon';

export interface DateAvailability {
  date: string;
  selectable: boolean;
  slots: {
    morning: boolean;
    afternoon: boolean;
    any: boolean;
  };
  reasons: {
    morning?: SlotUnavailableReason | null;
    afternoon?: SlotUnavailableReason | null;
  };
}

export interface AvailabilityConfig {
  mode: 'legacy' | 'managed';
  lead_time_days: number;
  booking_horizon_days: number;
}

export interface AvailabilityResponse {
  mode: 'legacy' | 'managed';
  timezone: 'Asia/Taipei';
  today: string;
  lead_time_days: number;
  booking_horizon_days: number;
  window: {
    earliest: string;
    latest: string;
  };
  dates: Record<string, DateAvailability>;
}

export interface AvailabilityRule {
  id: string;
  day_of_week: number; // 0 (週日) ~ 6 (週六)
  slot_code: BroadSlot;
  is_enabled: number; // 0 or 1
  updated_at: string;
}

export interface AvailabilityException {
  id: string;
  exception_date: string;
  slot_code: 'all' | 'morning' | 'afternoon';
  reason?: string | null;
  created_at: string;
}

