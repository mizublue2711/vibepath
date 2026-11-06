import React, { useState, useEffect } from 'react';
import { ApiKeyManager, KeyConnectionStatus } from '../services/apiKeyManager';
import { N8N_DIFY_HEADER_EXPRESSION } from '../services/webhook';
import { LanguageCode } from '../data/vibePathData';
import {
  KeyRound,
  ShieldCheck,
  RotateCcw,
  Copy,
  Check,
  Layers,
  Terminal,
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language?: LanguageCode;
  onSaved?: (status: KeyConnectionStatus) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language = 'vi',
  onSaved,
}) => {
  const [mapKey, setMapKey] = useState<string>('');
  const [difyKey, setDifyKey] = useState<string>('');
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [copiedExpr, setCopiedExpr] = useState<boolean>(false);
  const [statusSnapshot, setStatusSnapshot] = useState<KeyConnectionStatus>(() =>
    ApiKeyManager.getStatus()
  );

  useEffect(() => {
    if (isOpen) {
      setMapKey(ApiKeyManager.getRawCustomMapKey());
      setDifyKey(ApiKeyManager.getRawCustomDifyKey());
      setGeminiKey(ApiKeyManager.getGeminiKey());
      setStatusSnapshot(ApiKeyManager.getStatus());
    }
  }, [isOpen]);

  const handleSave = () => {
    ApiKeyManager.saveKeys({
      mapKey,
      difyKey,
      geminiKey,
    });
    const updatedStatus = ApiKeyManager.getStatus();
    setStatusSnapshot(updatedStatus);
    if (onSaved) {
      onSaved(updatedStatus);
    }
    onClose();
  };

  const handleResetToSystemDefault = () => {
    ApiKeyManager.clearKeys();
    setMapKey('');
    setDifyKey('');
    setGeminiKey('');
    const updatedStatus = ApiKeyManager.getStatus();
    setStatusSnapshot(updatedStatus);
    if (onSaved) {
      onSaved(updatedStatus);
    }
  };

  const handleCopyN8nExpr = async () => {
    try {
      await navigator.clipboard.writeText(N8N_DIFY_HEADER_EXPRESSION);
      setCopiedExpr(true);
      setTimeout(() => setCopiedExpr(false), 2000);
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="BYOK Personal Connection Settings"
      className="fixed inset-0 z-50 bg-[#080A0F]/90 flex items-center justify-center p-3 sm:p-4"
    >
      <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist w-full max-w-xl p-4 sm:p-6 text-[#F3F6F9] flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#1F1F2E] pb-3">
          <div className="space-y-0.5">
            <span className="vp-label-caps text-[#00E5FF] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#00E676]" />
              <span>[ BYOK ENGINE // LOCALSTORAGE ISOLATION & VPS FALLBACK ]</span>
            </span>
            <h3 className="vp-headline-md text-[#F3F6F9]">
              {language === 'vi'
                ? 'Thiết lập Kết nối Cá nhân (BYOK — Tùy chọn)'
                : 'Personal Connection Override (BYOK — Optional)'}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-3 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#F3F6F9] vp-telemetry-sm cursor-pointer transition-colors"
          >
            [ × CLOSE ]
          </button>
        </div>

        {/* 3-Layer Bulletproof Guard Status Banner */}
        <div className="bg-[#080A0F] border border-[#1F1F2E] p-3 flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="vp-label-caps text-[#00E676] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00E676]" />
              <span>[ 3-LAYER BULLETPROOF GUARD // ZERO UI FREEZE ]</span>
            </span>
            <span className="vp-telemetry-sm text-[#00E5FF]">
              [ MAP: {statusSnapshot.activeMapMode} · AI: {statusSnapshot.activeDifyMode} ]
            </span>
          </div>
          <p className="vp-body-md text-xs text-[#9BA8B8]">
            {language === 'vi'
              ? 'Lưu cục bộ trên trình duyệt (localStorage). Nếu bỏ trống hoặc hết hạn mức (401/429), ứng dụng tự động chuyển về kết nối mặc định của hệ thống VPS mà không bao giờ treo nút bấm.'
              : 'Stored exclusively in browser localStorage. If left blank or rate-limited (401/429), the app automatically falls back to the default VPS system configuration without freezing the UI.'}
          </p>
        </div>

        {/* Input Fields */}
        <div className="space-y-3.5">
          {/* 1. Mapbox GL v3 Public Token */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="byok-map-input"
                className="vp-label-caps text-[#00E5FF] flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5 text-[#00E676]" />
                <span>[01] MAPBOX GL V3 PUBLIC TOKEN (vibepath_custom_map_key)</span>
              </label>
              <span className="vp-telemetry-sm text-[11px] text-[#00E676]">
                {mapKey.trim().length > 5 ? '[ CUSTOM ACTIVE ]' : '[ FALLBACK:VITE_MAPBOX_TOKEN ]'}
              </span>
            </div>
            <input
              id="byok-map-input"
              type="password"
              autoComplete="off"
              placeholder="pk.eyJ1... (Mapbox GL v3 Public Access Token)"
              value={mapKey}
              onChange={(e) => setMapKey(e.target.value)}
              className="w-full min-h-[44px] bg-[#080A0F] border border-[#1F1F2E] px-3 text-xs text-[#00E676] font-mono-brand focus:outline-none focus:border-[#00E5FF]"
            />
          </div>

          {/* 2. Dify AI App Key (n8n Webhook Relay) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="byok-dify-input"
                className="vp-label-caps text-[#00E5FF] flex items-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>[02] DIFY AI APP KEY FOR N8N WEBHOOK (vibepath_custom_dify_key)</span>
              </label>
              <span className="vp-telemetry-sm text-[11px] text-[#00E5FF]">
                {difyKey.trim().length > 5 ? '[ ATTACHED TO N8N ]' : '[ FALLBACK: VPS DIFY ]'}
              </span>
            </div>
            <input
              id="byok-dify-input"
              type="password"
              autoComplete="off"
              placeholder="app-xxxxxxxxxxxxxxxx (Tự động đính kèm vào Payload gửi n8n)"
              value={difyKey}
              onChange={(e) => setDifyKey(e.target.value)}
              className="w-full min-h-[44px] bg-[#080A0F] border border-[#1F1F2E] px-3 text-xs text-[#00E5FF] font-mono-brand focus:outline-none focus:border-[#00E5FF]"
            />
          </div>

          {/* 3. Optional Gemini Co-Pilot Override */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="byok-gemini-input"
                className="vp-label-caps text-[#9BA8B8] flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#00E676]" />
                <span>[03] GEMINI AI CO-PILOT OVERRIDE (vibepath_custom_gemini_key)</span>
              </label>
              <span className="vp-telemetry-sm text-[11px] text-[#00E676]">
                {geminiKey.trim().length > 5 ? '[ CUSTOM QUOTA ]' : '[ FALLBACK: SERVER PROXY ]'}
              </span>
            </div>
            <input
              id="byok-gemini-input"
              type="password"
              autoComplete="off"
              placeholder="AIzaSy... (Tùy chọn — Mặc định dùng Proxy Server)"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              className="w-full min-h-[44px] bg-[#080A0F] border border-[#1F1F2E] px-3 text-xs text-[#F3F6F9] font-mono-brand focus:outline-none focus:border-[#00E5FF]"
            />
          </div>
        </div>

        {/* n8n Node HTTP Request Expression Reference Box */}
        <div className="bg-[#080A0F] border border-[#1F1F2E] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="vp-label-caps text-[#00E5FF]">
              [ N8N NODE EXPRESSION // CALL DIFY AI HEADER AUTHORIZATION ]
            </span>
            <button
              type="button"
              onClick={handleCopyN8nExpr}
              className="min-h-[32px] px-2.5 bg-[#0D1017] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#F3F6F9] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer"
            >
              {copiedExpr ? (
                <Check className="w-3.5 h-3.5 text-[#00E676]" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
              )}
              <span>{copiedExpr ? '[ COPIED ]' : '[ COPY EXPRESSION ]'}</span>
            </button>
          </div>
          <pre className="font-mono-brand text-[11px] text-[#00E676] whitespace-pre-wrap break-all bg-[#0D1017] border border-[#1F1F2E] p-2">
            {N8N_DIFY_HEADER_EXPRESSION}
          </pre>
        </div>

        {/* Action Footer */}
        <div className="pt-2 border-t border-[#1F1F2E] flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleResetToSystemDefault}
            className="vp-touch-target px-3.5 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#9BA8B8] hover:text-[#F3F6F9] vp-telemetry-sm flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>
              {language === 'vi' ? '[ DÙNG MẶC ĐỊNH HỆ THỐNG ]' : '[ USE SYSTEM DEFAULT ]'}
            </span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="vp-touch-target px-4 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#FF5252] text-[#F3F6F9] font-mono-brand text-xs font-bold cursor-pointer transition-colors"
            >
              {language === 'vi' ? '[ × ĐÓNG ]' : '[ × CLOSE ]'}
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="clip-button-chamfer vp-touch-target px-5 bg-[#00E5FF] hover:bg-[#00E5FF]/90 border border-[#00E5FF] text-[#080A0F] font-mono-brand text-xs font-bold cursor-pointer transition-colors"
            >
              {language === 'vi' ? '[ ⚡ LƯU & ÁP DỤNG NGAY ]' : '[ ⚡ SAVE & APPLY NOW ]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
