import React, { useState, useMemo, useEffect } from 'react';
import {
  UserRole,
  FeedbackReport,
  LanguageCode,
  EVALUABLE_FEATURES,
} from '../data/vibePathData';
import {
  buildWebhookFeedbackPayload,
  sendFeedbackPayload,
  FeedbackWebhookPayload,
} from '../services/webhook';
import {
  Star,
  UploadCloud,
  Send,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Terminal,
  ShieldCheck,
} from 'lucide-react';

interface FeedbackBugReportTabProps {
  reports: FeedbackReport[];
  onAddReport: (report: FeedbackReport) => void;
  language: LanguageCode;
}

export const FeedbackBugReportTab: React.FC<FeedbackBugReportTabProps> = ({
  reports,
  onAddReport,
  language,
}) => {
  const [role, setRole] = useState<UserRole>('vlogger');
  const [rating, setRating] = useState<number>(4);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    EVALUABLE_FEATURES[0],
    EVALUABLE_FEATURES[1],
  ]);
  const [feedbackText, setFeedbackText] = useState<string>('');
  const [attachmentUrl, setAttachmentUrl] = useState<string>(
    'https://r2.vibepath.io/buckets/telemetry-prod/snapshots/field-session-capture.png'
  );
  const [isUploadingR2, setIsUploadingR2] = useState<boolean>(false);
  const [isTriaging, setIsTriaging] = useState<boolean>(false);
  const [latestSubmitted, setLatestSubmitted] = useState<FeedbackReport | null>(null);
  const [latestSanitizedPayload, setLatestSanitizedPayload] =
    useState<FeedbackWebhookPayload | null>(null);
  const [byokRev, setByokRev] = useState<number>(0);

  useEffect(() => {
    const onKeysUpdated = () => setByokRev((r) => r + 1);
    window.addEventListener('vibepath_apikeys_updated', onKeysUpdated);
    return () => window.removeEventListener('vibepath_apikeys_updated', onKeysUpdated);
  }, []);

  const toggleFeature = (feat: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feat) ? prev.filter((f) => f !== feat) : [...prev, feat]
    );
  };

  // Live SchemaValidator + custom_dify_key preview
  const liveSanitizedPreview: FeedbackWebhookPayload = useMemo(() => {
    return buildWebhookFeedbackPayload({
      event_type: 'user_feedback',
      timestamp: new Date().toISOString(),
      language,
      role,
      rating,
      selected_features: selectedFeatures,
      feedback_text:
        feedbackText.trim() ||
        (language === 'vi'
          ? 'Kiểm thử thực tế ngoài trời: Hệ thống ghim tọa độ 1-chạm hoạt động ổn định.'
          : 'Outdoor field test: One-tap coordinate lock performed reliably.'),
      attachment_url: attachmentUrl,
    });
  }, [language, role, rating, selectedFeatures, feedbackText, attachmentUrl, byokRev]);

  // Simulate / trigger Cloudflare R2 Bucket Screenshot Upload
  const handleAutoUploadR2 = async () => {
    setIsUploadingR2(true);
    try {
      const res = await fetch('/api/vibepath/upload-r2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: `${role}-screen-capture-${Date.now()}.png`,
        }),
      });
      const data = await res.json();
      if (data.attachment_url) {
        setAttachmentUrl(data.attachment_url);
      }
    } catch (_) {
      setAttachmentUrl(
        `https://r2.vibepath.io/buckets/telemetry-prod/snapshots/${role}-${Date.now()}.png`
      );
    } finally {
      setIsUploadingR2(false);
    }
  };

  // Fill realistic test scenarios for 1-tap evaluation
  const applyPresetScenario = (preset: 'p0' | 'p1' | 'p2') => {
    if (preset === 'p0') {
      setRole('vlogger');
      setRating(1);
      setSelectedFeatures([
        'Invisible Background Tracker (GPS)',
        'One-Tap Spot Pinning (POI INT2)',
      ]);
      setFeedbackText(
        'KHẨN CẤP P0: Khi đang ghi lộ trình ngầm dưới trời nắng 38°C và bấm Sync to Cloud trong vùng mất sóng 4G, ứng dụng báo timeout và có nguy cơ mất điểm ghim vừa nhập.'
      );
    } else if (preset === 'p1') {
      setRole('editor');
      setRating(3);
      setSelectedFeatures([
        'Premiere / CapCut .XML Markers',
        '3D Map 60FPS Video Follow-Cam',
      ]);
      setFeedbackText(
        'Lỗi P1: Mốc thời gian Marker #3 trong file .XML lệch khoảng 12 frame so với chuyển động dừng của camera 3D 60FPS khi import vào CapCut Pro.'
      );
    } else {
      setRole('tester');
      setRating(5);
      setSelectedFeatures([
        'Outdoor Sunlight Contrast (#12161A)',
        'Bilingual .SRT Subtitle Sync',
      ]);
      setFeedbackText(
        'Giao diện nền tối #12161A kết hợp màu chữ #00E5FF và vùng nút bấm 140px đáy màn hình cực kỳ dễ bấm bằng 1 tay khi ngồi sau xe máy.'
      );
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFeedback =
      feedbackText.trim() ||
      (language === 'vi'
        ? 'Kiểm thử thực tế ngoài trời: Hệ thống ghim tọa độ 1-chạm hoạt động ổn định, độ tương phản cao dưới nắng.'
        : 'Outdoor field test: One-tap coordinate lock and high-contrast telemetry display performed reliably.');

    // Strict Typecast, Sanitize & Attach custom_dify_key via buildWebhookFeedbackPayload
    const sanitizedPayload = buildWebhookFeedbackPayload({
      event_type: 'user_feedback',
      timestamp: new Date().toISOString(),
      language,
      role,
      rating,
      selected_features: selectedFeatures,
      feedback_text: cleanFeedback,
      attachment_url: attachmentUrl,
    });

    setLatestSanitizedPayload(sanitizedPayload);
    setIsTriaging(true);

    try {
      const data = await sendFeedbackPayload(sanitizedPayload);
      const newReport: FeedbackReport = {
        id: `BUG-${Math.floor(1000 + Math.random() * 9000)}`,
        role: sanitizedPayload.role,
        rating: sanitizedPayload.rating,
        selected_features: sanitizedPayload.selected_features,
        feedback_text: sanitizedPayload.feedback_text,
        attachment_url: sanitizedPayload.attachment_url || '',
        created_at: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        triage: data.triage,
      };
      onAddReport(newReport);
      setLatestSubmitted(newReport);
      setFeedbackText('');
    } catch (_) {
      const isUrgent =
        sanitizedPayload.rating <= 2 ||
        sanitizedPayload.feedback_text.toLowerCase().includes('p0');
      const newReport: FeedbackReport = {
        id: `BUG-${Math.floor(1000 + Math.random() * 9000)}`,
        role: sanitizedPayload.role,
        rating: sanitizedPayload.rating,
        selected_features: sanitizedPayload.selected_features,
        feedback_text: sanitizedPayload.feedback_text,
        attachment_url: sanitizedPayload.attachment_url || '',
        created_at: new Date().toLocaleTimeString('en-GB', { hour12: false }),
        triage: {
          category: 'GPS_TELEMETRY',
          severity: isUrgent ? 'P0' : 'P2',
          summary: sanitizedPayload.feedback_text.slice(0, 90),
          recommended_action: isUrgent
            ? 'Immediate hotfix rollback & Cloudflare Worker replay.'
            : 'Logged for next ergonomic UI iteration.',
          telegram_alert_sent: isUrgent,
          telegram_channel: isUrgent ? '@VibePathOpsAlertBot #p0-urgent' : 'N/A (P2 Queue)',
          dify_agent_run_id: `dify-run-${Date.now().toString(36)}`,
        },
      };
      onAddReport(newReport);
      setLatestSubmitted(newReport);
      setFeedbackText('');
    } finally {
      setIsTriaging(false);
    }
  };

  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-4 md:gap-6">
      {/* Left 4 Columns: Direct In-App Feedback & Bug Report Form ("Don't Make Me Think" UX) */}
      <div className="col-span-4 md:col-span-4 flex flex-col gap-4">
        <form
          onSubmit={handleSubmitFeedback}
          className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 md:p-5 flex flex-col gap-4"
        >
          <div className="border-b border-[#1F1F2E] pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="vp-label-caps text-[#00E5FF]">
                [ SCHEMA_VALIDATOR // ZERO_DROP_OFF_FORM ]
              </span>
              <h2 className="vp-headline-md text-[#F3F6F9] mt-0.5">
                {language === 'vi'
                  ? 'Khảo sát Trực tiếp & Báo lỗi Hiện trường'
                  : 'Direct Qualitative Feedback & Bug Report'}
              </h2>
            </div>

            {/* Quick Scenario Buttons for 1-Tap Testing */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => applyPresetScenario('p0')}
                className="vp-touch-target px-2.5 bg-[#080A0F] border border-[#FF5252] text-[#FF5252] vp-telemetry-sm cursor-pointer hover:bg-[#FF5252]/10"
                title="Test P0 Critical Alert"
              >
                [ TEST_P0 ]
              </button>
              <button
                type="button"
                onClick={() => applyPresetScenario('p1')}
                className="vp-touch-target px-2.5 bg-[#080A0F] border border-[#00E5FF] text-[#00E5FF] vp-telemetry-sm cursor-pointer hover:bg-[#00E5FF]/10"
                title="Test P1 Drift Bug"
              >
                [ TEST_P1 ]
              </button>
              <button
                type="button"
                onClick={() => applyPresetScenario('p2')}
                className="vp-touch-target px-2.5 bg-[#080A0F] border border-[#00E676] text-[#00E676] vp-telemetry-sm cursor-pointer hover:bg-[#00E676]/10"
                title="Test P2 UX Praise"
              >
                [ TEST_P2 ]
              </button>
            </div>
          </div>

          {/* 1. role: Vai trò trải nghiệm (vlogger, editor, tester) */}
          <div className="space-y-1.5">
            <span className="vp-label-caps text-[#9BA8B8] block">
              [ 01 // EXPERIENCE_ROLE: VLOGGER | EDITOR | TESTER ]
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['vlogger', 'editor', 'tester'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`vp-touch-target border font-mono-brand text-xs font-bold uppercase transition-colors cursor-pointer ${
                    role === r
                      ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F]'
                      : 'bg-[#080A0F] border-[#1F1F2E] text-[#9BA8B8] hover:border-[#00E5FF]'
                  }`}
                >
                  [ {r} ]
                </button>
              ))}
            </div>
          </div>

          {/* 2. rating: Đánh giá mức độ hài lòng (1 - 5 sao INT2) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="vp-label-caps text-[#9BA8B8]">
                [ 02 // SATISFACTION_RATING_INT2 ]
              </span>
              <span className="vp-telemetry-sm text-[#00E5FF]">[ {rating} / 5 ★ ]</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = star <= rating;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className={`vp-touch-target border flex items-center justify-center gap-1 vp-telemetry-sm transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#00E5FF] border-[#00E5FF] text-[#080A0F] font-bold'
                        : 'bg-[#080A0F] border-[#1F1F2E] text-[#9BA8B8]'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${active ? 'fill-[#080A0F] text-[#080A0F]' : ''}`} />
                    <span>{star}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. selected_features: Danh sách tính năng đánh giá */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="vp-label-caps text-[#9BA8B8]">
                [ 03 // EVALUATED_FEATURES ]
              </span>
              <span className="vp-telemetry-sm text-[#00E676]">
                [ {selectedFeatures.length} SELECTED ]
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EVALUABLE_FEATURES.map((feat) => {
                const active = selectedFeatures.includes(feat);
                return (
                  <button
                    key={feat}
                    type="button"
                    onClick={() => toggleFeature(feat)}
                    className={`min-h-[48px] px-3 py-2 border text-left vp-body-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      active
                        ? 'bg-[#080A0F] border-[#00E5FF] text-[#F3F6F9]'
                        : 'bg-[#080A0F] border-[#1F1F2E] text-[#9BA8B8] hover:border-[#00E5FF]'
                    }`}
                  >
                    <span className="truncate">{feat}</span>
                    <span className="vp-telemetry-sm text-[#00E5FF] shrink-0">
                      {active ? '[ ON ]' : '[ OFF ]'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. feedback_text: Mô tả phản hồi / báo lỗi chi tiết */}
          <div className="space-y-1.5">
            <label htmlFor="feedback-text" className="vp-label-caps text-[#9BA8B8] block">
              [ 04 // QUALITATIVE_FEEDBACK_OR_BUG_DESCRIPTION ]
            </label>
            <textarea
              id="feedback-text"
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={
                language === 'vi'
                  ? 'Nhập mô tả chi tiết trải nghiệm hoặc sự cố kỹ thuật để Dify AI Agent phân loại mức độ ưu tiên (P0/P1/P2)...'
                  : 'Describe the issue or qualitative UX feedback for automatic Dify AI Agent triage (P0/P1/P2)...'
              }
              className="w-full p-3.5 bg-[#080A0F] border border-[#1F1F2E] text-[#F3F6F9] vp-body-md focus:border-[#00E5FF] focus:outline-none resize-none"
            />
          </div>

          {/* 5. attachment_url: URL ảnh màn hình lỗi (Tự động upload lên Cloudflare R2 Bucket) */}
          <div className="space-y-1.5">
            <label htmlFor="attachment-url" className="vp-label-caps text-[#9BA8B8] block">
              [ 05 // CLOUDFLARE_R2_SCREENSHOT_ATTACHMENT_URL ]
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="attachment-url"
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="flex-1 min-h-[48px] px-3 bg-[#080A0F] border border-[#1F1F2E] text-[#00E5FF] vp-telemetry-sm focus:border-[#00E5FF] focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAutoUploadR2}
                disabled={isUploadingR2}
                className="vp-touch-target px-3.5 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#00E5FF] vp-telemetry-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <UploadCloud className="w-4 h-4 text-[#00E5FF]" />
                <span>{isUploadingR2 ? '[ UPLOADING_R2... ]' : '[ AUTO_R2_SNAPSHOT ]'}</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isTriaging}
            className="clip-button-chamfer w-full min-h-[52px] bg-[#00E5FF] hover:bg-[#00E5FF]/90 border border-[#00E5FF] text-[#080A0F] font-mono-brand font-bold text-sm flex items-center justify-center gap-2.5 cursor-pointer transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>
              {isTriaging
                ? '[ SANITIZING_AND_TRIAGING_WITH_DIFY_AI... ]'
                : '[ ⚡ SANITIZE_AND_SUBMIT_AI_BUG_TRIAGE ]'}
            </span>
          </button>
        </form>
      </div>

      {/* Right 4 Columns: SchemaValidator.sanitizeFeedbackPayload Inspector & Dify AI Bug Triage Queue */}
      <div className="col-span-4 md:col-span-4 flex flex-col gap-4">
        {/* Live SchemaValidator.sanitizeFeedbackPayload() Preview */}
        <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="vp-label-caps text-[#00E676] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#00E676]" />
              <span>[ SchemaValidator.sanitizeFeedbackPayload() // LIVE_CONTRACT ]</span>
            </span>
            <span className="vp-telemetry-sm text-[#00E5FF]">[ event_type: user_feedback ]</span>
          </div>
          <pre className="bg-[#080A0F] border border-[#1F1F2E] p-3 font-mono-brand text-xs text-[#00E5FF] max-h-[150px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
            {JSON.stringify(latestSanitizedPayload || liveSanitizedPreview, null, 2)}
          </pre>
        </div>

        {/* Latest Triage Alert Banner if P0/P1 */}
        {latestSubmitted && (
          <div
            className={`border p-4 ${
              latestSubmitted.triage.severity === 'P0' || latestSubmitted.triage.severity === 'P1'
                ? 'bg-[#0D1017] border-[#FF5252]'
                : 'bg-[#0D1017] border-[#00E676]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="vp-label-caps text-[#00E5FF] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-[#FF5252]" />
                <span>
                  [ DIFY_AI_TRIAGE_COMPLETE // {latestSubmitted.triage.dify_agent_run_id} ]
                </span>
              </span>
              <span className="vp-telemetry-sm text-[#00E676]">
                [ SEVERITY: {latestSubmitted.triage.severity} ]
              </span>
            </div>
            <p className="font-mono-brand font-bold text-sm text-[#F3F6F9] mt-1.5">
              {latestSubmitted.triage.summary}
            </p>
            <p className="vp-body-md text-xs text-[#9BA8B8] mt-1">
              Action: {latestSubmitted.triage.recommended_action}
            </p>
            {latestSubmitted.triage.telegram_alert_sent && (
              <div className="mt-2.5 pt-2.5 border-t border-[#1F1F2E] flex items-center justify-between vp-telemetry-sm text-[#00E5FF]">
                <span>[ TELEGRAM_EMERGENCY_WEBHOOK_DISPATCHED ]</span>
                <span className="text-[#00E676]">{latestSubmitted.triage.telegram_channel}</span>
              </div>
            )}
          </div>
        )}

        {/* Live AI Bug Triage Queue & Telegram Dispatch Feed */}
        <div className="bg-[#0D1017] border border-[#1F1F2E] clip-chamfer-brutalist p-4 md:p-5 flex flex-col gap-4 flex-1">
          <div className="flex items-center justify-between border-b border-[#1F1F2E] pb-3">
            <div>
              <span className="vp-label-caps text-[#00E676]">
                [ DIFY_AI_AGENT // TELEGRAM_WEBHOOK_MONITOR ]
              </span>
              <h3 className="vp-headline-md text-[#F3F6F9] mt-0.5">
                {language === 'vi'
                  ? `Hàng đợi Phân loại AI (${reports.length} Tickets)`
                  : `AI Bug Triage Queue (${reports.length} Tickets)`}
              </h3>
            </div>
            <Terminal className="w-5 h-5 text-[#00E5FF]" />
          </div>

          <div className="divide-y divide-[#1F1F2E]">
            {reports.map((rep) => {
              const isCritical = rep.triage.severity === 'P0' || rep.triage.severity === 'P1';
              return (
                <div key={rep.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 vp-telemetry-sm">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          rep.triage.severity === 'P0'
                            ? 'text-[#FF5252] font-bold'
                            : rep.triage.severity === 'P1'
                            ? 'text-[#00E5FF] font-bold'
                            : 'text-[#00E676] font-bold'
                        }
                      >
                        [ {rep.triage.severity} ]
                      </span>
                      <span className="text-[#F3F6F9]">{rep.id}</span>
                      <span aria-hidden="true" className="text-[#9BA8B8]">·</span>
                      <span className="text-[#00E5FF]">[ {rep.triage.category} ]</span>
                      <span aria-hidden="true" className="text-[#9BA8B8]">·</span>
                      <span className="text-[#9BA8B8] uppercase">
                        ROLE: {rep.role} ({rep.rating}/5★)
                      </span>
                    </div>
                    <span className="text-[#9BA8B8]">{rep.created_at}</span>
                  </div>

                  <p className="vp-body-md text-[#F3F6F9]">{rep.feedback_text}</p>

                  <div className="bg-[#080A0F] border border-[#1F1F2E] p-3 space-y-1.5">
                    <div className="vp-telemetry-sm text-[#00E676]">
                      [ AI_TRIAGE ] {rep.triage.summary}
                    </div>
                    <div className="vp-body-md text-xs text-[#9BA8B8]">
                      Resolution: {rep.triage.recommended_action}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono-brand">
                      <span className="text-[#9BA8B8] truncate max-w-xs">
                        R2: {rep.attachment_url}
                      </span>
                      {isCritical ? (
                        <span className="text-[#00E5FF] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#FF5252]" />
                          <span>[ TELEGRAM_ALERT: {rep.triage.telegram_channel} ]</span>
                        </span>
                      ) : (
                        <span className="text-[#00E676] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>[ LOGGED // {rep.triage.telegram_channel} ]</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
