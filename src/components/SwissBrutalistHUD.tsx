import React, { useEffect, useState } from 'react';
import { FlightStageUpdate } from '../services/cinematicFlightEngine';

export interface HUDProps {
  tripName: string;
  isSyncing: boolean;
  onSync: () => void;
  onTriggerCinematicRender?: () => void;
}

export const SwissBrutalistHUD: React.FC<HUDProps> = ({
  tripName,
  isSyncing,
  onSync,
  onTriggerCinematicRender,
}) => {
  const [flightStatus, setFlightStatus] = useState<FlightStageUpdate | null>(null);
  const [lastExportFile, setLastExportFile] = useState<string | null>(null);

  useEffect(() => {
    const handleStageEvent = (e: Event) => {
      const custom = e as CustomEvent<FlightStageUpdate | null>;
      setFlightStatus(custom.detail || null);
    };

    const handleCompleteEvent = (e: Event) => {
      const custom = e as CustomEvent<{ filename?: string } | null>;
      if (custom.detail?.filename) {
        setLastExportFile(custom.detail.filename);
        window.setTimeout(() => setLastExportFile(null), 5000);
      }
    };

    window.addEventListener('vibepath_cinematic_status', handleStageEvent);
    window.addEventListener('vibepath_cinematic_complete', handleCompleteEvent);
    return () => {
      window.removeEventListener('vibepath_cinematic_status', handleStageEvent);
      window.removeEventListener('vibepath_cinematic_complete', handleCompleteEvent);
    };
  }, []);

  const isRenderingCinematic = Boolean(flightStatus?.isRecording);

  const handleCinematicClick = () => {
    if (onTriggerCinematicRender) {
      onTriggerCinematicRender();
    } else {
      window.dispatchEvent(
        new CustomEvent('vibepath_trigger_cinematic_render', {
          detail: {
            recordVideo: true,
            tripName: tripName || 'SAIGON_NIGHT_CULINARY_NODE_01',
          },
        })
      );
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden bg-[#080A0F] border-b border-[#1F1F2E] px-3 sm:px-6 py-3 text-[#FFFFFF] select-none mb-3">
      <div className="max-w-[1440px] mx-auto flex flex-wrap justify-between items-center gap-2.5">
        {/* Khung định vị góc trái */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div
            className={`w-3 h-3 shrink-0 ${
              isRenderingCinematic
                ? 'bg-[#00E676] animate-ping'
                : 'bg-[#00E5FF] animate-pulse'
            }`}
          />
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-[#00E5FF] font-bold tracking-widest block truncate">
              {flightStatus
                ? flightStatus.label
                : '[ SYS_TELEMETRY // VIBEPATH_v2.5 // 4-STAGE_FLIGHT_ENGINE ]'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white truncate">
                {tripName || 'ROUTE_UNNAMED_NODE'}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-[#0D1017] border border-[#00E5FF] text-[#00E5FF]">
                {flightStatus?.globalDistrictScanTag ||
                  '[ GLOBAL_DISTRICT_SCAN // DISTRICT 1, VN ]'}
              </span>
              {flightStatus?.hudLockTag && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#0D1017] border border-[#00E676] text-[#00E676]">
                  {flightStatus.hudLockTag}
                </span>
              )}
              {lastExportFile && (
                <span className="text-[10px] font-bold px-2 py-0.5 bg-[#0D1017] border border-[#00E5FF] text-[#00E5FF] truncate">
                  [ EXPORTED // {lastExportFile} ]
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Thông số Kỹ thuật Buồng Lái (Cockpit Data Grid) */}
        <div className="hidden xl:flex items-center gap-6 border-x border-[#1F1F2E] px-6 py-1 shrink-0">
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">[ LATENCY ]</span>
            <span className="text-xs text-[#00E5FF] font-bold">12.4 MS</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">[ VECTOR_FPS ]</span>
            <span className="text-xs text-[#00E5FF] font-bold">60.0 FPS</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">[ PROTOCOL ]</span>
            <span className="text-xs text-[#00E676] font-bold">SSL_ZERO_TRUST</span>
          </div>
        </div>

        {/* Primary Action Buttons: [ 🎬 1-CLICK CINEMATIC RENDER ] & [ ⚡ EXECUTE_SYNC ] */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCinematicClick}
            className={`clip-button-chamfer px-3.5 sm:px-5 py-2 sm:py-2.5 font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
              isRenderingCinematic
                ? 'bg-[#00E676] text-[#080A0F] border border-[#00E676]'
                : 'bg-[#00E5FF] text-[#080A0F] hover:bg-white hover:text-black border border-[#00E5FF]'
            }`}
          >
            {isRenderingCinematic
              ? `[ 🔴 REC_60FPS // STAGE ${flightStatus?.stageNumber || 1}/4 ]`
              : '[ 🎬 1-CLICK CINEMATIC RENDER ]'}
          </button>

          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className={`clip-button-chamfer px-3 sm:px-4 py-2 sm:py-2.5 font-bold text-[11px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
              isSyncing
                ? 'bg-[#1F1F2E] text-slate-500 border border-[#2D2D44] cursor-not-allowed'
                : 'bg-[#0D1017] text-[#00E5FF] hover:bg-[#00E5FF] hover:text-[#080A0F] border border-[#00E5FF]'
            }`}
          >
            {isSyncing ? '[ SYNCING_DATA... ]' : '[ ⚡ EXECUTE_SYNC ]'}
          </button>
        </div>
      </div>
    </div>
  );
};
