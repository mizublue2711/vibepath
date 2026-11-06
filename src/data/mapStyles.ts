// Natural Tones Basemap Style for Civil War 1860s Cartography
export const VINTAGE_SEPIA_MAP_STYLE: google.maps.MapTypeStyle[] = [
  {
    elementType: 'geometry',
    stylers: [{ color: '#e3dec9' }], // Warm Natural Tones parchment base
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3d322a' }], // Deep warm espresso ink
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#f5f2ed' }, { weight: 2 }],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#d1c2ab' }, { weight: 1.2 }], // Historical state borders
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#8a7a67' }, { weight: 2 }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#c4baaa' }, { weight: 1.5 }, { dash: [4, 4] } as any],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#e3dec9' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#ebe6db' }],
  },
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' }], // Clean historical overview
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#d9d2c4' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#d9d2c4' }, { weight: 0.8 }], // Antique dirt/wagon roads
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#c4baaa' }, { weight: 1.2 }],
  },
  {
    featureType: 'road',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }], // Hide modern road numbers
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }], // Hide modern transit
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ visibility: 'on' }, { color: '#7c6c5a' }], // Historical rail lines
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#a6bac5' }], // Muted antique slate-blue rivers and ocean
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3e5672' }],
  },
];

