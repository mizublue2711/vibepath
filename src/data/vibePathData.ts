export type LanguageCode = 'vi' | 'en';
export type SubsystemTab = 'vlogger' | 'editor' | 'feedback';
export type UserRole = 'vlogger' | 'editor' | 'tester';
export type BugSeverity = 'P0' | 'P1' | 'P2';

export interface CulinaryNode {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating: 1 | 2 | 3 | 4 | 5; // INT2 (1 - 5)
  note: string;
  noteEn: string;
  images: string[];
  timestamp: string;
  timecodeSeconds: number; // Synced second in 3D video timeline
  durationSeconds: number;
  district: string;
  temperatureC: number;
  audioPeakDb: number;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
  speedKmh: number;
  accuracyM: number;
  timestamp: string;
}

export interface TelemetryState {
  gpsLocked: boolean;
  accuracyM: number;
  satellites: number;
  audioDb: number;
  batteryPct: number;
  deviceTempC: number;
  speedKmh: number;
  distanceKm: number;
  elapsedSeconds: number;
}

export interface CloudSyncReceipt {
  syncId: string;
  timestamp: string;
  language: LanguageCode;
  nodesCount: number;
  waypointsCount: number;
  payloadSizeKb: number;
  status: 'SYNCED_ATOMIC' | 'PENDING';
}

export interface FeedbackReport {
  id: string;
  role: UserRole;
  rating: number;
  selected_features: string[];
  feedback_text: string;
  attachment_url: string;
  created_at: string;
  triage: {
    category: 'GPS_TELEMETRY' | 'MAP_3D_ENGINE' | 'NLE_EXPORT_PIPELINE' | 'CLOUD_SYNC_WORKER' | 'OUTDOOR_UX_ERGONOMICS';
    severity: BugSeverity;
    summary: string;
    recommended_action: string;
    telegram_alert_sent: boolean;
    telegram_channel: string;
    dify_agent_run_id: string;
  };
}

export const FIELD_PRESET_IMAGES: { labelVi: string; labelEn: string; url: string }[] = [
  {
    labelVi: 'Phở Bò Tái Lăn Đêm',
    labelEn: 'Night Rare Beef Pho',
    url: '/src/assets/images/culinary_pho_bo_node_1793937904766.jpg',
  },
  {
    labelVi: 'Bánh Mì Than Hoa Giòn',
    labelEn: 'Charcoal Grilled Banh Mi',
    url: '/src/assets/images/culinary_banh_mi_node_1793937909088.jpg',
  },
  {
    labelVi: 'Ốc Hương Nướng Mỡ Hành',
    labelEn: 'Scallion Oil Grilled Sea Snails',
    url: '/src/assets/images/culinary_oc_dem_node_1793937908515.jpg',
  },
  {
    labelVi: 'Cà Phê Phin Sữa Đá Vỉa Hè',
    labelEn: 'Street Phin Iced Milk Coffee',
    url: '/src/assets/images/culinary_ca_phe_node_1793937908928.jpg',
  },
];

export const INITIAL_CULINARY_NODES: CulinaryNode[] = [
  {
    id: 'poi-01',
    name: 'Phở Bò Phú Gia — Nguyễn Chính',
    latitude: 10.7682,
    longitude: 106.6914,
    rating: 5,
    note: 'Nước dùng trong vắt ninh xương ống 18 tiếng, bò tái lăn dậy mùi tỏi phi cháy cạnh cực cuốn.',
    noteEn: 'Crystal-clear 18-hour marrow broth with wok-seared garlic rare beef that hits with intense aroma.',
    images: ['/src/assets/images/culinary_pho_bo_node_1793937904766.jpg'],
    timestamp: '19:15:08',
    timecodeSeconds: 0,
    durationSeconds: 18,
    district: 'Quận 1, TP.HCM',
    temperatureC: 33.4,
    audioPeakDb: -9.2,
  },
  {
    id: 'poi-02',
    name: 'Bánh Mì Heo Quay Lò Than Bùi Viện',
    latitude: 10.7674,
    longitude: 106.6939,
    rating: 5,
    note: 'Vỏ bánh nướng lại trên than hồng giòn rụm, bì heo nổ giòn tan quyện sốt ớt rim cay nồng.',
    noteEn: 'Baguette re-toasted over glowing charcoal, crackling roast pork skin layered with fiery house chili jam.',
    images: ['/src/assets/images/culinary_banh_mi_node_1793937909088.jpg'],
    timestamp: '19:48:22',
    timecodeSeconds: 18,
    durationSeconds: 20,
    district: 'Quận 1, TP.HCM',
    temperatureC: 34.1,
    audioPeakDb: -8.4,
  },
  {
    id: 'poi-03',
    name: 'Ốc Đêm Vĩnh Khánh — Khu Ẩm Thực Q4',
    latitude: 10.7611,
    longitude: 106.7024,
    rating: 5,
    note: 'Ốc hương nướng mỡ hành đậu phộng béo ngậy, nước chấm sả ớt tắc chua cay cân bằng hoàn hảo.',
    noteEn: 'Sizzling sea snails bathed in scallion oil and crushed peanuts, paired with kumquat lemongrass dipping sauce.',
    images: ['/src/assets/images/culinary_oc_dem_node_1793937908515.jpg'],
    timestamp: '20:32:45',
    timecodeSeconds: 38,
    durationSeconds: 24,
    district: 'Quận 4, TP.HCM',
    temperatureC: 32.8,
    audioPeakDb: -7.6,
  },
  {
    id: 'poi-04',
    name: 'Cà Phê Vợt & Phin Đêm Phan Đình Phùng',
    latitude: 10.7926,
    longitude: 106.6821,
    rating: 4,
    note: 'Cà phê phin đậm đặc hậu vị cacao khói, ngồi ghế đẩu ngắm dòng xe Sài Gòn về đêm.',
    noteEn: 'Bold slow-drip Robusta with smoky cacao finish served over condensed milk on low street stools.',
    images: ['/src/assets/images/culinary_ca_phe_node_1793937908928.jpg'],
    timestamp: '21:18:10',
    timecodeSeconds: 62,
    durationSeconds: 18,
    district: 'Phú Nhuận, TP.HCM',
    temperatureC: 30.5,
    audioPeakDb: -11.4,
  },
];

export const INITIAL_ROUTE_WAYPOINTS: RouteWaypoint[] = [
  { lat: 10.7682, lng: 106.6914, speedKmh: 0, accuracyM: 0.8, timestamp: '19:15:08' },
  { lat: 10.7679, lng: 106.6926, speedKmh: 24, accuracyM: 0.9, timestamp: '19:31:00' },
  { lat: 10.7674, lng: 106.6939, speedKmh: 18, accuracyM: 0.7, timestamp: '19:48:22' },
  { lat: 10.7645, lng: 106.6982, speedKmh: 31, accuracyM: 0.8, timestamp: '20:10:15' },
  { lat: 10.7611, lng: 106.7024, speedKmh: 12, accuracyM: 0.6, timestamp: '20:32:45' },
  { lat: 10.7748, lng: 106.6935, speedKmh: 34, accuracyM: 0.9, timestamp: '20:55:10' },
  { lat: 10.7852, lng: 106.6869, speedKmh: 29, accuracyM: 0.8, timestamp: '21:08:30' },
  { lat: 10.7926, lng: 106.6821, speedKmh: 0, accuracyM: 0.7, timestamp: '21:18:10' },
];

export const EVALUABLE_FEATURES = [
  'Invisible Background Tracker (GPS)',
  'One-Tap Spot Pinning (POI INT2)',
  '3D Map 60FPS Video Follow-Cam',
  'Bilingual .SRT Subtitle Sync',
  'Premiere / CapCut .XML Markers',
  'AI Chapters & Social Captions',
  'Outdoor Sunlight Contrast (#12161A)',
];

export const INITIAL_FEEDBACK_REPORTS: FeedbackReport[] = [
  {
    id: 'BUG-9042',
    role: 'vlogger',
    rating: 4,
    selected_features: ['Invisible Background Tracker (GPS)', 'One-Tap Spot Pinning (POI INT2)'],
    feedback_text: 'Khi chạy xe máy qua gầm cầu Khánh Hội (Quận 4), độ chính xác GPS giảm từ 0.8m xuống 6.5m trong khoảng 4 giây trước khi tự khóa lại.',
    attachment_url: 'https://r2.vibepath.io/buckets/telemetry-prod/snapshots/khanh-hoi-multipath-gps.png',
    created_at: '20:41:12',
    triage: {
      category: 'GPS_TELEMETRY',
      severity: 'P1',
      summary: 'Multipath GPS signal degradation under urban overpass; Kalman filter smoothing required.',
      recommended_action: 'Enable IMU dead-reckoning interpolation when HDOP exceeds 2.5 for <10s windows.',
      telegram_alert_sent: true,
      telegram_channel: '@VibePathOpsAlertBot #field-p1',
      dify_agent_run_id: 'dify-run-88219a',
    },
  },
  {
    id: 'BUG-9038',
    role: 'editor',
    rating: 5,
    selected_features: ['Premiere / CapCut .XML Markers', 'Bilingual .SRT Subtitle Sync'],
    feedback_text: 'File .XML kéo vào Premiere Pro 2025 nhận đủ 100% mốc thời gian và màu Cyan cho từng quán ăn, tiết kiệm 45 phút cắt thô mỗi tập vlog.',
    attachment_url: 'https://r2.vibepath.io/buckets/telemetry-prod/snapshots/premiere-xml-import-verified.png',
    created_at: '20:15:04',
    triage: {
      category: 'NLE_EXPORT_PIPELINE',
      severity: 'P2',
      summary: 'Positive verification of XMEML v5 60fps marker import in Adobe Premiere Pro.',
      recommended_action: 'Archive as benchmark regression test in NLE export suite.',
      telegram_alert_sent: false,
      telegram_channel: 'N/A (P2 Normal Queue)',
      dify_agent_run_id: 'dify-run-88194c',
    },
  },
];

// Format seconds to SRT timestamp (HH:MM:SS,mmm)
export function formatSrtTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.round((totalSeconds - Math.floor(totalSeconds)) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

// Format seconds to YouTube Chapter timestamp (MM:SS)
export function formatChapterTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Generate Bilingual .SRT File Content synced to 3D Map Video
export function generateBilingualSrt(nodes: CulinaryNode[], primaryLang: LanguageCode = 'vi'): string {
  const blocks: string[] = [];
  let idx = 1;

  nodes.forEach((node, i) => {
    const startSec = node.timecodeSeconds;
    const midSec = startSec + Math.floor(node.durationSeconds / 2);
    const endSec = startSec + node.durationSeconds;

    const line1Vi = `[ĐIỂM DỪNG #${i + 1}] ${node.name} (${node.rating}/5★) — GPS: ${node.latitude.toFixed(4)}, ${node.longitude.toFixed(4)}`;
    const line1En = `[STOP #${i + 1}] ${node.name} (${node.rating}/5★) — GPS: ${node.latitude.toFixed(4)}, ${node.longitude.toFixed(4)}`;

    blocks.push(
      `${idx}\n${formatSrtTime(startSec)} --> ${formatSrtTime(midSec)}\n${
        primaryLang === 'vi' ? `${line1Vi}\n${line1En}` : `${line1En}\n${line1Vi}`
      }`
    );
    idx++;

    blocks.push(
      `${idx}\n${formatSrtTime(midSec)} --> ${formatSrtTime(endSec)}\n${
        primaryLang === 'vi' ? `${node.note}\n${node.noteEn}` : `${node.noteEn}\n${node.note}`
      }`
    );
    idx++;
  });

  return blocks.join('\n\n') + '\n';
}

// Generate Adobe Premiere Pro / CapCut compatible XMEML .XML Marker Timeline (60FPS)
export function generatePremiereXmlMarkers(nodes: CulinaryNode[]): string {
  const fps = 60;
  const totalDurationSec = nodes.reduce((acc, n) => Math.max(acc, n.timecodeSeconds + n.durationSeconds), 80);
  const totalFrames = totalDurationSec * fps;

  const markersXml = nodes
    .map((node, index) => {
      const inFrame = Math.round(node.timecodeSeconds * fps);
      const outFrame = Math.round((node.timecodeSeconds + node.durationSeconds) * fps);
      const safeName = node.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeComment = `[${node.rating}/5★ | ${node.latitude.toFixed(5)}, ${node.longitude.toFixed(5)}] VI: ${node.note} || EN: ${node.noteEn}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

      return `    <marker>
      <name>POI #${index + 1}: ${safeName}</name>
      <comment>${safeComment}</comment>
      <in>${inFrame}</in>
      <out>${outFrame}</out>
      <color>
        <alpha>255</alpha>
        <red>0</red>
        <green>229</green>
        <blue>255</blue>
      </color>
    </marker>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="VibePath_3D_Culinary_Timeline_60FPS">
    <name>VibePath_3D_Route_60FPS_Master</name>
    <duration>${totalFrames}</duration>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <timecode>
      <rate>
        <timebase>${fps}</timebase>
        <ntsc>FALSE</ntsc>
      </rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
${markersXml}
  </sequence>
</xmeml>
`;
}

// Generate GeoJSON for 3D Map & Video Production
export function generateRouteGeoJson(nodes: CulinaryNode[], waypoints: RouteWaypoint[]): string {
  const geojson = {
    type: 'FeatureCollection',
    metadata: {
      generator: 'VibePath Kinetic Telemetry Studio',
      fps: 60,
      exportedAt: new Date().toISOString(),
    },
    features: [
      {
        type: 'Feature',
        properties: {
          name: 'VibePath Motorbike Trajectory',
          stroke: '#5322FF',
          strokeWidth: 4,
        },
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map((w) => [w.lng, w.lat, 12]),
        },
      },
      ...nodes.map((n, idx) => ({
        type: 'Feature',
        properties: {
          id: n.id,
          stopOrder: idx + 1,
          name: n.name,
          rating: n.rating,
          noteVi: n.note,
          noteEn: n.noteEn,
          timecodeSeconds: n.timecodeSeconds,
          markerColor: '#00E5FF',
        },
        geometry: {
          type: 'Point',
          coordinates: [n.longitude, n.latitude, 0],
        },
      })),
    ],
  };
  return JSON.stringify(geojson, null, 2);
}

// Default AI YouTube Chapters & Social Captions
export function buildDefaultAiCopy(nodes: CulinaryNode[], lang: LanguageCode): {
  youtubeChapters: string;
  socialCaption: string;
} {
  const chapters = nodes
    .map((n) => `${formatChapterTime(n.timecodeSeconds)} - ${n.name} (${n.rating}/5★)`)
    .join('\n');

  if (lang === 'en') {
    const spotsList = nodes
      .map((n, i) => `📍 Stop ${i + 1}: ${n.name} (${n.rating}/5★)\n   ↳ "${n.noteEn}"\n   ↳ GPS: ${n.latitude.toFixed(4)}, ${n.longitude.toFixed(4)}`)
      .join('\n\n');

    return {
      youtubeChapters: `00:00 - Intro & VibePath 3D GPS Route Lock\n${chapters}\n${formatChapterTime(
        (nodes[nodes.length - 1]?.timecodeSeconds || 60) + 18
      )} - Final Verdict & Full Map Export`,
      socialCaption: `🔥 4 LEGENDARY LATE-NIGHT STREET FOOD SPOTS IN SAIGON (60FPS 3D Route Tracked!)\n\nWe locked our GPS telemetry on the motorbike and hit ${nodes.length} unreal culinary stops tonight — every single coordinate verified on VibePath:\n\n${spotsList}\n\n⚡ Save this reel for your next Saigon midnight food run! Which spot are you hitting first? 👇\n\n#VibePath #SaigonStreetFood #VietnamFoodVlog #NightFoodTour #BanhMi #PhoBo #OcDem #FoodTok`,
    };
  }

  const spotsListVi = nodes
    .map((n, i) => `📍 Trạm ${i + 1}: ${n.name} (${n.rating}/5★)\n   ↳ "${n.note}"\n   ↳ Tọa độ GPS: ${n.latitude.toFixed(4)}, ${n.longitude.toFixed(4)}`)
    .join('\n\n');

  return {
    youtubeChapters: `00:00 - Mở đầu & Khóa tọa độ 3D VibePath\n${chapters}\n${formatChapterTime(
      (nodes[nodes.length - 1]?.timecodeSeconds || 60) + 18
    )} - Tổng kết lộ trình & Bản đồ 3D`,
    socialCaption: `🔥 CÀN QUÉT ${nodes.length} TỌA ĐỘ ẨM THỰC ĐÊM SÀI GÒN — BẢN ĐỒ 3D 60FPS CHUẨN TỪNG MÉT!\n\nĐêm nay bật khóa lộ trình ngầm VibePath trên xe máy, ghim nóng ${nodes.length} quán đỉnh nhất từ Quận 1 sang Quận 4 & Phú Nhuận:\n\n${spotsListVi}\n\n⚡ Lưu ngay bài đăng này để tối nay lập kèo đi ăn! Bạn chấm quán số mấy đỉnh nhất? Comment ngay bên dưới nhé 👇\n\n#VibePath #FoodTourSaiGon #AnSapSaiGon #PhoBoDem #BanhMiThanHoa #OcVinhKhanh #ReelsVietnam #TikTokFoodVN`,
  };
}

export type LegoGraphicStyleKey =
  | 'real_satellite'
  | 'tactical_blueprint'
  | 'cinematic_dark'
  | 'minimal_lineart';

export interface LegoStylePreset {
  key: LegoGraphicStyleKey;
  title: string;
  descVi: string;
  descEn: string;
  layerSize: string;
  bgHex: string;
  gridHex: string;
  routeHex: string;
  accentHex: string;
}

export const LEGO_STYLE_PRESETS: Record<LegoGraphicStyleKey, LegoStylePreset> = {
  real_satellite: {
    key: 'real_satellite',
    title: 'Google Satellite Real',
    descVi: 'Chế độ thật 100% ảnh vệ tinh sắc nét từ ngoài vũ trụ.',
    descEn: '100% real high-resolution satellite imagery from orbital space.',
    layerSize: 'Tile raster ảnh thật',
    bgHex: '#0B1218',
    gridHex: 'rgba(0, 229, 255, 0.22)',
    routeHex: '#00E676',
    accentHex: '#00E5FF',
  },
  tactical_blueprint: {
    key: 'tactical_blueprint',
    title: 'Spy Movie Blueprint',
    descVi: 'Bản đồ nét vẽ xanh chì/trắng dạng hồ sơ điệp viên điện ảnh.',
    descEn: 'Cyan/white CAD schematic blueprint in spy thriller dossier style.',
    layerSize: 'Vector Tiles (~15 KB)',
    bgHex: '#07192E',
    gridHex: 'rgba(0, 229, 255, 0.32)',
    routeHex: '#00E5FF',
    accentHex: '#FFFFFF',
  },
  cinematic_dark: {
    key: 'cinematic_dark',
    title: 'OLED Cyberpunk / Slate',
    descVi: 'Tông đen OLED điểm nhấn Laser Cyan #00E5FF, Indigo #5322FF & Xanh #00E676 chuẩn VibePath.',
    descEn: 'OLED slate canvas with #00E5FF Laser Cyan, #5322FF Indigo & #00E676 Sensor Green.',
    layerSize: 'Vector Tiles (~12 KB)',
    bgHex: '#12161A',
    gridHex: '#1F1F2E',
    routeHex: '#00E5FF',
    accentHex: '#00E676',
  },
  minimal_lineart: {
    key: 'minimal_lineart',
    title: 'Minimalist 3D Vector',
    descVi: 'Đơn giản hóa toàn bộ nhà cửa 3D thành các khối khung dây (wireframe).',
    descEn: 'Simplifies all 3D urban architecture into ultra-light wireframe meshes.',
    layerSize: 'Vector Tiles (~10 KB)',
    bgHex: '#0E1116',
    gridHex: 'rgba(243, 246, 249, 0.18)',
    routeHex: '#5322FF',
    accentHex: '#00E5FF',
  },
};

// Export GPX Telemetry (.GPX) with L1/L5 Dual-Frequency Sub-Meter Metadata
export function generateGpxTelemetry(nodes: CulinaryNode[], waypoints: RouteWaypoint[]): string {
  const baseDate = '2026-11-05';
  const wptXml = nodes
    .map((n, idx) => {
      const safeName = n.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const safeDesc = `[INT2 Rating: ${n.rating}/5★ | Temp: ${n.temperatureC}°C | Audio: ${n.audioPeakDb}dB] ${n.note}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `  <wpt lat="${n.latitude.toFixed(6)}" lon="${n.longitude.toFixed(6)}">
    <ele>12.0</ele>
    <time>${baseDate}T${n.timestamp || '19:30:00'}Z</time>
    <name>POI #${idx + 1}: ${safeName}</name>
    <desc>${safeDesc}</desc>
    <sym>Restaurant</sym>
  </wpt>`;
    })
    .join('\n');

  const trkptXml = waypoints
    .map((w) => {
      const timeStr = w.timestamp.includes('T')
        ? w.timestamp
        : `${baseDate}T${w.timestamp || '19:30:00'}Z`;
      return `      <trkpt lat="${w.lat.toFixed(6)}" lon="${w.lng.toFixed(6)}">
        <ele>12.4</ele>
        <time>${timeStr}</time>
        <hdop>${w.accuracyM.toFixed(2)}</hdop>
        <extensions>
          <vibepath:speed_kmh>${w.speedKmh}</vibepath:speed_kmh>
          <vibepath:gnss_band>L1_L5_GALILEO_GPS</vibepath:gnss_band>
        </extensions>
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="VibePath L1/L5 Dual-Frequency Telemetry Studio" xmlns="http://www.topografix.com/GPX/1/1" xmlns:vibepath="https://vibepath.io/schema/gpx/v1">
  <metadata>
    <name>VibePath Culinary Field Trajectory (Sub-Meter L1/L5)</name>
    <desc>Time-synced GPX telemetry track and Food POI waypoints for NLE Post-Production</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wptXml}
  <trk>
    <name>VibePath 60FPS Camera &amp; Motorbike Track</name>
    <type>Motorbike_Food_Vlog_L1_L5</type>
    <trkseg>
${trkptXml}
    </trkseg>
  </trk>
</gpx>
`;
}

// Export Raw Sensor & Audio JSON (.JSON)
export function generateRawSensorJson(
  nodes: CulinaryNode[],
  waypoints: RouteWaypoint[],
  language: LanguageCode
): string {
  return JSON.stringify(
    {
      schema_version: 'draft-07-vibepath-v2',
      gnss_hardware: {
        constellations: ['GPS_L1_L5', 'GALILEO_E1_E5a'],
        mean_horizontal_accuracy_m: 0.78,
        sampling_rate_hz: 10,
        frame_sync_fps: 60,
      },
      exported_at: new Date().toISOString(),
      language,
      telemetry_stream: waypoints.map((w, idx) => ({
        seq: idx + 1,
        latitude: w.lat,
        longitude: w.lng,
        altitude_m: 12.4,
        speed_kmh: w.speedKmh,
        l1_l5_accuracy_m: w.accuracyM,
        timestamp: w.timestamp,
      })),
      culinary_sensory_nodes: nodes.map((n, idx) => ({
        poi_id: n.id,
        sequence_order: idx + 1,
        name: n.name,
        coordinates: {
          latitude: n.latitude,
          longitude: n.longitude,
        },
        int2_rating: n.rating,
        sensory_notes: {
          vi: n.note,
          en: n.noteEn,
        },
        ambient_telemetry: {
          surface_temp_c: n.temperatureC,
          audio_peak_db: n.audioPeakDb,
          timecode_in_sec: n.timecodeSeconds,
          segment_duration_sec: n.durationSeconds,
        },
        media_assets: n.images,
      })),
    },
    null,
    2
  );
}

// Export Lightweight 4K/8K Scalable Vector Track (.SVG)
export function generateLightweightSvgTrack(
  nodes: CulinaryNode[],
  waypoints: RouteWaypoint[],
  targetPoiName: string,
  styleKey: LegoGraphicStyleKey = 'cinematic_dark'
): string {
  const preset = LEGO_STYLE_PRESETS[styleKey] || LEGO_STYLE_PRESETS.cinematic_dark;
  const allLats = [...nodes.map((n) => n.latitude), ...waypoints.map((w) => w.lat)];
  const allLngs = [...nodes.map((n) => n.longitude), ...waypoints.map((w) => w.lng)];
  const minLat = Math.min(...allLats, 10.76);
  const maxLat = Math.max(...allLats, 10.795);
  const minLng = Math.min(...allLngs, 106.68);
  const maxLng = Math.max(...allLngs, 106.705);
  const spanLat = Math.max(0.01, maxLat - minLat);
  const spanLng = Math.max(0.01, maxLng - minLng);

  const mapToSvg = (lat: number, lng: number) => {
    const x = 140 + ((lng - minLng) / spanLng) * 1640;
    const y = 920 - ((lat - minLat) / spanLat) * 760;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  };

  const pathSource =
    waypoints.length >= 2
      ? waypoints.map((w) => mapToSvg(w.lat, w.lng))
      : nodes.map((n) => mapToSvg(n.latitude, n.longitude));

  const pathData = pathSource
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
    .join(' ');

  const gridLines: string[] = [];
  for (let gx = 120; gx <= 1800; gx += 120) {
    gridLines.push(`<line x1="${gx}" y1="60" x2="${gx}" y2="1020" stroke="${preset.gridHex}" stroke-width="1" />`);
  }
  for (let gy = 100; gy <= 980; gy += 110) {
    gridLines.push(`<line x1="80" y1="${gy}" x2="1840" y2="${gy}" stroke="${preset.gridHex}" stroke-width="1" />`);
  }

  const nodesSvg = nodes
    .map((n, idx) => {
      const pt = mapToSvg(n.latitude, n.longitude);
      const safeTitle = n.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const idxStr = String(idx + 1).padStart(2, '0');
      return `  <g transform="translate(${pt.x}, ${pt.y})">
    <circle r="24" fill="none" stroke="${preset.accentHex}" stroke-width="1" stroke-dasharray="4 4" />
    <rect x="-8" y="-8" width="16" height="16" fill="${preset.accentHex}" stroke="#12161A" stroke-width="2" />
    <rect x="16" y="-22" width="350" height="38" rx="0" fill="#12161A" stroke="${preset.accentHex}" stroke-width="1" />
    <text x="26" y="-4" fill="#F3F6F9" font-family="JetBrains Mono, monospace" font-size="12" font-weight="bold">[ ${idxStr} // NODE ] ${safeTitle} (${n.rating}★)</text>
    <text x="26" y="11" fill="${preset.accentHex}" font-family="Space Grotesk, monospace" font-size="10">${n.latitude.toFixed(4)}°N, ${n.longitude.toFixed(4)}°E</text>
  </g>`;
    })
    .join('\n');

  const safeTarget = targetPoiName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <style>
      .vp-path-glow { fill: none; stroke: ${preset.routeHex}; stroke-width: 12; stroke-linecap: square; stroke-linejoin: miter; opacity: 0.25; }
      .vp-path-core { fill: none; stroke: ${preset.routeHex}; stroke-width: 4.5; stroke-linecap: square; stroke-linejoin: miter; stroke-dasharray: 12 6; }
    </style>
  </defs>
  <rect width="1920" height="1080" fill="${preset.bgHex}" />
  <g opacity="0.65">
    ${gridLines.join('\n    ')}
  </g>
  <path class="vp-path-glow" d="${pathData}" />
  <path class="vp-path-core" d="${pathData}" />
${nodesSvg}
  <g transform="translate(80, 56)">
    <rect width="640" height="54" rx="0" fill="#12161A" stroke="${preset.accentHex}" stroke-width="1" />
    <text x="20" y="24" fill="${preset.accentHex}" font-family="Space Grotesk, monospace" font-size="12" font-weight="bold">[ CAD TELEMETRY // ${preset.title.toUpperCase()} ]</text>
    <text x="20" y="42" fill="#F3F6F9" font-family="JetBrains Mono, monospace" font-size="13" font-weight="bold">[ TARGET // POI ] ${safeTarget} · L1/L5 SUB-METER LOCK</text>
  </g>
</svg>`;
}

// Export 60FPS Lottie Animation JSON (.lottie.json) (< 100 KB)
export function generateLottieJsonTrack(
  nodes: CulinaryNode[],
  waypoints: RouteWaypoint[],
  targetPoiName: string
): string {
  const lottieObj = {
    v: '5.9.0',
    fr: 60,
    ip: 0,
    op: 360,
    w: 1920,
    h: 1080,
    nm: `VibePath_60FPS_${targetPoiName.replace(/\s+/g, '_')}`,
    ddd: 0,
    assets: [],
    meta: {
      generator: 'VibePath Kinetic Studio Lottie Exporter',
      poiCount: nodes.length,
      waypointsCount: waypoints.length,
    },
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'B-Spline Route Trajectory (60FPS Trim Path)',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [960, 540, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          {
            ty: 'gr',
            it: [
              {
                ind: 0,
                ty: 'sh',
                ks: {
                  a: 0,
                  k: {
                    i: waypoints.map(() => [0, 0]),
                    o: waypoints.map(() => [0, 0]),
                    v: waypoints.map((w, idx) => [-500 + idx * 140, 260 - idx * 65]),
                    c: false,
                  },
                },
              },
              {
                ty: 'tm',
                s: { a: 0, k: 0 },
                e: {
                  a: 1,
                  k: [
                    { t: 0, s: [0], e: [100], i: { x: [0.4], y: [1] }, o: { x: [0.6], y: [0] } },
                    { t: 300, s: [100] },
                  ],
                },
                o: { a: 0, k: 0 },
                m: 1,
              },
              {
                ty: 'st',
                c: { a: 0, k: [0.325, 0.133, 1, 1] },
                o: { a: 0, k: 100 },
                w: { a: 0, k: 6 },
                lc: 2,
                lj: 2,
              },
            ],
          },
        ],
        ip: 0,
        op: 360,
        st: 0,
      },
    ],
  };
  return JSON.stringify(lottieObj, null, 2);
}

