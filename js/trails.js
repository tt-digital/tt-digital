// ── Tile sources ─────────────────────────────────────────────────────────────
const TILES = {
  light: {
    url:  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  },
  dark: {
    url:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  },
};

const TRACK_COLOR = { light: '#6b8e5e', dark: '#7db87a' };
const FILL_COLOR  = { light: 'rgba(107,142,94,0.2)', dark: 'rgba(125,184,122,0.12)' };

// ── State ─────────────────────────────────────────────────────────────────────
let map, tileLayer, trackLayer, hoverMarker, elevChart;
let trails   = [];   // { name, date, location, file, elevData, stats }
let activeIdx = null;
let mapReady  = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
const dark = () => document.documentElement.getAttribute('data-theme') === 'dark';
const $ = id => document.getElementById(id);

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const f1 = lat1 * Math.PI / 180, f2 = lat2 * Math.PI / 180;
  const df = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a  = Math.sin(df/2)**2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtDist(km)  { return km.toFixed(1) + ' km'; }
function fmtGain(m)   { return '+' + Math.round(m) + ' m'; }
function fmtEle(m)    { return Math.round(m) + ' m'; }
function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── GPX parsing ───────────────────────────────────────────────────────────────
async function parseGpx(url) {
  const resp = await fetch(url);
  const xml  = new DOMParser().parseFromString(await resp.text(), 'text/xml');
  const pts  = [...xml.querySelectorAll('trkpt')];

  const elevData = [];
  let dist = 0, gain = 0, loss = 0;
  let prevLat = null, prevLon = null, prevEle = null;
  let startTime = null, endTime = null;

  for (const pt of pts) {
    const lat = parseFloat(pt.getAttribute('lat'));
    const lon = parseFloat(pt.getAttribute('lon'));
    const ele = parseFloat(pt.querySelector('ele')?.textContent ?? 0);
    const timeEl = pt.querySelector('time');
    const t = timeEl ? new Date(timeEl.textContent) : null;

    if (!startTime && t) startTime = t;
    if (t) endTime = t;

    if (prevLat !== null) {
      dist += haversine(prevLat, prevLon, lat, lon);
      const de = ele - prevEle;
      if (de > 0) gain += de; else loss += Math.abs(de);
    }

    elevData.push({ lat, lon, ele, dist });
    prevLat = lat; prevLon = lon; prevEle = ele;
  }

  const duration = (startTime && endTime)
    ? (endTime - startTime) / 1000
    : null;

  return {
    elevData,
    stats: {
      dist:     dist / 1000,
      gain,
      loss,
      maxEle:   Math.max(...elevData.map(p => p.ele)),
      minEle:   Math.min(...elevData.map(p => p.ele)),
      duration,
    },
  };
}

// ── Map ───────────────────────────────────────────────────────────────────────
function initMap() {
  if (mapReady) return;
  mapReady = true;

  map = L.map('map', { zoomControl: true }).setView([47.7, 11.8], 10);
  const t = dark() ? TILES.dark : TILES.light;
  tileLayer = L.tileLayer(t.url, { attribution: t.attr, maxZoom: 19 }).addTo(map);

  new MutationObserver(() => {
    const t = dark() ? TILES.dark : TILES.light;
    tileLayer.setUrl(t.url);
    if (trackLayer) trackLayer.setStyle({ color: TRACK_COLOR[dark() ? 'dark' : 'light'] });
    if (activeIdx !== null && trails[activeIdx]?.elevData?.length) drawChart(trails[activeIdx].elevData);
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

// ── Draw track on map ─────────────────────────────────────────────────────────
function showTrailOnMap(trail) {
  initMap();

  if (trackLayer)  { map.removeLayer(trackLayer);  trackLayer  = null; }
  if (hoverMarker) { map.removeLayer(hoverMarker); hoverMarker = null; }

  const theme   = dark() ? 'dark' : 'light';
  const latlngs = trail.elevData.map(p => [p.lat, p.lon]);

  trackLayer = L.polyline(latlngs, {
    color: TRACK_COLOR[theme], weight: 3, opacity: 0.9,
  }).addTo(map);

  const dot = (ll, fill) => L.circleMarker(ll, {
    radius: 5, color: '#fff', fillColor: fill, fillOpacity: 1, weight: 2,
  }).addTo(map);
  if (latlngs.length) {
    dot(latlngs[0], TRACK_COLOR[theme]);
    dot(latlngs[latlngs.length - 1], '#c05050');
  }

  map.fitBounds(trackLayer.getBounds(), { padding: [24, 24] });
}

// ── Elevation chart ───────────────────────────────────────────────────────────
function drawChart(elevData) {
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

  const ctx = $('elevationChart').getContext('2d');
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
          titleFont:  { family: mono, size: 10 },
          bodyFont:   { family: mono, size: 10 },
        },
      },
      scales: {
        x: {
          ticks:  { color: muted, maxTicksLimit: 6, font: { family: mono, size: 9 } },
          grid:   { color: subtle },
          border: { display: false },
        },
        y: {
          ticks:  { color: muted, maxTicksLimit: 4, font: { family: mono, size: 9 } },
          grid:   { color: subtle },
          border: { display: false },
        },
      },
    },
  });
}

// ── Logbook list ──────────────────────────────────────────────────────────────
function renderLogbook() {
  const list = $('logbook');
  list.innerHTML = trails.map((t, i) => {
    const s = t.stats;
    const dur = s.duration ? fmtDuration(s.duration) : '—';
    return `
    <div class="log-entry${i === activeIdx ? ' active' : ''}" onclick="selectTrail(${i})">
      <div class="log-meta">${t.date}${t.location ? ' &nbsp;·&nbsp; ' + t.location : ''}</div>
      <div class="log-title">${t.name}</div>
      <div class="log-stats">
        <span>${fmtDist(s.dist)}</span>
        <span>${fmtGain(s.gain)}</span>
        <span>↑ ${fmtEle(s.maxEle)}</span>
        <span>${dur}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Select a trail ────────────────────────────────────────────────────────────
function selectTrail(idx) {
  activeIdx = idx;

  // highlight active entry
  document.querySelectorAll('.log-entry').forEach((el, i) =>
    el.classList.toggle('active', i === idx));

  const trail = trails[idx];
  const s = trail.stats;

  // show detail panel
  $('trailDetail').style.display = 'block';

  showTrailOnMap(trail);

  // stats bar
  $('statDist').textContent = fmtDist(s.dist);
  $('statGain').textContent = fmtGain(s.gain);
  $('statLoss').textContent = '−' + Math.round(s.loss) + ' m';
  $('statHigh').textContent = fmtEle(s.maxEle);
  $('trailStats').style.display = 'flex';

  // status bar
  $('status').textContent =
    `// ${trail.name} · ${fmtDist(s.dist)} · ${fmtGain(s.gain)}`;

  drawChart(trail.elevData);

  // scroll map into view on mobile
  if (window.innerWidth <= 520) {
    $('trailDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

window.selectTrail = selectTrail;

// ── Boot ──────────────────────────────────────────────────────────────────────
(async function init() {
  let index = [];
  try {
    const resp = await fetch('gpx/index.json');
    index = resp.ok ? await resp.json() : [];
  } catch (_) { index = []; }

  if (!index.length) {
    $('logbook').innerHTML =
      '<p class="trail-empty">// no trails yet — add .gpx files to gpx/ and update gpx/index.json</p>';
    $('trailDetail').style.display = 'none';
    $('status').textContent = '// trails — 0 entries';
    return;
  }

  // Parse all GPX files in parallel
  const parsed = await Promise.all(
    index.map(t => parseGpx(t.file).catch(() => null))
  );

  trails = index.map((t, i) => ({
    ...t,
    ...(parsed[i] || { elevData: [], stats: { dist: 0, gain: 0, loss: 0, maxEle: 0, duration: null } }),
  }));

  $('status').textContent = `// trails — ${trails.length} entr${trails.length === 1 ? 'y' : 'ies'}`;

  renderLogbook();

  // Show first trail by default
  selectTrail(0);
})();
