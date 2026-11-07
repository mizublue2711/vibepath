import React, { useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { CulinaryNode } from '../data/vibePathData';
import { PoiSearchBox, GeocodedPoiResult } from './PoiSearchBox';
import { MapPin, Crosshair, CheckCircle2, CloudUpload, Trash2, X } from 'lucide-react';

export interface ActivePoiDraft {
  name: string;
  latitude: number;
  longitude: number;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string;
}

export interface TargetPinningTerminalProps {
  onAddNode: (node: Omit<CulinaryNode, 'id' | 'timestamp' | 'timecodeSeconds'>) => void;
  nodesCount: number;
  pinnedLocations?: CulinaryNode[];
  onDeleteNode?: (id: string) => void;
  onClearSession?: () => void;
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
  pinnedLocations = [],
  onDeleteNode,
  onClearSession,
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
  const { t } = useTranslation();

  const [activePoi, setActivePoi] = useState<ActivePoiDraft | null>(null);
  const [spotName, setSpotName] = useState<string>('');
  const [spotLat, setSpotLat] = useState<number>(Number(activeRiderPos.lat.toFixed(5)));
  const [spotLng, setSpotLng] = useState<number>(Number(activeRiderPos.lng.toFixed(5)));
  const [spotRating, setSpotRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [spotNote, setSpotNote] = useState<string>('');
  const [searchResetKey, setSearchResetKey] = useState<number>(0);
  const [pinSuccessMsg, setPinSuccessMsg] = useState<string | null>(null);

  const handleOneTapGpsLock = () => {
    const lockedLat = Number(activeRiderPos.lat.toFixed(6));
    const lockedLng = Number(activeRiderPos.lng.toFixed(6));
    setSpotLat(lockedLat);
    setSpotLng(lockedLng);
    if (activePoi) {
      setActivePoi({
        ...activePoi,
        latitude: lockedLat,
        longitude: lockedLng,
      });
    }
  };

  const handleSelectAutocompletePoi = (result: GeocodedPoiResult) => {
    const defaultNote = spotNote.trim() || result.fullAddress || '';
    setSpotName(result.name);
    setSpotLat(result.latitude);
    setSpotLng(result.longitude);
    setSpotNote(defaultNote);

    setActivePoi({
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      rating: spotRating,
      note: defaultNote,
    });

    setPinSuccessMsg(
      `${t('pinning.selectedPoi')} "${result.name}" (${result.latitude.toFixed(4)}°N, ${result.longitude.toFixed(4)}°E)`
    );
    onCoordinatesPinned?.();
    setTimeout(() => setPinSuccessMsg(null), 4000);
  };

  const handleUpdateName = (val: string) => {
    setSpotName(val);
    if (val.trim()) {
      setActivePoi((prev) => ({
        name: val,
        latitude: prev?.latitude ?? spotLat,
        longitude: prev?.longitude ?? spotLng,
        rating: prev?.rating ?? spotRating,
        note: prev?.note ?? spotNote,
      }));
    } else if (!activePoi?.latitude) {
      setActivePoi(null);
    } else {
      setActivePoi((prev) => (prev ? { ...prev, name: '' } : null));
    }
  };

  const handleUpdateRating = (ratingVal: 1 | 2 | 3 | 4 | 5) => {
    setSpotRating(ratingVal);
    if (activePoi) {
      setActivePoi({
        ...activePoi,
        rating: ratingVal,
      });
    }
  };

  const handleUpdateNote = (val: string) => {
    setSpotNote(val);
    if (activePoi) {
      setActivePoi({
        ...activePoi,
        note: val,
      });
    }
  };

  const handleRemoveActivePoiChip = () => {
    setActivePoi(null);
    setSpotName('');
    setSpotNote('');
    setSearchResetKey((k) => k + 1);
  };

  const handleClearSessionClick = () => {
    if (window.confirm(t('pinning.clearSessionConfirm'))) {
      onClearSession?.();
      setActivePoi(null);
      setSpotName('');
      setSpotNote('');
      setSearchResetKey((k) => k + 1);
    }
  };

  const handleSubmitSpotPin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName =
      (activePoi?.name || spotName).trim() ||
      `${t('pinning.defaultPoiPrefix')} #${nodesCount + 1}`;
    const cleanNote =
      (activePoi?.note || spotNote).trim() || t('pinning.defaultPoiNote');
    const targetLat = activePoi ? activePoi.latitude : spotLat;
    const targetLng = activePoi ? activePoi.longitude : spotLng;
    const currentRating = activePoi ? activePoi.rating : spotRating;

    const int2Rating = Math.min(
      5,
      Math.max(1, parseInt(String(currentRating), 10) || 5)
    ) as 1 | 2 | 3 | 4 | 5;

    onAddNode({
      name: cleanName,
      latitude: Number(targetLat),
      longitude: Number(targetLng),
      rating: int2Rating,
      note: cleanNote,
      noteEn: cleanNote,
      images: [],
      durationSeconds: 18,
      district: 'District 1, Ben Thanh',
      temperatureC: deviceTempC,
      audioPeakDb: audioPeakDb,
    });

    // Reset active POI, search input, and notes box for next location
    setActivePoi(null);
    setSpotName('');
    setSpotNote('');
    setSearchResetKey((k) => k + 1);

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
              onClick={handleClearSessionClick}
              className="min-h-[34px] px-3 bg-[#0D0E17] border border-[#1F1F2E] text-[#FF5252] hover:border-[#FF5252] hover:bg-[#FF5252]/10 font-mono text-xs font-bold flex items-center gap-1.5 cursor-pointer rounded-none"
              title={t('pinning.clearSession')}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0 text-[#FF5252]" />
              <span>{t('pinning.clearSession')}</span>
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
              key={searchResetKey}
              onSelectLocation={handleSelectAutocompletePoi}
              mapCenterLngLat={[spotLng, spotLat]}
              placeholder={t('search.placeholder')}
              compact={true}
            />

            <input
              id="poi-name"
              type="text"
              value={spotName}
              onChange={(e) => handleUpdateName(e.target.value)}
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
                const currentVal = activePoi ? activePoi.rating : spotRating;
                const active = starVal <= currentVal;
                return (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => handleUpdateRating(starVal)}
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
              value={activePoi ? activePoi.note : spotNote}
              onChange={(e) => handleUpdateNote(e.target.value)}
              placeholder={t('pinning.tasteNotesPlaceholder')}
              className="w-full p-2.5 bg-[#05050A] border border-[#1F1F2E] text-white font-mono text-xs focus:border-[#00E5FF] focus:outline-none resize-none rounded-none"
            />

            {/* Dynamic Active POI Chip List & Empty State */}
            <div className="pt-1 flex flex-wrap items-center gap-2 min-h-[36px]">
              {!activePoi && pinnedLocations.length === 0 ? (
                <div className="w-full py-2 px-3 border border-dashed border-[#1F1F2E] bg-[#05050A] font-mono text-[11px] text-[#8A8FA3] flex items-center justify-center text-center rounded-none select-none">
                  {t('pinning.emptyPoiState')}
                </div>
              ) : (
                <>
                  {/* Instantly instantiated Active POI Chip */}
                  {activePoi && (
                    <div
                      style={{
                        background: 'rgba(0, 229, 255, 0.1)',
                      }}
                      className="px-2.5 py-1.5 border border-[#00E5FF] font-mono text-xs flex items-center gap-2 text-white shadow-[0_0_8px_rgba(0,229,255,0.2)] rounded-none shrink-0"
                    >
                      <span className="font-bold text-[#00E5FF]">
                        [ 📍 01 // {(activePoi.name || t('pinning.defaultPoiPrefix')).toUpperCase()} ]
                      </span>
                      <button
                        type="button"
                        onClick={handleRemoveActivePoiChip}
                        className="text-[#8A8FA3] hover:text-[#FF5252] p-0.5 cursor-pointer rounded-none transition-colors"
                        title={t('pinning.removePoiChip')}
                        aria-label={t('pinning.removePoiChip')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Pinned history list under notes box */}
                  {pinnedLocations.map((loc, idx) => {
                    const chipIdx = String((activePoi ? idx + 2 : idx + 1)).padStart(2, '0');
                    return (
                      <div
                        key={loc.id}
                        className="px-2.5 py-1.5 border border-[#1F1F2E] bg-[#05050A] hover:border-[#00E5FF]/40 font-mono text-xs flex items-center gap-2 text-[#8A8FA3] rounded-none shrink-0"
                      >
                        <span className="text-white">
                          [ 📍 {chipIdx} // {loc.name.toUpperCase()} ]
                        </span>
                        {onDeleteNode && (
                          <button
                            type="button"
                            onClick={() => onDeleteNode(loc.id)}
                            className="text-[#8A8FA3] hover:text-[#FF5252] p-0.5 cursor-pointer rounded-none transition-colors"
                            title={t('pinning.removePoiChip')}
                            aria-label={t('pinning.removePoiChip')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
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
