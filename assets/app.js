/* CTO Track — plain browser JS, no build step, no dependencies.
   State lives in localStorage under one key. Export monthly. */
(function () {
  "use strict";

  var KEY = "ctoTrack.v1";
  var TRACKS = window.TRACKS;
  var LADDER = window.LADDER;
  var LVLNAME = { F: "Foundation", P: "Practitioner", A: "Architect", L: "Leader" };

  var defaults = {
    done: {},      // lessonId -> true
    notes: {},     // lessonId -> string
    gates: {},     // gateId -> true
    ev: {},        // evidenceId -> { done: bool, note: string }
    comp: {},      // competencyId -> 0..5
    snaps: [],     // { d, learning, readiness, comp }
    prefs: { theme: "paper", accent: "#002FA7", fs: 1, font: "sans", density: "normal", motion: "on", focus: false },
    ai: { key: "", model: "claude-sonnet-5" }
  };

  var S = load();
  var view = "overview";
  var stage = "s1";
  var filter = "all";
  var query = "";

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      var p = JSON.parse(raw);
      var s = JSON.parse(JSON.stringify(defaults));
      Object.keys(defaults).forEach(function (k) {
        if (p[k] === undefined) return;
        if (k === "prefs" || k === "ai") { Object.keys(defaults[k]).forEach(function (j) { if (p[k][j] !== undefined) s[k][j] = p[k][j]; }); }
        else s[k] = p[k];
      });
      return s;
    } catch (e) { return JSON.parse(JSON.stringify(defaults)); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { alert("Could not save. Browser storage may be full or blocked in private mode."); }
  }

  /* ---------------- content helpers ---------------- */
  function trackList() { return [TRACKS.finance, TRACKS.tech]; }
  function allLessons() {
    var out = [];
    trackList().forEach(function (t) {
      t.modules.forEach(function (m) {
        m.lessons.forEach(function (l) { out.push({ l: l, m: m, t: t }); });
      });
    });
    return out;
  }
  var LESSONS = allLessons();
  function lessonById(id) {
    for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].l.id === id) return LESSONS[i];
    return null;
  }

  /* ---------------- maths ---------------- */
  function pct(a, b) { return b === 0 ? 0 : Math.round((a / b) * 100); }
  function modStats(m) {
    var d = 0;
    m.lessons.forEach(function (l) { if (S.done[l.id]) d++; });
    return { done: d, total: m.lessons.length, pct: pct(d, m.lessons.length) };
  }
  function trackStats(t) {
    var d = 0, n = 0;
    t.modules.forEach(function (m) { var s = modStats(m); d += s.done; n += s.total; });
    return { done: d, total: n, pct: pct(d, n) };
  }
  function learning() {
    var d = 0;
    LESSONS.forEach(function (x) { if (S.done[x.l.id]) d++; });
    return { done: d, total: LESSONS.length, pct: pct(d, LESSONS.length) };
  }
  function gateStats() {
    var d = 0, n = 0;
    LADDER.stages.forEach(function (st) {
      st.gates.forEach(function (g) { n++; if (S.gates[g.id]) d++; });
    });
    return { done: d, total: n, pct: pct(d, n) };
  }
  function stageStats(st) {
    var d = 0;
    st.gates.forEach(function (g) { if (S.gates[g.id]) d++; });
    return { done: d, total: st.gates.length, pct: pct(d, st.gates.length) };
  }
  function evStats() {
    var d = 0;
    LADDER.evidence.forEach(function (e) { if (S.ev[e.id] && S.ev[e.id].done) d++; });
    return { done: d, total: LADDER.evidence.length, pct: pct(d, LADDER.evidence.length) };
  }
  function compVal(id) { return S.comp[id] || 0; }
  function compAvg() {
    var sum = 0;
    LADDER.competencies.forEach(function (c) { sum += compVal(c.id); });
    return sum / LADDER.competencies.length;
  }
  function readiness() {
    var g = gateStats().pct, e = evStats().pct, c = (compAvg() / 5) * 100;
    return Math.round((g + e + c) / 3);
  }
  function overall() { return Math.round(readiness() * 0.6 + learning().pct * 0.4); }

  /* ---------------- small builders ---------------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fill(p) { return '<div class="fill"><i style="width:' + p + '%"></i></div>'; }
  function metric(label, figure, unit, note) {
    return '<div class="card metric"><div class="label">' + esc(label) + '</div>' +
      '<div class="fig">' + figure + (unit ? '<small> ' + esc(unit) + "</small>" : "") + "</div>" +
      (note ? '<div class="note">' + esc(note) + "</div>" : "") + "</div>";
  }

  /* ---------------- views ---------------- */
  function vOverview() {
    var L = learning(), g = gateStats(), e = evStats();
    var h = '<div class="head"><h2>Where you stand</h2><p>' + esc(LADDER.note) + "</p></div>";

    h += '<div class="grid g4">' +
      metric("Overall", overall() + "%", "", "Readiness weighted 60, learning 40") +
      metric("Ladder readiness", readiness() + "%", "", "Gates, evidence and self-rating") +
      metric("Gates cleared", g.done + '<small> / ' + g.total + "</small>", "", "Across five stages") +
      metric("Lessons done", L.done + '<small> / ' + L.total + "</small>", "", "Finance and technology") +
      "</div>";

    h += '<div class="grid g2" style="margin-top:var(--gap)">';
    h += '<div class="card"><h3>Tracks</h3><table><thead><tr><th>Track</th><th class="n">Done</th><th class="n">Total</th><th class="n">%</th></tr></thead><tbody>';
    trackList().forEach(function (t) {
      var s = trackStats(t);
      h += "<tr><td>" + esc(t.name) + '</td><td class="n">' + s.done + '</td><td class="n">' + s.total + '</td><td class="n">' + s.pct + "%</td></tr>";
    });
    h += '<tr><td>Evidence ledger</td><td class="n">' + e.done + '</td><td class="n">' + e.total + '</td><td class="n">' + e.pct + "%</td></tr>";
    h += "</tbody></table></div>";

    h += '<div class="card"><h3>Competency self-rating</h3>' + radar() +
      '<p class="meta" style="margin-top:10px">Self-ratings are evidence-anchored: a 4 or 5 should have a filled evidence row behind it. Rate in the Ladder view.</p></div>';
    h += "</div>";

    // next actions: lowest-rated competency, first unmet gate, first open gap
    var lowest = LADDER.competencies.slice().sort(function (a, b) { return compVal(a.id) - compVal(b.id); })[0];
    var nextGate = null;
    LADDER.stages.forEach(function (st) {
      st.gates.forEach(function (gg) { if (!nextGate && !S.gates[gg.id]) nextGate = { st: st, g: gg }; });
    });
    h += '<div class="card" style="margin-top:var(--gap)"><h3>Next three things</h3><table><tbody>';
    if (nextGate) h += "<tr><td>Next unmet gate</td><td>" + esc(nextGate.st.n + " " + nextGate.st.title) + " — " + esc(nextGate.g.t) + "</td></tr>";
    h += "<tr><td>Weakest competency</td><td>" + esc(lowest.name) + " at " + compVal(lowest.id) + " of 5 — " + esc(lowest.desc) + "</td></tr>";
    h += "<tr><td>Open gap</td><td>" + esc(LADDER.gaps[0].t) + " — " + esc(LADDER.gaps[0].first) + "</td></tr>";
    h += "</tbody></table></div>";

    if (S.snaps.length === 0) {
      h += '<div class="empty" style="margin-top:var(--gap)">No quarterly snapshot saved yet. Snapshots are how you see movement rather than mood. Save one from the Progress view.</div>';
    }
    return h;
  }

  function radar() {
    var cs = LADDER.competencies, n = cs.length, cx = 130, cy = 130, R = 96;
    var svg = '<svg viewBox="0 0 260 260" width="100%" style="max-width:340px;display:block" role="img" aria-label="Competency radar">';
    function pt(i, r) {
      var a = (Math.PI * 2 * i) / n - Math.PI / 2;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
    for (var ring = 1; ring <= 5; ring++) {
      var pts = [];
      for (var i = 0; i < n; i++) { var p = pt(i, (R * ring) / 5); pts.push(p[0].toFixed(1) + "," + p[1].toFixed(1)); }
      svg += '<polygon points="' + pts.join(" ") + '" fill="none" stroke="var(--rule)" stroke-width="1"/>';
    }
    for (var j = 0; j < n; j++) {
      var q = pt(j, R);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke="var(--rule)" stroke-width="1"/>';
      var lp = pt(j, R + 16);
      svg += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 4).toFixed(1) + '" font-size="10" fill="var(--ink-3)" text-anchor="middle">' + (j + 1) + "</text>";
    }
    var vp = [], any = false;
    for (var k = 0; k < n; k++) {
      var v = compVal(cs[k].id); if (v > 0) any = true;
      var pv = pt(k, (R * v) / 5);
      vp.push(pv[0].toFixed(1) + "," + pv[1].toFixed(1));
    }
    if (any) svg += '<polygon points="' + vp.join(" ") + '" fill="var(--accent)" fill-opacity="0.16" stroke="var(--accent)" stroke-width="1.5"/>';
    svg += "</svg>";
    var legend = '<div class="meta" style="margin-top:8px">';
    cs.forEach(function (c, i) { legend += (i ? " · " : "") + (i + 1) + " " + esc(c.name); });
    return svg + legend + "</div>";
  }

  function vLadder() {
    var st = null;
    LADDER.stages.forEach(function (x) { if (x.id === stage) st = x; });
    if (!st) st = LADDER.stages[0];

    var h = '<div class="head"><h2>The ladder</h2><p>Five stages, ordered by what each one forces you to learn. Titles vary between firms; the gates do not.</p></div>';

    h += '<div class="stagegrid">';
    LADDER.stages.forEach(function (x) {
      var s = stageStats(x);
      h += '<button class="stagecol" data-action="stage" data-id="' + x.id + '" aria-current="' + (x.id === st.id) + '">' +
        '<div><span class="folio">' + x.n + '</span></div>' +
        '<div><div class="t">' + esc(x.title) + '</div><div class="c">' + s.done + " / " + s.total + " gates</div></div></button>";
    });
    h += "</div>";

    var ss = stageStats(st);
    h += '<div class="card" style="margin-top:var(--gap)"><h3>' + st.n + " · " + esc(st.title) + "</h3>" +
      '<p class="meta">' + esc(st.from) + " → " + esc(st.to) + "</p><p>" + esc(st.shift) + "</p>" +
      fill(ss.pct) + '<p class="meta">' + ss.done + " of " + ss.total + " gates cleared</p>";
    st.gates.forEach(function (g) {
      var on = !!S.gates[g.id];
      h += '<label class="check' + (on ? " done" : "") + '" data-row="' + g.id + '"><input type="checkbox" data-action="gate" data-id="' + g.id + '"' + (on ? " checked" : "") + '><span class="t">' + esc(g.t) + "</span></label>";
    });
    h += '<p class="meta" style="margin-top:12px">Signals you are actually at this stage: ' + st.signals.map(esc).join(" · ") + "</p></div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>Competency self-rating</h3>' +
      '<p class="meta">0 none, 1 aware, 2 assisted, 3 independent, 4 leading others, 5 setting the standard. Anything above 3 needs an evidence row.</p>';
    LADDER.competencies.forEach(function (c) {
      h += '<div class="slider"><div><strong>' + esc(c.name) + "</strong><br><span class=\"meta\">" + esc(c.desc) + '</span></div>' +
        '<input type="range" min="0" max="5" step="1" value="' + compVal(c.id) + '" data-action="comp" data-id="' + c.id + '" aria-label="' + esc(c.name) + '">' +
        '<div class="v" data-v="' + c.id + '">' + compVal(c.id) + "</div></div>";
    });
    h += "</div>";

    var e = evStats();
    h += '<div class="card" style="margin-top:var(--gap)"><h3>Evidence ledger</h3>' +
      '<p class="meta">A claim without an artefact is not evidence. ' + e.done + " of " + e.total + " filled.</p>" + fill(e.pct);
    LADDER.competencies.forEach(function (c) {
      h += '<h4 style="margin-top:16px">' + esc(c.name) + "</h4>";
      LADDER.evidence.filter(function (x) { return x.c === c.id; }).forEach(function (x) {
        var rec = S.ev[x.id] || { done: false, note: "" };
        h += '<label class="check' + (rec.done ? " done" : "") + '" data-row="' + x.id + '"><input type="checkbox" data-action="ev" data-id="' + x.id + '"' + (rec.done ? " checked" : "") + '>' +
          '<span class="t">' + esc(x.t) + '<br><span class="meta">Proof: ' + esc(x.how) + "</span></span></label>";
        h += '<textarea data-action="evnote" data-id="' + x.id + '" placeholder="Where the artefact lives" style="margin:6px 0 10px">' + esc(rec.note) + "</textarea>";
      });
    });
    h += "</div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>Gap ledger</h3>' +
      '<p>The uncomfortable section. These are areas where deep technical work produces no evidence at all, and they are the usual reason architects stop below the executive line.</p>' +
      '<div class="scroll-x"><table><thead><tr><th>Gap</th><th>Why it blocks you</th><th>Smallest first move</th></tr></thead><tbody>';
    LADDER.gaps.forEach(function (g) {
      h += "<tr><td><strong>" + esc(g.t) + "</strong></td><td>" + esc(g.why) + "</td><td>" + esc(g.first) + "</td></tr>";
    });
    h += "</tbody></table></div></div>";
    return h;
  }

  function lessonHTML(l, m) {
    var on = !!S.done[l.id];
    var note = S.notes[l.id] || "";
    var h = '<div class="lesson' + (on ? " is-done" : "") + '" data-lesson="' + l.id + '">';
    h += '<div class="hd"><input type="checkbox" class="done" data-action="lesson" data-id="' + l.id + '"' + (on ? " checked" : "") + ' aria-label="Mark ' + esc(l.t) + ' done">' +
      '<button class="ttl" data-action="expand" data-id="' + l.id + '" aria-expanded="false">' + esc(l.t) + "</button>" +
      '<span class="tag ' + l.lvl + '" title="' + LVLNAME[l.lvl] + '">' + l.lvl + "</span></div>";
    h += '<div class="detail" hidden data-detail="' + l.id + '"><ul>';
    l.k.forEach(function (b) { h += "<li>" + esc(b) + "</li>"; });
    h += "</ul>";
    h += '<div class="doline"><strong>Do this:</strong> ' + esc(l.do) + "</div>";
    h += '<label for="n-' + l.id + '">Your note</label><textarea id="n-' + l.id + '" data-action="note" data-id="' + l.id + '" placeholder="What you learned, or where this bites in your own estate">' + esc(note) + "</textarea>";
    h += '<div class="row" style="margin-top:10px"><button class="btn small" data-action="ask" data-id="' + l.id + '">Ask about this lesson</button>' +
      '<span class="meta">' + LVLNAME[l.lvl] + " · " + esc(m.name) + "</span></div>";
    h += "</div></div>";
    return h;
  }

  function vTrack(t) {
    var s = trackStats(t);
    var h = '<div class="head"><h2>' + esc(t.name) + "</h2><p>" + esc(t.blurb) + "</p>" +
      '<div class="row" style="margin-top:12px">' +
      '<label>Level <select data-action="filter">' +
      ["all", "F", "P", "A", "L"].map(function (v) {
        return '<option value="' + v + '"' + (filter === v ? " selected" : "") + ">" + (v === "all" ? "All levels" : LVLNAME[v]) + "</option>";
      }).join("") + "</select></label>" +
      '<button class="btn small" data-action="expandall">Expand all</button>' +
      '<button class="btn small" data-action="collapseall">Collapse all</button>' +
      '<span class="meta">' + s.done + " of " + s.total + " lessons done</span></div>" + fill(s.pct) + "</div>";

    t.modules.forEach(function (m) {
      var lessons = m.lessons.filter(function (l) { return filter === "all" || l.lvl === filter; });
      var ms = modStats(m);
      h += '<details class="mod"' + (t.modules.length <= 3 ? " open" : "") + ">";
      h += "<summary><h3>" + esc(m.name) + '</h3><span class="meta">' + ms.done + " / " + ms.total + " · " + ms.pct + "%</span></summary>";
      h += '<div class="body"><p class="meta">' + esc(m.blurb) + "</p>";
      if (lessons.length === 0) h += '<div class="empty">No lessons at this level in this module.</div>';
      lessons.forEach(function (l) { h += lessonHTML(l, m); });
      h += "</div></details>";
    });
    return h;
  }

  function vSearch() {
    var q = query.toLowerCase();
    var hits = LESSONS.filter(function (x) {
      if (filter !== "all" && x.l.lvl !== filter) return false;
      var blob = (x.l.t + " " + x.l.k.join(" ") + " " + x.l.do + " " + x.m.name).toLowerCase();
      return blob.indexOf(q) !== -1;
    });
    var h = '<div class="head"><h2>Search</h2><p>' + hits.length + ' lessons match "' + esc(query) + '".</p></div>';
    if (hits.length === 0) return h + '<div class="empty">Nothing matched. Try a shorter term, or clear the box to go back.</div>';
    var byMod = {};
    hits.forEach(function (x) {
      var k = x.t.name + " · " + x.m.name;
      (byMod[k] = byMod[k] || []).push(x);
    });
    Object.keys(byMod).forEach(function (k) {
      h += '<div class="card" style="margin-bottom:var(--gap)"><h4>' + esc(k) + "</h4>";
      byMod[k].forEach(function (x) { h += lessonHTML(x.l, x.m); });
      h += "</div>";
    });
    return h;
  }

  function vProgress() {
    var L = learning();
    var h = '<div class="head"><h2>Progress</h2><p>Two numbers that mean different things. Learning is input. Readiness is what someone else could verify.</p></div>';
    h += '<div class="grid g3">' +
      metric("Learning", L.pct + "%", "", L.done + " of " + L.total + " lessons") +
      metric("Readiness", readiness() + "%", "", "Gates, evidence, self-rating") +
      metric("Overall", overall() + "%", "", "0.6 readiness + 0.4 learning") +
      "</div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>By module</h3><div class="scroll-x"><table><thead><tr><th>Track</th><th>Module</th><th class="n">Done</th><th class="n">Total</th><th class="n">%</th></tr></thead><tbody>';
    trackList().forEach(function (t) {
      t.modules.forEach(function (m) {
        var s = modStats(m);
        h += "<tr><td>" + esc(t.name) + "</td><td>" + esc(m.name) + '</td><td class="n">' + s.done + '</td><td class="n">' + s.total + '</td><td class="n">' + s.pct + "%</td></tr>";
      });
    });
    h += "</tbody></table></div></div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>By level</h3><div class="scroll-x"><table><thead><tr><th>Level</th><th class="n">Done</th><th class="n">Total</th><th class="n">%</th></tr></thead><tbody>';
    ["F", "P", "A", "L"].forEach(function (lv) {
      var tot = 0, dn = 0;
      LESSONS.forEach(function (x) { if (x.l.lvl === lv) { tot++; if (S.done[x.l.id]) dn++; } });
      h += "<tr><td>" + LVLNAME[lv] + '</td><td class="n">' + dn + '</td><td class="n">' + tot + '</td><td class="n">' + pct(dn, tot) + "%</td></tr>";
    });
    h += "</tbody></table></div></div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>Quarterly snapshots</h3>' +
      '<p class="meta">A snapshot freezes today\'s numbers so you can see movement across quarters instead of guessing.</p>' +
      '<div class="row"><button class="btn primary" data-action="snap">Save snapshot</button></div>';
    if (S.snaps.length === 0) h += '<div class="empty" style="margin-top:12px">No snapshots yet.</div>';
    else {
      h += '<div class="scroll-x" style="margin-top:12px"><table><thead><tr><th>Date</th><th class="n">Learning</th><th class="n">Readiness</th><th class="n">Avg rating</th><th></th></tr></thead><tbody>';
      S.snaps.slice().reverse().forEach(function (sn, i) {
        var idx = S.snaps.length - 1 - i;
        h += "<tr><td>" + esc(sn.d) + '</td><td class="n">' + sn.learning + '%</td><td class="n">' + sn.readiness + '%</td><td class="n">' + (sn.avg || 0).toFixed(1) +
          '</td><td class="n"><button class="btn small" data-action="delsnap" data-id="' + idx + '">Delete</button></td></tr>';
      });
      h += "</tbody></table></div>";
    }
    h += "</div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>Backup</h3>' +
      '<p>Everything is stored in this browser only. Clearing site data erases it. Export once a month and keep the file somewhere you actually back up.</p>' +
      '<div class="row"><button class="btn primary" data-action="export">Export JSON</button>' +
      '<button class="btn" data-action="importpick">Import JSON</button>' +
      '<input type="file" id="importfile" data-action="importfile" accept="application/json,.json" hidden>' +
      '<button class="btn" data-action="reset">Erase all progress</button></div>' +
      '<p class="meta">Import replaces everything currently stored. It does not merge.</p></div>';
    return h;
  }

  function vSettings() {
    var p = S.prefs;
    function opt(v, label, cur) { return '<option value="' + v + '"' + (cur === v ? " selected" : "") + ">" + label + "</option>"; }
    var h = '<div class="head"><h2>Settings</h2><p>Saved in this browser alongside your progress.</p></div>';

    h += '<div class="card"><h3>Appearance</h3><div class="grid g2" style="margin-top:12px">';
    h += "<div><label>Theme</label><select data-action=\"pref\" data-k=\"theme\">" +
      opt("paper", "Paper — pure white", p.theme) + opt("neutral", "Neutral grey", p.theme) +
      opt("blueprint", "Blueprint — cool blue-grey", p.theme) + opt("slate", "Slate — dark", p.theme) +
      opt("ink", "Ink — near black", p.theme) + opt("contrast", "High contrast", p.theme) + "</select></div>";
    h += "<div><label>Accent</label><select data-action=\"pref\" data-k=\"accent\">" +
      opt("#002FA7", "Klein blue", p.accent) + opt("#E4002B", "Swiss red", p.accent) +
      opt("#FF4F00", "International orange", p.accent) + opt("#00706B", "Deep teal", p.accent) +
      opt("#2B2B2B", "Graphite", p.accent) + "</select></div>";
    h += "<div><label>Text size</label><select data-action=\"pref\" data-k=\"fs\">" +
      opt("0.92", "Small", String(p.fs)) + opt("1", "Medium", String(p.fs)) +
      opt("1.1", "Large", String(p.fs)) + opt("1.22", "Extra large", String(p.fs)) + "</select></div>";
    h += "<div><label>Typeface</label><select data-action=\"pref\" data-k=\"font\">" +
      opt("sans", "Sans (Helvetica)", p.font) + opt("serif", "Serif (Georgia)", p.font) + opt("mono", "Monospace", p.font) + "</select></div>";
    h += "<div><label>Density</label><select data-action=\"pref\" data-k=\"density\">" +
      opt("tight", "Tight", p.density) + opt("normal", "Normal", p.density) + opt("roomy", "Roomy", p.density) + "</select></div>";
    h += "<div><label>Motion</label><select data-action=\"pref\" data-k=\"motion\">" +
      opt("on", "Transitions on", p.motion) + opt("off", "Reduced motion", p.motion) + "</select></div>";
    h += "</div>";
    h += '<label class="check" style="border:0"><input type="checkbox" data-action="focus"' + (p.focus ? " checked" : "") +
      '><span class="t">Focus mode — hide every progress figure while you read. Useful when the percentages start driving the behaviour.</span></label>';
    h += "</div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>AI tutor</h3>' +
      '<p>Optional. Paste an Anthropic API key to ask questions about any lesson. The key is stored in this browser only and is never committed to the repository.</p>' +
      '<p class="meta">Trade-off worth knowing: a key used from a browser page is visible to anything running on that page, and to anyone who opens your developer tools. Use a key with a low spend limit, and do not use a shared work key.</p>' +
      '<div class="grid g2" style="margin-top:12px">' +
      '<div><label for="aikey">API key</label><input id="aikey" type="password" value="' + esc(S.ai.key) + '" data-action="aikey" placeholder="sk-ant-..." autocomplete="off"></div>' +
      '<div><label for="aimodel">Model</label><input id="aimodel" type="text" value="' + esc(S.ai.model) + '" data-action="aimodel"></div>' +
      "</div></div>";

    h += '<div class="card" style="margin-top:var(--gap)"><h3>How the numbers are computed</h3><table><tbody>' +
      "<tr><td>Learning</td><td>Lessons marked done, over " + LESSONS.length + " total</td></tr>" +
      "<tr><td>Readiness</td><td>Mean of gate completion, evidence completion, and average self-rating over 5</td></tr>" +
      "<tr><td>Overall</td><td>0.6 × readiness + 0.4 × learning. Evidence is weighted higher because it is the part someone else can verify</td></tr>" +
      "</tbody></table></div>";
    return h;
  }

  /* ---------------- render ---------------- */
  var VIEWS = {
    overview: { label: "Where you stand", fn: vOverview },
    ladder: { label: "The ladder", fn: vLadder },
    finance: { label: "Finance", fn: function () { return vTrack(TRACKS.finance); } },
    tech: { label: "Technology", fn: function () { return vTrack(TRACKS.tech); } },
    progress: { label: "Progress", fn: vProgress },
    settings: { label: "Settings", fn: vSettings },
    search: { label: "Search", fn: vSearch }
  };

  function applyPrefs() {
    var p = S.prefs, r = document.documentElement;
    r.setAttribute("data-theme", p.theme);
    r.setAttribute("data-font", p.font);
    r.setAttribute("data-density", p.density);
    r.setAttribute("data-motion", p.motion);
    r.style.setProperty("--accent", p.accent);
    r.style.setProperty("--fs", p.fs);
    document.body.classList.toggle("focus-on", !!p.focus);
  }

  function navHTML() {
    var order = ["overview", "ladder", "finance", "tech", "progress", "settings"];
    var pcts = {
      ladder: readiness() + "%",
      finance: trackStats(TRACKS.finance).pct + "%",
      tech: trackStats(TRACKS.tech).pct + "%",
      overview: overall() + "%",
      progress: "", settings: ""
    };
    return order.map(function (v) {
      return '<button data-action="nav" data-id="' + v + '" aria-current="' + (view === v) + '"><span>' + VIEWS[v].label +
        '</span><span class="pct" data-live>' + (S.prefs.focus ? "" : pcts[v]) + "</span></button>";
    }).join("");
  }

  function render() {
    applyPrefs();
    document.getElementById("nav").innerHTML = navHTML();
    var host = document.getElementById("viewhost");
    host.innerHTML = VIEWS[view] ? VIEWS[view].fn() : vOverview();
    if (S.prefs.focus) {
      Array.prototype.forEach.call(host.querySelectorAll(".metric, .fill"), function (n) { n.style.display = "none"; });
    }
    host.scrollIntoView({ block: "start" });
    var sf = document.getElementById("stamp");
    var L = learning();
    sf.textContent = L.done + " lessons · " + gateStats().done + " gates · " + evStats().done + " evidence rows";
  }

  function refreshCounters() {
    document.getElementById("nav").innerHTML = navHTML();
    var L = learning();
    document.getElementById("stamp").textContent = L.done + " lessons · " + gateStats().done + " gates · " + evStats().done + " evidence rows";
  }

  function go(v) { view = v; render(); }

  /* ---------------- events ---------------- */
  var noteTimer = null;
  function debouncedSave() {
    if (noteTimer) clearTimeout(noteTimer);
    noteTimer = setTimeout(save, 400);
  }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var a = el.getAttribute("data-action"), id = el.getAttribute("data-id");

    if (a === "nav") { go(id); collapseSideOnMobile(); }
    else if (a === "stage") { stage = id; render(); }
    else if (a === "expand") {
      var d = document.querySelector('[data-detail="' + id + '"]');
      var open = d.hasAttribute("hidden");
      if (open) d.removeAttribute("hidden"); else d.setAttribute("hidden", "");
      el.setAttribute("aria-expanded", String(open));
    }
    else if (a === "expandall" || a === "collapseall") {
      Array.prototype.forEach.call(document.querySelectorAll("details.mod"), function (n) { n.open = a === "expandall"; });
    }
    else if (a === "snap") {
      S.snaps.push({ d: new Date().toISOString().slice(0, 10), learning: learning().pct, readiness: readiness(), avg: compAvg(), comp: JSON.parse(JSON.stringify(S.comp)) });
      save(); render();
    }
    else if (a === "delsnap") {
      if (confirm("Delete this snapshot?")) { S.snaps.splice(Number(id), 1); save(); render(); }
    }
    else if (a === "export") exportJSON();
    else if (a === "importpick") document.getElementById("importfile").click();
    else if (a === "reset") {
      if (confirm("Erase all progress, notes, evidence and snapshots from this browser? This cannot be undone.")) {
        S = JSON.parse(JSON.stringify(defaults)); save(); render();
      }
    }
    else if (a === "ask") openAsk(id);
    else if (a === "askclose") document.getElementById("drawer").setAttribute("hidden", "");
    else if (a === "askopen") openAsk(null);
    else if (a === "asksend") sendAsk();
    else if (a === "burger") {
      var side = document.getElementById("side");
      side.setAttribute("data-collapsed", side.getAttribute("data-collapsed") === "true" ? "false" : "true");
    }
  });

  document.addEventListener("change", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var a = el.getAttribute("data-action"), id = el.getAttribute("data-id");

    if (a === "lesson") {
      if (el.checked) S.done[id] = true; else delete S.done[id];
      var row = el.closest(".lesson");
      if (row) row.classList.toggle("is-done", el.checked);
      save(); refreshCounters();
    }
    else if (a === "gate") {
      if (el.checked) S.gates[id] = true; else delete S.gates[id];
      var r1 = el.closest(".check"); if (r1) r1.classList.toggle("done", el.checked);
      save(); refreshCounters();
    }
    else if (a === "ev") {
      S.ev[id] = S.ev[id] || { done: false, note: "" };
      S.ev[id].done = el.checked;
      var r2 = el.closest(".check"); if (r2) r2.classList.toggle("done", el.checked);
      save(); refreshCounters();
    }
    else if (a === "comp") { S.comp[id] = Number(el.value); save(); refreshCounters(); }
    else if (a === "filter") { filter = el.value; render(); }
    else if (a === "pref") {
      var k = el.getAttribute("data-k");
      S.prefs[k] = k === "fs" ? Number(el.value) : el.value;
      save(); applyPrefs();
    }
    else if (a === "focus") { S.prefs.focus = el.checked; save(); render(); }
    else if (a === "importfile") handleImport(el);
  });

  document.addEventListener("input", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var a = el.getAttribute("data-action"), id = el.getAttribute("data-id");
    if (a === "note") { S.notes[id] = el.value; debouncedSave(); }
    else if (a === "evnote") { S.ev[id] = S.ev[id] || { done: false, note: "" }; S.ev[id].note = el.value; debouncedSave(); }
    else if (a === "comp") { var v = document.querySelector('[data-v="' + id + '"]'); if (v) v.textContent = el.value; }
    else if (a === "aikey") { S.ai.key = el.value.trim(); debouncedSave(); }
    else if (a === "aimodel") { S.ai.model = el.value.trim(); debouncedSave(); }
  });

  function collapseSideOnMobile() {
    if (window.innerWidth <= 900) document.getElementById("side").setAttribute("data-collapsed", "true");
  }

  var searchTimer = null;
  document.getElementById("q").addEventListener("input", function (e) {
    query = e.target.value;
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      if (query.trim().length >= 2) { view = "search"; render(); }
      else if (view === "search") { view = "overview"; render(); }
    }, 220);
  });

  function handleImport(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var p = JSON.parse(rd.result);
        if (!p || typeof p !== "object" || (p.done === undefined && p.gates === undefined)) throw new Error("bad");
        if (!confirm("Import replaces everything currently stored in this browser. Continue?")) return;
        localStorage.setItem(KEY, JSON.stringify(p));
        S = load(); save(); render();
        alert("Import complete.");
      } catch (err) { alert("That file is not a valid export from this app."); }
      input.value = "";
    };
    rd.readAsText(f);
  }

  function exportJSON() {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cto-track-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------------- AI tutor ---------------- */
  var askContext = null;
  function openAsk(lessonId) {
    askContext = lessonId ? lessonById(lessonId) : null;
    var d = document.getElementById("drawer");
    d.removeAttribute("hidden");
    document.getElementById("askctx").textContent = askContext
      ? askContext.t.name + " · " + askContext.m.name + " · " + askContext.l.t
      : "No lesson selected — ask anything from the curriculum.";
    document.getElementById("askout").textContent = "";
    var box = document.getElementById("askq");
    box.value = askContext ? "Explain this in more depth, with one concrete enterprise example." : "";
    box.focus();
  }

  function sendAsk() {
    var q = document.getElementById("askq").value.trim();
    var out = document.getElementById("askout");
    if (!q) { out.textContent = "Type a question first."; return; }
    if (!S.ai.key) { out.textContent = "No API key saved. Add one in Settings to use the tutor."; return; }
    var ctx = "";
    if (askContext) {
      ctx = "Lesson: " + askContext.l.t + "\nModule: " + askContext.m.name +
        "\nLevel: " + LVLNAME[askContext.l.lvl] + "\nKey points:\n- " + askContext.l.k.join("\n- ") +
        "\nExercise: " + askContext.l.do + "\n\n";
    }
    out.textContent = "Thinking...";
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": S.ai.key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: S.ai.model || "claude-sonnet-5",
        max_tokens: 1200,
        system: "You tutor an experienced enterprise architect working toward a CTO role in a large IT services firm. Be direct and concrete. Correct wrong assumptions in the question rather than working around them. Use enterprise examples. No flattery, no preamble. Keep it under 400 words unless asked for more.",
        messages: [{ role: "user", content: ctx + "Question: " + q }]
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) {
          out.textContent = "Request failed: " + ((res.j && res.j.error && res.j.error.message) || "check the key, the model name, and your spend limit.");
          return;
        }
        var text = (res.j.content || []).filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join("\n");
        out.textContent = text || "Empty response.";
      })
      .catch(function () {
        out.textContent = "Network or CORS error. Browser calls need the direct-browser-access header, which this app sends; if it still fails the key or network is blocked.";
      });
  }

  /* ---------------- boot ---------------- */
  document.getElementById("q").placeholder = "Search " + LESSONS.length + " lessons";
  render();
  window.CTOTRACK = { state: function () { return S; }, learning: learning, readiness: readiness, overall: overall, lessons: LESSONS, render: render, go: go };
})();
