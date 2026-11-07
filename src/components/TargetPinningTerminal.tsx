import React, { useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { CulinaryNode, FIELD_PRESET_IMAGES } from '../data/vibePathData';
import { PoiSearchBox, GeocodedPoiResult } from './PoiSearchBox';
import { MapPin, Crosshair, CheckCircle2, CloudUpload, Plus } from 'lucide-react';

export interface TargetPinningTerminalProps {
  onAddNode: (node: Omit<CulinaryNode, 'id' | 'timestamp' | 'timecodeSeconds'>) => void;
  nodesCount: number;
  activeRiderPos: { lat: number; lng: number };
  deviceTempC: number;
  audioPeakDb: number;
  lastSyncId?: string;
  isSyncing: boolean;
  onSyncToCloud: () => Promise<void>;
  onClose: () => void;
  onCoordinatesPinned?: () => void;
  pinFormRef?: React.RefObject<HTMLDivElement | null>;
}

export const TargetPinningTerminal: React.FC<TargetPinningTerminalProps> = ({
  onAddNode,
  nodesCount,
  activeRiderPos,
  deviceTempC,
  audioPeakDb,
  lastSyncId,
  isSyncing,
  onSyncToCloud,
  onClose,
  onCoordinatesPinned,
  pinFormRef,
}) => {
  const { t, lang } = useTranslation();

  const [spotName, setSpotName] = useState<string>('');
  const [spotLat, setSpotLat] = useState<number>(Number(activeRiderPos.lat.toFixed(5)));
  const [spotLng, setSpotLng] = useState<number>(Number(activeRiderPos.lng.toFixed(5)));
  const [spotRating, setSpotRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [spotNote, setSpotNote] = useState<string>('');
  const [spotImages, setSpotImages] = useState<string[]>([FIELD_PRESET_IMAGES[0].url]);
  const [customImageUrl, setCustomImageUrl] = useState<string>('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);

  const handleOneTapGpsLock = () => {
    const lockedLat = Number(activeRiderPos.lat.toFixed(6));
    const lockedLng = Number(activeRiderPos.lng.toFixed(6));
    setSpotLat(lockedLat);
    setSpotLng(lockedLng);
  };

  const handleSelectAutocompletePoi = (result: GeocodedPoiResult) => {
    setSpotName(result.name);
    setSpotLat(result.latitude);
    setSpotLng(result.longitude);
    if (!spotNote.trim() && result.fullAddress) {
      setSpotNote(result.fullAddress);
    }
    setPinSuccessMsg(
      `${t('pinning.selectedPoi')} "${result.name}" (${result.latitude.toFixed(4)}°N, ${result.longitude.toFixed(4)}°E)`
    );
    onCoordinatesPinned?.();
    setTimeout(() => setPinSuccessMsg(null), 4000);
  };

  const handleToggleImage = (url: string) => {
    setSpotImages((prev) =>
      prev.includes(url)
        ? prev.length > 1
          ? prev.filter((u) => u !== url)
          : prev
        : [...prev, url]
    );
  };

  const handleAddCustomImage = () => {
    const trimmed = customImageUrl.trim();
    if (!trimmed) return;
    if (!spotImages.includes(trimmed)) {
      setSpotImages((prev) => [...prev, trimmed]);
    }
    setCustomImageUrl('');
  };

  const handleSubmitSpotPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = spotName.trim() || `${t('pinning.defaultPoiPrefix')} #${nodesCount + 1}`;
    const cleanNote = spotNote.trim() || t('pinning.defaultPoiNote');

    const int2Rating = Math.min(5, Math.max(1, parseInt(String(spotRating), 10) || 5)) as
      | 1
      | 2
      | 3
      | 4
      | 5;

    onAddNode({
      name: cleanName,
      latitude: Number(spotLat),
      longitude: Number(spotLng),
      rating: int2Rating,
      note: cleanNote,
      noteEn: cleanNote,
      images: spotImages.length > 0 ? spotImages : [FIELD_PRESET_IMAGES[0].url],
      durationSeconds: 18,
      district: 'District 1, Ben Thanh',
      temperatureC: deviceTempC,
      audioPeakDb: audioPeakDb,
    });

    setSpotName('');
    setSpotNote('');
    setPinSuccessMsg(`${t('pinning.pinnedSuccess')} "${cleanName}" (${int2Rating}/5)`);
    onCoordinatesPinned?.();
    setTimeout(() => setPinSuccessMsg(null), 3500);
  };

  return (
    <div ref={pinFormRef} className="rounded-none">
      <form
        onSubmit={handleSubmitSpotPin}
        className="bg-[#0D0E17] border border-[#1F1F2E] p-4 flex flex-col gap-3.5 w-full max-w-full overflow-hidden rounded-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1F1F2E] pb-2.5">
          <div>
            <span className="font-mono text-[10px] tracking-widest text-[#5322FF] block">
              {t('pinning.sectionHeader')}
            </span>
            <h2 className="text-sm font-bold text-white uppercase tracking-tight">
              {t('pinning.terminalTitle')}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOneTapGpsLock}
              className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer rounded-none"
            >
              <Crosshair className="w-3.5 h-3.5 shrink-0" />
              <span>{t('pinning.gpsLock')}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#FF5252] hover:text-white font-mono text-xs font-bold cursor-pointer rounded-none"
            >
              {t('pinning.close')}
            </button>
          </div>
        </div>

        {pinSuccessMsg && (
          <div className="bg-[#05050A] border border-[#00FF66] p-2.5 flex items-center gap-2 text-[#00FF66] font-mono text-xs rounded-none">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{pinSuccessMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <PoiSearchBox
              onSelectLocation={handleSelectAutocompletePoi}
              mapCenterLngLat={[spotLng, spotLat]}
              placeholder={t('search.placeholder')}
              compact={true}
            />

            <input
              id="poi-name"
              type="text"
              value={spotName}
              onChange={(e) => setSpotName(e.target.value)}
              placeholder={t('pinning.venueNamePlaceholder')}
              className="w-full min-h-[40px] px-3 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none rounded-none"
            />

            <div className="grid grid-cols-2 gap-2">
              <input
                id="poi-lat"
                type="number"
                step="0.00001"
                value={spotLat}
                onChange={(e) => setSpotLat(Number(e.target.value))}
                aria-label={t('pinning.latitudeAria')}
                className="w-full min-h-[38px] px-2.5 bg-[#05050A] border border-[#1F1F2E] text-[#00FF66] font-mono text-xs focus:border-[#00E5FF] focus:outline-none rounded-none"
              />
              <input
                id="poi-lng"
                type="number"
                step="0.00001"
                value={spotLng}
                onChange={(e) => setSpotLng(Number(e.target.value))}
                aria-label={t('pinning.longitudeAria')}
                className="w-full min-h-[38px] px-2.5 bg-[#05050A] border border-[#1F1F2E] text-[#00FF66] font-mono text-xs focus:border-[#00E5FF] focus:outline-none rounded-none"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-1.5">
              {([1, 2, 3, 4, 5] as const).map((starVal) => {
                const active = starVal <= spotRating;
                return (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => setSpotRating(starVal)}
                    className={`min-h-[36px] bg-[#0D0E17] border flex items-center justify-center gap-1 font-mono text-xs font-bold cursor-pointer rounded-none ${
                      active
                        ? 'border-[#00E5FF] text-[#00E5FF]'
                        : 'border-[#1F1F2E] text-[#8A8FA3]'
                    }`}
                  >
                    <span>{active ? '█' : '░'}</span>
                    <span>{starVal}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              id="poi-note"
              rows={2}
              value={spotNote}
              onChange={(e) => setSpotNote(e.target.value)}
              placeholder={t('pinning.tasteNotesPlaceholder')}
              className="w-full p-2.5 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none resize-none rounded-none"
            />

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                {FIELD_PRESET_IMAGES.map((preset) => {
                  const selected = spotImages.includes(preset.url);
                  return (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => handleToggleImage(preset.url)}
                      className={`px-2 py-1 bg-[#05050A] border font-mono text-[11px] flex items-center gap-1.5 cursor-pointer shrink-0 rounded-none ${
                        selected
                          ? 'border-[#00E5FF] text-white'
                          : 'border-[#1F1F2E] text-[#8A8FA3]'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={lang === 'en' ? preset.labelEn : preset.labelVi}
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 object-cover"
                      />
                      <span>{lang === 'en' ? preset.labelEn : preset.labelVi}</span>
                    </button>
                  );
                })}
              </div>

              <input
                type="url"
                value={customImageUrl}
                onChange={(e) => setCustomImageUrl(e.target.value)}
                placeholder={t('pinning.imageUrlPlaceholder')}
                className="w-32 min-h-[32px] px-2 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs rounded-none"
              />
              <button
                type="button"
                onClick={handleAddCustomImage}
                className="min-h-[32px] px-2 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] cursor-pointer rounded-none"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1F1F2E]">
          <span className="font-mono text-xs text-[#8A8FA3]">
            {lastSyncId ? `${t('pinning.lastSync')}: ${lastSyncId}` : t('pinning.readyToSync')}
          </span>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              style={{
                clipPath:
                  'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
              }}
              className="min-h-[40px] px-4 bg-[#0D0E17] border border-[#00E5FF] text-white hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
            >
              <MapPin className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span>{t('pinning.saveAndPinSpot')}</span>
            </button>

            <button
              type="button"
              onClick={onSyncToCloud}
              disabled={isSyncing}
              className="min-h-[40px] px-4 bg-[#0D0E17] border border-[#1F1F2E] text-[#8A8FA3] hover:border-[#00E5FF] hover:text-[#00E5FF] hover:shadow-[0_0_12px_rgba(0,229,255,0.28)] font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all rounded-none"
            >
              <CloudUpload className="w-4 h-4 shrink-0" />
              <span>{isSyncing ? t('pinning.syncing') : t('pinning.syncToCloud')}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
