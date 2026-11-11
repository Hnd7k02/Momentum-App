// Gemeinsame Bausteine der Mockups: Muskelzeilen und Verlaufslinien. Kein Produktcode.
const WORT = { improved: 'Verbessert', held: 'Gehalten', declined: 'Zurückgegangen', few: 'Zu wenig Vergleichsdaten', none: 'Noch nicht trainiert' };
const GRUPPEN = [
  ['Brust', '#D9654E', 'Vor 2 Tagen', [0, 2, 3, 5, 7, 9], 'improved'],
  ['Rücken', '#2E6FB7', 'Vor 3 Tagen', [0, 1, 3, 4, 6], 'improved'],
  ['Schultern', '#E8A33D', 'Vor 2 Tagen', [0, 1, 2, 3, 4], 'improved'],
  ['Bizeps', '#7B5AC9', 'Vor 3 Tagen', [0, 1, 0, 2, 1], 'held'],
  ['Trizeps', '#C45D9E', 'Vor 2 Tagen', [0, -1, 1, 0, 0], 'held'],
  ['Rumpf', '#C9A227', 'Vor 5 Tagen', [0, 1, -1, -1], 'held'],
  ['Quadrizeps', '#1F9E94', 'Vor 4 Tagen', [0, -1, -3, -4, -5], 'declined'],
  ['Beinbeuger und Gesäss', '#8C6239', 'Vor 4 Tagen', [0, 1, 1, 2], 'held'],
  ['Waden', '#4FB3E8', null, null, 'none'],
  ['Unterarme', '#6E7B8B', 'Vor 6 Tagen', null, 'few'],
];
// Muskelfarbe als Punkt: um 35 % zum eigenen Grau gezogen, damit sie nicht wie ein Status liest.
function gedaempft(hex, t = 0.35) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const g = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  return `rgb(${c.map((x) => Math.round(x + (g - x) * t)).join(',')})`;
}
const zahl = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' %';
// Verlaufslinie: gemeinsame Skala von −12 bis +12 % für alle Zeilen, Nulllinie in der Mitte.
function linie(werte, zustand, w = 80, h = 24) {
  const y = (v) => h / 2 - (Math.max(-12, Math.min(12, v)) / 12) * (h / 2 - 3);
  const x = (i) => 3 + (i / (werte.length - 1)) * (w - 6);
  const p = werte.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const farbe = zustand === 'improved' ? 'var(--status-strong)' : zustand === 'declined' ? 'var(--status-weak)' : 'var(--data-ink)';
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line class="zero" x1="0" x2="${w}" y1="${h / 2}" y2="${h / 2}"/><polyline class="line" points="${p}"/><circle cx="${x(werte.length - 1).toFixed(1)}" cy="${y(werte.at(-1)).toFixed(1)}" r="3" fill="${farbe}"/></svg>`;
}
function zeilen(ziel, leer = false) {
  const schmal = window.innerWidth <= 340;
  ziel.innerHTML = GRUPPEN.map(([name, farbe, wann, werte, z]) => {
    const zustand = leer ? 'none' : z;
    const punkt = `<i class="dot" style="background:${gedaempft(farbe)};${zustand === 'none' ? 'opacity:.4' : ''}"></i>`;
    const links = `<div><div class="name">${name}</div>${wann && !leer ? `<div class="when">${wann}</div>` : ''}</div>`;
    if (zustand === 'none' || zustand === 'few') return `<div class="row wide">${punkt}${links}<span class="chip ${zustand}">${WORT[zustand]}</span></div>`;
    return `<div class="row">${punkt}${links}${linie(werte, zustand, schmal ? 64 : 80)}<div class="right"><div class="figure num t-${zustand}">${zahl(werte.at(-1))}</div><div class="state">${WORT[zustand]}</div></div></div>`;
  }).join('');
}
const LEGENDE = `<span><i class="s-improved"></i>Verbessert</span><span><i class="s-held"></i>Gehalten</span><span><i class="s-declined"></i>Zurückgegangen</span><span><i class="s-few"></i>Zu wenig Vergleichsdaten</span><span><i class="s-none"></i>Noch nicht trainiert</span>`;
const TABS = `<span>Heute</span><span>Verlauf</span><span>Rang</span><span aria-current="page">Bereiche</span>`;
