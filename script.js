/* ════════════════════════════════════════════════════════
   AETHER WEATHER INTELLIGENCE — SCRIPT.JS
   WeatherAPI · Chart.js · Canvas Animations
   Modern async/await · Clean architecture
════════════════════════════════════════════════════════ */

'use strict';

/* ── API Configuration ──────────────────────────────── */
const API_KEY  = '14f36399be3642d483343926262703';
const BASE_URL = 'https://api.weatherapi.com/v1/forecast.json';

/* ── DOM References ─────────────────────────────────── */
const $ = id => document.getElementById(id);

const DOM = {
  loader:        $('loader'),
  dashboard:     $('dashboard'),
  errorBox:      $('error-box'),
  errorText:     $('error-text'),
  searchInput:   $('search-input'),
  searchBtn:     $('search-btn'),
  locateBtn:     $('locate-btn'),
  acList:        $('autocomplete-list'),
  // Current weather
  cityDisplay:   $('city-display'),
  regionDisplay: $('region-display'),
  tempVal:       $('temp-val'),
  condIcon:      $('cond-icon'),
  condText:      $('cond-text'),
  feelsLine:     $('feels-line'),
  uvVal:         $('uv-val'),
  humVal:        $('hum-val'),
  windVal:       $('wind-val'),
  timeVal:       $('time-val'),
  sunriseVal:    $('sunrise-val'),
  sunsetVal:     $('sunset-val'),
  humRing:       $('hum-ring'),
  humRingText:   $('hum-ring-text'),
  presRing:      $('pres-ring'),
  presVal:       $('pres-val'),
  forecastRow:   $('forecast-row'),
  // Detail cells
  dFeelslike:    $('d-feelslike'),
  dVisibility:   $('d-visibility'),
  dWinddir:      $('d-winddir'),
  dUv:           $('d-uv'),
  dPrecip:       $('d-precip'),
  dCloud:        $('d-cloud'),
  footerUpdated: $('footer-updated'),
};

/* ── App State ──────────────────────────────────────── */
let tempChart    = null;   // Chart.js instance
let clockTimer   = null;   // Live clock interval
let particleAnim = null;   // Particle animation frame
let particles    = [];     // Active particles

/* ══════════════════════════════════════════════════════
   INITIALISATION
══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initAtmosCanvas();        // Ambient animated background
  initParticleCanvas();     // Rain / snow particle system
  bindEvents();             // Wire all UI interactions
  detectLocation();         // Auto-locate on load
});

/* ══════════════════════════════════════════════════════
   EVENT BINDING
══════════════════════════════════════════════════════ */
function bindEvents() {
  // Search button
  DOM.searchBtn.addEventListener('click', handleSearch);

  // Enter key
  DOM.searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSearch();
  });

  // Autocomplete (debounced)
  DOM.searchInput.addEventListener('input', debounce(handleAutocomplete, 380));

  // Locate me
  DOM.locateBtn.addEventListener('click', detectLocation);

  // Close autocomplete on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) closeAutocomplete();
  });
}

/* ── Handle Search ──────────────────────────────────── */
function handleSearch() {
  const q = DOM.searchInput.value.trim();
  if (q) { closeAutocomplete(); fetchWeather(q); }
}

/* ══════════════════════════════════════════════════════
   GEOLOCATION
══════════════════════════════════════════════════════ */
function detectLocation() {
  if (!navigator.geolocation) {
    fetchWeather('London'); // fallback
    return;
  }
  showLoader();
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeather(`${pos.coords.latitude},${pos.coords.longitude}`),
    ()  => fetchWeather('London'),  // permission denied fallback
    { timeout: 8000 }
  );
}

/* ══════════════════════════════════════════════════════
   WEATHER DATA FETCH
══════════════════════════════════════════════════════ */
async function fetchWeather(query) {
  showLoader();
  hideError();

  try {
    const url = `${BASE_URL}?key=${API_KEY}&q=${encodeURIComponent(query)}&days=7&aqi=no&alerts=no`;
    const res  = await fetch(url);

    if (!res.ok) {
      // WeatherAPI returns JSON errors too
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    renderDashboard(data);

  } catch (err) {
    showError(err.message || 'Failed to fetch weather data. Please try again.');
  }
}

/* ══════════════════════════════════════════════════════
   RENDER DASHBOARD
══════════════════════════════════════════════════════ */
function renderDashboard(data) {
  const { location, current, forecast } = data;

  // ── Location ──
  DOM.cityDisplay.textContent   = location.name;
  DOM.regionDisplay.textContent = `${location.region ? location.region + ', ' : ''}${location.country}`;

  // ── Current Temp ──
  DOM.tempVal.textContent  = Math.round(current.temp_c);
  DOM.condText.textContent = current.condition.text;
  DOM.condIcon.src         = 'https:' + current.condition.icon.replace('64x64', '128x128');
  DOM.condIcon.alt         = current.condition.text;
  DOM.feelsLine.textContent = `Feels like ${Math.round(current.feelslike_c)}°C · Updated just now`;

  // ── Stats ──
  DOM.uvVal.textContent   = current.uv;
  DOM.humVal.textContent  = `${current.humidity}%`;
  DOM.windVal.textContent = `${Math.round(current.wind_kph)} km/h`;

  // ── Sunrise / Sunset ──
  const today = forecast.forecastday[0];
  DOM.sunriseVal.textContent = today.astro.sunrise;
  DOM.sunsetVal.textContent  = today.astro.sunset;
  animateSunArc(today.astro.sunrise, today.astro.sunset, location.localtime);

  // ── Humidity ring gauge ──
  const humPct = current.humidity;
  animateRing(DOM.humRing, humPct, 188.5);
  DOM.humRingText.textContent = `${humPct}%`;

  // ── Pressure ring ──
  // Normalize: 970–1040 hPa range → 0-100%
  const pressPct = Math.min(100, Math.max(0, ((current.pressure_mb - 970) / 70) * 100));
  animateRing(DOM.presRing, pressPct, 188.5);
  DOM.presVal.textContent = Math.round(current.pressure_mb);

  // ── Detail cells ──
  DOM.dFeelslike.textContent  = `${Math.round(current.feelslike_c)}°C`;
  DOM.dVisibility.textContent = `${current.vis_km} km`;
  DOM.dWinddir.textContent    = current.wind_dir;
  DOM.dUv.textContent         = `${current.uv} / 11`;
  DOM.dPrecip.textContent     = `${today.day.totalprecip_mm} mm`;
  DOM.dCloud.textContent      = `${current.cloud}%`;

  // ── 7-day forecast cards ──
  renderForecastCards(forecast.forecastday);

  // ── Temperature chart ──
  renderTempChart(forecast.forecastday);

  // ── Background + effects ──
  applyWeatherTheme(current, location.localtime);

  // ── Live local clock ──
  startLiveClock(location.localtime, location.tz_id);

  // ── Last updated ──
  DOM.footerUpdated.textContent = `Data as of ${current.last_updated}`;

  hideLoader();
  showDashboard();
}

/* ── Render Forecast Cards ──────────────────────────── */
function renderForecastCards(days) {
  DOM.forecastRow.innerHTML = '';

  days.forEach((day, i) => {
    const date    = new Date(day.date + 'T12:00:00');
    const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const maxT    = Math.round(day.day.maxtemp_c);
    const minT    = Math.round(day.day.mintemp_c);
    const iconUrl = 'https:' + day.day.condition.icon;
    const cond    = day.day.condition.text;

    const card = document.createElement('div');
    card.className = `fc-card${i === 0 ? ' today' : ''}`;
    card.innerHTML = `
      <span class="fc-day">${dayName}</span>
      <span style="font-size:0.62rem;color:var(--text-dim);letter-spacing:0.06em;">${dateStr}</span>
      <img src="${iconUrl}" alt="${cond}" class="fc-icon" loading="lazy" />
      <span class="fc-cond">${cond}</span>
      <div class="fc-temps">
        <span class="fc-max">${maxT}°</span>
        <span class="fc-min">${minT}°</span>
      </div>
    `;
    DOM.forecastRow.appendChild(card);
  });
}

/* ── Render Chart ───────────────────────────────────── */
function renderTempChart(days) {
  const labels = days.map((d, i) => {
    if (i === 0) return 'Today';
    return new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  });
  const highs = days.map(d => Math.round(d.day.maxtemp_c));
  const lows  = days.map(d => Math.round(d.day.mintemp_c));

  const ctx = $('temp-chart').getContext('2d');
  if (tempChart) tempChart.destroy();

  // Create gradients
  const highGrad = ctx.createLinearGradient(0, 0, 0, 220);
  highGrad.addColorStop(0,   'rgba(212, 168, 83, 0.5)');
  highGrad.addColorStop(1,   'rgba(212, 168, 83, 0.02)');

  const lowGrad = ctx.createLinearGradient(0, 0, 0, 220);
  lowGrad.addColorStop(0,   'rgba(56, 189, 248, 0.4)');
  lowGrad.addColorStop(1,   'rgba(56, 189, 248, 0.02)');

  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'High °C',
          data: highs,
          borderColor: '#d4a853',
          backgroundColor: highGrad,
          borderWidth: 2.5,
          pointBackgroundColor: '#d4a853',
          pointBorderColor: 'rgba(12,10,8,0.8)',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          tension: 0.45,
          fill: true,
        },
        {
          label: 'Low °C',
          data: lows,
          borderColor: '#38bdf8',
          backgroundColor: lowGrad,
          borderWidth: 2,
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: 'rgba(12,10,8,0.8)',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.45,
          fill: true,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(12, 10, 8, 0.92)',
          titleColor: '#f5ead8',
          bodyColor:  'rgba(245, 234, 216, 0.65)',
          borderColor: 'rgba(255, 245, 220, 0.1)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 12,
          callbacks: {
            label: ctx => `  ${ctx.dataset.label}: ${ctx.parsed.y}°C`
          }
        }
      },
      scales: {
        x: {
          grid:   { color: 'rgba(255, 245, 220, 0.05)' },
          ticks:  { color: 'rgba(245, 234, 216, 0.45)', font: { size: 11, family: "'Outfit', sans-serif" } },
          border: { color: 'transparent' }
        },
        y: {
          grid:   { color: 'rgba(255, 245, 220, 0.05)' },
          ticks:  {
            color:    'rgba(245, 234, 216, 0.45)',
            font:     { size: 11, family: "'Outfit', sans-serif" },
            callback: v => `${v}°`
          },
          border: { color: 'transparent' }
        }
      }
    }
  });
}

/* ══════════════════════════════════════════════════════
   WEATHER THEME & ANIMATIONS
══════════════════════════════════════════════════════ */

/* Determine weather state from condition code */
function getWeatherState(current, localtime) {
  const code    = current.condition.code;
  const isNight = !current.is_day;

  if (isNight)                          return 'night';
  if ([1000].includes(code))            return 'sunny';
  if ([1003,1006,1009,1030].includes(code)) return 'cloudy';
  if (code >= 1150 && code <= 1201)     return 'rain';
  if (code >= 1063 && code <= 1072)     return 'rain';
  if (code >= 1210 && code <= 1282)     return 'snow';
  if ([1087,1273,1276,1279,1282].includes(code)) return 'thunder';
  if ([1135,1147].includes(code))       return 'fog';
  if (code >= 1180)                     return 'rain';
  return 'cloudy';
}

function applyWeatherTheme(current, localtime) {
  const state = getWeatherState(current, localtime);
  document.body.className = `state-${state}`;

  // Clouds
  const cl1 = document.getElementById('cloud-layer-1');
  const cl2 = document.getElementById('cloud-layer-2');
  const showClouds = ['cloudy','rain','thunder','snow','fog'].includes(state);
  cl1.classList.toggle('visible', showClouds);
  cl2.classList.toggle('visible', showClouds && state !== 'fog');

  // Sun orb
  const orb  = document.getElementById('sky-orb');
  const rays = document.getElementById('orb-rays');
  orb.classList.toggle('visible', ['sunny','night'].includes(state));
  orb.classList.toggle('night',   state === 'night');
  rays.classList.toggle('visible', state === 'sunny');

  // Particles (rain / snow)
  stopParticles();
  if (state === 'rain' || state === 'thunder') startParticles('rain');
  if (state === 'snow')                        startParticles('snow');
}

/* ══════════════════════════════════════════════════════
   PARTICLE SYSTEM (Rain / Snow)
══════════════════════════════════════════════════════ */
function initParticleCanvas() {
  const canvas = $('particle-canvas');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  window.addEventListener('resize', () => {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  });
}

function startParticles(type) {
  const canvas = $('particle-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.classList.add('active');

  const count = type === 'rain' ? 140 : 80;
  particles   = [];

  for (let i = 0; i < count; i++) {
    particles.push(makeParticle(type, canvas.width, canvas.height, true));
  }

  function makeParticle(type, W, H, randomY = false) {
    return {
      type,
      x:       Math.random() * W,
      y:       randomY ? Math.random() * H : -10,
      speed:   type === 'rain' ? Math.random() * 8 + 8 : Math.random() * 2 + 1,
      drift:   type === 'rain' ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 0.8,
      size:    type === 'rain' ? Math.random() * 1.5 + 1 : Math.random() * 5 + 2,
      opacity: Math.random() * 0.5 + 0.25,
      length:  type === 'rain' ? Math.random() * 14 + 8 : 0,
    };
  }

  function draw() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    particles.forEach(p => {
      ctx.globalAlpha = p.opacity;

      if (p.type === 'rain') {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(147, 210, 255, 0.7)';
        ctx.lineWidth   = p.size;
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.drift * 2, p.y + p.length);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(220, 240, 255, 0.85)';
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      p.x += p.drift;
      p.y += p.speed;

      if (p.y > H + 20) {
        Object.assign(p, makeParticle(p.type, W, H));
      }
    });

    ctx.globalAlpha = 1;
    particleAnim = requestAnimationFrame(draw);
  }

  draw();
}

function stopParticles() {
  if (particleAnim) cancelAnimationFrame(particleAnim);
  const canvas = $('particle-canvas');
  canvas.classList.remove('active');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = [];
}

/* ══════════════════════════════════════════════════════
   AMBIENT CANVAS BACKGROUND
══════════════════════════════════════════════════════ */
function initAtmosCanvas() {
  const canvas = $('atmos-canvas');
  const ctx    = canvas.getContext('2d');
  let W, H;
  let orbs = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    orbs = [
      { x: W * 0.15, y: H * 0.25, r: 350, vx:  0.25, vy:  0.15, hue: 35, sat: '50%' },
      { x: W * 0.80, y: H * 0.60, r: 400, vx: -0.20, vy: -0.18, hue: 25, sat: '40%' },
      { x: W * 0.50, y: H * 0.80, r: 300, vx:  0.15, vy: -0.22, hue: 45, sat: '35%' },
    ];
  }

  window.addEventListener('resize', resize);
  resize();

  function loop() {
    ctx.clearRect(0, 0, W, H);
    orbs.forEach(o => {
      // Drift
      o.x += o.vx; o.y += o.vy;
      if (o.x < -o.r || o.x > W + o.r) o.vx *= -1;
      if (o.y < -o.r || o.y > H + o.r) o.vy *= -1;

      // Draw soft radial gradient blob
      const g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r);
      g.addColorStop(0,   `hsla(${o.hue}, ${o.sat}, 40%, 0.22)`);
      g.addColorStop(0.5, `hsla(${o.hue}, ${o.sat}, 30%, 0.08)`);
      g.addColorStop(1,   `hsla(${o.hue}, ${o.sat}, 20%, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();
    });
    requestAnimationFrame(loop);
  }
  loop();
}

/* ══════════════════════════════════════════════════════
   SUN ARC ANIMATION
══════════════════════════════════════════════════════ */
function animateSunArc(sunriseStr, sunsetStr, localtime) {
  // Parse times from "06:30 AM" format
  const toMins = str => {
    const [time, period] = str.split(' ');
    let [h, m]  = time.split(':').map(Number);
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h  = 0;
    return h * 60 + m;
  };

  const riseMin  = toMins(sunriseStr);
  const setMin   = toMins(sunsetStr);
  const nowDate  = new Date(localtime);
  const nowMin   = nowDate.getHours() * 60 + nowDate.getMinutes();
  const totalMin = setMin - riseMin;
  const elapsed  = Math.max(0, Math.min(nowMin - riseMin, totalMin));
  const progress = totalMin > 0 ? elapsed / totalMin : 0;

  // Animate progress arc (dashoffset from 320 → 0)
  const arcEl = $('sun-progress');
  if (arcEl) {
    const dashLen = 320;
    setTimeout(() => {
      arcEl.style.transition  = 'stroke-dashoffset 1.8s cubic-bezier(0.4,0,0.2,1)';
      arcEl.style.strokeDashoffset = dashLen * (1 - progress);
    }, 300);
  }

  // Move sun dot along the quadratic Bezier path
  // Path: "M20 130 Q130 -20 240 130"
  // Parametric: P(t) = (1-t)²·P0 + 2(1-t)t·P1 + t²·P2
  const P0 = { x: 20,  y: 130 };
  const P1 = { x: 130, y: -20 };
  const P2 = { x: 240, y: 130 };

  const t   = progress;
  const sx  = (1-t)*(1-t)*P0.x + 2*(1-t)*t*P1.x + t*t*P2.x;
  const sy  = (1-t)*(1-t)*P0.y + 2*(1-t)*t*P1.y + t*t*P2.y;

  const dot  = $('sun-pos');
  const glow = $('sun-glow');
  if (dot)  { dot.setAttribute('cx',  sx); dot.setAttribute('cy',  sy); }
  if (glow) { glow.setAttribute('cx', sx); glow.setAttribute('cy', sy); }
}

/* ══════════════════════════════════════════════════════
   RING GAUGE ANIMATION
══════════════════════════════════════════════════════ */
function animateRing(el, percent, circumference) {
  if (!el) return;
  const offset = circumference * (1 - percent / 100);
  el.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)';
  el.setAttribute('stroke-dashoffset', offset);
}

/* ══════════════════════════════════════════════════════
   LIVE LOCAL CLOCK
══════════════════════════════════════════════════════ */
function startLiveClock(localtime, tzId) {
  if (clockTimer) clearInterval(clockTimer);

  // WeatherAPI gives us localtime as "YYYY-MM-DD HH:MM"
  // We'll approximate by using the offset between server localtime and UTC
  const serverLocal  = new Date(localtime.replace(' ', 'T'));
  const utcNow       = new Date();
  const offsetMs     = serverLocal - utcNow; // rough tz offset in ms

  function update() {
    const local = new Date(Date.now() + offsetMs);
    DOM.timeVal.textContent = local.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  update();
  clockTimer = setInterval(update, 1000);
}

/* ══════════════════════════════════════════════════════
   AUTOCOMPLETE (WeatherAPI Search)
══════════════════════════════════════════════════════ */
async function handleAutocomplete() {
  const q = DOM.searchInput.value.trim();
  if (q.length < 2) { closeAutocomplete(); return; }

  try {
    const res  = await fetch(`https://api.weatherapi.com/v1/search.json?key=${API_KEY}&q=${encodeURIComponent(q)}`);
    const data = await res.json();

    if (!data.length) { closeAutocomplete(); return; }

    DOM.acList.innerHTML = data.slice(0, 6).map(loc => `
      <div class="ac-item" data-query="${loc.name}, ${loc.country}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
        <span>${loc.name}${loc.region ? ', ' + loc.region : ''}, ${loc.country}</span>
      </div>
    `).join('');

    DOM.acList.classList.remove('hidden');

    DOM.acList.querySelectorAll('.ac-item').forEach(item => {
      item.addEventListener('click', () => {
        DOM.searchInput.value = item.dataset.query;
        closeAutocomplete();
        fetchWeather(item.dataset.query);
      });
    });

  } catch (_) {
    closeAutocomplete();
  }
}

function closeAutocomplete() {
  DOM.acList.classList.add('hidden');
  DOM.acList.innerHTML = '';
}

/* ══════════════════════════════════════════════════════
   UI STATE HELPERS
══════════════════════════════════════════════════════ */
function showLoader()    { DOM.loader.classList.remove('hidden'); DOM.dashboard.classList.add('hidden'); }
function hideLoader()    { DOM.loader.classList.add('hidden'); }
function showDashboard() { DOM.dashboard.classList.remove('hidden'); }
function hideError()     { DOM.errorBox.classList.add('hidden'); }
function showError(msg)  {
  DOM.errorText.textContent = msg;
  DOM.errorBox.classList.remove('hidden');
  DOM.loader.classList.add('hidden');
}

/* ══════════════════════════════════════════════════════
   UTILITY
══════════════════════════════════════════════════════ */

/* Debounce function for autocomplete */
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}