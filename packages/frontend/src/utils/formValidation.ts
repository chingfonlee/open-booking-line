import type { CreateServiceRequestDto, AvailabilityResponse } from '../../../shared/types';

export interface StepValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateStep1(formData: Partial<CreateServiceRequestDto>): StepValidationResult {
  const errors: Record<string, string> = {};

  if (!formData.service_type) {
    errors.service_type = '請選擇一項服務項目';
  }

  const crop = (formData.crop_type || '').trim();
  if (!crop) {
    errors.crop_type = '請輸入或點選主要作物種類';
  } else if (crop.length > 50) {
    errors.crop_type = '作物種類長度不可超過 50 個字';
  }

  const areaStr = (formData.area_value || '').trim();
  const areaNum = parseFloat(areaStr);
  if (!areaStr || isNaN(areaNum) || areaNum <= 0) {
    errors.area_value = '請輸入大於 0 的預估面積數值';
  } else if (areaStr.length > 30) {
    errors.area_value = '面積數值長度過長';
  }

  if (!formData.branch_volume) {
    errors.branch_volume = '請選擇預估枝條數量';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateStep2(
  formData: Partial<CreateServiceRequestDto>,
  availability?: AvailabilityResponse | null,
  blockedDates: string[] = []
): StepValidationResult {
  const errors: Record<string, string> = {};

  if (!formData.location_area) {
    errors.location_area = '請選擇施作行政區';
  }

  const address = (formData.location_address || '').trim();
  if (!address) {
    errors.location_address = '請輸入施作地段、地號或詳細地址標的';
  } else if (address.length > 200) {
    errors.location_address = '地點地址不可超過 200 個字';
  }

  const date = (formData.preferred_date || '').trim();
  if (!date) {
    errors.preferred_date = '請選擇希望施工日期';
  } else {
    // 檢查時段預約規則
    if (availability && availability.dates) {
      const dayAvail = availability.dates[date];
      if (dayAvail) {
        if (!dayAvail.selectable) {
          errors.preferred_date = '您選擇的日期服務站已額滿或公休封鎖，請改選其他日期';
        } else {
          const slot = formData.preferred_time_slot || 'morning';
          if (slot === 'morning' && !dayAvail.slots.morning) {
            errors.preferred_time_slot = '該日「上午」時段已無名額，請選擇下午或更換日期';
          } else if (slot === 'afternoon' && !dayAvail.slots.afternoon) {
            errors.preferred_time_slot = '該日「下午」時段已無名額，請選擇上午或更換日期';
          } else if (slot === 'any' && !dayAvail.slots.any) {
            errors.preferred_time_slot = '該日所有時段皆無可用名額，請改選其他日期';
          }
        }
      }
    } else if (blockedDates.includes(date)) {
      errors.preferred_date = '您選擇的日期服務站已額滿或暫停排程，請選擇其他日期';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateStep3(formData: Partial<CreateServiceRequestDto>): StepValidationResult {
  const errors: Record<string, string> = {};

  const name = (formData.contact_name || '').trim();
  if (!name) {
    errors.contact_name = '請輸入聯絡人姓名';
  } else if (name.length > 50) {
    errors.contact_name = '姓名長度不可超過 50 個字';
  }

  const rawPhone = (formData.phone || '').trim();
  const cleanPhone = rawPhone.replace(/[-\s]/g, '');
  if (!cleanPhone) {
    errors.phone = '請輸入聯絡電話';
  } else {
    const isMobile = /^09\d{8}$/.test(cleanPhone);
    const isLandline = /^0[2-8]\d{7}$/.test(cleanPhone);
    if (!isMobile && !isLandline) {
      if (cleanPhone.startsWith('09')) {
        errors.phone = `手機號碼需為 10 碼數字（目前為 ${cleanPhone.length} 碼）`;
      } else if (/^0[2-8]/.test(cleanPhone)) {
        errors.phone = `市話號碼需為 9 碼數字（目前為 ${cleanPhone.length} 碼）`;
      } else {
        errors.phone = '電話格式不正確：請輸入 09 開頭 10 碼手機或 02-08 開頭 9 碼市話';
      }
    }
  }

  const notes = (formData.notes || '').trim();
  if ((formData.crop_type || '').includes('其他') && !notes) {
    errors.notes = '您於第一步選擇了「其他」作物，請於此處備註實際作物種類';
  } else if (notes.length > 1000) {
    errors.notes = '補充備註不可超過 1000 個字';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateAllSteps(
  formData: Partial<CreateServiceRequestDto>,
  availability?: AvailabilityResponse | null,
  blockedDates: string[] = []
): StepValidationResult {
  const res1 = validateStep1(formData);
  const res2 = validateStep2(formData, availability, blockedDates);
  const res3 = validateStep3(formData);

  const errors = { ...res1.errors, ...res2.errors, ...res3.errors };
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
