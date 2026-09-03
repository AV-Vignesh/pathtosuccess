/* CTO Track — plain browser JS, no build step, no dependencies. */
(function () {
  "use strict";

  var KEY = "ctoTrack.v1";
  var TRACKS = window.TRACKS;
  var LADDER = window.LADDER;
  var LVL = { F: "Foundation", P: "Practitioner", A: "Architect", L: "Leader" };
  var SHORT = { c1: "Arch", c2: "Delivery", c3: "Commercial", c4: "Talent", c5: "Client", c6: "Partner", c7: "IP", c8: "Market", c9: "Risk", c10: "Innovation" };
  var THEMES = [
    { id: "midnight", name: "Midnight", sw: "#08090a" },
    { id: "graphite", name: "Graphite", sw: "#17181b" },
    { id: "slate", name: "Slate", sw: "#111725" },
    { id: "dim", name: "Dim", sw: "#212327" },
    { id: "light", name: "Light", sw: "#ffffff" },
    { id: "contrast", name: "Contrast", sw: "#000000" }
  ];
  var ACCENTS = ["#5E6AD2", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];

  var defaults = {
    done: {}, notes: {}, gates: {}, ev: {}, comp: {}, snaps: [],
    prefs: { theme: "midnight", accent: "#5E6AD2", fs: 1, font: "ui", density: "normal", motion: "on", focus: false },
    ai: { key: "", model: "claude-sonnet-5" }
  };

  var S = load();
  var view = "overview";
  var stage = "s1";
  var tab = "gates";
  var mod = { finance: "all", tech: "all" };
  var filter = "all";
  var query = "";

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      var p = JSON.parse(raw), s = JSON.parse(JSON.stringify(defaults));
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

  /* ---------------- content ---------------- */
  function tracks() { return [TRACKS.finance, TRACKS.tech]; }
  var LESSONS = (function () {
    var o = [];
    tracks().forEach(function (t) { t.modules.forEach(function (m) { m.lessons.forEach(function (l) { o.push({ l: l, m: m, t: t }); }); }); });
    return o;
  })();
  function lessonById(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].l.id === id) return LESSONS[i]; return null; }

  /* ---------------- maths ---------------- */
  function pc(a, b) { return b === 0 ? 0 : Math.round((a / b) * 100); }
  function modStats(m) { var d = 0; m.lessons.forEach(function (l) { if (S.done[l.id]) d++; }); return { done: d, total: m.lessons.length, pct: pc(d, m.lessons.length) }; }
  function trackStats(t) { var d = 0, n = 0; t.modules.forEach(function (m) { var s = modStats(m); d += s.done; n += s.total; }); return { done: d, total: n, pct: pc(d, n) }; }
  function learning() { var d = 0; LESSONS.forEach(function (x) { if (S.done[x.l.id]) d++; }); return { done: d, total: LESSONS.length, pct: pc(d, LESSONS.length) }; }
  function stageStats(st) { var d = 0; st.gates.forEach(function (g) { if (S.gates[g.id]) d++; }); return { done: d, total: st.gates.length, pct: pc(d, st.gates.length) }; }
  function gateStats() { var d = 0, n = 0; LADDER.stages.forEach(function (st) { st.gates.forEach(function (g) { n++; if (S.gates[g.id]) d++; }); }); return { done: d, total: n, pct: pc(d, n) }; }
  function evStats() { var d = 0; LADDER.evidence.forEach(function (e) { if (S.ev[e.id] && S.ev[e.id].done) d++; }); return { done: d, total: LADDER.evidence.length, pct: pc(d, LADDER.evidence.length) }; }
  function compVal(id) { return S.comp[id] || 0; }
  function compAvg() { var s = 0; LADDER.competencies.forEach(function (c) { s += compVal(c.id); }); return s / LADDER.competencies.length; }
  function readiness() { return Math.round((gateStats().pct + evStats().pct + (compAvg() / 5) * 100) / 3); }
  function overall() { return Math.round(readiness() * 0.6 + learning().pct * 0.4); }

  /* ---------------- html helpers ---------------- */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function bar(p, cls) { return '<div class="bar' + (cls ? " " + cls : "") + '"><i style="width:' + p + '%"></i></div>'; }
  function stat(k, v, unit, n) {
    return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + v + (unit ? "<i>" + esc(unit) + "</i>" : "") + "</div>" +
      (n ? '<div class="n">' + esc(n) + "</div>" : "") + "</div>";
  }
  function tick(action, id, on, label) {
    return '<span class="tick"><input type="checkbox" data-action="' + action + '" data-id="' + id + '"' + (on ? " checked" : "") +
      ' aria-label="' + esc(label) + '"><span></span></span>';
  }
  function seg(action, items, cur) {
    return '<div class="seg" role="tablist">' + items.map(function (i) {
      return '<button role="tab" data-action="' + action + '" data-id="' + i[0] + '" aria-selected="' + (cur === i[0]) + '">' + esc(i[1]) + "</button>";
    }).join("") + "</div>";
  }

  /* ---------------- charts ---------------- */
  function radar() {
    var cs = LADDER.competencies, n = cs.length, cx = 150, cy = 142, R = 100;
    function pt(i, r) { var a = (Math.PI * 2 * i) / n - Math.PI / 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
    var s = '<svg viewBox="0 0 300 290" width="100%" style="display:block;max-width:420px;margin:0 auto" role="img" aria-label="Competency radar">';
    for (var ring = 1; ring <= 5; ring++) {
      var p = [];
      for (var i = 0; i < n; i++) { var q = pt(i, (R * ring) / 5); p.push(q[0].toFixed(1) + "," + q[1].toFixed(1)); }
      s += '<polygon points="' + p.join(" ") + '" fill="none" stroke="var(--line)" stroke-width="1"/>';
    }
    for (var j = 0; j < n; j++) {
      var e = pt(j, R);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" stroke="var(--line)"/>';
      var lp = pt(j, R + 22), anch = lp[0] > cx + 6 ? "start" : (lp[0] < cx - 6 ? "end" : "middle");
      s += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 3.5).toFixed(1) + '" font-size="9.5" fill="var(--text-3)" text-anchor="' + anch + '">' + esc(SHORT[cs[j].id]) + "</text>";
    }
    var vp = [], any = false;
    for (var k = 0; k < n; k++) {
      var v = compVal(cs[k].id); if (v > 0) any = true;
      var pv = pt(k, (R * v) / 5); vp.push(pv[0].toFixed(1) + "," + pv[1].toFixed(1));
    }
    if (any) {
      s += '<polygon points="' + vp.join(" ") + '" fill="var(--accent)" fill-opacity="0.22" stroke="var(--accent)" stroke-width="1.75"/>';
      for (var m2 = 0; m2 < n; m2++) {
        if (compVal(cs[m2].id) === 0) continue;
        var dp = pt(m2, (R * compVal(cs[m2].id)) / 5);
        s += '<circle cx="' + dp[0].toFixed(1) + '" cy="' + dp[1].toFixed(1) + '" r="2.6" fill="var(--accent)"/>';
      }
    }
    s += "</svg>";
    if (!any) s += '<p class="faint" style="text-align:center">Rate yourself in Ladder → Competencies to fill this.</p>';
    return s;
  }

  function trend() {
    if (S.snaps.length < 2) return '<div class="empty">Save at least two snapshots to see movement.</div>';
    var W = 560, H = 150, pad = 26, n = S.snaps.length;
    function line(key, colour) {
      var d = S.snaps.map(function (s, i) {
        var x = pad + (i * (W - pad * 2)) / (n - 1);
        var y = H - pad - ((s[key] || 0) / 100) * (H - pad * 2);
        return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      }).join(" ");
      return '<path d="' + d + '" fill="none" stroke="' + colour + '" stroke-width="2" stroke-linecap="round"/>';
    }
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" style="display:block" role="img" aria-label="Snapshot trend">';
    [0, 50, 100].forEach(function (v) {
      var y = H - pad - (v / 100) * (H - pad * 2);
      s += '<line x1="' + pad + '" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '" stroke="var(--line)"/>';
      s += '<text x="4" y="' + (y + 3) + '" font-size="9" fill="var(--text-3)">' + v + "</text>";
    });
    s += line("readiness", "var(--accent)") + line("learning", "var(--good)") + "</svg>";
    s += '<div class="legend"><div><b style="color:var(--accent)">—</b> Readiness</div><div><b style="color:var(--good)">—</b> Learning</div>' +
      '<div class="faint">' + esc(S.snaps[0].d) + " → " + esc(S.snaps[n - 1].d) + "</div></div>";
    return s;
  }

  /* ---------------- overview ---------------- */
  function vOverview() {
    var L = learning(), g = gateStats(), e = evStats();
    var h = '<div class="hero block"><div class="lead">' +
      '<div><div class="cap">Overall readiness</div><div class="big">' + overall() + "<i>%</i></div></div>" +
      '<div class="split">' +
      "<div><small class=\"cap\">Ladder</small><span>" + readiness() + "%</span></div>" +
      "<div><small class=\"cap\">Curriculum</small><span>" + L.pct + "%</span></div>" +
      "<div><small class=\"cap\">Gates</small><span>" + g.done + " / " + g.total + "</span></div>" +
      "<div><small class=\"cap\">Evidence</small><span>" + e.done + " / " + e.total + "</span></div>" +
      "</div></div>" + bar(overall()) +
      "<p>" + esc(LADDER.note) + "</p></div>";

    var lowest = LADDER.competencies.slice().sort(function (a, b) { return compVal(a.id) - compVal(b.id); })[0];
    var next = null;
    LADDER.stages.forEach(function (st) { st.gates.forEach(function (gg) { if (!next && !S.gates[gg.id]) next = { st: st, g: gg }; }); });

    h += '<div class="grid auto block">' +
      stat("Lessons done", L.done, "/ " + L.total, "Finance and technology") +
      stat("Avg self-rating", compAvg().toFixed(1), "/ 5", "Across 10 competencies") +
      stat("Stage in progress", (next ? next.st.n : "05"), "", next ? next.st.title : "All gates cleared") +
      stat("Snapshots", S.snaps.length, "", S.snaps.length ? "Last " + S.snaps[S.snaps.length - 1].d : "None saved yet") +
      "</div>";

    h += '<div class="grid two block">';
    h += '<div class="card"><div class="cardhd"><h3>Do these next</h3><span class="faint">Lowest-hanging evidence</span></div><div class="list">';
    if (next) h += rowPlain(next.st.n + " · " + next.st.title, next.g.t, "Gate");
    h += rowPlain(lowest.name + " — rated " + compVal(lowest.id) + " of 5", lowest.desc, "Rating");
    h += rowPlain(LADDER.gaps[0].t, LADDER.gaps[0].first, "Gap");
    h += "</div></div>";
    h += '<div class="card"><div class="cardhd"><h3>Competency shape</h3><span class="faint">' + compAvg().toFixed(1) + " avg</span></div>" + radar() + "</div>";
    h += "</div>";

    h += '<div class="card block"><div class="cardhd"><h3>Curriculum coverage</h3><span class="faint">' + L.done + " of " + L.total + "</span></div>" +
      '<div class="tblwrap"><table><thead><tr><th>Module</th><th>Track</th><th class="n">Done</th><th style="width:110px">Progress</th><th class="n">%</th></tr></thead><tbody>';
    tracks().forEach(function (t) {
      t.modules.forEach(function (m) {
        var s = modStats(m);
        h += "<tr><td>" + esc(m.name) + '</td><td class="w">' + esc(t.name) + '</td><td class="n">' + s.done + " / " + s.total +
          "</td><td>" + bar(s.pct, "tiny") + '</td><td class="n">' + s.pct + "%</td></tr>";
      });
    });
    h += "</tbody></table></div></div>";
    return h;
  }
  function rowPlain(title, sub, kind) {
    return '<div class="item"><div class="line"><span class="pill ' + (kind === "Gate" ? "P" : kind === "Gap" ? "L" : "A") + '">' + esc(kind) +
      '</span><span class="txt"><span>' + esc(title) + '</span><span class="sub">' + esc(sub) + "</span></span></div></div>";
  }

  /* ---------------- ladder ---------------- */
  function vLadder() {
    var st = LADDER.stages[0];
    LADDER.stages.forEach(function (x) { if (x.id === stage) st = x; });
    var g = gateStats(), e = evStats();

    var h = '<div class="pagehd spread"><div><h1>The ladder</h1><p>Five stages ordered by what each one forces you to learn. Titles vary between firms; the gates do not.</p></div>' +
      seg("tab", [["gates", "Gates " + g.done + "/" + g.total], ["rate", "Competencies"], ["ev", "Evidence " + e.done + "/" + e.total], ["gaps", "Gap ledger"]], tab) + "</div>";

    if (tab === "gates") {
      h += '<div class="stages block">';
      LADDER.stages.forEach(function (x) {
        var s = stageStats(x);
        h += '<button class="stagebtn" data-action="stage" data-id="' + x.id + '" aria-current="' + (x.id === st.id) + '">' +
          '<div class="no">' + x.n + '</div><div class="nm">' + esc(x.title) + '</div><div class="ct">' + s.done + " / " + s.total + "</div></button>";
      });
      h += "</div>";

      var ss = stageStats(st);
      h += '<div class="card block"><div class="cardhd"><div><h3>' + esc(st.title) + '</h3><span class="faint">' + esc(st.from) + " → " + esc(st.to) + "</span></div>" +
        '<span class="faint">' + ss.done + " of " + ss.total + "</span></div>" +
        '<p style="margin-bottom:12px">' + esc(st.shift) + "</p>" + bar(ss.pct) + "</div>";

      h += '<div class="list block"><div class="grp"><span>Gates</span><span>' + ss.pct + "%</span></div>";
      st.gates.forEach(function (gg) {
        var on = !!S.gates[gg.id];
        h += '<div class="item' + (on ? " on" : "") + '"><label class="line">' + tick("gate", gg.id, on, gg.t) +
          '<span class="txt"><span>' + esc(gg.t) + "</span></span></label></div>";
      });
      h += "</div>";
      h += '<div class="callout block"><b>You are actually at this stage when:</b> ' + st.signals.map(esc).join(" · ") + "</div>";
    }

    if (tab === "rate") {
      h += '<div class="grid two block"><div class="card">' + radar() + "</div>" +
        '<div class="card"><h3>Scale</h3><p>0 none · 1 aware · 2 assisted · 3 independent · 4 leading others · 5 setting the standard.</p>' +
        '<div class="callout">Anything above 3 should have a filled evidence row behind it. Self-rating without evidence is just mood.</div></div></div>';
      h += '<div class="list block"><div class="grp"><span>Competencies</span><span>' + compAvg().toFixed(1) + " avg</span></div>";
      LADDER.competencies.forEach(function (c) {
        h += '<div class="rate"><div><b>' + esc(c.name) + '</b><span class="d">' + esc(c.desc) + "</span></div>" +
          '<input type="range" min="0" max="5" step="1" value="' + compVal(c.id) + '" data-action="comp" data-id="' + c.id + '" aria-label="' + esc(c.name) + '">' +
          '<div class="v" data-v="' + c.id + '">' + compVal(c.id) + "</div></div>";
      });
      h += "</div>";
    }

    if (tab === "ev") {
      h += '<div class="card block"><div class="cardhd"><h3>Evidence ledger</h3><span class="faint">' + e.done + " of " + e.total + "</span></div>" +
        "<p>A claim without an artefact is not evidence. Record where the proof lives, not what you remember doing.</p>" + bar(e.pct) + "</div>";
      LADDER.competencies.forEach(function (c) {
        var rows = LADDER.evidence.filter(function (x) { return x.c === c.id; });
        var dn = rows.filter(function (x) { return S.ev[x.id] && S.ev[x.id].done; }).length;
        h += '<div class="list block"><div class="grp"><span>' + esc(c.name) + "</span><span>" + dn + " / " + rows.length + "</span></div>";
        rows.forEach(function (x) {
          var rec = S.ev[x.id] || { done: false, note: "" };
          h += '<div class="item' + (rec.done ? " on" : "") + '"><label class="line">' + tick("ev", x.id, rec.done, x.t) +
            '<span class="txt"><span>' + esc(x.t) + '</span><span class="sub">Proof: ' + esc(x.how) + "</span></span></label>" +
            '<div class="detail" style="padding-top:0"><textarea data-action="evnote" data-id="' + x.id + '" placeholder="Where the artefact lives">' + esc(rec.note) + "</textarea></div></div>";
        });
        h += "</div>";
      });
    }

    if (tab === "gaps") {
      h += '<div class="card block"><h3>Gap ledger</h3><p>The uncomfortable section. These are the areas where deep technical work produces no evidence at all, and they are the usual reason architects stop below the executive line.</p></div>';
      h += '<div class="tblwrap block"><table><thead><tr><th>Gap</th><th>Why it blocks you</th><th>Smallest first move</th></tr></thead><tbody>';
      LADDER.gaps.forEach(function (x) {
        h += "<tr><td><strong>" + esc(x.t) + '</strong></td><td class="w">' + esc(x.why) + '</td><td class="w">' + esc(x.first) + "</td></tr>";
      });
      h += "</tbody></table></div>";
    }
    return h;
  }

  /* ---------------- curriculum ---------------- */
  function lessonHTML(x) {
    var l = x.l, on = !!S.done[l.id], note = S.notes[l.id] || "";
    var h = '<div class="item' + (on ? " on" : "") + '" data-lesson="' + l.id + '"><div class="line">' +
      tick("lesson", l.id, on, l.t) +
      '<button class="ttl" data-action="expand" data-id="' + l.id + '" aria-expanded="false">' + esc(l.t) + "</button>" +
      '<span class="pill ' + l.lvl + '" title="' + LVL[l.lvl] + '">' + l.lvl + "</span></div>";
    h += '<div class="detail" hidden data-detail="' + l.id + '">' +
      (l.f ? '<div class="formula"><span class="tagline">Formula</span>' + esc(l.f) + "</div>" : "") +
      "<ul>" + l.k.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" +
      (l.ex ? '<div class="worked"><span class="tagline">Worked example</span>' + esc(l.ex) + "</div>" : "") +
      '<div class="doline"><b>Do this</b> — ' + esc(l.do) + "</div>" +
      '<textarea data-action="note" data-id="' + l.id + '" placeholder="Your note: where this bites in your own estate">' + esc(note) + "</textarea>" +
      '<div class="row" style="margin-top:9px"><button class="btn sm" data-action="ask" data-id="' + l.id + '">Ask about this</button>' +
      '<span class="faint">' + LVL[l.lvl] + " · " + esc(x.m.name) + "</span></div></div></div>";
    return h;
  }

  function vTrack(t) {
    var s = trackStats(t), sel = mod[t.id];
    var h = '<div class="pagehd"><h1>' + esc(t.name) + "</h1><p>" + esc(t.blurb) + "</p></div>";

    h += '<div class="grid auto block">' +
      stat("Track progress", s.pct, "%", s.done + " of " + s.total + " lessons") +
      stat("Modules", t.modules.length, "", "Pick one below to focus") +
      stat("Level filter", filter === "all" ? "All" : LVL[filter], "", "Foundation to Leader") +
      "</div>";

    h += '<div class="spread block">' +
      seg("filter", [["all", "All levels"], ["F", "Foundation"], ["P", "Practitioner"], ["A", "Architect"], ["L", "Leader"]], filter) + "</div>";

    h += '<div class="chips block"><button class="chip" data-action="mod" data-id="all" aria-pressed="' + (sel === "all") + '">All modules <b>' + s.done + "/" + s.total + "</b></button>";
    t.modules.forEach(function (m) {
      var ms = modStats(m);
      h += '<button class="chip" data-action="mod" data-id="' + m.id + '" aria-pressed="' + (sel === m.id) + '">' + esc(m.name) + " <b>" + ms.done + "/" + ms.total + "</b></button>";
    });
    h += "</div>";

    var shown = t.modules.filter(function (m) { return sel === "all" || m.id === sel; });
    var any = 0;
    shown.forEach(function (m) {
      var ls = m.lessons.filter(function (l) { return filter === "all" || l.lvl === filter; });
      if (!ls.length) return;
      any += ls.length;
      var ms = modStats(m);
      h += '<div class="list block"><div class="grp"><span>' + esc(m.name) + "</span><span>" + ms.done + " / " + ms.total + " · " + ms.pct + "%</span></div>";
      if (sel !== "all") h += '<div class="item"><div class="line"><span class="txt sub" style="color:var(--text-3)">' + esc(m.blurb) + "</span></div></div>";
      ls.forEach(function (l) { h += lessonHTML({ l: l, m: m, t: t }); });
      h += "</div>";
    });
    if (!any) h += '<div class="empty">No lessons match this level in the selected module.</div>';
    return h;
  }

  function vSearch() {
    var q = query.toLowerCase();
    var hits = LESSONS.filter(function (x) {
      if (filter !== "all" && x.l.lvl !== filter) return false;
      return (x.l.t + " " + x.l.k.join(" ") + " " + x.l.do + " " + x.m.name).toLowerCase().indexOf(q) !== -1;
    });
    var h = '<div class="pagehd"><h1>Search</h1><p>' + hits.length + ' of ' + LESSONS.length + ' lessons match "' + esc(query) + '".</p></div>';
    h += '<div class="block">' + seg("filter", [["all", "All levels"], ["F", "Foundation"], ["P", "Practitioner"], ["A", "Architect"], ["L", "Leader"]], filter) + "</div>";
    if (!hits.length) return h + '<div class="empty">Nothing matched. Try a shorter term, or clear the box.</div>';
    var by = {};
    hits.forEach(function (x) { var k = x.m.name; (by[k] = by[k] || []).push(x); });
    Object.keys(by).forEach(function (k) {
      h += '<div class="list block"><div class="grp"><span>' + esc(k) + "</span><span>" + by[k].length + "</span></div>";
      by[k].forEach(function (x) { h += lessonHTML(x); });
      h += "</div>";
    });
    return h;
  }

  function vFormulas() {
    var rows = LESSONS.filter(function (x) { return x.l.f; });
    var q = query.trim().toLowerCase();
    var h = '<div class="pagehd"><h1>Formula sheet</h1><p>Every formula in the curriculum on one page, with its worked example. ' + rows.length + ' entries. Tick marks carry over from the lessons.</p></div>';
    var by = {};
    rows.forEach(function (x) { (by[x.m.name] = by[x.m.name] || []).push(x); });
    Object.keys(by).forEach(function (k) {
      h += '<div class="card block"><div class="cardhd"><h3>' + esc(k) + '</h3><span class="faint">' + by[k].length + " formulas</span></div>" +
        '<div class="tblwrap"><table><thead><tr><th style="width:24%">Metric</th><th style="width:38%">Formula</th><th>Worked example</th></tr></thead><tbody>';
      by[k].forEach(function (x) {
        var on = !!S.done[x.l.id];
        h += "<tr" + (on ? ' style="opacity:.55"' : "") + "><td><strong>" + esc(x.l.t) + '</strong> <span class="pill ' + x.l.lvl + '">' + x.l.lvl + "</span></td>" +
          '<td class="fx">' + esc(x.l.f) + '</td><td class="w">' + esc(x.l.ex || "") + "</td></tr>";
      });
      h += "</tbody></table></div></div>";
    });
    if (!rows.length) h += '<div class="empty">No formulas found.</div>';
    return h;
  }

  /* ---------------- progress ---------------- */
  function vProgress() {
    var L = learning();
    var h = '<div class="pagehd"><h1>Progress</h1><p>Two numbers that mean different things. Learning is input. Readiness is what someone else could verify.</p></div>';
    h += '<div class="grid auto block">' +
      stat("Overall", overall(), "%", "0.6 readiness + 0.4 learning") +
      stat("Readiness", readiness(), "%", "Gates, evidence, rating") +
      stat("Learning", L.pct, "%", L.done + " of " + L.total) +
      stat("Avg rating", compAvg().toFixed(1), "/ 5", "10 competencies") +
      "</div>";

    h += '<div class="card block"><div class="cardhd"><h3>Movement</h3><button class="btn primary sm" data-action="snap">Save snapshot</button></div>' + trend() + "</div>";

    if (S.snaps.length) {
      h += '<div class="tblwrap block"><table><thead><tr><th>Date</th><th class="n">Learning</th><th class="n">Readiness</th><th class="n">Avg rating</th><th></th></tr></thead><tbody>';
      S.snaps.slice().reverse().forEach(function (sn, i) {
        var idx = S.snaps.length - 1 - i;
        h += "<tr><td>" + esc(sn.d) + '</td><td class="n">' + sn.learning + '%</td><td class="n">' + sn.readiness + '%</td><td class="n">' + (sn.avg || 0).toFixed(1) +
          '</td><td class="n"><button class="btn ghost sm" data-action="delsnap" data-id="' + idx + '">Delete</button></td></tr>';
      });
      h += "</tbody></table></div>";
    }

    h += '<div class="grid two block"><div class="card"><h3 style="margin-bottom:10px">By level</h3><div class="tblwrap"><table><thead><tr><th>Level</th><th class="n">Done</th><th style="width:90px"></th><th class="n">%</th></tr></thead><tbody>';
    ["F", "P", "A", "L"].forEach(function (lv) {
      var tot = 0, dn = 0;
      LESSONS.forEach(function (x) { if (x.l.lvl === lv) { tot++; if (S.done[x.l.id]) dn++; } });
      h += '<tr><td><span class="pill ' + lv + '">' + lv + "</span> " + LVL[lv] + '</td><td class="n">' + dn + " / " + tot + "</td><td>" + bar(pc(dn, tot), "tiny") + '</td><td class="n">' + pc(dn, tot) + "%</td></tr>";
    });
    h += "</tbody></table></div></div>";

    h += '<div class="card"><h3 style="margin-bottom:10px">Ladder detail</h3><div class="tblwrap"><table><thead><tr><th>Stage</th><th class="n">Gates</th><th style="width:90px"></th></tr></thead><tbody>';
    LADDER.stages.forEach(function (st) {
      var s = stageStats(st);
      h += "<tr><td>" + st.n + " " + esc(st.title) + '</td><td class="n">' + s.done + " / " + s.total + "</td><td>" + bar(s.pct, "tiny") + "</td></tr>";
    });
    h += "</tbody></table></div></div></div>";

    h += '<div class="card block"><div class="cardhd"><h3>Backup</h3><span class="faint">Browser storage only</span></div>' +
      "<p>Everything is stored in this browser. Clearing site data erases it. Export once a month and keep the file somewhere you actually back up.</p>" +
      '<div class="row"><button class="btn primary" data-action="export">Export JSON</button>' +
      '<button class="btn" data-action="importpick">Import JSON</button>' +
      '<input type="file" id="importfile" data-action="importfile" accept="application/json,.json" hidden>' +
      '<button class="btn danger" data-action="reset">Erase all progress</button></div>' +
      '<p class="faint" style="margin-top:8px">Import replaces everything currently stored. It does not merge.</p></div>';
    return h;
  }

  /* ---------------- settings ---------------- */
  function vSettings() {
    var p = S.prefs;
    function sel(k, opts) {
      return '<select data-action="pref" data-k="' + k + '">' + opts.map(function (o) {
        return '<option value="' + o[0] + '"' + (String(p[k]) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
      }).join("") + "</select>";
    }
    function setrow(title, note, ctl) {
      return '<div class="setrow"><div class="lbl"><b>' + esc(title) + "</b><span>" + esc(note) + '</span></div><div class="ctl">' + ctl + "</div></div>";
    }
    var h = '<div class="pagehd"><h1>Settings</h1><p>Saved in this browser alongside your progress.</p></div>';

    h += '<div class="card block"><div class="cardhd"><h3>Appearance</h3></div>';
    h += '<div class="setrow"><div class="lbl"><b>Theme</b><span>Six surfaces, dark by default</span></div><div class="ctl" style="width:auto"><div class="swatches">' +
      THEMES.map(function (t) {
        return '<button class="themebtn" data-action="theme" data-id="' + t.id + '" aria-pressed="' + (p.theme === t.id) + '"><i style="background:' + t.sw + '"></i>' + t.name + "</button>";
      }).join("") + "</div></div></div>";
    h += '<div class="setrow"><div class="lbl"><b>Accent</b><span>Used for progress, focus and active states</span></div><div class="ctl" style="width:auto"><div class="swatches">' +
      ACCENTS.map(function (a) {
        return '<button class="sw" data-action="accent" data-id="' + a + '" style="background:' + a + '" aria-pressed="' + (p.accent === a) + '" aria-label="Accent ' + a + '"></button>';
      }).join("") + "</div></div></div>";
    h += setrow("Text size", "Scales the whole interface", sel("fs", [["0.92", "Small"], ["1", "Medium"], ["1.1", "Large"], ["1.22", "Extra large"]]));
    h += setrow("Typeface", "Interface font family", sel("font", [["ui", "System sans"], ["serif", "Serif"], ["mono", "Monospace"]]));
    h += setrow("Density", "Padding and spacing", sel("density", [["tight", "Tight"], ["normal", "Normal"], ["roomy", "Roomy"]]));
    h += setrow("Motion", "Transitions and bar animation", sel("motion", [["on", "On"], ["off", "Reduced"]]));
    h += '<div class="setrow"><div class="lbl"><b>Focus mode</b><span>Hide every percentage while you read, for when the numbers start driving the behaviour</span></div>' +
      '<div class="ctl" style="width:auto"><label class="row">' + tick("focus", "focus", p.focus, "Focus mode") + "<span>Hide figures</span></label></div></div>";
    h += "</div>";

    h += '<div class="card block"><div class="cardhd"><h3>AI tutor</h3><span class="faint">Optional</span></div>' +
      "<p>Paste an Anthropic API key to ask questions against any lesson's context. The key stays in this browser and is never committed to the repository.</p>" +
      '<div class="callout" style="margin-bottom:12px"><b>Trade-off:</b> a key used from a browser page is readable by anything running on that page and by anyone who opens developer tools. Use a personal key with a low spend limit, never a shared work key.</div>' +
      setrow("API key", "Stored in localStorage on this device", '<input type="password" value="' + esc(S.ai.key) + '" data-action="aikey" placeholder="sk-ant-..." autocomplete="off">') +
      setrow("Model", "Any current Anthropic model string", '<input type="text" value="' + esc(S.ai.model) + '" data-action="aimodel">') +
      "</div>";

    h += '<div class="card block"><div class="cardhd"><h3>How the numbers are computed</h3></div><div class="tblwrap"><table><tbody>' +
      "<tr><td><strong>Learning</strong></td><td class=\"w\">Lessons marked done, over " + LESSONS.length + " total</td></tr>" +
      "<tr><td><strong>Readiness</strong></td><td class=\"w\">Mean of gate completion, evidence completion, and average self-rating over 5</td></tr>" +
      "<tr><td><strong>Overall</strong></td><td class=\"w\">0.6 × readiness + 0.4 × learning. Evidence weighs more because it is the part someone else can verify</td></tr>" +
      "</tbody></table></div></div>";
    return h;
  }

  /* ---------------- render ---------------- */
  var VIEWS = {
    overview: { label: "Overview", fn: vOverview },
    ladder: { label: "Ladder", fn: vLadder },
    finance: { label: "Finance", fn: function () { return vTrack(TRACKS.finance); } },
    formulas: { label: "Formula sheet", fn: vFormulas },
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
  }

  function navHTML() {
    var groups = [
      ["Track", ["overview", "ladder", "progress"]],
      ["Curriculum", ["finance", "tech", "formulas"]],
      ["", ["settings"]]
    ];
    var pcts = { overview: overall() + "%", ladder: readiness() + "%", finance: trackStats(TRACKS.finance).pct + "%", tech: trackStats(TRACKS.tech).pct + "%", formulas: "", progress: "", settings: "" };
    var h = "";
    groups.forEach(function (grp) {
      if (grp[0]) h += '<div class="railgroup">' + grp[0] + "</div>";
      h += "<nav>" + grp[1].map(function (v) {
        return '<button data-action="nav" data-id="' + v + '" aria-current="' + (view === v) + '"><span class="k">' + VIEWS[v].label +
          '</span><span class="pct">' + (S.prefs.focus ? "" : pcts[v]) + "</span></button>";
      }).join("") + "</nav>";
    });
    return h;
  }

  function render() {
    applyPrefs();
    document.getElementById("railnav").innerHTML = navHTML();
    document.getElementById("crumb").textContent = VIEWS[view] ? VIEWS[view].label : "Overview";
    var host = document.getElementById("viewhost");
    host.innerHTML = (VIEWS[view] || VIEWS.overview).fn();
    if (S.prefs.focus) {
      Array.prototype.forEach.call(host.querySelectorAll(".stat .v, .hero .big, .hero .split, .bar, .grp span:last-child"), function (n) { n.style.visibility = "hidden"; });
    }
    stamp();
  }
  function stamp() {
    var L = learning();
    document.getElementById("stamp").textContent = L.done + " lessons · " + gateStats().done + " gates · " + evStats().done + " evidence";
  }
  function refresh() {
    document.getElementById("railnav").innerHTML = navHTML();
    stamp();
  }
  function go(v) { view = v; render(); window.scrollTo(0, 0); }

  /* ---------------- events ---------------- */
  var t1 = null;
  function later() { if (t1) clearTimeout(t1); t1 = setTimeout(save, 400); }

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var a = el.getAttribute("data-action"), id = el.getAttribute("data-id");
    if (a === "nav") go(id);
    else if (a === "stage") { stage = id; render(); }
    else if (a === "tab") { tab = id; render(); }
    else if (a === "mod") { mod[view] = id; render(); }
    else if (a === "filter") { filter = id; render(); }
    else if (a === "theme") { S.prefs.theme = id; save(); render(); }
    else if (a === "accent") { S.prefs.accent = id; save(); render(); }
    else if (a === "expand") {
      var d = document.querySelector('[data-detail="' + id + '"]');
      var open = d.hasAttribute("hidden");
      if (open) d.removeAttribute("hidden"); else d.setAttribute("hidden", "");
      el.setAttribute("aria-expanded", String(open));
    }
    else if (a === "snap") {
      S.snaps.push({ d: new Date().toISOString().slice(0, 10), learning: learning().pct, readiness: readiness(), avg: compAvg(), comp: JSON.parse(JSON.stringify(S.comp)) });
      save(); render();
    }
    else if (a === "delsnap") { if (confirm("Delete this snapshot?")) { S.snaps.splice(Number(id), 1); save(); render(); } }
    else if (a === "export") exportJSON();
    else if (a === "importpick") document.getElementById("importfile").click();
    else if (a === "reset") {
      if (confirm("Erase all progress, notes, evidence and snapshots from this browser? This cannot be undone.")) {
        S = JSON.parse(JSON.stringify(defaults)); save(); render();
      }
    }
    else if (a === "ask") openAsk(id);
    else if (a === "askopen") openAsk(null);
    else if (a === "askclose") document.getElementById("drawer").setAttribute("hidden", "");
    else if (a === "asksend") sendAsk();
  });

  document.addEventListener("change", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var a = el.getAttribute("data-action"), id = el.getAttribute("data-id");
    if (a === "lesson") {
      if (el.checked) S.done[id] = true; else delete S.done[id];
      var r = el.closest(".item"); if (r) r.classList.toggle("on", el.checked);
      save(); refresh();
    }
    else if (a === "gate") {
      if (el.checked) S.gates[id] = true; else delete S.gates[id];
      var r2 = el.closest(".item"); if (r2) r2.classList.toggle("on", el.checked);
      save(); refresh();
    }
    else if (a === "ev") {
      S.ev[id] = S.ev[id] || { done: false, note: "" };
      S.ev[id].done = el.checked;
      var r3 = el.closest(".item"); if (r3) r3.classList.toggle("on", el.checked);
      save(); refresh();
    }
    else if (a === "comp") { S.comp[id] = Number(el.value); save(); refresh(); }
    else if (a === "pref") { var k = el.getAttribute("data-k"); S.prefs[k] = k === "fs" ? Number(el.value) : el.value; save(); applyPrefs(); }
    else if (a === "focus") { S.prefs.focus = el.checked; save(); render(); }
    else if (a === "importfile") handleImport(el);
  });

  document.addEventListener("input", function (ev) {
    var el = ev.target.closest("[data-action]");
    if (!el) return;
    var a = el.getAttribute("data-action"), id = el.getAttribute("data-id");
    if (a === "note") { S.notes[id] = el.value; later(); }
    else if (a === "evnote") { S.ev[id] = S.ev[id] || { done: false, note: "" }; S.ev[id].note = el.value; later(); }
    else if (a === "comp") { var v = document.querySelector('[data-v="' + id + '"]'); if (v) v.textContent = el.value; }
    else if (a === "aikey") { S.ai.key = el.value.trim(); later(); }
    else if (a === "aimodel") { S.ai.model = el.value.trim(); later(); }
  });

  var t2 = null;
  document.getElementById("q").addEventListener("input", function (e) {
    query = e.target.value;
    if (t2) clearTimeout(t2);
    t2 = setTimeout(function () {
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

  /* ---------------- ask ---------------- */
  var ctxLesson = null;
  function openAsk(lessonId) {
    ctxLesson = lessonId ? lessonById(lessonId) : null;
    document.getElementById("drawer").removeAttribute("hidden");
    document.getElementById("askctx").textContent = ctxLesson
      ? ctxLesson.m.name + " · " + ctxLesson.l.t
      : "No lesson selected — ask anything from the curriculum.";
    document.getElementById("askout").textContent = "";
    var b = document.getElementById("askq");
    b.value = ctxLesson ? "Explain this in more depth, with one concrete enterprise example." : "";
    b.focus();
  }

  function sendAsk() {
    var q = document.getElementById("askq").value.trim(), out = document.getElementById("askout");
    if (!q) { out.textContent = "Type a question first."; return; }
    if (!S.ai.key) { out.textContent = "No API key saved. Add one in Settings to use the tutor."; return; }
    var ctx = "";
    if (ctxLesson) {
      ctx = "Lesson: " + ctxLesson.l.t + "\nModule: " + ctxLesson.m.name + "\nLevel: " + LVL[ctxLesson.l.lvl] +
        "\nKey points:\n- " + ctxLesson.l.k.join("\n- ") + "\nExercise: " + ctxLesson.l.do + "\n\n";
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
        system: "You tutor an experienced enterprise architect working toward a CTO role in a large IT services firm. Be direct and concrete. Correct wrong assumptions in the question rather than working around them. Use enterprise examples. No flattery, no preamble. Under 400 words unless asked for more.",
        messages: [{ role: "user", content: ctx + "Question: " + q }]
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) { out.textContent = "Request failed: " + ((res.j && res.j.error && res.j.error.message) || "check the key, the model name, and your spend limit."); return; }
        var text = (res.j.content || []).filter(function (c) { return c.type === "text"; }).map(function (c) { return c.text; }).join("\n");
        out.textContent = text || "Empty response.";
      })
      .catch(function () { out.textContent = "Network error, or the key is blocked. Check the console for detail."; });
  }

  /* ---------------- boot ---------------- */
  document.getElementById("q").placeholder = "Search " + LESSONS.length + " lessons";
  render();
  window.CTOTRACK = {
    state: function () { return S; }, learning: learning, readiness: readiness, overall: overall,
    lessons: LESSONS, render: render, go: go,
    setTab: function (t) { tab = t; render(); }, setMod: function (v, m) { mod[v] = m; render(); }
  };
})();
