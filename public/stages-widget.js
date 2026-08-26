/* Kanjo Aïkido — Widget « Stages » à intégrer dans le site kanjoaikido.fr.
 *
 * Usage dans la page Stages du site :
 *   <div id="kanjo-stages"></div>
 *   <script src="https://kanjo-aikido.web.app/stages-widget.js" defer></script>
 *
 * Lit ET écrit la MÊME base Firestore que l'app des adhérents : un stage
 * ajouté ici apparaît dans l'app, et inversement. Reprend les tokens CSS
 * du site (var(--gold), var(--bg-alt)…) avec repli, pour se fondre dans
 * l'esthétique existante.
 */
(function () {
  "use strict";
  var MOUNT_ID = "kanjo-stages";
  var mount = document.getElementById(MOUNT_ID);
  if (!mount) {
    console.warn('[kanjo-stages] Ajoute <div id="' + MOUNT_ID + '"></div> à la page.');
    return;
  }

  var CONFIG = {
    apiKey: "AIzaSyDxVHxSqUNi2xdsFroVL1qON5a1RQVkq8s",
    authDomain: "kanjo-aikido.firebaseapp.com",
    projectId: "kanjo-aikido",
    storageBucket: "kanjo-aikido.firebasestorage.app",
    messagingSenderId: "319041643134",
    appId: "1:319041643134:web:a7b6a5ef7629df953e2e2f",
  };
  // Codes PIN prof (mêmes que l'app) — simple friction pour l'ajout depuis
  // le site. Non secret : la sécurité réelle passerait par Firebase Auth.
  var PROF_PINS = { "0713": "Sébastien", "2043": "Jean-Charles" };

  var TYPE_LABEL = { dojo: "Au dojo", national: "Stage national", international: "Stage international" };
  var MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  var JOURS = ["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("load " + src)); };
      document.head.appendChild(s);
    });
  }

  function injectStyle() {
    if (document.getElementById("kanjo-stages-css")) return;
    var css =
      '#' + MOUNT_ID + '{--ks-gold:var(--gold,#c9a24d);--ks-bg:var(--bg-alt,#1a1610);--ks-line:rgba(201,162,77,.22);' +
      '--ks-tl:var(--text-light,#f1e8d2);--ks-ts:var(--text-strong,#ece3cf);--ks-tb:var(--text-body,#cdc4b2);' +
      '--ks-tm:var(--text-muted,#aaa18d);--ks-td:var(--text-dim,#8a7d5c);' +
      "--ks-serif:var(--font-serif,'Cormorant Garamond',Georgia,serif);" +
      "--ks-title:var(--font-title,'Cinzel',Georgia,serif);" +
      "--ks-sans:var(--font-sans,'Space Grotesk',system-ui,sans-serif);color:var(--ks-tb);}" +
      '#' + MOUNT_ID + ' *{box-sizing:border-box;}' +
      '.ks-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;}' +
      '.ks-card{border:1px solid var(--ks-line);border-radius:16px;overflow:hidden;background:linear-gradient(160deg,rgba(201,162,77,.06),transparent);display:flex;flex-direction:column;}' +
      '.ks-affiche{width:100%;aspect-ratio:3/4;object-fit:cover;background:#0f0c07;border-bottom:1px solid var(--ks-line);}' +
      '.ks-body{padding:18px 20px 20px;}' +
      '.ks-type{font-family:var(--ks-sans);font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--ks-gold);font-weight:600;}' +
      '.ks-title{font-family:var(--ks-title);font-size:20px;font-weight:600;color:var(--ks-ts);margin:8px 0 4px;line-height:1.2;}' +
      '.ks-dates{font-family:var(--ks-serif);font-size:18px;color:var(--ks-tl);}' +
      '.ks-meta{font-family:var(--ks-serif);font-size:16px;color:var(--ks-tm);margin-top:4px;}' +
      '.ks-empty{font-family:var(--ks-serif);font-style:italic;font-size:18px;color:var(--ks-tm);padding:28px 4px;text-align:center;}' +
      '.ks-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;flex-wrap:wrap;}' +
      '.ks-btn{font-family:var(--ks-sans);font-weight:600;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;border:none;border-radius:11px;padding:11px 20px;background:var(--ks-gold);color:#0d0b07;}' +
      '.ks-btn.ghost{background:transparent;color:var(--ks-gold);border:1px solid var(--ks-line);}' +
      '.ks-modal{position:fixed;inset:0;z-index:99999;background:rgba(9,8,5,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;}' +
      '.ks-sheet{width:100%;max-width:440px;max-height:90vh;overflow:auto;background:var(--bg,#131009);border:1px solid var(--ks-line);border-radius:18px;padding:22px;}' +
      '.ks-sheet h3{font-family:var(--ks-title);color:var(--ks-ts);font-size:20px;margin:0 0 14px;font-weight:600;}' +
      '.ks-field{display:block;margin-bottom:12px;}' +
      '.ks-field span{display:block;font-family:var(--ks-sans);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ks-td);margin-bottom:5px;}' +
      '.ks-field input,.ks-field select{width:100%;font-family:var(--ks-sans);font-size:14px;color:var(--ks-tl);background:#0f0c07;border:1px solid var(--ks-line);border-radius:10px;padding:10px 12px;}' +
      '.ks-row{display:flex;gap:10px;justify-content:flex-end;margin-top:8px;}' +
      '.ks-err{color:#e08a7a;font-family:var(--ks-sans);font-size:12px;margin:6px 0;}';
    var el = document.createElement("style");
    el.id = "kanjo-stages-css"; el.textContent = css;
    document.head.appendChild(el);
  }

  function fmtDate(d) { return JOURS[d.getDay()] + " " + d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); }
  function fmtRange(start, end) {
    if (!start) return "";
    if (end && end.getTime() > start.getTime() + 1000) {
      // même mois → "12 – 14 avril 2026", sinon deux dates complètes
      if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear())
        return start.getDate() + " – " + end.getDate() + " " + MOIS[end.getMonth()] + " " + end.getFullYear();
      return fmtDate(start) + " → " + fmtDate(end);
    }
    return fmtDate(start);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]; }); }
  function toDate(v) { return v && typeof v.toDate === "function" ? v.toDate() : (v ? new Date(v) : null); }

  function render(db) {
    injectStyle();
    var startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    db.collection("stages").orderBy("date", "asc").get().then(function (snap) {
      var items = [];
      snap.forEach(function (doc) {
        var s = doc.data();
        var start = toDate(s.date), end = toDate(s.endDate);
        var ref = end || start;
        if (ref && ref.getTime() >= startOfToday.getTime()) items.push({ s: s, start: start, end: end });
      });
      var cards = items.map(function (it) {
        var s = it.s;
        var aff = s.afficheUrl ? '<img class="ks-affiche" src="' + esc(s.afficheUrl) + '" alt="Affiche ' + esc(s.title) + '" loading="lazy">' : "";
        return '<article class="ks-card">' + aff + '<div class="ks-body">' +
          '<div class="ks-type">' + esc(TYPE_LABEL[s.type] || "Stage") + '</div>' +
          '<div class="ks-title">' + esc(s.title || "Stage") + '</div>' +
          '<div class="ks-dates">' + esc(fmtRange(it.start, it.end)) + '</div>' +
          (s.instructor ? '<div class="ks-meta">avec ' + esc(s.instructor) + '</div>' : '') +
          '</div></article>';
      }).join("");
      mount.innerHTML =
        '<div class="ks-head">' +
        '<button class="ks-btn ghost" id="ks-add">+ Ajouter un stage</button>' +
        '</div>' +
        (cards ? '<div class="ks-grid">' + cards + '</div>' : '<div class="ks-empty">Aucun stage à venir pour le moment.</div>');
      var addBtn = document.getElementById("ks-add");
      if (addBtn) addBtn.onclick = function () { openForm(db); };
    }).catch(function (e) {
      mount.innerHTML = '<div class="ks-empty">Impossible de charger les stages.</div>';
      console.error("[kanjo-stages]", e);
    });
  }

  function openForm(db) {
    var wrap = document.createElement("div");
    wrap.className = "ks-modal";
    wrap.innerHTML =
      '<div class="ks-sheet"><h3>Ajouter un stage</h3>' +
      '<div class="ks-err" id="ks-e" style="display:none"></div>' +
      '<label class="ks-field"><span>Code prof (PIN)</span><input id="ks-pin" type="password" inputmode="numeric" placeholder="••••"></label>' +
      '<label class="ks-field"><span>Titre</span><input id="ks-title" placeholder="Stage de printemps"></label>' +
      '<label class="ks-field"><span>Type</span><select id="ks-tp"><option value="dojo">Au dojo</option><option value="national">Stage national</option><option value="international">Stage international</option></select></label>' +
      '<label class="ks-field"><span>Enseignant / intervenant</span><input id="ks-ins" placeholder="Nom du sensei"></label>' +
      '<label class="ks-field"><span>Date</span><input id="ks-d1" type="date"></label>' +
      '<label class="ks-field"><span>Date de fin (optionnel)</span><input id="ks-d2" type="date"></label>' +
      '<label class="ks-field"><span>Lien de l\'affiche (optionnel)</span><input id="ks-aff" placeholder="https://…"></label>' +
      '<div class="ks-row"><button class="ks-btn ghost" id="ks-cancel">Annuler</button><button class="ks-btn" id="ks-save">Enregistrer</button></div>' +
      '</div>';
    document.body.appendChild(wrap);
    function close() { wrap.remove(); }
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.getElementById("ks-cancel").onclick = close;
    function err(m) { var e = document.getElementById("ks-e"); e.textContent = m; e.style.display = "block"; }
    document.getElementById("ks-save").onclick = function () {
      var pin = document.getElementById("ks-pin").value.trim();
      var who = PROF_PINS[pin];
      if (!who) return err("Code PIN incorrect.");
      var title = document.getElementById("ks-title").value.trim();
      var d1 = document.getElementById("ks-d1").value;
      if (!title) return err("Le titre est requis.");
      if (!d1) return err("La date est requise.");
      var d2 = document.getElementById("ks-d2").value;
      var Ts = window.firebase.firestore.Timestamp;
      var payload = {
        title: title,
        type: document.getElementById("ks-tp").value,
        instructor: document.getElementById("ks-ins").value.trim(),
        date: Ts.fromDate(new Date(d1 + "T00:00:00")),
        endDate: d2 ? Ts.fromDate(new Date(d2 + "T00:00:00")) : null,
        afficheUrl: document.getElementById("ks-aff").value.trim() || null,
        recordedBy: who,
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
      };
      var btn = document.getElementById("ks-save"); btn.textContent = "…"; btn.disabled = true;
      db.collection("stages").add(payload).then(function () { close(); render(db); })
        .catch(function (e) { console.error(e); err("Échec de l'enregistrement."); btn.textContent = "Enregistrer"; btn.disabled = false; });
    };
  }

  var BASE = "https://www.gstatic.com/firebasejs/10.12.2/";
  function ensureFirebase() {
    if (window.firebase && window.firebase.firestore) return Promise.resolve();
    return loadScript(BASE + "firebase-app-compat.js").then(function () { return loadScript(BASE + "firebase-firestore-compat.js"); });
  }
  ensureFirebase()
    .then(function () {
      if (!window.firebase.apps || !window.firebase.apps.length) window.firebase.initializeApp(CONFIG);
      render(window.firebase.firestore());
    })
    .catch(function (e) { console.error("[kanjo-stages] init", e); mount.innerHTML = '<div class="ks-empty">Chargement impossible.</div>'; });
})();
