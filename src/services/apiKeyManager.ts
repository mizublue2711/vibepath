/**
 * apiKeyManager.ts — Trình quản lý cấu hình & kết nối 3 lớp chống gãy ngang (Bulletproof Handler)
 * Ưu tiên cấu hình cá nhân tại trình duyệt (localStorage) -> Tự động Fallback về hệ thống mặc định.
 */

export interface UserApiKeys {
  mapKey?: string;
  geminiKey?: string;
  difyKey?: string;
}

export interface KeyConnectionStatus {
  hasCustomMapKey: boolean;
  hasCustomGeminiKey: boolean;
  hasCustomDifyKey: boolean;
  activeMapMode: 'CUSTOM_OVERRIDE' | 'SYSTEM_DEFAULT';
  activeAiMode: 'CUSTOM_OVERRIDE' | 'SYSTEM_DEFAULT';
  activeDifyMode: 'CUSTOM_OVERRIDE' | 'SYSTEM_DEFAULT';
  updatedAt: string;
}

export class ApiKeyManager {
  private static STORAGE_KEY_MAP = 'vibepath_custom_map_key';
  private static STORAGE_KEY_GEMINI = 'vibepath_custom_gemini_key';
  private static STORAGE_KEY_DIFY = 'vibepath_custom_dify_key';

  /**
   * 1. Lưu cấu hình từ giao diện & phát sự kiện cập nhật toàn ứng dụng tức thì (Không cần F5)
   */
  static saveKeys(keys: UserApiKeys): void {
    try {
      if (keys.mapKey !== undefined) {
        localStorage.setItem(this.STORAGE_KEY_MAP, keys.mapKey.trim());
      }
      if (keys.geminiKey !== undefined) {
        localStorage.setItem(this.STORAGE_KEY_GEMINI, keys.geminiKey.trim());
      }
      if (keys.difyKey !== undefined) {
        localStorage.setItem(this.STORAGE_KEY_DIFY, keys.difyKey.trim());
      }

      // Phát custom event để Map 3D, Editor Studio và Webhook tự nạp lại ngay mà không bị Stale Closure
      window.dispatchEvent(new Event('vibepath_apikeys_updated'));
    } catch (err) {
      console.error('[ApiKeyManager] Unable to write to localStorage:', err);
    }
  }

  /**
   * Xóa cấu hình cá nhân và quay về mặc định của hệ thống VPS
   */
  static clearKeys(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY_MAP);
      localStorage.removeItem(this.STORAGE_KEY_GEMINI);
      localStorage.removeItem(this.STORAGE_KEY_DIFY);
      window.dispatchEvent(new Event('vibepath_apikeys_updated'));
    } catch (err) {
      console.error('[ApiKeyManager] Unable to clear localStorage:', err);
    }
  }

  /**
   * 2. Đọc cấu hình (Ưu tiên cấu hình cá nhân -> Fallback mặc định hệ thống)
   */
  static getMapKey(): string {
    try {
      const custom = localStorage.getItem(this.STORAGE_KEY_MAP);
      if (custom && custom.trim().length > 5) {
        return custom.trim();
      }
    } catch (_) {}
    return (import.meta as any).env?.VITE_MAPBOX_TOKEN || '';
  }

  static getRawCustomMapKey(): string {
    try {
      return localStorage.getItem(this.STORAGE_KEY_MAP) || '';
    } catch (_) {
      return '';
    }
  }

  static getGeminiKey(): string {
    try {
      return (localStorage.getItem(this.STORAGE_KEY_GEMINI) || '').trim();
    } catch (_) {
      return '';
    }
  }

  static getDifyKey(): string | null {
    try {
      const custom = localStorage.getItem(this.STORAGE_KEY_DIFY);
      return custom && custom.trim().length > 5 ? custom.trim() : null;
    } catch (_) {
      return null;
    }
  }

  static getRawCustomDifyKey(): string {
    try {
      return localStorage.getItem(this.STORAGE_KEY_DIFY) || '';
    } catch (_) {
      return '';
    }
  }

  static getStatus(): KeyConnectionStatus {
    const mapKey = this.getRawCustomMapKey().trim();
    const geminiKey = this.getGeminiKey();
    const difyKey = this.getDifyKey();

    return {
      hasCustomMapKey: mapKey.length > 5,
      hasCustomGeminiKey: geminiKey.length > 5,
      hasCustomDifyKey: Boolean(difyKey),
      activeMapMode: mapKey.length > 5 ? 'CUSTOM_OVERRIDE' : 'SYSTEM_DEFAULT',
      activeAiMode: geminiKey.length > 5 ? 'CUSTOM_OVERRIDE' : 'SYSTEM_DEFAULT',
      activeDifyMode: difyKey ? 'CUSTOM_OVERRIDE' : 'SYSTEM_DEFAULT',
      updatedAt: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    };
  }

  /**
   * 3. Hàm bọc (Wrapper) gọi AI qua Proxy Server An Toàn — Tuyệt đối không treo UI
   * Xử lý đầy đủ các mã lỗi 400 / 401 / 403 / 429 và ngắt trạng thái chờ ngay lập tức.
   */
  static async safeCallGemini(
    nodes: any[],
    language: 'vi' | 'en' = 'vi'
  ): Promise<{ youtubeChapters: string; socialCaption: string; modeUsed: string }> {
    const customGeminiKey = this.getGeminiKey();
    const customDifyKey = this.getDifyKey();

    try {
      const response = await fetch('/api/vibepath/ai-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes,
          language,
          ...(customGeminiKey ? { custom_gemini_key: customGeminiKey } : {}),
          ...(customDifyKey ? { custom_dify_key: customDifyKey } : {}),
        }),
      });

      if (!response.ok) {
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          throw new Error(
            language === 'vi'
              ? 'Cấu hình khóa kết nối không hợp lệ (401/403). Hệ thống đã tự động chuyển về chế độ dự phòng an toàn.'
              : 'Invalid connection credential (401/403). Automatically switched to safe fallback.'
          );
        } else if (response.status === 429) {
          throw new Error(
            language === 'vi'
              ? 'Đã vượt quá giới hạn lượt gọi (429 Rate Limit). Vui lòng thử lại sau ít phút.'
              : 'Rate limit exceeded (429). Please retry in a moment.'
          );
        } else {
          throw new Error(`AI Service HTTP ${response.status}`);
        }
      }

      const data = await response.json();
      return {
        youtubeChapters: data.youtubeChapters || '',
        socialCaption: data.socialCaption || '',
        modeUsed: data.modeUsed || (customGeminiKey ? 'BYOK_OVERRIDE' : 'VPS_SYSTEM_DEFAULT'),
      };
    } catch (err: any) {
      console.error('[AI Guard Error]:', err);
      throw err;
    }
  }
}
