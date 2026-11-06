/**
 * webhook.ts — Dịch vụ gửi dữ liệu đồng bộ sang n8n / VibePath Backend
 * Tự động đọc custom_dify_key từ ApiKeyManager (nếu có) và bảo vệ chống treo nút Submit.
 */

import { ApiKeyManager } from './apiKeyManager';
import { SchemaValidator, RenderPayload, FeedbackPayload } from '../utils/schema-validator';
import { CloudSyncReceipt } from '../data/vibePathData';

export const N8N_DIFY_HEADER_EXPRESSION =
  "={{ $json.body.custom_dify_key ? 'Bearer ' + $json.body.custom_dify_key : 'Bearer app-xxxxxxxxxxxxxxxxxxxx' }}";

export interface SyncWebhookPayload extends RenderPayload {
  custom_dify_key?: string;
}

export interface FeedbackWebhookPayload extends FeedbackPayload {
  custom_dify_key?: string;
}

/**
 * Chuẩn bị Payload gửi đi (Đính kèm custom_dify_key nếu người dùng đã cài đặt trong localStorage)
 */
export function buildWebhookRenderPayload(rawOrSanitized: any): SyncWebhookPayload {
  const sanitized = SchemaValidator.sanitizeRenderPayload(rawOrSanitized);
  const customDifyKey = ApiKeyManager.getDifyKey();

  return {
    ...sanitized,
    ...(customDifyKey ? { custom_dify_key: customDifyKey } : {}),
  };
}

export function buildWebhookFeedbackPayload(rawOrSanitized: any): FeedbackWebhookPayload {
  const sanitized = SchemaValidator.sanitizeFeedbackPayload(rawOrSanitized);
  const customDifyKey = ApiKeyManager.getDifyKey();

  return {
    ...sanitized,
    ...(customDifyKey ? { custom_dify_key: customDifyKey } : {}),
  };
}

/**
 * Gửi RenderPayload lên n8n / Backend Sync với cơ chế chống gãy ngang (Timeout + Error Catch)
 */
export const sendRenderPayload = async (data: any): Promise<CloudSyncReceipt & { byokActive?: boolean }> => {
  const finalPayload = buildWebhookRenderPayload(data);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch('/api/vibepath/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalPayload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    const receipt = await res.json();
    return {
      ...receipt,
      byokActive: Boolean(finalPayload.custom_dify_key),
    };
  } catch (error) {
    console.error('[Webhook Sync Guard]:', error);
    throw new Error(
      'Không thể kết nối đến server n8n/Cloud. Đã kích hoạt cơ chế lưu cục bộ an toàn.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Gửi FeedbackPayload sang luồng AI Bug Triage (n8n + Dify Agent + Telegram Alert)
 */
export const sendFeedbackPayload = async (data: any): Promise<any> => {
  const finalPayload = buildWebhookFeedbackPayload(data);
  const customGeminiKey = ApiKeyManager.getGeminiKey();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch('/api/vibepath/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...finalPayload,
        ...(customGeminiKey ? { custom_gemini_key: customGeminiKey } : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error('[Webhook Triage Guard]:', error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};
