/**
 * VibePath Data Contract Validator & Type Sanitizer
 * Đảm bảo dữ liệu Frontend khớp 100% với JSON Schema Draft-07 và Database Supabase
 */

export interface TelemetryPoint {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed_kmh?: number;
  heading?: number;
  timestamp: string;
}

export interface FoodPOI {
  poi_id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: number;
  note?: string;
  timestamp: string;
  images?: string[];
}

export interface RenderPayload {
  trip_id: string;
  youtuber_id: string;
  language: 'vi' | 'en';
  trip_name: string;
  created_at: string;
  accent_color?: string;
  font_family?: string;
  telemetry_data: TelemetryPoint[];
  food_pois: FoodPOI[];
}

export interface FeedbackPayload {
  event_type: 'user_feedback';
  timestamp: string;
  language: 'vi' | 'en';
  role: 'vlogger' | 'editor' | 'tester';
  rating: number;
  selected_features: string[];
  feedback_text: string;
  attachment_url?: string;
}

export class SchemaValidator {
  /**
   * Làm sạch và ép kiểu bắt buộc cho Render Payload (Luồng Render Video 3D)
   */
  static sanitizeRenderPayload(input: any): RenderPayload {
    if (!input || typeof input !== 'object') {
      throw new Error('Payload không hợp lệ: Phải là một Object.');
    }

    // 1. Validate & Standardize Language Enum
    const langRaw = String(input.language || '').toLowerCase().trim();
    const validLanguage: 'vi' | 'en' = langRaw === 'vi' || langRaw === 'en' ? langRaw : 'vi';

    // 2. Validate & Sanitize Telemetry (Ép kiểu Float số thực)
    const rawTelemetry = Array.isArray(input.telemetry_data) ? input.telemetry_data : [];
    if (rawTelemetry.length < 2) {
      throw new Error(
        'Cảnh báo Data Contract: Cần tối thiểu 2 điểm GPS telemetry để nội suy B-Spline.'
      );
    }

    const cleanTelemetry: TelemetryPoint[] = rawTelemetry.map((pt: any, index: number) => {
      const lat = Number(pt.latitude);
      const lng = Number(pt.longitude);

      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error(
          `Lỗi Vĩ độ (latitude) không hợp lệ tại điểm index [${index}]: ${pt.latitude}`
        );
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new Error(
          `Lỗi Kinh độ (longitude) không hợp lệ tại điểm index [${index}]: ${pt.longitude}`
        );
      }

      return {
        latitude: lat,
        longitude: lng,
        altitude: Number(pt.altitude) || 0.0,
        speed_kmh: Math.max(0, Number(pt.speed_kmh) || 0.0),
        heading: Math.min(360, Math.max(0, Number(pt.heading) || 0.0)),
        timestamp: String(pt.timestamp || new Date().toISOString()),
      };
    });

    // 3. Validate & Sanitize Food POIs (Ép kiểu Rating Integer 1-5 và Float GPS)
    const rawPois = Array.isArray(input.food_pois) ? input.food_pois : [];
    const cleanPois: FoodPOI[] = rawPois.map((poi: any, index: number) => {
      const lat = Number(poi.latitude);
      const lng = Number(poi.longitude);
      const rawRating = parseInt(String(poi.rating), 10);
      const rating = !isNaN(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : 5;

      return {
        poi_id: String(poi.poi_id || `POI_${Date.now()}_${index}`),
        name: String(poi.name || 'Địa điểm ẩm thực chưa đặt tên').trim(),
        latitude: isNaN(lat) ? 0.0 : lat,
        longitude: isNaN(lng) ? 0.0 : lng,
        rating: rating, // Ép kiểu Integer 1-5 tránh crash cột INT2 trên Postgres
        note: String(poi.note || '').trim(),
        timestamp: String(poi.timestamp || new Date().toISOString()),
        images: Array.isArray(poi.images) ? poi.images.map(String) : [],
      };
    });

    return {
      trip_id: String(input.trip_id || `TRIP_${Date.now()}`),
      youtuber_id: String(input.youtuber_id || 'vlogger_system'),
      language: validLanguage,
      trip_name: String(input.trip_name || 'Chuyến đi không tên').trim(),
      created_at: String(input.created_at || new Date().toISOString()),
      accent_color: String(input.accent_color || '#00E5FF').trim(),
      font_family: String(input.font_family || 'JetBrains Mono').trim(),
      telemetry_data: cleanTelemetry,
      food_pois: cleanPois,
    };
  }

  /**
   * Làm sạch và ép kiểu bắt buộc cho Feedback Payload (Luồng Báo lỗi / Khảo sát)
   */
  static sanitizeFeedbackPayload(input: any): FeedbackPayload {
    if (!input || typeof input !== 'object') {
      throw new Error('Feedback Payload không hợp lệ.');
    }

    const langRaw = String(input.language || '').toLowerCase().trim();
    const validLanguage: 'vi' | 'en' = langRaw === 'vi' || langRaw === 'en' ? langRaw : 'vi';

    const roleRaw = String(input.role || '').toLowerCase().trim();
    const validRoles: ('vlogger' | 'editor' | 'tester')[] = ['vlogger', 'editor', 'tester'];
    const validRole = validRoles.includes(roleRaw as any)
      ? (roleRaw as 'vlogger' | 'editor' | 'tester')
      : 'tester';

    const rawRating = parseInt(String(input.rating), 10);
    const rating = !isNaN(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : 5;

    return {
      event_type: 'user_feedback',
      timestamp: String(input.timestamp || new Date().toISOString()),
      language: validLanguage,
      role: validRole,
      rating: rating,
      selected_features: Array.isArray(input.selected_features)
        ? input.selected_features.map(String)
        : [],
      feedback_text: String(input.feedback_text || '').trim(),
      attachment_url: String(input.attachment_url || '').trim(),
    };
  }
}
