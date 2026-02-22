// ── Tile sources ─────────────────────────────────────────────────────────────
const TILES = {
  light: {
    url:   'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr:  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  dark: {
    url:   'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr:  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  },
};

const TRACK_COLOR = { light: '#6b8e5e', dark: '#7db87a' };
const FILL_COLOR  = { light: 'rgba(107,142,94,0.2)', dark: 'rgba(125,184,122,0.12)' };

// ── State ─────────────────────────────────────────────────────────────────────
let map, tileLayer, trackLayer, hoverMarker, elevChart;
let elevData = [];   // { lat, lon, ele, dist }
let trails   = [];
let activeIdx = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────
const dark = () => document.documentElement.getAttribute('data-theme') === 'dark';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const f1 = lat1 * Math.PI / 180, f2 = lat2 * Math.PI / 180;
  const df = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(df/2)**2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Map ───────────────────────────────────────────────────────────────────────
function initMap() {
  map = L.map('map', { zoomControl: true }).setView([51.5, 10], 6);

  const t = dark() ? TILES.dark : TILES.light;
  tileLayer = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map);

  // Sync tile layer and chart colours when theme toggles
  new MutationObserver(() => {
    const t = dark() ? TILES.dark : TILES.light;
    tileLayer.setUrl(t.url);
    if (trackLayer) trackLayer.setStyle({ color: TRACK_COLOR[dark() ? 'dark' : 'light'] });
    if (elevData.length) drawChart();
  }).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });
}

// ── GPX parsing ───────────────────────────────────────────────────────────────
async function parseGpx(url) {
  const resp = await fetch(url);
  const xml  = new DOMParser().parseFromString(await resp.text(), 'text/xml');
  const pts  = [...xml.querySelectorAll('trkpt')];

  elevData = [];
  let dist = 0, gain = 0, loss = 0, prevLat = null, prevLon = null, prevEle = null;

  for (const pt of pts) {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const ele = parseFloat(pt.querySelector('ele')?.textContent ?? 0);

    if (prevLat !== null) {
      dist += haversine(prevLat, prevLon, lat, lon);
      const de = ele - prevEle;
      if (de > 0) gain += de; else loss += Math.abs(de);
    }

    elevData.push({ lat, lon, ele, dist });
    prevLat = lat; prevLon = lon; prevEle = ele;
  }

  return { gain, loss,
    totalDist: dist / 1000,
    maxEle: Math.max(...elevData.map(p => p.ele)),
    minEle: Math.min(...elevData.map(p => p.ele)),
  };
}

// ── Load a trail ──────────────────────────────────────────────────────────────
async function loadTrail(idx) {
  activeIdx = idx;

  // highlight active pill
  document.querySelectorAll('.trail-pill').forEach((el, i) =>
    el.classList.toggle('active', i === idx));

  // clear previous layers
  if (trackLayer)  { map.removeLayer(trackLayer);  trackLayer  = null; }
  if (hoverMarker) { map.removeLayer(hoverMarker); hoverMarker = null; }

  const trail = trails[idx];
  const stats = await parseGpx(trail.file);
  const theme = dark() ? 'dark' : 'light';

  // draw track
  const latlngs = elevData.map(p => [p.lat, p.lon]);
  trackLayer = L.polyline(latlngs, {
    color: TRACK_COLOR[theme], weight: 3, opacity: 0.9,
  }).addTo(map);

  // start (green) / end (red) dots
  const dot = (ll, fill) => L.circleMarker(ll, {
    radius: 5, color: '#fff', fillColor: fill, fillOpacity: 1, weight: 2,
  }).addTo(map);
  if (latlngs.length) {
    dot(latlngs[0], TRACK_COLOR[theme]);
    dot(latlngs[latlngs.length - 1], '#c05050');
  }

  map.fitBounds(trackLayer.getBounds(), { padding: [24, 24] });

  // stats bar
  const $ = id => document.getElementById(id);
  $('statDist').textContent = `${stats.totalDist.toFixed(1)} km`;
  $('statGain').textContent = `+${Math.round(stats.gain)} m`;
  $('statLoss').textContent = `−${Math.round(stats.loss)} m`;
  $('statHigh').textContent = `${Math.round(stats.maxEle)} m`;
  $('trailStats').style.display = 'flex';

  // status bar
  $('status').textContent =
    `// ${trail.name} · ${stats.totalDist.toFixed(1)} km · +${Math.round(stats.gain)} m`;

  drawChart();
}

// ── Elevation chart ───────────────────────────────────────────────────────────
function drawChart() {
  if (elevChart) elevChart.destroy();

  const theme  = dark() ? 'dark' : 'light';
  const mono   = "'IBM Plex Mono', monospace";
  const subtle = dark() ? '#333' : '#eee';
  const muted  = dark() ? '#555' : '#aaa';

  const mapHoverPlugin = {
    id: 'mapHover',
    afterEvent(chart, { event: ev }) {
      if (ev.type === 'mouseout') {
        if (hoverMarker) { map.removeLayer(hoverMarker); hoverMarker = null; }
        return;
      }
      const els = chart.getElementsAtEventForMode(ev.native, 'index', { intersect: false }, false);
      if (!els.length) return;
      const { lat, lon } = elevData[els[0].index];
      if (!hoverMarker) {
        hoverMarker = L.circleMarker([lat, lon], {
          radius: 5, color: '#fff',
          fillColor: TRACK_COLOR[theme], fillOpacity: 1, weight: 2,
        }).addTo(map);
      } else {
        hoverMarker.setLatLng([lat, lon]);
      }
    },
  };

  const ctx = document.getElementById('elevationChart').getContext('2d');
  elevChart = new Chart(ctx, {
    type: 'line',
    plugins: [mapHoverPlugin],
    data: {
      labels:   elevData.map(p => (p.dist / 1000).toFixed(2)),
      datasets: [{
        data:            elevData.map(p => p.ele),
        borderColor:     TRACK_COLOR[theme],
        backgroundColor: FILL_COLOR[theme],
        borderWidth:     1.5,
        fill:            true,
        pointRadius:     0,
        tension:         0.3,
      }],
    },
    options: {
      animation:           false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => `${items[0].label} km`,
            label: item  => `${Math.round(item.raw)} m`,
          },
          backgroundColor: dark() ? '#111' : '#fff',
          titleColor:      muted,
          bodyColor:       muted,
          borderColor:     subtle,
          borderWidth:     1,
          titleFont:       { family: mono, size: 10 },
          bodyFont:        { family: mono, size: 10 },
        },
      },
      scales: {
        x: {
          ticks: { color: muted, maxTicksLimit: 6, font: { family: mono, size: 9 } },
          grid:  { color: subtle },
          border: { display: false },
        },
        y: {
          ticks: { color: muted, maxTicksLimit: 4, font: { family: mono, size: 9 } },
          grid:  { color: subtle },
          border: { display: false },
        },
      },
    },
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
(async function init() {
  try {
    const resp = await fetch('gpx/index.json');
    trails = resp.ok ? await resp.json() : [];
  } catch (_) { trails = []; }

  if (!trails.length) {
    document.getElementById('map').style.display          = 'none';
    document.getElementById('elevationWrap').style.display = 'none';
    document.getElementById('trailList').innerHTML =
      '<p class="trail-empty">// no trails yet — add .gpx files to gpx/ and run node build.js</p>';
    return;
  }

  initMap();

  // pill list (only shown for 2+ trails)
  if (trails.length > 1) {
    const list = document.getElementById('trailList');
    list.innerHTML = trails.map((t, i) =>
      `<a href="#" class="trail-pill${i === 0 ? ' active' : ''}"
          onclick="loadTrail(${i}); return false;">${t.name}</a>`
    ).join('');
    list.style.display = 'flex';
    window.loadTrail = loadTrail;
  }

  loadTrail(0);
})();
