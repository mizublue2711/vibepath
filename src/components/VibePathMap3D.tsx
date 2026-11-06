import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CulinaryNode,
  RouteWaypoint,
  LanguageCode,
} from '../data/vibePathData';
import {
  Compass,
  Play,
  Pause,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Video,
} from 'lucide-react';

// Mandatory Google Maps Platform attribution ID for AI Studio
const GMP_ATTRIBUTION_ID = 'gmp_mcp_codeassist_v1_aistudio';

interface VibePathMap3DProps {
  nodes: CulinaryNode[];
  waypoints: RouteWaypoint[];
  selectedNodeId: string | null;
  onSelectNode: (node: CulinaryNode) => void;
  onPickCoordinate?: (lat: number, lng: number) => void;
  activeRiderPos: { lat: number; lng: number };
  isTracking: boolean;
  language: LanguageCode;
  isFollowCamPlaying?: boolean;
  onToggleFollowCam?: () => void;
  onExportVideoReady?: (blobUrl: string, filename: string) => void;
  compactMode?: boolean;
}

export const VibePathMap3D: React.FC<VibePathMap3DProps> = ({
  nodes,
  waypoints,
  selectedNodeId,
  onSelectNode,
  onPickCoordinate,
  activeRiderPos,
  isTracking,
  language,
  isFollowCamPlaying = false,
  onToggleFollowCam,
  onExportVideoReady,
  compactMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gmpContainerRef = useRef<HTMLDivElement | null>(null);

  // Camera state for 3D perspective projection
  const [cameraTilt, setCameraTilt] = useState<number>(62);
  const [cameraHeading, setCameraHeading] = useState<number>(28);
  const [cameraZoom, setCameraZoom] = useState<number>(1.15);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [followProgress, setFollowProgress] = useState<number>(0); // 0..1 along route
  const [isRecordingClip, setIsRecordingClip] = useState<boolean>(false);
  const [recordingPct, setRecordingPct] = useState<number>(0);
  const [useGmp3D, setUseGmp3D] = useState<boolean>(false);

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; heading: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    heading: 28,
    panX: 0,
    panY: 0,
  });

  const apiKey = ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  // Listen for gmp-map-fallback event so ApiProjectMapError switches immediately to Kinetic 3D Canvas
  useEffect(() => {
    const handleFallback = () => {
      setUseGmp3D(false);
    };
    window.addEventListener('gmp-map-fallback', handleFallback);
    return () => window.removeEventListener('gmp-map-fallback', handleFallback);
  }, []);

  // Optional Google Maps 3D initialization only when a real non-empty key is configured
  useEffect(() => {
    if (!apiKey || !useGmp3D || !gmpContainerRef.current) return;
    let isMounted = true;

    async function initOptionalGmp3D() {
      try {
        if (!(window as any).google?.maps?.importLibrary) {
          const existing = document.getElementById('vibepath-gmp-3d-sdk');
          if (!existing) {
            await new Promise<void>((resolve, reject) => {
              const script = document.createElement('script');
              script.id = 'vibepath-gmp-3d-sdk';
              script.src = `https://maps.googleapis.com/maps/api/js?loading=async&key=${apiKey}&libraries=maps3d,marker&v=beta&solution_channel=${GMP_ATTRIBUTION_ID}`;
              script.async = true;
              script.onload = () => resolve();
              script.onerror = () => reject(new Error('GMP script load failed'));
              document.head.appendChild(script);
            });
          }
        }
        const maps3dLib = await (window as any).google.maps.importLibrary('maps3d');
        if (!isMounted || !gmpContainerRef.current) return;
        gmpContainerRef.current.innerHTML = '';
        const Map3DElement = maps3dLib?.Map3DElement;
        if (Map3DElement) {
          const mapEl = new Map3DElement({
            center: { lat: activeRiderPos.lat, lng: activeRiderPos.lng, altitude: 0 },
            range: 3200,
            tilt: 65,
            heading: cameraHeading,
            mode: 'HYBRID',
            gestureHandling: 'GREEDY',
            internalUsageAttributionIds: [GMP_ATTRIBUTION_ID],
          });
          mapEl.style.width = '100%';
          mapEl.style.height = '100%';
          gmpContainerRef.current.appendChild(mapEl);
        }
      } catch (_) {
        if (isMounted) setUseGmp3D(false);
      }
    }

    initOptionalGmp3D();
    return () => {
      isMounted = false;
    };
  }, [apiKey, useGmp3D, activeRiderPos.lat, activeRiderPos.lng, cameraHeading]);

  // Compute bounding center of all culinary nodes and waypoints
  const boundsCenter = React.useMemo(() => {
    const allLats = [...nodes.map((n) => n.latitude), ...waypoints.map((w) => w.lat), activeRiderPos.lat];
    const allLngs = [...nodes.map((n) => n.longitude), ...waypoints.map((w) => w.lng), activeRiderPos.lng];
    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);
    return {
      centerLat: (minLat + maxLat) / 2,
      centerLng: (minLng + maxLng) / 2,
      spanLat: Math.max(0.025, maxLat - minLat),
      spanLng: Math.max(0.025, maxLng - minLng),
    };
  }, [nodes, waypoints, activeRiderPos]);

  // Project (lat, lng, altitudeMeters) to 2D canvas screen coordinates with 3D perspective tilt & heading
  const project3D = useCallback(
    (lat: number, lng: number, altMeters: number, width: number, height: number, headingDeg: number, tiltDeg: number) => {
      const normX = ((lng - boundsCenter.centerLng) / (boundsCenter.spanLng * 0.72)) * Math.min(width, height) * 0.44 * cameraZoom;
      const normY = -((lat - boundsCenter.centerLat) / (boundsCenter.spanLat * 0.72)) * Math.min(width, height) * 0.44 * cameraZoom;

      const radH = (headingDeg * Math.PI) / 180;
      const rotX = normX * Math.cos(radH) - normY * Math.sin(radH);
      const rotY = normX * Math.sin(radH) + normY * Math.cos(radH);

      const tiltFactor = Math.cos((tiltDeg * Math.PI) / 180);
      const perspectiveDepth = 1 + (rotY / (Math.max(width, height) * 1.45)) * 0.42;
      const screenX = width * 0.5 + panOffset.x + rotX * perspectiveDepth;
      const screenY = height * 0.54 + panOffset.y + rotY * tiltFactor * perspectiveDepth - altMeters * 1.15 * cameraZoom;

      return { x: screenX, y: screenY, scale: Math.max(0.45, perspectiveDepth) };
    },
    [boundsCenter, cameraZoom, panOffset]
  );

  // Store projected node screen hitboxes for click selection
  const nodeHitboxesRef = useRef<Array<{ id: string; x: number; y: number; r: number; node: CulinaryNode }>>([]);

  // 60FPS Kinetic 3D Terrain & Follow-Cam Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    const renderFrame = (now: number) => {
      const elapsedSec = (now - startTime) / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(300, rect.width);
      const height = Math.max(240, rect.height);

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // 1. Neutral Core Strata #12161A OLED Base
      ctx.fillStyle = '#12161A';
      ctx.fillRect(0, 0, width, height);

      // Dynamic heading when follow-cam is active
      const activeHeading = isFollowCamPlaying || isRecordingClip
        ? (cameraHeading + elapsedSec * 14) % 360
        : cameraHeading;

      // 2. 3D Perspective Topographic & Urban Grid (#1A2026 & #242D35)
      const gridSteps = 12;
      ctx.lineWidth = 1;
      for (let i = -gridSteps; i <= gridSteps; i++) {
        const dLat = (i / gridSteps) * boundsCenter.spanLat * 0.9;
        const dLng = (i / gridSteps) * boundsCenter.spanLng * 0.9;

        // Horizontal grid line
        const p1 = project3D(
          boundsCenter.centerLat + dLat,
          boundsCenter.centerLng - boundsCenter.spanLng * 0.9,
          0,
          width,
          height,
          activeHeading,
          cameraTilt
        );
        const p2 = project3D(
          boundsCenter.centerLat + dLat,
          boundsCenter.centerLng + boundsCenter.spanLng * 0.9,
          0,
          width,
          height,
          activeHeading,
          cameraTilt
        );
        ctx.strokeStyle = i % 3 === 0 ? '#242D35' : '#1A2026';
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        // Vertical grid line
        const p3 = project3D(
          boundsCenter.centerLat - boundsCenter.spanLat * 0.9,
          boundsCenter.centerLng + dLng,
          0,
          width,
          height,
          activeHeading,
          cameraTilt
        );
        const p4 = project3D(
          boundsCenter.centerLat + boundsCenter.spanLat * 0.9,
          boundsCenter.centerLng + dLng,
          0,
          width,
          height,
          activeHeading,
          cameraTilt
        );
        ctx.beginPath();
        ctx.moveTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.stroke();
      }

      // 3. Simulated Saigon River 3D Channel Contour
      const riverCoords = [
        { lat: 10.756, lng: 106.708 },
        { lat: 10.765, lng: 106.706 },
        { lat: 10.775, lng: 106.707 },
        { lat: 10.788, lng: 106.712 },
      ];
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.lineWidth = 18 * cameraZoom;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      riverCoords.forEach((rc, idx) => {
        const pt = project3D(rc.lat, rc.lng, 0, width, height, activeHeading, cameraTilt);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();

      // 4. Route Trajectory Path (#5322FF Core Primary Indigo)
      const pathPoints = waypoints.length >= 2
        ? waypoints.map((w) => ({ lat: w.lat, lng: w.lng }))
        : nodes.map((n) => ({ lat: n.latitude, lng: n.longitude }));

      if (pathPoints.length >= 2) {
        // Ground shadow line
        ctx.strokeStyle = 'rgba(83, 34, 255, 0.28)';
        ctx.lineWidth = 10 * cameraZoom;
        ctx.beginPath();
        pathPoints.forEach((pt, idx) => {
          const p = project3D(pt.lat, pt.lng, 0, width, height, activeHeading, cameraTilt);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // Elevated 3D Trajectory Ribbon (#5322FF)
        ctx.strokeStyle = '#5322FF';
        ctx.lineWidth = 4 * cameraZoom;
        ctx.beginPath();
        pathPoints.forEach((pt, idx) => {
          const p = project3D(pt.lat, pt.lng, 10, width, height, activeHeading, cameraTilt);
          if (idx === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();

        // Animated Kinetic Precision pulses along trajectory
        const pulseOffset = (elapsedSec * 48) % 24;
        ctx.setLineDash([8, 16]);
        ctx.lineDashOffset = -pulseOffset;
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 5. Render Extruded 3D Culinary Nodes (#00E5FF Laser Cyan)
      const hitboxes: Array<{ id: string; x: number; y: number; r: number; node: CulinaryNode }> = [];

      nodes.forEach((node, idx) => {
        const isSelected = node.id === selectedNodeId;
        const basePt = project3D(node.latitude, node.longitude, 0, width, height, activeHeading, cameraTilt);
        const topPt = project3D(
          node.latitude,
          node.longitude,
          isSelected ? 46 : 30,
          width,
          height,
          activeHeading,
          cameraTilt
        );

        // Ground target ring
        ctx.strokeStyle = isSelected ? '#00E5FF' : 'rgba(0, 229, 255, 0.45)';
        ctx.lineWidth = isSelected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.ellipse(basePt.x, basePt.y, 14 * basePt.scale, 8 * basePt.scale, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Vertical 3D extrusion stem
        ctx.strokeStyle = isSelected ? '#00E5FF' : '#5322FF';
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.beginPath();
        ctx.moveTo(basePt.x, basePt.y);
        ctx.lineTo(topPt.x, topPt.y);
        ctx.stroke();

        // 3D Node Pin Head
        const pinRadius = isSelected ? 15 : 12;
        ctx.fillStyle = isSelected ? '#00E5FF' : '#1A2026';
        ctx.strokeStyle = '#00E5FF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(topPt.x, topPt.y, pinRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Index number inside pin
        ctx.fillStyle = isSelected ? '#12161A' : '#00E5FF';
        ctx.font = '700 11px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), topPt.x, topPt.y);

        // High-contrast label tag
        const labelText = `${node.name.slice(0, 22)}${node.name.length > 22 ? '…' : ''} · ${node.rating}★`;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const textWidth = ctx.measureText(labelText).width;
        const boxX = topPt.x - textWidth / 2 - 8;
        const boxY = topPt.y - pinRadius - 26;

        ctx.fillStyle = isSelected ? '#5322FF' : 'rgba(18, 22, 26, 0.92)';
        ctx.strokeStyle = isSelected ? '#00E5FF' : '#242D35';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, textWidth + 16, 20, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#F3F6F9';
        ctx.textAlign = 'left';
        ctx.fillText(labelText, boxX + 8, boxY + 10.5);

        hitboxes.push({ id: node.id, x: topPt.x, y: topPt.y, r: pinRadius + 10, node });
      });

      nodeHitboxesRef.current = hitboxes;

      // 6. Active GPS Lock Rider Position (#00E676 Sensor Green) or Follow-Cam Drone Position
      let liveLat = activeRiderPos.lat;
      let liveLng = activeRiderPos.lng;

      if ((isFollowCamPlaying || isRecordingClip) && pathPoints.length >= 2) {
        const cyc = ((elapsedSec * 0.14) % 1);
        setFollowProgress(cyc);
        const totalSegs = pathPoints.length - 1;
        const segFloat = cyc * totalSegs;
        const segIdx = Math.min(totalSegs - 1, Math.floor(segFloat));
        const segT = segFloat - segIdx;
        liveLat = pathPoints[segIdx].lat + (pathPoints[segIdx + 1].lat - pathPoints[segIdx].lat) * segT;
        liveLng = pathPoints[segIdx].lng + (pathPoints[segIdx + 1].lng - pathPoints[segIdx].lng) * segT;
      }

      const riderPt = project3D(liveLat, liveLng, 14, width, height, activeHeading, cameraTilt);
      const pulseRadius = 10 + (Math.sin(elapsedSec * 5) * 0.5 + 0.5) * 14;

      ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(riderPt.x, riderPt.y, pulseRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#00E676';
      ctx.beginPath();
      ctx.arc(riderPt.x, riderPt.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#12161A';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 7. Burn-in 60FPS Telemetry Timecode HUD on Canvas (so exported MP4/WebM video includes real telemetry!)
      ctx.fillStyle = 'rgba(18, 22, 26, 0.86)';
      ctx.strokeStyle = '#242D35';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(12, 12, 256, 46, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00E676';
      ctx.font = '700 10px "Space Grotesk", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        isTracking || isFollowCamPlaying || isRecordingClip
          ? '60FPS 3D KINETIC ENGINE · GPS LOCKED'
          : '3D ROUTE VIEWPORT · STANDBY',
        22,
        27
      );

      ctx.fillStyle = '#F3F6F9';
      ctx.font = '600 12px "Space Grotesk", sans-serif';
      ctx.fillText(
        `LAT ${liveLat.toFixed(4)}°N  LNG ${liveLng.toFixed(4)}°E`,
        22,
        45
      );

      ctx.restore();
      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(animId);
  }, [
    boundsCenter,
    cameraHeading,
    cameraTilt,
    cameraZoom,
    isFollowCamPlaying,
    isRecordingClip,
    isTracking,
    nodes,
    project3D,
    selectedNodeId,
    waypoints,
    activeRiderPos,
  ]);

  // Handle pointer interactions (click node, pick coordinate, or drag to orbit 3D camera)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if user tapped a Culinary Node pin
    const hit = nodeHitboxesRef.current.find(
      (hb) => Math.hypot(hb.x - clickX, hb.y - clickY) <= hb.r
    );
    if (hit) {
      onSelectNode(hit.node);
      return;
    }

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      heading: cameraHeading,
      panX: panOffset.x,
      panY: panOffset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setCameraHeading((dragStartRef.current.heading + dx * 0.45 + 360) % 360);
    setPanOffset({
      x: Math.max(-160, Math.min(160, dragStartRef.current.panX + dx * 0.25)),
      y: Math.max(-120, Math.min(120, dragStartRef.current.panY + dy * 0.25)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const movedDist = Math.hypot(
      e.clientX - dragStartRef.current.x,
      e.clientY - dragStartRef.current.y
    );
    isDraggingRef.current = false;

    // If tap without drag and coordinate picker is enabled, convert tap position to GPS coordinate
    if (movedDist < 6 && onPickCoordinate) {
      const rect = e.currentTarget.getBoundingClientRect();
      const normX = (e.clientX - rect.left - rect.width * 0.5) / (rect.width * 0.4);
      const normY = -(e.clientY - rect.top - rect.height * 0.54) / (rect.height * 0.4);
      const pickedLat = Number((boundsCenter.centerLat + normY * boundsCenter.spanLat * 0.45).toFixed(6));
      const pickedLng = Number((boundsCenter.centerLng + normX * boundsCenter.spanLng * 0.45).toFixed(6));
      onPickCoordinate(pickedLat, pickedLng);
    }
  };

  // Record 60FPS 3D Map Video directly from Canvas using MediaRecorder
  const handleRecord60FpsVideo = () => {
    const canvas = canvasRef.current;
    if (!canvas || isRecordingClip) return;

    try {
      setIsRecordingClip(true);
      setRecordingPct(0);
      const stream = (canvas as any).captureStream ? (canvas as any).captureStream(60) : null;
      if (!stream || typeof MediaRecorder === 'undefined') {
        setIsRecordingClip(false);
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunks.push(ev.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const filename = `vibepath-3d-route-60fps-${Date.now()}.webm`;
        if (onExportVideoReady) {
          onExportVideoReady(url, filename);
        } else {
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
        }
        setIsRecordingClip(false);
        setRecordingPct(100);
      };

      recorder.start(100);
      const durationMs = 3500;
      const started = performance.now();
      const progressTimer = setInterval(() => {
        const pct = Math.min(99, Math.round(((performance.now() - started) / durationMs) * 100));
        setRecordingPct(pct);
      }, 120);

      setTimeout(() => {
        clearInterval(progressTimer);
        if (recorder.state !== 'inactive') recorder.stop();
      }, durationMs);
    } catch (_) {
      setIsRecordingClip(false);
    }
  };

  // Active node for subtitle preview during follow-cam
  const activeSubtitleNode =
    nodes[Math.min(nodes.length - 1, Math.floor(followProgress * nodes.length))] || nodes[0];

  return (
    <div
      className={`relative w-full ${
        compactMode ? 'h-[300px] md:h-[380px]' : 'h-[340px] md:h-[440px]'
      } bg-[#12161A] border border-[#242D35] rounded-xl overflow-hidden select-none`}
    >
      {/* Optional Google Maps 3D Layer when configured */}
      {useGmp3D && apiKey && (
        <div ref={gmpContainerRef} className="absolute inset-0 z-10 w-full h-full" />
      )}

      {/* Native 60FPS Kinetic 3D Terrain & Telemetry Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Top-Right 48x48px Ergonomic Camera Controls */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        {onToggleFollowCam && (
          <button
            type="button"
            onClick={onToggleFollowCam}
            className={`vp-touch-target px-3 rounded-lg border flex items-center gap-2 transition-colors cursor-pointer ${
              isFollowCamPlaying
                ? 'bg-[#5322FF] border-[#00E5FF] text-white'
                : 'bg-[#1A2026]/90 border-[#242D35] text-[#F3F6F9] hover:border-[#00E5FF]'
            }`}
            title={language === 'vi' ? 'Chế độ Góc quay Bám theo 60FPS' : '60FPS Follow-Cam Mode'}
          >
            {isFollowCamPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span className="vp-telemetry-sm whitespace-nowrap">
              {isFollowCamPlaying ? 'FOLLOW 60FPS' : '3D CAM'}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={handleRecord60FpsVideo}
          disabled={isRecordingClip}
          className={`vp-touch-target px-3 rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
            isRecordingClip
              ? 'bg-[#5322FF] border-[#00E676] text-white'
              : 'bg-[#1A2026]/90 border-[#242D35] text-[#00E5FF] hover:border-[#00E5FF]'
          }`}
          title={language === 'vi' ? 'Kết xuất Video 3D 60FPS' : 'Render 60FPS 3D Video Clip'}
        >
          <Video className="w-4 h-4" />
          <span className="vp-telemetry-sm whitespace-nowrap">
            {isRecordingClip ? `REC ${recordingPct}%` : '60FPS REC'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCameraZoom((z) => Math.min(2.2, Number((z + 0.2).toFixed(2))))}
          className="vp-touch-target rounded-lg bg-[#1A2026]/90 border border-[#242D35] text-[#F3F6F9] hover:border-[#00E5FF] flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => setCameraZoom((z) => Math.max(0.65, Number((z - 0.2).toFixed(2))))}
          className="vp-touch-target rounded-lg bg-[#1A2026]/90 border border-[#242D35] text-[#F3F6F9] hover:border-[#00E5FF] flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            setCameraHeading(28);
            setCameraTilt((t) => (t === 62 ? 42 : 62));
            setPanOffset({ x: 0, y: 0 });
          }}
          className="vp-touch-target rounded-lg bg-[#1A2026]/90 border border-[#242D35] text-[#F3F6F9] hover:border-[#00E5FF] flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Reset 3D Camera"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Telemetry & Bilingual Subtitle Overlay inside 3D Viewport */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pointer-events-none">
        <div className="bg-[#12161A]/90 border border-[#242D35] rounded-lg px-3 py-2 max-w-xl">
          <div className="flex items-center gap-2 text-[#00E5FF] vp-label-caps">
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>
              HDG {Math.round(cameraHeading)}° · PITCH {cameraTilt}° · {nodes.length} CULINARY NODES
            </span>
          </div>
          {activeSubtitleNode && (
            <p className="vp-body-md text-[#F3F6F9] mt-0.5 line-clamp-1">
              <span className="text-[#00E676] font-semibold mr-1.5">
                [{activeSubtitleNode.name}]
              </span>
              {language === 'vi' ? activeSubtitleNode.note : activeSubtitleNode.noteEn}
            </p>
          )}
        </div>

        {onPickCoordinate && (
          <div className="bg-[#1A2026]/90 border border-[#242D35] rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-[#9BA8B8]">
            <Crosshair className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="vp-telemetry-sm">
              {language === 'vi' ? 'Chạm bản đồ để khóa tọa độ POI' : 'Tap map to lock POI coordinates'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
