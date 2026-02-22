// trail-embed.js — self-contained GPX map + elevation chart for a post
// Usage: <div class="trail-embed" data-gpx="../gpx/my-trail.gpx"></div>
(async function () {
  const wrap = document.querySelector('.trail-embed[data-gpx]');
  if (!wrap) return;

  const TILES = {
    light: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
             attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
    dark:  { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
             attr: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>' },
  };
  const TRACK = { light: '#6b8e5e', dark: '#7db87a' };
  const FILL  = { light: 'rgba(107,142,94,0.2)', dark: 'rgba(125,184,122,0.12)' };
  const dark  = () => document.documentElement.getAttribute('data-theme') === 'dark';

  // Build DOM inside wrap
  wrap.innerHTML = `
    <div id="_tmap"></div>
    <div class="trail-stats" id="_tstats">
      <div class="trail-stat"><span>distance</span><span id="_td">—</span></div>
      <div class="trail-stat"><span>gain</span><span id="_tg">—</span></div>
      <div class="trail-stat"><span>loss</span><span id="_tl">—</span></div>
      <div class="trail-stat"><span>highest</span><span id="_th">—</span></div>
    </div>
    <div class="elevation-wrap"><canvas id="_telev"></canvas></div>`;

  // Haversine distance in metres
  function hav(la1, lo1, la2, lo2) {
    const R = 6371e3, f1 = la1 * Math.PI / 180, f2 = la2 * Math.PI / 180;
    const a = Math.sin((la2-la1)*Math.PI/360)**2 + Math.cos(f1)*Math.cos(f2)*Math.sin((lo2-lo1)*Math.PI/360)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  // Parse GPX
  const xml = new DOMParser().parseFromString(
    await (await fetch(wrap.dataset.gpx)).text(), 'text/xml');
  const pts = [...xml.querySelectorAll('trkpt')];

  let dist = 0, gain = 0, loss = 0, pLat = null, pLon = null, pEle = null;
  let startT = null, endT = null;
  const elevData = pts.map(pt => {
    const lat = +pt.getAttribute('lat'), lon = +pt.getAttribute('lon');
    const ele = +(pt.querySelector('ele')?.textContent ?? 0);
    const t   = pt.querySelector('time')?.textContent;
    if (t) { if (!startT) startT = new Date(t); endT = new Date(t); }
    if (pLat !== null) {
      dist += hav(pLat, pLon, lat, lon);
      const de = ele - pEle;
      if (de > 0) gain += de; else loss -= de;
    }
    pLat = lat; pLon = lon; pEle = ele;
    return { lat, lon, ele, dist };
  });

  const maxEle = Math.max(...elevData.map(p => p.ele));

  // Stats bar
  document.getElementById('_td').textContent = (dist / 1000).toFixed(1) + ' km';
  document.getElementById('_tg').textContent = '+' + Math.round(gain) + ' m';
  document.getElementById('_tl').textContent = '−' + Math.round(loss) + ' m';
  document.getElementById('_th').textContent = Math.round(maxEle) + ' m';
  document.getElementById('_tstats').style.display = 'flex';

  // Map
  const theme = dark() ? 'dark' : 'light';
  const map = L.map('_tmap', { zoomControl: true });
  const tileLayer = L.tileLayer(TILES[theme].url, { attribution: TILES[theme].attr, maxZoom: 19 }).addTo(map);

  const latlngs = elevData.map(p => [p.lat, p.lon]);
  const track = L.polyline(latlngs, { color: TRACK[theme], weight: 3, opacity: 0.9 }).addTo(map);
  map.fitBounds(track.getBounds(), { padding: [24, 24] });

  const dot = (ll, fill) => L.circleMarker(ll, { radius: 5, color: '#fff', fillColor: fill, fillOpacity: 1, weight: 2 }).addTo(map);
  if (latlngs.length) { dot(latlngs[0], TRACK[theme]); dot(latlngs[latlngs.length-1], '#c05050'); }

  // Elevation chart
  let hover = null;
  const mono = "'IBM Plex Mono', monospace";
  const subtle = () => dark() ? '#333' : '#eee';
  const muted  = () => dark() ? '#555' : '#aaa';

  const hoverPlugin = {
    id: 'hover',
    afterEvent(chart, { event: ev }) {
      if (ev.type === 'mouseout') { if (hover) { map.removeLayer(hover); hover = null; } return; }
      const els = chart.getElementsAtEventForMode(ev.native, 'index', { intersect: false }, false);
      if (!els.length) return;
      const { lat, lon } = elevData[els[0].index];
      if (!hover) hover = L.circleMarker([lat, lon], { radius: 5, color: '#fff', fillColor: TRACK[dark()?'dark':'light'], fillOpacity: 1, weight: 2 }).addTo(map);
      else hover.setLatLng([lat, lon]);
    },
  };

  const chart = new Chart(document.getElementById('_telev').getContext('2d'), {
    type: 'line',
    plugins: [hoverPlugin],
    data: {
      labels:   elevData.map(p => (p.dist / 1000).toFixed(2)),
      datasets: [{ data: elevData.map(p => p.ele), borderColor: TRACK[theme], backgroundColor: FILL[theme],
                   borderWidth: 1.5, fill: true, pointRadius: 0, tension: 0.3 }],
    },
    options: {
      animation: false, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { title: i => `${i[0].label} km`, label: i => `${Math.round(i.raw)} m` },
          backgroundColor: () => dark() ? '#111' : '#fff',
          titleColor: muted(), bodyColor: muted(), borderColor: subtle(), borderWidth: 1,
          titleFont: { family: mono, size: 10 }, bodyFont: { family: mono, size: 10 },
        },
      },
      scales: {
        x: { ticks: { color: muted(), maxTicksLimit: 6, font: { family: mono, size: 9 } }, grid: { color: subtle() }, border: { display: false } },
        y: { ticks: { color: muted(), maxTicksLimit: 4, font: { family: mono, size: 9 } }, grid: { color: subtle() }, border: { display: false } },
      },
    },
  });

  // Theme sync
  new MutationObserver(() => {
    const th = dark() ? 'dark' : 'light';
    tileLayer.setUrl(TILES[th].url);
    track.setStyle({ color: TRACK[th] });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
