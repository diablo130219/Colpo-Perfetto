// ===== COLPO PERFETTO — Supabase Cloud Sync =====
// Salva e carica i dati principali da Supabase nella tabella colpo_perfetto_app_state.
(function(){
  const SUPABASE_URL = "https://hfrxjuzqugkitjnsvipa.supabase.co";
  const SUPABASE_KEY = "sb_publishable_ETiDKSXRNDr1ZruC7mFsiQ_di5P9w5C";
  const TABLE_NAME = "colpo_perfetto_app_state";
  const APP_KEY = "colpo_perfetto_main";

  const KEYS = ["cp_v4", "cp_taccuino_v1", "cp_cassa_iniziale", "cp_multipla_v1"];
  const ENDPOINT = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}`;

  let ready = false;
  let timer = null;

  const origSet = Storage.prototype.setItem;
  const origRemove = Storage.prototype.removeItem;

  function headers(extra = {}) {
    return {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...extra
    };
  }

  function snapshot() {
    const dati = {};
    KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      dati[key] = value === null ? null : value;
    });
    return dati;
  }

  function hasUsefulData(dati) {
    return dati && KEYS.some((key) => dati[key] !== null && dati[key] !== undefined && dati[key] !== "");
  }

  async function loadRemoteState() {
    const url = `${ENDPOINT}?app_key=eq.${encodeURIComponent(APP_KEY)}&select=dati,updated_at&limit=1`;
    const res = await fetch(url, {
      method: "GET",
      headers: headers(),
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`Supabase load HTTP ${res.status}`);
    const rows = await res.json();
    return rows && rows[0] ? rows[0].dati || {} : null;
  }

  async function pushState() {
    try {
      const body = {
        app_key: APP_KEY,
        dati: snapshot(),
        updated_at: new Date().toISOString()
      };

      const res = await fetch(`${ENDPOINT}?on_conflict=app_key`, {
        method: "POST",
        headers: headers({
          "Prefer": "resolution=merge-duplicates,return=minimal"
        }),
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`Supabase save HTTP ${res.status}`);
      document.documentElement.classList.add("cloud-ready");
      document.documentElement.classList.remove("cloud-offline");
      return true;
    } catch (error) {
      console.warn("Cloud save Supabase fallito, resto in locale", error);
      document.documentElement.classList.add("cloud-offline");
      return false;
    }
  }

  function schedulePush() {
    if (!ready) return;
    clearTimeout(timer);
    timer = setTimeout(pushState, 450);
  }

  Storage.prototype.setItem = function(key, value) {
    origSet.apply(this, arguments);
    if (KEYS.includes(key)) schedulePush();
  };

  Storage.prototype.removeItem = function(key) {
    origRemove.apply(this, arguments);
    if (KEYS.includes(key)) schedulePush();
  };

  window.CP_CLOUD_SAVE_NOW = pushState;

  window.CP_CLOUD_READY = (async function(){
    try {
      const remote = await loadRemoteState();
      if (hasUsefulData(remote)) {
        KEYS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(remote, key) && remote[key] !== null && remote[key] !== undefined) {
            origSet.call(localStorage, key, remote[key]);
          }
        });
      } else if (hasUsefulData(snapshot())) {
        await pushState();
      }

      ready = true;
      document.documentElement.classList.add("cloud-ready");
      document.documentElement.classList.remove("cloud-offline");
    } catch (error) {
      ready = true;
      document.documentElement.classList.add("cloud-offline");
      console.warn("Cloud load Supabase non disponibile, uso dati locali", error);
    }
  })();
})();
