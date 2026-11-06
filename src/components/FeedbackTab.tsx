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
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Terminal,
  ShieldCheck,
  Code2,
} from 'lucide-react';

export interface FeedbackTabProps {
  reports: FeedbackReport[];
  onAddReport: (report: FeedbackReport) => void;
  language: LanguageCode;
}

const FEATURE_CHIP_MAP: Array<{ key: string; shortLabel: string }> = [
  { key: EVALUABLE_FEATURES[4] || '3D Map 60FPS Video Follow-Cam', shortLabel: '3D MAP 60FPS' },
  { key: EVALUABLE_FEATURES[2] || 'Bilingual .SRT Subtitle Sync', shortLabel: 'BILINGUAL SRT' },
  { key: EVALUABLE_FEATURES[0] || 'Invisible Background Tracker (GPS)', shortLabel: 'GPS TRACKER' },
  { key: EVALUABLE_FEATURES[1] || 'One-Tap Spot Pinning (POI INT2)', shortLabel: '1-TAP POI PIN' },
  { key: EVALUABLE_FEATURES[3] || 'Premiere / CapCut .XML Markers', shortLabel: 'XML MARKERS' },
  { key: EVALUABLE_FEATURES[5] || 'Outdoor Sunlight Contrast (#12161A)', shortLabel: 'OLED CONTRAST' },
];

function buildSignalBarString(rating: number): string {
  const filled = Math.max(1, Math.min(5, rating));
  const blocks = [1, 2, 3, 4, 5].map((i) => (i <= filled ? '█' : '░')).join(' ');
  return `[ ${blocks} ] (${filled}/5)`;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = ({
  reports,
  onAddReport,
  language,
}) => {
  const [role, setRole] = useState<UserRole>('vlogger');
  const [rating, setRating] = useState<number>(3);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([
    FEATURE_CHIP_MAP[0].key,
    FEATURE_CHIP_MAP[1].key,
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

  // Hidden developer debug toggle & collapsible Raw JSON inspector state (both hidden by default)
  const [showDebugPresets, setShowDebugPresets] = useState<boolean>(false);
  const [isRawJsonOpen, setIsRawJsonOpen] = useState<boolean>(false);

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
        'Giao diện nền tối kết hợp màu chữ #00E5FF và nút ghim 1 chạm đáy màn hình cực kỳ dễ thao tác ngoài hiện trường.'
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
          severity: isUrgent ? 'P1' : 'P2',
          summary: sanitizedPayload.feedback_text.slice(0, 90),
          recommended_action: isUrgent
            ? 'Immediate hotfix rollback & Cloudflare Worker replay.'
            : 'Logged for next ergonomic UI iteration.',
          telegram_alert_sent: isUrgent,
          telegram_channel: isUrgent ? '@VibePathOpsAlertBot #p1-critical' : 'N/A (P2 Queue)',
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 bg-[#05050A] rounded-none">
      {/* Left 6 Columns: Streamlined Field Audit & Telemetry Feedback Form */}
      <div className="lg:col-span-6 flex flex-col gap-4 rounded-none">
        <form
          onSubmit={handleSubmitFeedback}
          className="bg-[#0D0E17] border border-[#1F1F2E] p-4 md:p-5 flex flex-col gap-4 rounded-none"
        >
          <div className="border-b border-[#1F1F2E] pb-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] tracking-widest text-[#5322FF] block">
                  [ 01 // TELEMETRY_AUDIT_TERMINAL ]
                </span>
                <h2 className="font-bold text-sm tracking-tight text-white uppercase mt-0.5">
                  FIELD AUDIT & TELEMETRY FEEDBACK
                </h2>
              </div>

              {/* Hidden Debug Toggle */}
              <button
                type="button"
                onClick={() => setShowDebugPresets((prev) => !prev)}
                className="min-h-[28px] px-2 bg-[#05050A] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white font-mono text-[10px] uppercase tracking-wider cursor-pointer rounded-none"
                title="Toggle Developer Test Presets"
              >
                {showDebugPresets ? '[ - HIDE_DEBUG ]' : '[ + DEV_DEBUG ]'}
              </button>
            </div>

            {/* Developer Debug Tags [TEST_P0], [TEST_P1], [TEST_P2] — Hidden behind toggle */}
            {showDebugPresets && (
              <div className="pt-2 border-t border-[#1F1F2E] flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-[#8A8FA3] mr-1">
                  SIMULATE_PAYLOAD:
                </span>
                <button
                  type="button"
                  onClick={() => applyPresetScenario('p0')}
                  className="min-h-[28px] px-2.5 bg-[#05050A] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#8A8FA3] hover:text-white font-mono text-[10px] cursor-pointer rounded-none"
                >
                  [TEST_P0]
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetScenario('p1')}
                  className="min-h-[28px] px-2.5 bg-[#05050A] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#8A8FA3] hover:text-white font-mono text-[10px] cursor-pointer rounded-none"
                >
                  [TEST_P1]
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetScenario('p2')}
                  className="min-h-[28px] px-2.5 bg-[#05050A] border border-[#1F1F2E] hover:border-[#00FF66] text-[#8A8FA3] hover:text-white font-mono text-[10px] cursor-pointer rounded-none"
                >
                  [TEST_P2]
                </button>
              </div>
            )}
          </div>

          {/* 1. Role Selection */}
          <div className="space-y-1.5">
            <span className="font-mono text-[10px] tracking-widest text-[#8A8FA3] block uppercase">
              [ 01 // OPERATOR_ROLE: VLOGGER | EDITOR | TESTER ]
            </span>
            <div className="grid grid-cols-3 gap-2">
              {(['vlogger', 'editor', 'tester'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`min-h-[38px] border font-mono text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer rounded-none ${
                    role === r
                      ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white'
                      : 'bg-[#05050A] border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white'
                  }`}
                >
                  [ {r} ]
                </button>
              ))}
            </div>
          </div>

          {/* 2. 5-Step Industrial Signal Bar [ █ █ █ ░ ░ ] (3/5) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#8A8FA3] uppercase">
                [ 02 // SIGNAL_INTEGRITY_RATING ]
              </span>
              <span className="font-mono text-xs font-bold text-[#00E5FF]">
                {buildSignalBarString(rating)}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((step) => {
                const active = step <= rating;
                return (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setRating(step)}
                    aria-label={`Signal Step ${step} of 5`}
                    className={`min-h-[38px] border font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer rounded-none ${
                      active
                        ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-[#00E5FF]'
                        : 'bg-[#05050A] border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF]'
                    }`}
                  >
                    <span>{active ? '█' : '░'}</span>
                    <span>0{step}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Evaluated Features: 2x3 Compact Grid of Non-Truncating Technical Chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#8A8FA3] uppercase">
                [ 03 // EVALUATED_FEATURES_MATRIX ]
              </span>
              <span className="font-mono text-xs text-[#00FF66]">
                [ {selectedFeatures.length}/6 ACTIVE ]
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FEATURE_CHIP_MAP.map((chip) => {
                const active = selectedFeatures.includes(chip.key);
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => toggleFeature(chip.key)}
                    className={`min-h-[40px] px-2.5 py-2 border font-mono text-[11px] font-bold uppercase tracking-wider text-center transition-colors cursor-pointer flex items-center justify-center rounded-none ${
                      active
                        ? 'border-[#00E5FF] text-white bg-[#00E5FF]/10'
                        : 'bg-[#05050A] border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white'
                    }`}
                  >
                    <span>
                      {active ? `[ ✓ ${chip.shortLabel} ]` : `[ + ${chip.shortLabel} ]`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Qualitative Feedback / Incident Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="feedback-text"
              className="font-mono text-[10px] tracking-widest text-[#8A8FA3] block uppercase"
            >
              [ 04 // INCIDENT_TELEMETRY_LOG ]
            </label>
            <textarea
              id="feedback-text"
              rows={3}
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder={
                language === 'vi'
                  ? 'Nhập mô tả chi tiết trải nghiệm hoặc sự cố kỹ thuật để điều phối qua N8N & Dify AI...'
                  : 'Enter field telemetry audit or bug report for automated N8N & Dify AI triage...'
              }
              className="w-full p-3 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none resize-none rounded-none"
            />
          </div>

          {/* 5. Cloudflare R2 Screenshot Attachment */}
          <div className="space-y-1.5">
            <label
              htmlFor="attachment-url"
              className="font-mono text-[10px] tracking-widest text-[#8A8FA3] block uppercase"
            >
              [ 05 // CLOUDFLARE_R2_SNAPSHOT_URI ]
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="attachment-url"
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="flex-1 min-h-[40px] px-3 bg-[#05050A] border border-[#1F1F2E] text-[#8A8FA3] font-mono text-xs focus:border-[#00E5FF] focus:outline-none rounded-none"
              />
              <button
                type="button"
                onClick={handleAutoUploadR2}
                disabled={isUploadingR2}
                className="min-h-[40px] px-3.5 bg-[#05050A] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#8A8FA3] hover:text-white font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors rounded-none"
              >
                <UploadCloud className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>{isUploadingR2 ? '[ UPLOADING_R2... ]' : '[ AUTO_R2_SNAPSHOT ]'}</span>
              </button>
            </div>
          </div>

          {/* Primary Action Button with 45° Chiseled Corner Clip-Path */}
          <button
            type="submit"
            disabled={isTriaging}
            style={{
              clipPath:
                'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
            }}
            className="w-full min-h-[48px] bg-[#0D0E17] border border-[#00E5FF] text-white hover:bg-[#00E5FF]/15 hover:text-[#00E5FF] font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors rounded-none"
          >
            <span>
              {isTriaging
                ? '[ > DISPATCHING_TO_N8N_PIPELINE... ]'
                : '[ > DISPATCH TICKET TO N8N ]'}
            </span>
          </button>
        </form>
      </div>

      {/* Right 6 Columns: Modernized AI Incident Ticket Queue & Collapsible Raw JSON Inspector */}
      <div className="lg:col-span-6 flex flex-col gap-4 rounded-none">
        {/* Latest Triage Alert Banner */}
        {latestSubmitted && (
          <div
            className={`bg-[#0D0E17] border p-4 rounded-none ${
              latestSubmitted.triage.severity === 'P0' || latestSubmitted.triage.severity === 'P1'
                ? 'border-[#00E5FF]'
                : 'border-[#00FF66]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-widest text-[#00E5FF] flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>
                  [ N8N_WEBHOOK_DISPATCHED // {latestSubmitted.triage.dify_agent_run_id} ]
                </span>
              </span>
              <span
                className={`px-2 py-0.5 border font-mono text-[10px] font-bold rounded-none ${
                  latestSubmitted.triage.severity === 'P0' ||
                  latestSubmitted.triage.severity === 'P1'
                    ? 'border-[#00E5FF] text-[#00E5FF]'
                    : 'border-[#00FF66] text-[#00FF66]'
                }`}
              >
                {latestSubmitted.triage.severity === 'P0' ||
                latestSubmitted.triage.severity === 'P1'
                  ? '[ P1 // CRITICAL ]'
                  : '[ P2 // LOGIC ]'}
              </span>
            </div>
            <p className="font-mono font-bold text-xs text-white mt-1.5">
              {latestSubmitted.triage.summary}
            </p>
            <p className="font-mono text-xs text-[#8A8FA3] mt-1">
              Action: {latestSubmitted.triage.recommended_action}
            </p>
          </div>
        )}

        {/* Modernized Incident Ticket Queue */}
        <div className="bg-[#0D0E17] border border-[#1F1F2E] p-4 md:p-5 flex flex-col gap-4 flex-1 rounded-none">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-3">
            <div>
              <span className="font-mono text-[10px] tracking-widest text-[#5322FF] block">
                [ 02 // AI_INCIDENT_TRIAGE_MONITOR ]
              </span>
              <h3 className="font-bold text-sm tracking-tight text-white uppercase mt-0.5">
                {language === 'vi'
                  ? `Hàng đợi Phân loại AI (${reports.length} Tickets)`
                  : `AI Incident Triage Queue (${reports.length} Tickets)`}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRawJsonOpen((prev) => !prev)}
                className={`min-h-[32px] px-3 border font-mono text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 cursor-pointer transition-colors rounded-none ${
                  isRawJsonOpen
                    ? 'bg-[#00E5FF]/10 border-[#00E5FF] text-white'
                    : 'bg-[#05050A] border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-white'
                }`}
              >
                <Code2 className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                <span>[ ⏣ INSPECT RAW JSON ]</span>
              </button>
              <Terminal className="w-4 h-4 text-[#00E5FF] hidden sm:block" />
            </div>
          </div>

          {/* Collapsible Raw JSON Schema Validator Inspector (Hidden by default) */}
          {isRawJsonOpen && (
            <div className="bg-[#05050A] border border-[#1F1F2E] p-3.5 space-y-2 rounded-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[10px] tracking-widest text-[#00FF66] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00FF66]" />
                  <span>[ SchemaValidator.sanitizeFeedbackPayload() // LIVE_CONTRACT ]</span>
                </span>
                <span className="font-mono text-[10px] text-[#00E5FF]">
                  [ event_type: user_feedback ]
                </span>
              </div>
              <pre className="bg-[#0D0E17] border border-[#1F1F2E] p-3 font-mono text-xs text-[#00E5FF] max-h-[180px] overflow-y-auto whitespace-pre-wrap leading-relaxed rounded-none">
                {JSON.stringify(latestSanitizedPayload || liveSanitizedPreview, null, 2)}
              </pre>
            </div>
          )}

          {/* Sleek Incident Ticket Cards */}
          <div className="flex flex-col gap-3">
            {reports.map((rep) => {
              const isCritical = rep.triage.severity === 'P0' || rep.triage.severity === 'P1';
              return (
                <article
                  key={rep.id}
                  className="bg-[#05050A] border border-[#1F1F2E] p-3.5 space-y-2.5 rounded-none"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                      <span
                        className={`px-2 py-0.5 border font-mono text-[11px] font-bold rounded-none ${
                          isCritical
                            ? 'border-[#00E5FF] text-[#00E5FF] bg-[#00E5FF]/10'
                            : 'border-[#00FF66] text-[#00FF66] bg-[#00FF66]/10'
                        }`}
                      >
                        {isCritical ? '[ P1 // CRITICAL ]' : '[ P2 // LOGIC ]'}
                      </span>
                      <span className="font-bold text-white">{rep.id}</span>
                      <span className="text-[#8A8FA3]">// {rep.triage.category}</span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] text-[#8A8FA3]">
                      <span className="uppercase">
                        {rep.role} • {buildSignalBarString(rep.rating)}
                      </span>
                      <span>|</span>
                      <span>{rep.created_at}</span>
                    </div>
                  </div>

                  <p className="text-xs text-white leading-relaxed">{rep.feedback_text}</p>

                  <div className="bg-[#0D0E17] border border-[#1F1F2E] p-2.5 space-y-1 rounded-none">
                    <div className="font-mono text-xs text-white font-bold">
                      [ TRIAGE_SUMMARY ] {rep.triage.summary}
                    </div>
                    <div className="font-mono text-xs text-[#8A8FA3]">
                      Resolution: {rep.triage.recommended_action}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[11px]">
                      <span className="text-[#8A8FA3] break-all">
                        R2: {rep.attachment_url}
                      </span>
                      {isCritical ? (
                        <span className="text-[#00E5FF] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-[#00E5FF]" />
                          <span>[ N8N_ALERT: {rep.triage.telegram_channel} ]</span>
                        </span>
                      ) : (
                        <span className="text-[#00FF66] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#00FF66]" />
                          <span>[ QUEUED // {rep.triage.telegram_channel} ]</span>
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
