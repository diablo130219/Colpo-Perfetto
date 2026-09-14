// ===== COLPO PERFETTO — app.js (v2 — 5 migliorie) =====

const N = 25;
const TABS = ['cp1'];
const TAB_NAMES = { cp1:'CASSA' };
const MULTI_KEY = 'cp_multipla_v1';
const MULTI_N = 12;

// Quote suggerite ottimizzate per quote basse (1.30-1.65)
const QSUGG = [
  1.30,1.30,1.35,1.30,1.30,1.35,1.35,1.40,1.40,1.45,
  1.40,1.40,1.45,1.45,1.40,1.40,1.40,1.45,1.45,1.50,
  1.50,1.50,1.55,1.60,1.65
];

// % magazzino dinamica per step (cresce man mano che sei al sicuro)
const PCT_MAG_PER_STEP = [
  30,30,30,                          // step 1-3  Fase1 (tutto in mag comunque)
  35,35,40,40,45,45,50,              // step 4-10
  50,50,55,55,55,55,55,60,60,60,    // step 11-20
  65,65,70,70,75                     // step 21-25
];

const state = {};
TABS.forEach(t => { state[t] = { steps:[] }; });
let prevMag = { cp1:0 };

function g(id)  { return document.getElementById(id); }
function fn(v)  { return (+v).toFixed(2).replace('.', ','); }
function fe(v)  { return fn(v) + ' \u20ac'; }
function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function getCassaGlobale() {
  try {
    const raw = localStorage.getItem('cp_cassa_iniziale');
    if (raw === null) return 300;
    const val = parseFloat(raw);
    return isNaN(val) ? 300 : val;
  } catch(e) { return 300; }
}

function initSteps(tab) {
  state[tab].steps = [];
  state[tab].terminated = false;
  for (let i = 0; i < N; i++)
    state[tab].steps.push({ data:'', ora:'', desc:'', qGioc:null, stakeManual:null, esito:null });
}

// ── Persist ──
function saveAll() {
  try {
    const save = {};
    TABS.forEach(t => { save[t] = { cfg: getConfig(t), steps: state[t].steps }; });
    localStorage.setItem('cp_v4', JSON.stringify(save));
  } catch(e) {}
}

function loadAll() {
  try {
    const raw = localStorage.getItem('cp_v4');
    if (!raw) return false;
    const save = JSON.parse(raw);
    TABS.forEach(t => {
      if (!save[t]) return;
      const c = save[t].cfg || {};
      if (g('stakeIniz-'+t)) g('stakeIniz-'+t).value = c.stakeIniz ?? 3;
      if (g('stepAzz-'+t))   g('stepAzz-'+t).value   = c.stepAzz   ?? 3;
      if (g('commP-'+t))     g('commP-'+t).value     = c.commP     ?? 0;
      state[t].steps = (save[t].steps || []).slice(0, N);
      while (state[t].steps.length < N)
        state[t].steps.push({ data:'', ora:'', desc:'', qGioc:null, stakeManual:null, esito:null });
      state[t].steps = state[t].steps.map(s => Object.assign({ data:'', ora:'', desc:'', qGioc:null, stakeManual:null, esito:null }, s));
      state[t].terminated = state[t].steps.some(s => s.esito === 'ko');
    });
    return true;
  } catch(e) { return false; }
}

function getConfig(tab) {
  return {
    cassa:     getCassaGlobale(),
    stakeIniz: parseFloat(g('stakeIniz-'+tab)?.value) || 3,
    stepAzz:   parseInt(g('stepAzz-'+tab)?.value)     || 3,
    commP:     parseFloat(g('commP-'+tab)?.value)     || 0,
  };
}

// % magazzino per step (dinamica o fissa fallback)
function getPctMag(stepIndex, stepAzz) {
  if (stepIndex < stepAzz) return 1.0; // Fase1: tutto in mag
  const f2idx = stepIndex - stepAzz;
  const arr = PCT_MAG_PER_STEP.slice(stepAzz);
  const pct = arr[Math.min(f2idx, arr.length-1)] || 40;
  return pct / 100;
}

// ── Build page ──
function buildPage(tab) {
  const pid = 'page-'+tab;
  const page = g(pid);
  if (!page) return;
  const wasActive = page.classList.contains('active');
  page.className = 'page theme-'+tab+(wasActive?' active':'');

  page.innerHTML = [
    '<header class="hero">',
    '  <div class="hero-left hero-left-logo">',
    '    <div class="hero-brand"><img src="logo-cp1-yellow.png" class="hero-logo" alt="CASSA"/></div>',
    '    <div class="hero-copy">',
    '      <div class="hero-badge">Sistema operativo</div>',
    '      <h1 class="hero-display">CASSA</h1>',
    '      <div class="hero-sub hero-sub-logo">La scalata a quota <strong>1000</strong></div>',
    '    </div>',
    '  </div>',
    '  <div class="hero-mag">',
    '    <div class="mag-ring"><div class="mag-inner">',
    '      <div class="mag-label-top">MAGAZZINO</div>',
    '      <div class="mag-amount" id="magTot-'+tab+'">0,00 \u20ac</div>',
    '      <div class="mag-label-bot" id="mi1-'+tab+'">0 step</div>',
    '    </div></div>',
    '  </div>',
    '</header>',

    // Barra sicurezza sessione
    '<div class="sicurezza-bar" id="sicurezza-bar-'+tab+'">',
    '  <div class="sic-label">Sicurezza sessione</div>',
    '  <div class="sic-track"><div class="sic-fill" id="sic-fill-'+tab+'"></div></div>',
    '  <div class="sic-stato" id="sic-stato-'+tab+'">—</div>',
    '</div>',

    '<div class="settings-bar">',
    '  <div class="setting-group"><label>Stake iniziale</label>',
    '    <div class="input-wrap"><input type="number" id="stakeIniz-'+tab+'" value="3" min="0.1" step="0.1"><span class="unit">\u20ac</span></div></div>',
    '  <div class="setting-group"><label>Step Fase 1</label>',
    '    <div class="input-wrap"><input type="number" id="stepAzz-'+tab+'" value="3" min="1" max="10" step="1"><span class="unit">#</span></div></div>',
    '  <div class="setting-group"><label>Commissioni</label>',
    '    <div class="input-wrap"><input type="number" id="commP-'+tab+'" value="0" min="0" max="10" step="0.5"><span class="unit">%</span></div></div>',
    '  <button class="btn-reset" data-tab="'+tab+'">&#8635; Salva nel Taccuino</button>',
    '  <button class="btn-elimina" data-tab="'+tab+'">&#128465; Elimina scalata</button>',
    '</div>',

    '<div class="stats-grid">',
    '  <div class="stat-card"><div class="stat-icon">\u25ce</div><div class="stat-body"><div class="stat-label">Stake prossimo</div><div class="stat-value" id="sc-stake-'+tab+'">3,00 \u20ac</div></div></div>',
    '  <div class="stat-card"><div class="stat-icon">\u25a4</div><div class="stat-body"><div class="stat-label">Step completati</div><div class="stat-value" id="sc-step-'+tab+'">0 / 25</div></div></div>',
    '  <div class="stat-card accent"><div class="stat-icon">\u25c6</div><div class="stat-body"><div class="stat-label">Magazzino</div><div class="stat-value gold" id="sc-mag-'+tab+'">0,00 \u20ac</div></div></div>',
    '  <div class="stat-card"><div class="stat-icon">\u25c7</div><div class="stat-body"><div class="stat-label">Rischio netto</div><div class="stat-value" id="sc-rischio-'+tab+'">3,00 \u20ac</div></div></div>',
    '  <div class="stat-card"><div class="stat-icon">\u25b2</div><div class="stat-body"><div class="stat-label">Return totale</div><div class="stat-value green" id="sc-return-'+tab+'">0,00 \u20ac</div></div></div>',
    '</div>',

    '<div class="phase-strip">',
    '  <div class="phase-pill"><span class="pill-dot red"></span>Fase 1 \u2014 Stake fisso · tutto il gain in magazzino</div>',
    '  <div class="phase-divider">\u2192</div>',
    '  <div class="phase-pill"><span class="pill-dot gold"></span>Fase 2 \u2014 % magazzino <strong>dinamica</strong> per step (cresce con gli step)</div>',
    '</div>',

    '<div class="table-wrap"><table>',
    '<thead><tr>',
    '<th class="col-n">#</th>',
    '<th class="col-date">Data</th>',
    '<th class="col-time">Ora</th>',
    '<th class="col-stk">Stake</th>',
    '<th class="col-dsc">Evento + mercato</th>',
    '<th class="col-stkcol">Stake usato</th>',
    '<th class="col-qg">Q. giocata</th>',
    '<th class="col-qs">Q. sugg.</th>',
    '<th class="col-gl">Gain lordo</th>',
    '<th class="col-gn">Gain netto</th>',
    '<th class="col-gm">\u2192 Mag. %</th>',
    '<th class="col-mc">Mag. cumul.</th>',
    '<th class="col-rt">Return</th>',
    '<th class="col-es">Esito</th>',
    '<th class="col-ann">↩</th>',
    '</tr></thead>',
    '<tbody id="tbody-'+tab+'"></tbody>',
    '</table></div>',

    // Grafico magazzino
    '<div class="mag-chart-wrap">',
    '  <div class="mag-chart-title">📈 Andamento Magazzino</div>',
    '  <canvas id="mag-chart-'+tab+'" height="90"></canvas>',
    '</div>',

    '<div class="formula-note">',
    '  <span class="fn-label">Formula Fase 2:</span>',
    '  Stake<sub>n+1</sub> = Stake<sub>n</sub> + GainNetto \u00d7 (1 \u2212 %mag<sub>step</sub>)',
    '  &nbsp;\u00b7&nbsp; <span id="mi2-'+tab+'">Prossimo stake: \u2014</span>',
    '</div>',
    '<div id="ko-container-'+tab+'"></div>'
  ].join('\n');
}

// ── Calcolo ──
function calcTab(tab) {
  const cfg = getConfig(tab);
  const { stakeIniz, stepAzz, commP } = cfg;
  let stakeCur=stakeIniz, magCum=0, returnCur=0, doneCount=0;
  const rows = [];
  for (let i = 0; i < N; i++) {
    const s = state[tab].steps[i];
    const isFase1 = (i < stepAzz);
    const pctMag = getPctMag(i, stepAzz);
    const stake = parseFloat(((s.stakeManual !== null && !isNaN(parseFloat(s.stakeManual))) ? parseFloat(s.stakeManual) : stakeCur).toFixed(2));
    let gainLordo=null, gainNetto=null, gainMag=null;
    if (s.esito === 'ok' && s.qGioc) {
      gainLordo = parseFloat((stake * s.qGioc).toFixed(2));
      const comm = parseFloat((gainLordo * commP/100).toFixed(2));
      gainNetto = parseFloat((gainLordo - stake - comm).toFixed(2));
      gainMag = parseFloat((gainNetto * pctMag).toFixed(2));
      if (isFase1) { stakeCur = stake; }
      else { stakeCur = parseFloat((stake + gainNetto - gainMag).toFixed(2)); }
      magCum = parseFloat((magCum + gainMag).toFixed(2));
      returnCur = parseFloat((returnCur + gainNetto).toFixed(2));
      doneCount++;
    } else if (s.esito === 'ko') {
      gainLordo=0; gainNetto=parseFloat((-stake).toFixed(2)); gainMag=0;
      returnCur=parseFloat((returnCur-stake).toFixed(2)); doneCount++;
    }
    rows.push({ i, isFase1, stake, pctMag, qGioc:s.qGioc, qSugg:QSUGG[i], gainLordo, gainNetto, gainMag, magCum, returnCur, esito:s.esito });
  }
  const rischio = Math.max(0, parseFloat((stakeIniz*stepAzz-magCum).toFixed(2)));
  const np = rows.find(r => r.esito===null);
  return { rows, magCum, returnCur, doneCount, rischio, np, cfg };
}

// ── Recalc ──
function recalc(tab) {
  const { rows, magCum, returnCur, doneCount, rischio, np, cfg } = calcTab(tab);

  animCounter(g('magTot-'+tab), prevMag[tab]||0, magCum, 500);
  prevMag[tab] = magCum;

  if (g('mi1-'+tab))      g('mi1-'+tab).textContent  = doneCount+' step completati';
  if (g('mi2-'+tab))      g('mi2-'+tab).textContent  = 'Prossimo stake: '+(np?fe(np.stake):'\u2014');
  if (g('sc-stake-'+tab)) g('sc-stake-'+tab).textContent = np?fe(np.stake):'\u2014';
  if (g('sc-step-'+tab))  g('sc-step-'+tab).textContent  = doneCount+' / '+N;
  if (g('sc-mag-'+tab))   g('sc-mag-'+tab).textContent   = fe(magCum);

  const rischioEl = g('sc-rischio-'+tab);
  if (rischioEl) {
    rischioEl.textContent = fe(rischio);
    rischioEl.className = 'stat-value ' + (rischio > 0 ? 'red' : 'green');
  }
  const returnEl = g('sc-return-'+tab);
  if (returnEl) {
    returnEl.textContent = (returnCur >= 0 ? '+' : '') + fe(returnCur);
    returnEl.className = 'stat-value ' + (returnCur >= 0 ? 'green' : 'red');
  }

  // ── Barra sicurezza ──
  aggiornaSicurezza(tab, magCum, rischio, cfg.stakeIniz, cfg.stepAzz);

  const tbody = g('tbody-'+tab);
  if (!tbody) return;
  tbody.innerHTML = '';
  const stepAzz = cfg.stepAzz;
  const terminated = state[tab].terminated;

  rows.forEach((r, idx) => {
    const tr = document.createElement('tr');
    if (r.esito==='ok') tr.classList.add('ok-r');
    if (r.esito==='ko') tr.classList.add('ko-r');
    if (idx===stepAzz)  tr.classList.add('phase-sep');
    if (terminated && r.esito===null) tr.classList.add('blocked-row');
    const gnClass = r.gainNetto===null?'mu':r.gainNetto>=0?'gp':'gng';

    const dataInput  = '<input type="date" class="date-inp" value="'+esc(state[tab].steps[idx].data)+'" oninput="state[\''+tab+'\'].steps['+idx+'].data=this.value;saveAll()">';
    const oraInput   = '<input type="time" class="time-inp" value="'+esc(state[tab].steps[idx].ora)+'" oninput="state[\''+tab+'\'].steps['+idx+'].ora=this.value;saveAll()">';
    const descInput  = '<input type="text" placeholder="Inserisci evento..." value="'+esc(state[tab].steps[idx].desc)+'" oninput="state[\''+tab+'\'].steps['+idx+'].desc=this.value;saveAll()">';
    const stakeInput = r.esito!==null
      ? '<span class="stk-col">'+fe(r.stake)+'</span>'
      : '<input type="text" inputmode="decimal" value="'+(state[tab].steps[idx].stakeManual!==null?fn(state[tab].steps[idx].stakeManual):fn(r.stake))+'" placeholder="Importo" class="stake-inp" onchange="setManualStake(\''+tab+'\','+idx+',this.value)">';

    // Alert quota alta se > 1.80
    const quotaVal = state[tab].steps[idx].qGioc;
    const quotaAlert = quotaVal && quotaVal > 1.80 ? ' quota-alert' : '';
    const qgCell = r.esito!==null
      ? '<span class="qg-badge'+quotaAlert+'">'+(r.qGioc?r.qGioc.toFixed(2).replace('.',','):'?')+'</span>'
      : '<input type="text" inputmode="decimal" value="'+(state[tab].steps[idx].qGioc?state[tab].steps[idx].qGioc.toFixed(2).replace('.',','):'')+'" placeholder="es. 1,35" class="qg-inp" onchange="handleQuotaChange(\''+tab+'\','+idx+',this)">';

    // Quota suggerita
    const qSugg = '<span class="q-sugg">'+r.qSugg.toFixed(2).replace('.',',')+'</span>';

    // % mag dinamica
    const pctMagLabel = r.isFase1 ? '<span class="mag-pct fase1">100%</span>' :
      '<span class="mag-pct">'+(r.gainMag!==null&&r.esito==='ok'?fe(r.gainMag)+' <em>('+Math.round(r.pctMag*100)+'%)</em>':'<span class="mu">\u2014</span>')+'</span>';

    const esitoCell = r.esito==='ok'
      ? '<span class="eok">OK</span>'
      : r.esito==='ko'
      ? '<span class="eko">KO</span>'
      : terminated
      ? '<span class="esito-blocked">\u2014</span>'
      : '<div class="bw"><button class="bok" data-tab="'+tab+'" data-idx="'+idx+'" data-val="ok">OK</button><button class="bko" data-tab="'+tab+'" data-idx="'+idx+'" data-val="ko">KO</button></div>';

    tr.innerHTML =
      '<td>'+(r.i+1)+(r.isFase1?'<span class="fb">F1</span>':'')+'</td>'+
      '<td>'+dataInput+'</td>'+
      '<td>'+oraInput+'</td>'+
      '<td><span class="stk-val'+(r.isFase1?' fase1':'')+'">'+fe(r.stake)+'</span></td>'+
      '<td class="col-dsc">'+descInput+'</td>'+
      '<td>'+stakeInput+'</td>'+
      '<td>'+qgCell+'</td>'+
      '<td>'+qSugg+'</td>'+
      '<td class="mu">'+(r.gainLordo!==null?fe(r.gainLordo):'\u2014')+'</td>'+
      '<td class="'+gnClass+'">'+(r.gainNetto!==null?fe(r.gainNetto):'\u2014')+'</td>'+
      '<td class="mgv">'+pctMagLabel+'</td>'+
      '<td class="mgc">'+(r.esito!==null?fe(r.magCum):'<span class="mu">\u2014</span>')+'</td>'+
      '<td class="ret">'+(r.esito!==null?fe(r.returnCur):'<span class="mu">\u2014</span>')+'</td>'+
      '<td>'+esitoCell+'</td>'+
      '<td>'+(r.esito!==null?'<button class="btn-annulla" data-tab="'+tab+'" data-idx="'+idx+'">↩</button>':'')+'</td>';
    tbody.appendChild(tr);
  });

  // Grafico
  disegnaGrafico(tab, rows);
  saveAll();
}

// ── Gestione quota con alert ──
function handleQuotaChange(tab, idx, inp) {
  const v = parseFloat(inp.value.replace(',','.'));
  if (!isNaN(v) && v >= 1) {
    state[tab].steps[idx].qGioc = v;
    // Alert visivo se quota > 1.80
    if (v > 1.80) {
      inp.classList.add('quota-alert');
      inp.title = '⚠ Quota alta! Il sistema funziona meglio con quote 1,30–1,65';
    } else {
      inp.classList.remove('quota-alert');
      inp.title = '';
    }
    recalc(tab);
    saveAll();
  } else {
    inp.value = '';
    inp.classList.remove('quota-alert');
  }
}

// ── Barra sicurezza ──
function aggiornaSicurezza(tab, magCum, rischio, stakeIniz, stepAzz) {
  const fill  = g('sic-fill-'+tab);
  const stato = g('sic-stato-'+tab);
  if (!fill || !stato) return;
  const rischioIniz = stakeIniz * stepAzz;
  const coperta = rischioIniz > 0 ? Math.min(1, magCum / rischioIniz) : 1;
  const pct = Math.round(coperta * 100);
  fill.style.width = pct + '%';
  if (pct >= 100) {
    fill.style.background = 'var(--green)';
    stato.textContent = '✓ RISCHIO AZZERATO — giochi con i soldi del bookmaker';
    stato.style.color = 'var(--green)';
  } else if (pct >= 50) {
    fill.style.background = '#f0a500';
    stato.textContent = '\u26a0 Metà rischio coperta — ' + pct + '% al sicuro';
    stato.style.color = '#f0a500';
  } else {
    fill.style.background = 'var(--red)';
    stato.textContent = '\u25cf Rischio aperto — ' + pct + '% coperto';
    stato.style.color = 'var(--red)';
  }
}

// ── Grafico magazzino ──
function disegnaGrafico(tab, rows) {
  const canvas = g('mag-chart-'+tab);
  if (!canvas) return;
  const doneRows = rows.filter(r => r.esito !== null);
  if (doneRows.length < 2) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }
  const W = canvas.offsetWidth || 800;
  canvas.width  = W;
  canvas.height = 90;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, 90);

  const vals = doneRows.map(r => r.magCum);
  const maxV = Math.max(...vals, 0.01);
  const pad  = 10;
  const pts  = vals.map((v, i) => ({
    x: pad + (i / (vals.length-1||1)) * (W - pad*2),
    y: 80 - (v / maxV) * 65
  }));

  // Linea gradiente
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, '#c9a84c');
  grad.addColorStop(1, '#3ecf8e');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach((p, i) => i===0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.stroke();

  // Area sotto
  ctx.beginPath();
  pts.forEach((p, i) => i===0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length-1].x, 90);
  ctx.lineTo(pts[0].x, 90);
  ctx.closePath();
  const areaGrad = ctx.createLinearGradient(0, 0, 0, 90);
  areaGrad.addColorStop(0, 'rgba(201,168,76,0.18)');
  areaGrad.addColorStop(1, 'rgba(201,168,76,0)');
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // Punti
  pts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
    ctx.fillStyle = '#c9a84c';
    ctx.fill();
    // Label valore
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '9px DM Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(fn(vals[i])+'€', p.x, p.y - 7);
  });
}

function setManualStake(tab, idx, raw) {
  const v = parseFloat(String(raw || '').replace(',', '.'));
  state[tab].steps[idx].stakeManual = (!isNaN(v) && v > 0) ? v : null;
  recalc(tab);
  saveAll();
}

function setEsito(tab, idx, val) {
  if (val === 'ok') {
    const rows = document.querySelectorAll('#tbody-'+tab+' tr');
    const inp  = rows[idx] && rows[idx].querySelector('input.qg-inp');
    const raw  = inp ? inp.value.replace(',','.').trim() : '';
    const q    = parseFloat(raw);
    if (!q || q < 1) { alert('Inserisci una quota valida (es. 1,35) prima di segnare OK'); return; }
    // Avviso quota alta
    if (q > 1.80) {
      if (!confirm('⚠ Quota '+fn(q)+' è alta per questo sistema (ottimale: 1,30–1,65).\nVuoi procedere lo stesso?')) return;
    }
    state[tab].steps[idx].qGioc = q;
    state[tab].steps[idx].esito = 'ok';
  } else {
    const rows = document.querySelectorAll('#tbody-'+tab+' tr');
    const inp  = rows[idx] && rows[idx].querySelector('input.qg-inp');
    const raw  = inp ? inp.value.replace(',','.').trim() : '';
    const q    = parseFloat(raw);
    if (!isNaN(q) && q >= 1) state[tab].steps[idx].qGioc = q;
    state[tab].steps[idx].esito = 'ko';
    state[tab].terminated = true;
  }
  recalc(tab);
  if (val === 'ko') setTimeout(function(){ showKoBanner(tab); }, 50);
}

// ── KO Banner ──
function showKoBanner(tab) {
  const container = document.getElementById('ko-container-'+tab);
  if (!container) return;
  const { magCum, returnCur, doneCount, rischio } = calcTab(tab);
  container.innerHTML =
    '<div class="ko-banner">'+
    '<div class="ko-banner-icon">\u26d4</div>'+
    '<div class="ko-banner-body">'+
    '<div class="ko-banner-title">Sessione terminata</div>'+
    '<div class="ko-banner-sub">Hai perso la cassa del bookmaker. Il magazzino \u00e8 al sicuro.</div>'+
    '<div class="ko-banner-stats">'+
    '<div class="ko-stat"><span>Step raggiunto</span><strong>'+doneCount+' / 25</strong></div>'+
    '<div class="ko-stat"><span>Magazzino salvato</span><strong class="gold">'+fe(magCum)+'</strong></div>'+
    '<div class="ko-stat"><span>Rischio netto</span><strong class="red">'+fe(rischio)+'</strong></div>'+
    '</div></div>'+
    '<div class="ko-banner-actions">'+
    '<button class="ko-banner-btn" onclick="doReset(\''+tab+'\')">&#8635; Salva nel Taccuino e ricomincia</button>'+
    '<button class="ko-banner-btn ko-banner-btn-del" onclick="eliminaScalata(\''+tab+'\')">&#128465; Elimina senza salvare</button>'+
    '</div>'+
    '</div>';
  container.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function doReset(tab) {
  const { magCum, returnCur, doneCount, rischio, cfg } = calcTab(tab);
  taccuinoAdd(tab, { magCum, returnCur, doneCount, rischio, stakeIniz: cfg.stakeIniz, cassa: getCassaGlobale(), stepAzz: cfg.stepAzz });
  initSteps(tab);
  prevMag[tab] = 0;
  const container = document.getElementById('ko-container-'+tab);
  if (container) container.innerHTML = '';
  recalc(tab);
  saveAll();
}


function eliminaScalata(tab) {
  if (!confirm('Eliminare tutta la scalata senza salvare nel Taccuino?\nQuesta operazione non è reversibile.')) return;
  initSteps(tab);
  prevMag[tab] = 0;
  const container = document.getElementById('ko-container-'+tab);
  if (container) container.innerHTML = '';
  recalc(tab);
  saveAll();
}

function annullaEsito(tab, idx) {
  if (!confirm('Annullare l\'esito dello step '+(idx+1)+'?')) return;
  state[tab].steps[idx].esito = null;
  state[tab].steps[idx].qGioc = null;
  // Se era KO, riabilita la sessione
  state[tab].terminated = state[tab].steps.some(s => s.esito === 'ko');
  // Svuota ko-container se non ci sono più KO
  if (!state[tab].terminated) {
    const container = document.getElementById('ko-container-'+tab);
    if (container) container.innerHTML = '';
  }
  recalc(tab);
  saveAll();
}

// ── Multipla ──
const multiplaState = { rows: [], importo: 10, bonus: 0, esito: null };
function initMultipla() {
  multiplaState.rows = [];
  for (let i = 0; i < MULTI_N; i++) multiplaState.rows.push({ data:'', ora:'', evento:'', mercato:'', quota:null });
  multiplaState.importo = 10;
  multiplaState.bonus = 0;
  multiplaState.esito = null;
}
function saveMultipla() { try { localStorage.setItem(MULTI_KEY, JSON.stringify(multiplaState)); } catch(e) {} }
function loadMultipla() {
  try {
    const raw = localStorage.getItem(MULTI_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    multiplaState.rows = (saved.rows || []).slice(0, MULTI_N);
    while (multiplaState.rows.length < MULTI_N) multiplaState.rows.push({ data:'', ora:'', evento:'', mercato:'', quota:null });
    multiplaState.rows = multiplaState.rows.map(r => Object.assign({ data:'', ora:'', evento:'', mercato:'', quota:null }, r));
    multiplaState.importo = parseFloat(saved.importo) || 10;
    multiplaState.bonus = parseFloat(saved.bonus) || 0;
    multiplaState.esito = saved.esito || null;
    return true;
  } catch(e) { return false; }
}
function calcMultipla() {
  const quote = multiplaState.rows.map(r => parseFloat(r.quota)).filter(q => !isNaN(q) && q > 1);
  const quotaTot = quote.length ? parseFloat(quote.reduce((a,b)=>a*b,1).toFixed(2)) : 0;
  const importo = parseFloat(multiplaState.importo) || 0;
  const bonus = parseFloat(multiplaState.bonus) || 0;
  const vincitaLord = quotaTot > 0 ? parseFloat((importo * quotaTot).toFixed(2)) : 0;
  const vincitaTot = parseFloat((vincitaLord + bonus).toFixed(2));
  const profitto = multiplaState.esito === 'ok' ? parseFloat((vincitaTot - importo).toFixed(2)) : multiplaState.esito === 'ko' ? -importo : 0;
  return { eventi: quote.length, quotaTot, importo, vincitaLord, vincitaTot: parseFloat((vincitaLord + (parseFloat(multiplaState.bonus)||0)).toFixed(2)), bonus: parseFloat(multiplaState.bonus)||0, profitto };
}
function buildMultiplaPage() {
  const page = g('page-multipla');
  if (!page) return;
  const wasActive = page.classList.contains('active');
  page.className = 'page theme-cp7' + (wasActive ? ' active' : '');
  page.innerHTML = [
    '<header class="hero">',
    '  <div class="hero-left hero-left-logo">',
    '    <div class="hero-brand"><img src="logo-cp7.png" class="hero-logo" alt="Multipla"/></div>',
    '    <div class="hero-copy">',
    '      <div class="hero-badge">Sistema operativo</div>',
    '      <h1 class="hero-display">MULTIPLA</h1>',
    '      <div class="hero-sub hero-sub-logo">Più eventi in una sola giocata</div>',
    '    </div>',
    '  </div>',
    '  <div class="hero-mag"><div class="mag-ring"><div class="mag-inner">',
    '    <div class="mag-label-top">QUOTA TOTALE</div>',
    '    <div class="mag-amount" id="multi-quota-big">0,00</div>',
    '    <div class="mag-label-bot" id="multi-eventi-big">0 eventi</div>',
    '  </div></div></div>',
    '</header>',
    '<div class="settings-bar">',
    '  <div class="setting-group"><label>Importo giocato</label>',
    '    <div class="input-wrap"><input type="number" id="multi-importo" value="10" min="0.1" step="0.5"><span class="unit">€</span></div></div>',
    '  <div class="setting-group"><label>Bonus bookmaker</label>',
    '    <div class="input-wrap"><input type="number" id="multi-bonus" value="0" min="0" step="0.5"><span class="unit">€</span></div></div>',
    '  <button class="btn-reset" id="multi-reset">↺ Reset multipla</button>',
    '</div>',
    '<div class="stats-grid">',
    '  <div class="stat-card"><div class="stat-icon">◇</div><div class="stat-body"><div class="stat-label">Eventi inseriti</div><div class="stat-value" id="multi-eventi">0</div></div></div>',
    '  <div class="stat-card accent"><div class="stat-icon">◆</div><div class="stat-body"><div class="stat-label">Quota totale</div><div class="stat-value gold" id="multi-quota">0,00</div></div></div>',
    '  <div class="stat-card"><div class="stat-icon">◎</div><div class="stat-body"><div class="stat-label">Importo</div><div class="stat-value" id="multi-stake">0,00 €</div></div></div>',
    '  <div class="stat-card"><div class="stat-icon">▲</div><div class="stat-body"><div class="stat-label">Vincita potenziale</div><div class="stat-value green" id="multi-vincita">0,00 €</div></div></div>',
    '  <div class="stat-card"><div class="stat-icon">△</div><div class="stat-body"><div class="stat-label">Profitto</div><div class="stat-value" id="multi-profitto">—</div></div></div>',
    '  <div class="stat-card"><div class="stat-icon">🎁</div><div class="stat-body"><div class="stat-label">Bonus incluso</div><div class="stat-value gold" id="multi-bonus-disp">0,00 €</div></div></div>',
    '</div>',
    '<div class="table-wrap"><table><thead><tr>',
    '<th class="col-n">#</th><th class="col-date">Data</th><th class="col-time">Ora</th><th class="col-dsc">Evento</th><th class="col-dsc">Mercato</th><th class="col-qg">Quota</th>',
    '</tr></thead><tbody id="multi-tbody"></tbody></table></div>',
    '<div class="multi-actions">',
    '  <button class="bok" id="multi-ok">OK</button>',
    '  <button class="bko" id="multi-ko">KO</button>',
    '  <button class="btn-reset" id="multi-clear-esito">Annulla esito</button>',
    '</div>',
    '<div class="multi-esito-msg" id="multi-esito-msg">Nessun esito selezionato</div>'
  ].join('\n');
}
function recalcMultipla() {
  const c = calcMultipla();
  const imp = g('multi-importo');
  if (imp && document.activeElement !== imp) imp.value = multiplaState.importo;
  if (g('multi-quota-big'))  g('multi-quota-big').textContent  = c.quotaTot ? fn(c.quotaTot) : '0,00';
  if (g('multi-eventi-big')) g('multi-eventi-big').textContent = c.eventi + (c.eventi===1?' evento':' eventi');
  if (g('multi-eventi'))  g('multi-eventi').textContent  = c.eventi;
  if (g('multi-quota'))   g('multi-quota').textContent   = c.quotaTot ? fn(c.quotaTot) : '0,00';
  if (g('multi-stake'))   g('multi-stake').textContent   = fe(c.importo);
  if (g('multi-vincita')) g('multi-vincita').textContent = fe(c.vincitaTot)+(c.bonus>0?' (incl. '+fe(c.bonus)+' bonus)':'');
  if (g('multi-bonus-disp')) g('multi-bonus-disp').textContent = fe(c.bonus);
  const bonusInp=g('multi-bonus'); if(bonusInp&&document.activeElement!==bonusInp) bonusInp.value=multiplaState.bonus||0;
  const pr = g('multi-profitto');
  if (pr) { pr.textContent = multiplaState.esito ? (c.profitto>=0?'+':'')+fe(c.profitto) : '—'; pr.className='stat-value '+(!multiplaState.esito?'':c.profitto>=0?'green':'red'); }
  const okBtn=g('multi-ok'), koBtn=g('multi-ko');
  if (okBtn) okBtn.classList.toggle('selected-esito', multiplaState.esito==='ok');
  if (koBtn) koBtn.classList.toggle('selected-esito', multiplaState.esito==='ko');
  const msg=g('multi-esito-msg');
  if (msg) {
    if (multiplaState.esito==='ok') { msg.textContent='Multipla VINTA: profitto +'+fe(c.profitto); msg.className='multi-esito-msg ok'; }
    else if (multiplaState.esito==='ko') { msg.textContent='Multipla PERSA: perdita -'+fe(c.importo); msg.className='multi-esito-msg ko'; }
    else { msg.textContent='Nessun esito selezionato'; msg.className='multi-esito-msg'; }
  }
  const tb=g('multi-tbody');
  if (!tb) return;
  tb.innerHTML='';
  multiplaState.rows.forEach((r,idx)=>{
    const tr=document.createElement('tr');
    tr.innerHTML='<td>'+(idx+1)+'</td>'+
      '<td><input type="date" class="date-inp" value="'+esc(r.data)+'" oninput="multiplaState.rows['+idx+'].data=this.value;saveMultipla()"></td>'+
      '<td><input type="time" class="time-inp" value="'+esc(r.ora)+'" oninput="multiplaState.rows['+idx+'].ora=this.value;saveMultipla()"></td>'+
      '<td class="col-dsc"><input type="text" placeholder="Partita / evento" value="'+esc(r.evento)+'" oninput="multiplaState.rows['+idx+'].evento=this.value;saveMultipla()"></td>'+
      '<td class="col-dsc"><input type="text" placeholder="Mercato" value="'+esc(r.mercato)+'" oninput="multiplaState.rows['+idx+'].mercato=this.value;saveMultipla()"></td>'+
      '<td><input type="text" inputmode="decimal" class="qg-inp" placeholder="es. 1,45" value="'+(r.quota?fn(r.quota):'')+'" onchange="var v=parseFloat(this.value.replace(\',\',\'.\'));if(!isNaN(v)&&v>1){multiplaState.rows['+idx+'].quota=v;}else{multiplaState.rows['+idx+'].quota=null;this.value=\'\';}recalcMultipla();saveMultipla();"></td>';
    tb.appendChild(tr);
  });
  saveMultipla();
}
function resetMultipla() { if(!confirm('Resettare la multipla?'))return; initMultipla(); recalcMultipla(); saveMultipla(); if(document.querySelector('#page-bilancio.active'))buildBilancio(); }
function setMultiplaEsito(val) {
  const c=calcMultipla();
  if(val==='ok'&&(c.eventi===0||c.quotaTot<=0)){alert('Inserisci almeno una quota valida.');return;}
  if(val==='ko'&&c.importo<=0){alert('Inserisci un importo valido.');return;}
  multiplaState.esito=val; recalcMultipla(); saveMultipla();
  if(document.querySelector('#page-bilancio.active'))buildBilancio();
}
function clearMultiplaEsito() { multiplaState.esito=null; recalcMultipla(); saveMultipla(); if(document.querySelector('#page-bilancio.active'))buildBilancio(); }

// ── Bilancio ──
function buildBilancio() {
  const grid=g('bil-grid'), tots=g('bil-totals');
  if(!grid||!tots) return;
  const cassaGlobale=getCassaGlobale();
  let totalMag=0, totalReturn=0;
  grid.innerHTML='';
  TABS.forEach(tab=>{
    const {magCum,returnCur,doneCount,rischio,cfg}=calcTab(tab);
    totalMag+=magCum; totalReturn+=returnCur;
    const pos=returnCur>=0;
    grid.innerHTML+='<div class="bil-card '+tab+'"><div class="bil-card-title">CASSA</div><div class="bil-rows">'+
      '<div class="bil-row"><span class="bil-row-label">Stake iniziale</span><span class="bil-row-val">'+fe(cfg.stakeIniz)+'</span></div>'+
      '<div class="bil-row"><span class="bil-row-label">Step completati</span><span class="bil-step-badge">'+doneCount+' / 25</span></div>'+
      '<div class="bil-row"><span class="bil-row-label">Magazzino accumulato</span><span class="bil-row-val gold">'+fe(magCum)+'</span></div>'+
      '<div class="bil-row"><span class="bil-row-label">Return totale</span><span class="bil-row-val '+(pos?'green':'red')+'">'+(returnCur>=0?'+':'')+fe(returnCur)+'</span></div>'+
      '<div class="bil-row"><span class="bil-row-label">Rischio netto</span><span class="bil-row-val">'+fe(rischio)+'</span></div>'+
      '</div></div>';
  });
  const multi=calcMultipla();
  const multiRischio=multiplaState.esito==='ok'?0:multi.importo;
  totalReturn=parseFloat((totalReturn+multi.profitto).toFixed(2));
  grid.innerHTML+='<div class="bil-card multipla"><div class="bil-card-title">MULTIPLA</div><div class="bil-rows">'+
    '<div class="bil-row"><span class="bil-row-label">Importo giocato</span><span class="bil-row-val">'+fe(multi.importo)+'</span></div>'+
    '<div class="bil-row"><span class="bil-row-label">Quota totale</span><span class="bil-row-val gold">'+(multi.quotaTot?fn(multi.quotaTot):'0,00')+'</span></div>'+
    '<div class="bil-row"><span class="bil-row-label">Vincita potenziale</span><span class="bil-row-val green">'+fe(multi.vincitaLord)+'</span></div>'+
    '<div class="bil-row"><span class="bil-row-label">Return totale</span><span class="bil-row-val '+(multi.profitto>=0?'green':'red')+'">'+(multi.profitto>=0?'+':'')+fe(multi.profitto)+'</span></div>'+
    '<div class="bil-row"><span class="bil-row-label">Rischio netto</span><span class="bil-row-val">'+fe(multiRischio)+'</span></div>'+
    '</div></div>';
  const cassaDisp=parseFloat((cassaGlobale+totalReturn).toFixed(2));
  tots.innerHTML=
    '<div class="bil-tot-item"><div class="bil-tot-label">Cassa iniziale</div><div class="bil-tot-val">'+fe(cassaGlobale)+'</div></div>'+
    '<div class="bil-tot-item"><div class="bil-tot-label">Magazzino totale</div><div class="bil-tot-val gold">'+fe(totalMag)+'</div></div>'+
    '<div class="bil-tot-item"><div class="bil-tot-label">Return cumulato</div><div class="bil-tot-val '+(totalReturn>=0?'green':'red')+'">'+(totalReturn>=0?'+':'')+fe(totalReturn)+'</div></div>'+
    '<div class="bil-tot-item"><div class="bil-tot-label">Cassa disponibile</div><div class="bil-tot-val '+(cassaDisp>=cassaGlobale?'green':'red')+'">'+fe(cassaDisp)+'</div></div>';
}

// ── Counter animation ──
function animCounter(el,from,to,dur){
  if(!el)return;
  const start=performance.now();
  const tick=now=>{const t=Math.min((now-start)/dur,1);const ease=1-Math.pow(1-t,3);el.textContent=fn(from+(to-from)*ease)+' \u20ac';if(t<1)requestAnimationFrame(tick);};
  requestAnimationFrame(tick);
}

// ── Tab switching ──
function switchTab(tab){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+tab));
  if(tab==='bilancio') buildBilancio();
  else if(tab==='taccuino') buildTaccuino();
  else if(tab==='multipla') recalcMultipla();
  else { recalc(tab); if(state[tab].terminated) showKoBanner(tab); }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', async ()=>{
  TABS.forEach(tab=>{ initSteps(tab); buildPage(tab); });
  initMultipla(); buildMultiplaPage();
  try { if(window.CP_CLOUD_READY) await window.CP_CLOUD_READY; } catch(e){}
  loadAll(); loadMultipla(); recalcMultipla();

  document.addEventListener('change', e=>{
    TABS.forEach(tab=>{
      ['stakeIniz-','stepAzz-','commP-'].forEach(prefix=>{
        if(e.target.id===prefix+tab){ recalc(tab); saveAll(); }
      });
    });
  });
  const mb=document.getElementById('multi-bonus');
  if(mb) mb.addEventListener('input',function(){const v=parseFloat(this.value.replace(',','.'));multiplaState.bonus=(!isNaN(v)&&v>=0)?v:0;recalcMultipla();saveMultipla();});
  const mi=document.getElementById('multi-importo');
  if(mi) mi.addEventListener('input',function(){const v=parseFloat(this.value.replace(',','.'));multiplaState.importo=(!isNaN(v)&&v>0)?v:0;recalcMultipla();saveMultipla();});
  document.addEventListener('click', e=>{
    const btn=e.target.closest('.bok,.bko');
    if(btn&&btn.dataset.tab&&btn.dataset.idx!==undefined&&btn.dataset.val) setEsito(btn.dataset.tab,parseInt(btn.dataset.idx),btn.dataset.val);
  });
  document.addEventListener('click', e=>{
    if(e.target.classList.contains('btn-reset')){const tab=e.target.dataset.tab;if(!tab)return;if(!confirm('Salvare la sessione nel Taccuino e resettare CASSA?'))return;doReset(tab);}
    if(e.target.classList.contains('btn-elimina')){const tab=e.target.dataset.tab;if(tab)eliminaScalata(tab);}
    if(e.target.classList.contains('btn-annulla')){const tab=e.target.dataset.tab;const idx=parseInt(e.target.dataset.idx);if(tab&&!isNaN(idx))annullaEsito(tab,idx);}
  });
  document.addEventListener('click', e=>{
    if(e.target.id==='multi-ok') setMultiplaEsito('ok');
    if(e.target.id==='multi-ko') setMultiplaEsito('ko');
    if(e.target.id==='multi-clear-esito') clearMultiplaEsito();
    if(e.target.id==='multi-reset') resetMultipla();
  });
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
  TABS.forEach(tab=>{ recalc(tab); if(state[tab].terminated) showKoBanner(tab); });

  // Ridisegna grafico su resize
  window.addEventListener('resize', ()=>{ TABS.forEach(tab=>{ const {rows}=calcTab(tab); disegnaGrafico(tab,rows); }); });
});
