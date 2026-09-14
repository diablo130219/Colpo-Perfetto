// ===== TACCUINO — storico sessioni =====

const TACCUINO_KEY = 'cp_taccuino_v1';
const CASSA_KEY = 'cp_cassa_iniziale';

function getCassaManuale() {
  try {
    const raw = localStorage.getItem(CASSA_KEY);
    if (raw === null) return null;
    const val = parseFloat(raw);
    return isNaN(val) ? null : val;
  } catch(e) { return null; }
}
function setCassaManuale(val) {
  try { localStorage.setItem(CASSA_KEY, val); } catch(e) {}
}

function taccuinoLoad() {
  try { return JSON.parse(localStorage.getItem(TACCUINO_KEY)) || []; }
  catch(e) { return []; }
}

function taccuinoSave(records) {
  try { localStorage.setItem(TACCUINO_KEY, JSON.stringify(records)); }
  catch(e) {}
}

function taccuinoAdd(tab, result) {
  const records = taccuinoLoad();
  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit', year:'numeric' });
  const timeStr = now.toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' });
  records.unshift({
    id: Date.now(),
    tab: TAB_NAMES[tab],
    date: dateStr,
    time: timeStr,
    stakeIniz: result.stakeIniz,
    cassa: result.cassa,
    stepAzz: result.stepAzz,
    doneCount: result.doneCount,
    magCum: result.magCum,
    returnCur: result.returnCur,
    rischio: result.rischio,
    esito: result.returnCur >= 0 ? 'positivo' : 'negativo'
  });
  taccuinoSave(records);
}

function taccuinoDelete(id) {
  const records = taccuinoLoad().filter(r => r.id !== id);
  taccuinoSave(records);
  buildTaccuino();
}

function resetCassa() {
  try { localStorage.removeItem(CASSA_KEY); } catch(e) {}
  buildTaccuino();
}

function aggiornaCAssa() {
  const inp = document.getElementById('cassa-manuale-inp');
  if (!inp) return;
  const raw = inp.value.replace(',','.').trim();
  const val = parseFloat(raw);
  if (!isNaN(val) && val > 0) {
    setCassaManuale(val);
    buildTaccuino();
  } else {
    inp.value = '';
    inp.focus();
  }
}

function taccuinoClear() {
  if (confirm('Cancellare tutto lo storico del Taccuino?')) {
    taccuinoSave([]);
    buildTaccuino();
  }
}

function buildTaccuino() {
  const container = document.getElementById('taccuino-content');
  if (!container) return;
  const records = taccuinoLoad();

  // Calcola stats (anche se vuoto)
  const totPos = records.filter(r => r.esito === 'positivo').length;
  const totNeg = records.filter(r => r.esito === 'negativo').length;
  const totMag = records.reduce((s,r) => s + (r.magCum||0), 0);
  const totRet = records.reduce((s,r) => s + (r.returnCur||0), 0);

  const cassaManuale = getCassaManuale();
  const cassaBase = cassaManuale !== null ? cassaManuale : 0;
  const cassaDisp = parseFloat((cassaBase + totRet).toFixed(2));
  const cassaDiff = parseFloat(totRet.toFixed(2));
  const cassaClass = cassaDiff >= 0 ? 'green' : 'red';
  const cassaInpVal = cassaManuale !== null ? fn(cassaManuale) : '';

  let html = `
    <div class="tac-cassa-card">
      <div class="tac-cassa-top">
        <div class="tac-cassa-left">
          <div class="tac-cassa-label">Cassa disponibile</div>
          <div class="tac-cassa-val">${cassaManuale !== null ? fn(cassaDisp)+" €" : "— €"}</div>
          <div class="tac-cassa-sub">
            Cassa iniziale: <strong>${cassaManuale !== null ? fn(cassaManuale)+" €" : "non impostata"}</strong>
            &nbsp;·&nbsp;
            Variazione: <strong class="${cassaClass}">${cassaDiff>=0?'+':''}${fn(cassaDiff)} €</strong>
          </div>
        </div>
        <div class="tac-cassa-edit">
          <div class="tac-cassa-edit-label">Imposta cassa iniziale</div>
          <div class="tac-cassa-edit-row">
            <input type="text" inputmode="decimal" id="cassa-manuale-inp"
              value="${cassaInpVal}"
              placeholder="es. 150,00"
              class="tac-cassa-inp"/>
            <span class="tac-cassa-unit">€</span>
            <button class="tac-cassa-btn" onclick="aggiornaCAssa()">Aggiorna</button>
            <button class="tac-cassa-btn-reset" onclick="resetCassa()">↺</button>
          </div>
          <div class="tac-cassa-edit-hint">Modifica la cassa di partenza per il calcolo</div>
        </div>
      </div>
      <div class="tac-cassa-bar">
        <div class="tac-cassa-bar-fill" style="width:${Math.min(100, Math.max(0, cassaBase > 0 ? (cassaDisp/cassaBase)*100 : 100)).toFixed(1)}%;background:${cassaDiff>=0?'var(--green)':'var(--red)'}"></div>
      </div>
    </div>
    <div class="tac-stats">
      <div class="tac-stat">
        <div class="tac-stat-label">Sessioni totali</div>
        <div class="tac-stat-val">${records.length}</div>
      </div>
      <div class="tac-stat">
        <div class="tac-stat-label">Positive</div>
        <div class="tac-stat-val green">${totPos}</div>
      </div>
      <div class="tac-stat">
        <div class="tac-stat-label">Negative</div>
        <div class="tac-stat-val red">${totNeg}</div>
      </div>
      <div class="tac-stat">
        <div class="tac-stat-label">Magazzino storico</div>
        <div class="tac-stat-val gold">${fn(totMag)} €</div>
      </div>
      <div class="tac-stat">
        <div class="tac-stat-label">Return cumulato</div>
        <div class="tac-stat-val ${totRet>=0?'green':'red'}">${totRet>=0?'+':''}${fn(totRet)} €</div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;margin-bottom:1rem">
      ${records.length > 0 ? '<button class="btn-tac-clear" onclick="taccuinoClear()">🗑 Cancella tutto storico</button>' : ''}
    </div>`;

  // Lista sessioni
  html += `<div class="tac-list">`;
  if (records.length === 0) {
    html += `<div class="tac-empty">
      <div class="tac-empty-icon">📓</div>
      <div class="tac-empty-text">Nessuna sessione registrata</div>
      <div class="tac-empty-sub">Dopo ogni KO o reset, la sessione viene salvata qui automaticamente</div>
    </div>`;
  }
  records.forEach(r => {
    const pos = r.esito === 'positivo';
    html += `
      <div class="tac-row ${pos?'tac-pos':'tac-neg'}">
        <div class="tac-row-left">
          <div class="tac-esito-dot ${pos?'dot-green':'dot-red'}"></div>
          <div>
            <div class="tac-row-title">${r.tab}</div>
            <div class="tac-row-date">${r.date} · ${r.time}</div>
          </div>
        </div>
        <div class="tac-row-mid">
          <div class="tac-kv"><span>Step raggiunto</span><strong>${r.doneCount} / 25</strong></div>
          <div class="tac-kv"><span>Stake iniziale</span><strong>${fn(r.stakeIniz)} €</strong></div>

        </div>
        <div class="tac-row-right">
          <div class="tac-kv"><span>Magazzino</span><strong class="gold">${fn(r.magCum)} €</strong></div>
          <div class="tac-kv"><span>Return</span><strong class="${pos?'green':'red'}">${r.returnCur>=0?'+':''}${fn(r.returnCur)} €</strong></div>
          <div class="tac-kv"><span>Rischio netto</span><strong>${fn(r.rischio||0)} €</strong></div>
        </div>
        <div class="tac-row-actions">
          <span class="tac-badge ${pos?'badge-pos':'badge-neg'}">${pos?'✓ Positivo':'✗ Negativo'}</span>
          <button class="btn-tac-del" onclick="taccuinoDelete(${r.id})">✕</button>
        </div>
      </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}
