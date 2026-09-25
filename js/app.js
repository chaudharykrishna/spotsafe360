/* SpotSafe 360 - game engines.
   Phase 1: engine guard (retry loader, self-diagnosing banner).
   Phase 2: world builder (the goods-in bay) and movement clamp.
   Phase 3: hazards as data - hotspots, hover shimmer, click and E flagging,
            scoring, streak, guards, feedback card, stereo-panned sound clue.
   Later phases hook into engineOnline() once the scene has loaded. */
(function () {
  "use strict";
  var DEBUG = /[?&]debug=1/.test(window.location.search);
  var SRI = "sha384-tVEbl7TUEnd3P8HoHIOqysRs2s8XW0iEfseiRgKkR9qRUtITLdOX+llejEgkop5S";
  var LIB_BYTES = 1405369;
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  /* Fisher-Yates, in place. Used by list mode and by the quiz. */
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* ================= icons: inline SVG line art ================= */
  var PATHS = {
    score: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
    streak: '<path d="M13 2 6 13h5l-1 9 8-12h-5z"/>',
    tick: '<path d="M5 13l4 4L19 7"/>',
    ring: '<circle cx="12" cy="12" r="6"/>',
    fire: '<path d="M12 3c1.5 3.5 5.5 5 5.5 9.5a5.5 5.5 0 0 1-11 0C6.5 9.5 9 8 10 5.5c0.8 1.6 2 2 2-2.5z"/>',
    vehicle: '<path d="M4 14V8h7v6M11 14l5-5M16 9v5"/><circle cx="6.8" cy="18" r="1.8"/><circle cx="13.8" cy="18" r="1.8"/>',
    height: '<circle cx="15" cy="4.5" r="2"/><path d="M14 8l-4 3 2 4-4 5M14 8l3 4 4 1"/>',
    house: '<path d="M12 4c3 4 6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 3-6 6-10z"/>',
    stack: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12L4 7.5M12 12v9"/>',
    good: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    penalty: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    sound: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
    mute: '<path d="M4 10v4h4l5 4V6l-5 4z"/><path d="M17 9l4 6M21 9l-4 6"/>',
    expand: '<path d="M6 9l6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    vr: '<path d="M3 10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-4.2l-2.8-2.6-2.8 2.6H5a2 2 0 0 1-2-2z"/>'
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (PATHS[name] || "") + "</svg>";
  }
  function iconOf(cat) { return PATHS[cat] ? cat : "house"; }

  /* ================= state ================= */
  var state = {
    score: 0, streak: 0, bestStreak: 0, found: {}, goodClicks: 0, wrongClicks: 0,
    lastSpot: 0, lastWrong: 0, muted: false,
    difficulty: "standard", cardTimer: null, beepId: null, audioUnlocked: false,
    /* Phase 4: round flow */
    name: "Player", avatar: 0, mode: "training",
    paused: false, roundOver: false,
    roundStart: 0, pausedTotal: 0, pauseBegan: 0,
    timerId: null, hintId: null, hintShown: {},
    /* Phase 5: review and list mode */
    listOpen: false, listOrder: null, listSafe: {}, reaction: {},
    /* List mode navigation: the running walk, and the spot it lit up. */
    locate: { raf: 0, marked: null, markTimer: null, bannerTimer: null },
    /* Quick-check quiz (A7): the drawn paper, where we are in it, and how
       many were right. endReason is held here because the review title is
       written after the quiz, not at the moment the round stops. */
    endReason: "time", roundMs: 0,
    quiz: { paper: [], at: 0, right: 0, answered: false }
  };
  function diff() { return CONFIG.difficulties[state.difficulty] || CONFIG.difficulties.standard; }
  function readParams() {
    var q = new URLSearchParams(window.location.search);
    var name = (q.get("name") || "").replace(/[<>&"']/g, "").slice(0, 16);
    state.name = name || "Player";
    var av = parseInt(q.get("avatar"), 10);
    state.avatar = isNaN(av) ? 0 : clamp(av, 0, 5);
    state.mode = q.get("mode") === "attack" ? "attack" : "training";
    var d = q.get("diff");
    state.difficulty = CONFIG.difficulties[d] ? d : "standard";
  }
  function elapsedMs() { return Date.now() - state.roundStart - state.pausedTotal; }
  function fmtTime(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }

  /* ================= builder helpers ================= */
  function el(tag, attrs, parent) {
    var e = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (parent) { parent.appendChild(e); }
    return e;
  }
  function box(parent, w, h, d, color, x, y, z, rot) {
    var a = { width: w, height: h, depth: d, position: x + " " + y + " " + z,
              material: "color:" + color + "; roughness:0.9" };
    if (rot) { a.rotation = "0 0 " + rot; }
    return el("a-box", a, parent);
  }
  function cyl(parent, r, h, color, x, y, z, rx, rz) {
    return el("a-cylinder", { radius: r, height: h, position: x + " " + y + " " + z,
      rotation: (rx || 0) + " 0 " + (rz || 0), material: "color:" + color + "; roughness:0.85" }, parent);
  }
  function worker(parent, x, z, vest, pants, hiVis) {
    var g = el("a-entity", { position: x + " 0 " + z }, parent);
    box(g, 0.16, 0.8, 0.16, pants, -0.11, 0.4, 0);
    box(g, 0.16, 0.8, 0.16, pants, 0.11, 0.4, 0);
    box(g, 0.46, 0.62, 0.26, vest, 0, 1.11, 0);
    if (hiVis) {
      box(g, 0.5, 0.07, 0.3, "#FFD100", 0, 0.98, 0);
      box(g, 0.5, 0.07, 0.3, "#FFD100", 0, 1.24, 0);
    }
    box(g, 0.12, 0.55, 0.12, vest, -0.31, 1.12, 0, 8);
    box(g, 0.12, 0.55, 0.12, vest, 0.31, 1.12, 0, -8);
    el("a-sphere", { radius: 0.16, position: "0 1.58 0", material: "color:#D9B38C; roughness:0.8" }, g);
    if (hiVis) {
      el("a-sphere", { radius: 0.18, position: "0 1.66 0", scale: "1 0.6 1", material: "color:#FFD100" }, g);
    } else {
      el("a-sphere", { radius: 0.17, position: "0 1.66 0", scale: "1 0.6 1", material: "color:#2B2B2B" }, g);
    }
    return g;
  }
  function palletStack(parent, x, z, layers) {
    var g = el("a-entity", { position: x + " 0 " + z }, parent);
    for (var i = 0; i < layers; i++) {
      box(g, 1.2, 0.14, 1.2, "#B08A5A", 0, 0.07 + i * 0.62, 0);
      box(g, 1.0, 0.46, 1.0, "#C8A06A", 0, 0.37 + i * 0.62, 0);
    }
    return g;
  }
  function rackBay(parent, x, z) {
    var g = el("a-entity", { position: x + " 0 " + z }, parent);
    [-2.5, 2.5].forEach(function (dz) {
      [-0.55, 0.55].forEach(function (dx) { box(g, 0.12, 3.2, 0.12, "#E87722", dx, 1.6, dz); });
    });
    [1.1, 2.3].forEach(function (y) {
      [-0.55, 0.55].forEach(function (dx) { box(g, 0.1, 0.12, 5.0, "#E87722", dx, y, 0); });
      [-1.6, 0, 1.6].forEach(function (dz) {
        box(g, 0.95, 0.14, 0.95, "#B08A5A", 0, y + 0.13, dz);
        box(g, 0.85, 0.7, 0.85, "#C9A876", 0, y + 0.55, dz);
      });
    });
    return g;
  }
  function forklift(parent, x, z, ry) {
    var g = el("a-entity", { position: x + " 0 " + z, rotation: "0 " + (ry || 0) + " 0" }, parent);
    box(g, 1.0, 0.8, 1.7, "#F28C28", 0, 0.75, 0);
    box(g, 0.9, 0.5, 0.6, "#3A3A3A", 0, 1.35, -0.4);
    [0.35, -0.35].forEach(function (dx) {
      box(g, 0.08, 2.0, 0.08, "#3A3A3A", dx, 1.2, 0.95);
      box(g, 0.1, 0.06, 1.3, "#3A3A3A", dx, 0.12, 1.5);
    });
    [[-0.5, 0.6], [0.5, 0.6], [-0.5, -0.6], [0.5, -0.6]].forEach(function (w) {
      cyl(g, 0.28, 0.2, "#222222", w[0], 0.28, w[1], 0, 90);
    });
    return g;
  }

  /* ================= the bay ================= */
  function buildRoom() {
    var room = $("room");
    el("a-plane", { rotation: "-90 0 0", width: 36, height: 24, position: "0 0 0",
                    material: "src:#texFloor; repeat:12 8; roughness:1" }, room);
    el("a-plane", { rotation: "-90 0 0", width: 36, height: 24, position: "0 8 0",
                    material: "color:#1A2634; side:back" }, room);
    el("a-plane", { width: 36, height: 8, position: "0 4 -12", material: "src:#texWall; repeat:12 3" }, room);
    el("a-plane", { width: 36, height: 8, position: "0 4 12", rotation: "0 180 0", material: "src:#texWall; repeat:12 3" }, room);
    el("a-plane", { width: 24, height: 8, position: "-18 4 0", rotation: "0 90 0", material: "src:#texWall; repeat:8 3" }, room);
    el("a-plane", { width: 24, height: 8, position: "18 4 0", rotation: "0 -90 0", material: "src:#texWall; repeat:8 3" }, room);
    [-9, -3, 3, 9].forEach(function (x) {
      el("a-plane", { rotation: "-90 0 0", width: 4, height: 1.2, position: x + " 7.95 0",
                      material: "color:#FFFFFF; emissive:#FFFFFF; emissiveIntensity:0.7; side:double" }, room);
    });
    [-10, 0, 10].forEach(function (x) {
      [-6, 2, 9].forEach(function (z) {
        box(room, 0.9, 0.12, 0.5, "#DDD8C4", x, 6.4, z).setAttribute("material",
          "color:#FFFBE8; emissive:#FFF6D8; emissiveIntensity:0.55");
      });
    });
    [10.4, 12.2].forEach(function (x) {
      el("a-plane", { rotation: "-90 0 0", width: 0.18, height: 16, position: x + " 0.02 1",
                      material: "color:#FFD100" }, room);
    });
  }
  function buildProps() {
    var p = $("props");
    rackBay(p, -16, -6); rackBay(p, -16, 1); rackBay(p, -16, 8);
    [6, 12].forEach(function (x) {
      box(p, 3.2, 3.6, 0.2, "#2E3B4E", x, 1.8, -11.85);
      box(p, 3.0, 3.4, 0.1, "#48586E", x, 1.7, -11.72);
      [-1.7, 1.7].forEach(function (dx) { box(p, 0.25, 0.9, 0.25, "#FFD100", x + dx, 0.45, -11.5); });
    });
    box(p, 2.5, 2.6, 6, "#24406B", 6, 1.5, -8.4);
    box(p, 0.1, 2.1, 1.2, "#C0392B", 17.9, 1.05, 2);
    cyl(p, 0.09, 0.55, "#C0392B", 17.75, 1.1, 0.6);
    for (var z = -6; z <= 8; z += 2) { cyl(p, 0.06, 1.1, "#FFD100", 12.6, 0.55, z); }
    box(p, 0.06, 0.06, 14.4, "#FFD100", 12.6, 0.95, 1);
    box(p, 0.06, 0.06, 14.4, "#FFD100", 12.6, 0.5, 1);
    box(p, 0.7, 1.3, 0.45, "#5B6773", -4, 0.65, 11.6);
    box(p, 6, 0.18, 3, "#39465A", -6, 3, 10.4);
    [[-8.8, 9], [-3.2, 9], [-8.8, 11.6], [-3.2, 11.6]].forEach(function (c) {
      box(p, 0.14, 3, 0.14, "#39465A", c[0], 1.5, c[1]);
    });
    palletStack(p, -6, 2, 2); palletStack(p, -8, -3, 3); palletStack(p, 8, 8, 2);
  }
  function buildDebug() {
    var d = $("debugLayer");
    CONFIG.colliders.forEach(function (c) {
      el("a-ring", { rotation: "-90 0 0", "radius-inner": c.r - 0.1, "radius-outer": c.r,
        position: c.x + " 0.03 " + c.z, material: "color:#FFD100; opacity:0.5; transparent:true" }, d);
    });
    var b = CONFIG.bounds;
    box(d, b.maxX - b.minX, 0.02, 0.08, "#3DDC6A", 0, 0.03, b.minZ);
    box(d, b.maxX - b.minX, 0.02, 0.08, "#3DDC6A", 0, 0.03, b.maxZ);
    box(d, 0.08, 0.02, b.maxZ - b.minZ, "#3DDC6A", b.minX, 0.03, 0);
    box(d, 0.08, 0.02, b.maxZ - b.minZ, "#3DDC6A", b.maxX, 0.03, 0);
    console.table(CONFIG.colliders);
    console.table(HAZARDS.concat(DISTRACTORS).map(function (i) {
      return { id: i.id, x: i.pos.x, z: i.pos.z, radius: i.radius };
    }));
  }

  /* ================= hazards: built from data ================= */
  function groupOf(id) { return document.querySelector('.hotspot[data-id="' + id + '"]'); }
  function wire(g, item) {
    var meshes = [];
    g.addEventListener("loaded", function () {
      meshes = Array.prototype.slice.call(g.querySelectorAll("a-box, a-cylinder, a-sphere"))
        .filter(function (m) { return !m.classList.contains("found-marker"); });
    });
    /* Hover tints the group by writing the two emissive properties only, and
       clears it by writing the material defaults back. Saving the old material
       first does not work: A-Frame hands getAttribute the parsed object, not
       the string it was built from, so the round trip stored "[object Object]"
       and the tint could never be taken off again - every hazard the mouse
       crossed stayed lit and gave itself away. */
    function glow(on) {
      meshes.forEach(function (m) {
        m.setAttribute("material", on
          ? { emissive: "#FFD100", emissiveIntensity: 0.22 }
          : { emissive: "#000000", emissiveIntensity: 1 });
      });
    }
    g.addEventListener("mouseenter", function () {
      glow(true);
      document.body.style.cursor = "pointer";
    });
    g.addEventListener("mouseleave", function () {
      glow(false);
      document.body.style.cursor = "";
    });
    g.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (DISTRACTORS.indexOf(item) >= 0) { onGoodClick(item); } else { onSpot(item); }
    });
  }
  function buildHazardObjects() {
    var host = $("hotspots");
    HAZARDS.forEach(function (h) {
      var g = el("a-entity", { position: h.pos.x + " 0 " + h.pos.z, class: "hotspot" }, host);
      g.dataset.id = h.id;
      if (h.id === "H1") {
        box(g, 1.3, 0.9, 1.1, "#7C8794", 0, 0.45, 0);
        box(g, 1.1, 0.8, 0.9, "#8B96A3", 0.15, 1.25, 0.1, 8);
        box(g, 1.2, 0.14, 1.2, "#B08A5A", -0.2, 0.07, 0.5, 20);
      } else if (h.id === "H2") {
        worker(g, 0, 0, "#2B3440", "#22262E", false);
      } else if (h.id === "H3") {
        forklift(g, 0, 0, 40);
      } else if (h.id === "H4") {
        el("a-cylinder", { radius: 1.5, height: 0.03, position: "-0.3 0.02 0",
          material: "color:#22302A; roughness:0.1; metalness:0.35; opacity:0.92; transparent:true" }, g);
        cyl(g, 0.42, 0.9, "#3B6E4F", 0.7, 0.42, 0.5, 0, 90);
        box(g, 0.34, 0.05, 0.34, "#22302A", 0.05, 0.03, 0.35);
      } else if (h.id === "H5") {
        /* 2.0 long, not 2.6: the walkway runs from x 10.4 to 12.2 and the
           barrier posts stand at 12.6, so the longer lead drove its plug
           straight through the post it is meant to lie beside. */
        cyl(g, 0.05, 2.0, "#1B2430", 0, 0.05, 0, 0, 90);
        box(g, 0.3, 0.14, 0.22, "#48586E", -1.05, 0.07, 0);
        box(g, 0.22, 0.1, 0.16, "#FFD100", 1.0, 0.05, 0);
      } else if (h.id === "H6") {
        box(g, 0.12, 3.2, 0.12, "#E87722", 0, 1.5, 0, 9);
        box(g, 0.16, 0.5, 0.16, "#2B2B2B", 0.12, 0.3, 0, 9);
        box(g, 0.1, 0.12, 2.6, "#E87722", 0.55, 1.0, 0.4, 6);
        box(g, 1.0, 0.14, 1.0, "#B08A5A", 1.2, 0.07, 0.2, 12);
      } else if (h.id === "H7") {
        box(g, 1.1, 1.1, 0.8, "#9A7B4F", -0.45, 0.55, 0.1, 4);
        box(g, 0.7, 0.6, 0.6, "#8B7355", -0.5, 1.4, -0.05, -6);
        cyl(g, 0.11, 0.5, "#C0392B", 0.62, 0.95, 0);
        box(g, 0.05, 0.34, 0.26, "#7C8794", 0.78, 1.3, 0);
      } else if (h.id === "H8") {
        worker(g, 0, 0, "#3C4656", "#22262E", false).setAttribute("position", "0 3.09 0");
        box(g, 1.2, 0.14, 1.0, "#B08A5A", 0.9, 3.16, -0.25, 8);
      } else if (h.id === "H9") {
        palletStack(g, 0, 0, 3);
        worker(g, 0, 0, "#3C4656", "#22262E", true).setAttribute("position", "0 1.86 0");
      }
      g.marker = el("a-box", { width: h.radius * 2, height: 2.6, depth: h.radius * 2,
        position: "0 1.3 0", material: "color:#FFD100; wireframe:true; opacity:0; transparent:true",
        class: "found-marker" }, g);
      wire(g, h);
      if (DEBUG) {
        el("a-ring", { rotation: "-90 0 0", "radius-inner": h.radius - 0.1, "radius-outer": h.radius,
          position: "0 0.03 0", material: "color:#3DDC6A; opacity:0.5; transparent:true" }, g);
      }
    });
    DISTRACTORS.forEach(function (d) {
      var g = el("a-entity", { position: d.pos.x + " 0 " + d.pos.z, class: "hotspot" }, host);
      g.dataset.id = d.id;
      worker(g, 0, 0, "#FFD100", "#22262E", true);
      g.marker = el("a-box", { width: d.radius * 2, height: 2.4, depth: d.radius * 2,
        position: "0 1.2 0", material: "color:#FFD100; wireframe:true; opacity:0; transparent:true",
        class: "found-marker" }, g);
      wire(g, d);
      if (DEBUG) {
        el("a-ring", { rotation: "-90 0 0", "radius-inner": d.radius - 0.1, "radius-outer": d.radius,
          position: "0 0.03 0", material: "color:#FFD100; opacity:0.5; transparent:true" }, g);
      }
    });
  }

  /* ================= audio: synthesised, zero assets ================= */
  var audio = { ctx: null, master: null };
  function audioReady() {
    if (!audio.ctx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) { return false; }
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === "suspended") { audio.ctx.resume(); }
    return true;
  }
  function unlockAudioOnce() {
    if (state.audioUnlocked) { return; }
    state.audioUnlocked = true;
    audioReady();
  }
  function blip(freq) {
    if (!audio.ctx || state.muted) { return; }
    var t = audio.ctx.currentTime;
    var osc = audio.ctx.createOscillator();
    var gain = audio.ctx.createGain();
    osc.type = "sine"; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.linearRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(gain); gain.connect(audio.master);
    osc.start(t); osc.stop(t + 0.18);
  }
  function beepOnce(pan) {
    if (!audio.ctx || state.muted) { return; }
    var t = audio.ctx.currentTime;
    var panner = audio.ctx.createStereoPanner ? audio.ctx.createStereoPanner() : null;
    if (panner) { panner.pan.value = clamp(pan, -1, 1); panner.connect(audio.master); }
    var dest = panner || audio.master;
    [0, 0.3].forEach(function (off) {
      var osc = audio.ctx.createOscillator();
      var gain = audio.ctx.createGain();
      osc.type = "square"; osc.frequency.value = 1250;
      gain.gain.setValueAtTime(0.0001, t + off);
      gain.gain.linearRampToValueAtTime(0.25, t + off + 0.02);
      gain.gain.linearRampToValueAtTime(0.0001, t + off + 0.14);
      osc.connect(gain); gain.connect(dest);
      osc.start(t + off); osc.stop(t + off + 0.16);
    });
  }
  function beepPan() {
    var cam = $("cam");
    var h = HAZARDS.filter(function (x) { return x.soundClue; })[0];
    if (!cam || !h) { return 0; }
    var yaw = cam.object3D.rotation.y;
    var fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    var dx = h.pos.x - cam.object3D.position.x, dz = h.pos.z - cam.object3D.position.z;
    var len = Math.hypot(dx, dz) || 1;
    var tx = dx / len, tz = dz / len;
    var rel = Math.atan2(tx * fz + tz * (-fx), tx * fx + tz * fz);
    return -Math.sin(rel) * 0.9;
  }
  function stopBeeps() { if (state.beepId) { clearInterval(state.beepId); state.beepId = null; } }
  function startBeeps() {
    stopBeeps();
    var sounders = HAZARDS.filter(function (h) { return h.soundClue; });
    if (!sounders.length) { return; }
    state.beepId = setInterval(function () {
      if (state.roundOver) { stopBeeps(); return; }
      if (state.paused) { return; }
      if (sounders.every(function (h) { return state.found[h.id]; })) { stopBeeps(); return; }
      if (audioReady()) { beepOnce(beepPan()); }
    }, CONFIG.beepEverySec * 1000);
  }

  /* ================= movement clamp ================= */
  /* Kept apart from the camera so list mode can test a standing spot before
     it walks the player there. Mutates and returns the point given. */
  function clampPoint(p) {
    /* Walls, then the things standing against them, twice over: a single pass
       lets a collider beside a wall push the standing point out through the
       wall, which is how you end up outside the bay at the fire exit. */
    for (var pass = 0; pass < 3; pass++) {
      p.x = clamp(p.x, CONFIG.bounds.minX, CONFIG.bounds.maxX);
      p.z = clamp(p.z, CONFIG.bounds.minZ, CONFIG.bounds.maxZ);
      CONFIG.colliders.forEach(function (c) {
        var dx = p.x - c.x, dz = p.z - c.z;
        var d = Math.hypot(dx, dz);
        if (d < c.r && d > 0.0001) { p.x = c.x + dx / d * c.r; p.z = c.z + dz / d * c.r; }
      });
    }
    p.x = clamp(p.x, CONFIG.bounds.minX, CONFIG.bounds.maxX);
    p.z = clamp(p.z, CONFIG.bounds.minZ, CONFIG.bounds.maxZ);
    return p;
  }
  function clampMovement() {
    var cam = $("cam");
    if (!cam || !cam.object3D) { return; }
    clampPoint(cam.object3D.position).y = CONFIG.eyeHeight;
  }

  /* ================= HUD and feedback card ================= */
  function hud() {
    $("hudScore").textContent = state.score;
    $("hudStreak").textContent = state.streak;
    $("hudFound").textContent = Object.keys(state.found).length + " / " + HAZARDS.length;
  }
  function catOf(h) {
    if (h.category.indexOf("Fire") === 0) { return "fire"; }
    if (h.category.indexOf("Vehicle") === 0) { return "vehicle"; }
    if (h.category.indexOf("Working") === 0) { return "height"; }
    if (h.category.indexOf("Stacking") === 0) { return "stack"; }
    if (h.category.indexOf("Good") === 0) { return "good"; }
    return "house";
  }
  function showCard(cat, title, briefLine, full) {
    var card = $("card");
    card.className = "cat-" + cat;
    $("cardIco").innerHTML = svg(iconOf(cat));
    $("cardTitle").textContent = title;
    $("cardWhat").textContent = briefLine;
    $("cardWhy").textContent = full ? full.why : "";
    $("cardControl").textContent = full ? full.control : "";
    $("cardMore").classList.add("hidden");
    $("btnExpand").innerHTML = svg("expand");
    $("btnExpand").style.display = full ? "" : "none";
    card.classList.remove("hidden");
    if (state.cardTimer) { clearTimeout(state.cardTimer); }
    state.cardTimer = setTimeout(hideCard, CONFIG.cardDismissSec * 1000);
  }
  function hideCard() { $("card").classList.add("hidden"); }

  /* ================= scoring ================= */
  function onSpot(h) {
    if (state.paused || state.roundOver) { return; }
    if (state.found[h.id]) { return; }
    state.found[h.id] = true;
    state.lastSpot = Date.now();
    state.score += CONFIG.scorePerHazard;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    state.reaction[h.id] = elapsedMs() / 1000;
    var g = groupOf(h.id);
    if (g && g.marker) {
      g.marker.setAttribute("material", "color:#3DDC6A; wireframe:true; opacity:0.35; transparent:true");
    }
    unlockAudioOnce(); blip(880);
    showCard(catOf(h), h.name + "  +" + CONFIG.scorePerHazard, h.brief.what, h.brief);
    hud();
    if (HAZARDS.every(function (x) { return state.found[x.id]; })) { endRound("found"); }
  }
  function onGoodClick(d) {
    if (state.paused || state.roundOver) { return; }
    state.goodClicks += 1;
    state.listSafe[d.id] = true;
    state.score = Math.max(0, state.score - diff().penalty);
    state.streak = 0;
    state.lastSpot = Date.now();
    unlockAudioOnce(); blip(330);
    showCard("good", STRINGS.cardGoodTitle + "  -" + diff().penalty, d.brief.what, d.brief);
    hud();
  }
  function onWrong() {
    if (state.paused || state.roundOver) { return; }
    if (Date.now() - (state.lastSpot || 0) < 60) { return; }
    if (Date.now() - (state.lastWrong || 0) < 80) { return; }
    state.lastWrong = Date.now();
    state.wrongClicks += 1;
    state.score = Math.max(0, state.score - diff().penalty);
    state.streak = 0;
    unlockAudioOnce(); blip(220);
    showCard("penalty", STRINGS.cardPenaltyTitle + "  -" + diff().penalty, STRINGS.cardPenaltyBrief,
      { why: STRINGS.cardPenaltyWhy, control: STRINGS.cardPenaltyControl });
    hud();
  }

  /* ================= reticle flagging (E key) ================= */
  function flagCenter() {
    var cam = $("cam");
    var p = cam.object3D.position;
    var yaw = cam.object3D.rotation.y, pitch = cam.object3D.rotation.x;
    var fx = -Math.sin(yaw) * Math.cos(pitch), fy = Math.sin(pitch), fz = -Math.cos(yaw) * Math.cos(pitch);
    var best = null, bestAng = 999, onFound = false;
    HAZARDS.concat(DISTRACTORS).forEach(function (i) {
      var dx = i.pos.x - p.x, dy = aimY(i) - p.y, dz = i.pos.z - p.z;
      var dist = Math.hypot(dx, dy, dz) || 1;
      var dot = (dx * fx + dy * fy + dz * fz) / dist;
      var ang = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
      var threshold = Math.atan2(i.radius, dist) * 180 / Math.PI + 2;
      if (ang >= threshold) { return; }
      /* An already flagged hazard never wins the dot - something behind it
         still can - but it is noted, so that E costs nothing when the dot is
         resting on work already done. */
      if (state.found[i.id]) { onFound = true; return; }
      if (ang < bestAng) { bestAng = ang; best = i; }
    });
    if (best) {
      if (DISTRACTORS.indexOf(best) >= 0) { onGoodClick(best); } else { onSpot(best); }
    } else if (!onFound) { onWrong(); }
  }

  /* ================= round flow (Phase 4) ================= */
  function setPaused(p) {
    if (state.roundOver) { return; }
    if (p === state.paused) { return; }
    state.paused = p;
    if (p) {
      state.pauseBegan = Date.now();
      $("pause").classList.remove("hidden");
      $("btnResume").focus();
    } else {
      state.pausedTotal += Date.now() - state.pauseBegan;
      $("pause").classList.add("hidden");
    }
  }
  function endRound(reason) {
    if (state.roundOver) { return; }
    state.roundOver = true;
    stopBeeps();
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
    if (state.hintId) { clearInterval(state.hintId); state.hintId = null; }
    if (state.cardTimer) { clearTimeout(state.cardTimer); state.cardTimer = null; }
    hideCard();
    hideBanner();
    $("pause").classList.add("hidden");
    state.listOpen = false;
    $("listMode").classList.add("hidden");
    document.body.classList.remove("list-open");
    state.endReason = reason;
    state.roundMs = elapsedMs();
    /* The quiz comes first: its points are part of the score the review shows
       and the leaderboard saves, so the review cannot be drawn until it ends. */
    startQuiz();
  }
  /* Drawn after the quiz, so the score tile and the saved row are final. */
  function showReview() {
    $("endTitle").textContent =
      state.endReason === "found" ? STRINGS.endFoundTitle : STRINGS.endTimeTitle;
    var foundN = Object.keys(state.found).length;
    var q = state.quiz;
    $("endStats").innerHTML =
      '<div class="end-stat"><b>' + state.score + "</b><span>Score</span></div>" +
      '<div class="end-stat"><b>' + foundN + " / " + HAZARDS.length + "</b><span>Found</span></div>" +
      '<div class="end-stat"><b>' + state.bestStreak + "</b><span>Best streak</span></div>" +
      (q.paper.length
        ? '<div class="end-stat"><b>' + q.right + " / " + q.paper.length +
          "</b><span>" + STRINGS.quizStatLabel + "</span></div>"
        : "") +
      '<div class="end-stat"><b>' + fmtTime(state.roundMs) + "</b><span>Time</span></div>";
    saveScore();
    $("endMap").innerHTML = miniMap();
    renderChips();
    $("roundEnd").classList.remove("hidden");
    $("btnAgain").focus();
    $("phaseTag").textContent = "Round saved. The portal leaderboard keeps your best scores.";
  }

  /* ================= quick-check quiz (A7) ================= */
  /* Draws CONFIG.quizCount questions from the QUIZ pool and shuffles each set
     of options. The correct text is captured before the shuffle, so the answer
     can never drift out of step with the order shown. */
  function drawPaper() {
    var pool = (typeof QUIZ !== "undefined" && QUIZ) ? QUIZ : [];
    var want = Math.min(CONFIG.quizCount || 0, pool.length);
    return shuffle(pool.slice(0, pool.length)).slice(0, want).map(function (q) {
      var right = q.options[0];
      return {
        ask: q.ask, because: q.because, right: right,
        options: shuffle(q.options.slice(0))
      };
    });
  }
  function startQuiz() {
    state.quiz = { paper: drawPaper(), at: 0, right: 0, answered: false };
    if (!state.quiz.paper.length) { showReview(); return; }
    $("quizTitle").textContent = STRINGS.quizTitle;
    $("quizIntro").textContent =
      STRINGS.quizIntro + CONFIG.quizPerCorrect + STRINGS.quizIntroTail;
    $("quiz").classList.remove("hidden");
    $("phaseTag").textContent = STRINGS.quizPhaseTag;
    renderQuestion();
  }
  function renderQuestion() {
    var q = state.quiz.paper[state.quiz.at];
    state.quiz.answered = false;
    $("quizProgress").textContent =
      STRINGS.quizProgress + (state.quiz.at + 1) + STRINGS.quizOf + state.quiz.paper.length;
    $("quizAsk").textContent = q.ask;
    $("quizFeedback").className = "quiz-feedback hidden";
    $("btnQuizNext").classList.add("hidden");
    var box = $("quizOptions");
    box.innerHTML = "";
    q.options.forEach(function (text, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "quiz-opt";
      var key = document.createElement("span");
      key.className = "quiz-key";
      key.textContent = "ABC".charAt(i) || String(i + 1);
      var label = document.createElement("span");
      label.textContent = text;
      b.appendChild(key);
      b.appendChild(label);
      b.addEventListener("click", function () { answerQuestion(text); });
      box.appendChild(b);
    });
    var first = box.querySelector("button");
    if (first) { first.focus(); }
  }
  function answerQuestion(chosen) {
    if (state.quiz.answered) { return; }
    state.quiz.answered = true;
    var q = state.quiz.paper[state.quiz.at];
    var correct = chosen === q.right;
    if (correct) {
      state.quiz.right += 1;
      state.score += CONFIG.quizPerCorrect;
    }
    /* Mark every option: the chosen one, and the right one when it was missed,
       so a wrong answer still teaches rather than just scoring. */
    Array.prototype.forEach.call($("quizOptions").children, function (b) {
      var text = b.lastChild.textContent;
      b.disabled = true;
      if (text === q.right) { b.classList.add("is-right"); }
      else if (text === chosen) { b.classList.add("is-wrong"); }
    });
    $("quizVerdict").textContent = correct
      ? STRINGS.quizRight + " +" + CONFIG.quizPerCorrect
      : STRINGS.quizWrong;
    $("quizBecause").textContent = q.because;
    $("quizFeedback").className = "quiz-feedback " + (correct ? "is-right" : "is-wrong");
    unlockAudioOnce(); blip(correct ? 880 : 220);
    var last = state.quiz.at === state.quiz.paper.length - 1;
    var next = $("btnQuizNext");
    next.textContent = last ? STRINGS.quizFinish : STRINGS.quizNext;
    next.classList.remove("hidden");
    next.focus();
  }
  function nextQuestion() {
    if (!state.quiz.answered) { return; }
    if (state.quiz.at < state.quiz.paper.length - 1) {
      state.quiz.at += 1;
      renderQuestion();
      return;
    }
    $("quiz").classList.add("hidden");
    showReview();
  }
  function startRound() {
    state.roundStart = Date.now();
    state.pausedTotal = 0;
    if (state.mode === "attack") {
      $("timeStat").classList.remove("hidden");
      $("hudTime").textContent = fmtTime(diff().attackSec * 1000);
      state.timerId = setInterval(function () {
        if (state.paused || state.roundOver) { return; }
        var left = diff().attackSec * 1000 - elapsedMs();
        $("hudTime").textContent = fmtTime(left);
        $("hudTime").classList.toggle("low", left <= 10000);
        if (left <= 0) { endRound("time"); }
      }, 250);
    }
    if (state.mode === "training" && diff().hintAfterSec > 0) {
      state.hintId = setInterval(function () {
        if (state.paused || state.roundOver) { return; }
        if (elapsedMs() < diff().hintAfterSec * 1000) { return; }
        HAZARDS.forEach(function (h) {
          if (state.found[h.id] || state.hintShown[h.id]) { return; }
          state.hintShown[h.id] = true;
          var g = groupOf(h.id);
          if (g && g.marker) {
            g.marker.setAttribute("material",
              "color:#FFD100; wireframe:true; opacity:0.16; transparent:true");
          }
        });
      }, 1000);
    }
  }

  /* ================= Phase 5: review, list mode, VR ================= */
  function saveScore() {
    try {
      var rows = JSON.parse(localStorage.getItem("ss360_scores") || "[]");
      if (!Array.isArray(rows)) { rows = []; }
      rows.push({
        name: state.name, avatar: state.avatar, score: state.score,
        found: Object.keys(state.found).length, mode: state.mode,
        diff: state.difficulty, secs: Math.round(state.roundMs / 1000),
        quiz: state.quiz.right, quizOf: state.quiz.paper.length,
        date: Date.now()
      });
      rows.sort(function (a, b) { return b.score - a.score; });
      if (rows.length > 50) { rows = rows.slice(0, 50); }
      localStorage.setItem("ss360_scores", JSON.stringify(rows));
    } catch (e) { /* storage blocked: the leaderboard just stays empty */ }
  }
  function miniMap() {
    var s = '<svg viewBox="-19.5 -14.5 39 27.5" class="minimap" role="img" aria-label="' + STRINGS.mapAria + '">';
    s += '<rect x="-18" y="-12" width="36" height="24" fill="#101F31" stroke="#3A5068" stroke-width="0.35"/>';
    /* schematic landmarks: dock doors north, fire exit east, mezzanine south-west, walkway lanes */
    s += '<rect x="4.4" y="-12.35" width="3.2" height="0.7" fill="#3A5068"/>';
    s += '<rect x="10.4" y="-12.35" width="3.2" height="0.7" fill="#3A5068"/>';
    s += '<rect x="17.65" y="0.8" width="0.7" height="2.4" fill="#C0392B"/>';
    s += '<rect x="-9.2" y="8.8" width="6.4" height="3.1" fill="#22374F"/>';
    s += '<line x1="10.4" y1="-7" x2="10.4" y2="9" stroke="#FFD100" stroke-width="0.18" opacity="0.8"/>';
    s += '<line x1="12.2" y1="-7" x2="12.2" y2="9" stroke="#FFD100" stroke-width="0.18" opacity="0.8"/>';
    CONFIG.colliders.forEach(function (c) {
      s += '<circle cx="' + c.x + '" cy="' + c.z + '" r="' + c.r + '" fill="#1B2E44"/>';
    });
    s += '<circle cx="0" cy="9" r="0.55" fill="#4DA3FF"/>';
    s += '<text x="0" y="11.4" text-anchor="middle" font-size="1.3" fill="#9FB3C8">' + STRINGS.wordSpawn + "</text>";
    s += '<path d="M16.6 -13.6 L17.2 -12.3 L16 -12.3 Z" fill="#9FB3C8"/>';
    s += '<text x="14.4" y="-12.6" font-size="1.3" fill="#9FB3C8">' + STRINGS.wordNorth + "</text>";
    HAZARDS.forEach(function (h) {
      var got = !!state.found[h.id];
      s += '<circle cx="' + h.pos.x + '" cy="' + h.pos.z + '" r="0.85" fill="' + (got ? "#3DDC6A" : "#FF5A4E") + '"/>';
      if (got) {
        s += '<path d="M' + (h.pos.x - 0.4) + " " + h.pos.z + " l0.3 0.35 l0.55 -0.7" +
             '" stroke="#08131F" stroke-width="0.22" fill="none"/>';
      } else {
        s += '<path d="M' + (h.pos.x - 0.3) + " " + (h.pos.z - 0.3) + " l0.6 0.6 M" +
             (h.pos.x + 0.3) + " " + (h.pos.z - 0.3) + " l-0.6 0.6" +
             '" stroke="#08131F" stroke-width="0.22" fill="none"/>';
      }
      s += '<text x="' + h.pos.x + '" y="' + (h.pos.z + 2.1) + '" text-anchor="middle" font-size="1.15" fill="#9FB3C8">' + h.id + "</text>";
    });
    DISTRACTORS.forEach(function (d) {
      s += '<circle cx="' + d.pos.x + '" cy="' + d.pos.z + '" r="0.7" fill="none" stroke="#FFD100" stroke-width="0.28"/>';
      s += '<text x="' + d.pos.x + '" y="' + (d.pos.z + 2.1) + '" text-anchor="middle" font-size="1.15" fill="#9FB3C8">' + d.id + "</text>";
    });
    s += "</svg>";
    return s;
  }
  function renderChips() {
    var html = "";
    var foundList = HAZARDS.filter(function (h) { return state.reaction[h.id] !== undefined; });
    foundList.sort(function (a, b) { return state.reaction[a.id] - state.reaction[b.id]; });
    foundList.forEach(function (h) {
      html += '<span class="chip chip-found">' + h.name + " <b>" +
        state.reaction[h.id].toFixed(1) + " s</b></span>";
    });
    HAZARDS.forEach(function (h) {
      if (state.found[h.id]) { return; }
      html += '<span class="chip chip-missed">' + h.name + " <b>" + STRINGS.wordMissed + "</b></span>";
    });
    $("endChips").innerHTML = html;
  }
  function orderedItems() {
    if (!state.listOrder) {
      state.listOrder = shuffle(HAZARDS.concat(DISTRACTORS));
    }
    return state.listOrder;
  }
  /* ---- list mode navigation ----
     The list is a way of getting about the bay, not a way of scoring from a
     menu: choosing a place closes the list, walks the camera to a standoff a
     few metres off that spot and turns it to face it. The judgement - hazard
     or safe - is then made in the bay, with a click or the E key, exactly as
     it is for a player who found the spot by walking. */
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function aimY(item) { return item.aimY || 1.2; }
  function standable(p) {
    if (p.x < CONFIG.bounds.minX || p.x > CONFIG.bounds.maxX ||
        p.z < CONFIG.bounds.minZ || p.z > CONFIG.bounds.maxZ) { return false; }
    return !CONFIG.colliders.some(function (c) {
      return Math.hypot(p.x - c.x, p.z - c.z) < c.r;
    });
  }
  /* Where to stand: back off along the line the player is already on, so the
     walk is short and the bay stays legible on the way. */
  function standPoint(item) {
    var p = $("cam").object3D.position;
    var dx = p.x - item.pos.x, dz = p.z - item.pos.z;
    var d = Math.hypot(dx, dz);
    /* Standing on the spot, or directly under one up in the air, leaves no
       direction to keep: back off towards the middle of the bay instead. */
    if (d < 0.01) {
      dx = -item.pos.x; dz = -item.pos.z;
      d = Math.hypot(dx, dz) || 1;
    }
    var base = Math.atan2(dz / d, dx / d);
    var off = item.radius + CONFIG.locate.standoffM;
    var first = null;
    /* The player's own line first, then swing round the spot in both
       directions. Things against a wall, like the stillages at the fire exit,
       have only a few sides you can actually stand on. */
    for (var i = 0; i < 12; i++) {
      var turn = (i % 2 ? -1 : 1) * Math.ceil(i / 2) * (Math.PI / 6);
      var cand = { x: item.pos.x + Math.cos(base + turn) * off,
                   z: item.pos.z + Math.sin(base + turn) * off };
      if (!first) { first = { x: cand.x, z: cand.z }; }
      if (standable(cand)) { return cand; }
    }
    return clampPoint(first);
  }
  /* Yaw and pitch that put the spot on the centre dot, in the angle
     convention flagCenter reads back. */
  function aimFrom(x, z, item) {
    var dx = item.pos.x - x, dy = aimY(item) - CONFIG.eyeHeight, dz = item.pos.z - z;
    var flat = Math.hypot(dx, dz) || 0.0001;
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, flat) };
  }
  function camLook() {
    var cam = $("cam");
    var lc = cam.components && cam.components["look-controls"];
    return lc && lc.yawObject && lc.pitchObject ? lc : null;
  }
  function setCam(x, z, yaw, pitch) {
    var cam = $("cam");
    var lc = camLook();
    /* Clamp every step of the walk, not just where it ends: the movement
       clamp is also running on its own interval, and two writers disagreeing
       about a step that crosses a rack shows up as a stutter. */
    var at = clampPoint({ x: x, z: z });
    cam.object3D.position.set(at.x, CONFIG.eyeHeight, at.z);
    /* look-controls owns the camera rotation and rewrites it every frame, so
       the turn has to be written into its own yaw and pitch objects. */
    if (lc) { lc.yawObject.rotation.y = yaw; lc.pitchObject.rotation.x = pitch; }
    cam.object3D.rotation.y = yaw;
    cam.object3D.rotation.x = pitch;
  }
  function glideTo(to, item) {
    var cam = $("cam");
    var lc = camLook();
    var aim = aimFrom(to.x, to.z, item);
    var from = {
      x: cam.object3D.position.x, z: cam.object3D.position.z,
      yaw: lc ? lc.yawObject.rotation.y : cam.object3D.rotation.y,
      pitch: lc ? lc.pitchObject.rotation.x : cam.object3D.rotation.x
    };
    /* Turn the short way round: 170 degrees to minus 170 is a 20 degree turn,
       not a 340 degree spin. */
    var dyaw = aim.yaw - from.yaw;
    while (dyaw > Math.PI) { dyaw -= 2 * Math.PI; }
    while (dyaw < -Math.PI) { dyaw += 2 * Math.PI; }
    if (state.locate.raf) { cancelAnimationFrame(state.locate.raf); state.locate.raf = 0; }
    var ms = reduceMotion() ? 0 : CONFIG.locate.glideMs;
    if (ms <= 0) { setCam(to.x, to.z, aim.yaw, aim.pitch); return; }
    var t0 = Date.now();
    (function step() {
      var k = Math.min(1, (Date.now() - t0) / ms);
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setCam(from.x + (to.x - from.x) * e, from.z + (to.z - from.z) * e,
             from.yaw + dyaw * e, from.pitch + (aim.pitch - from.pitch) * e);
      if (k < 1) { state.locate.raf = requestAnimationFrame(step); }
      else { state.locate.raf = 0; }
    })();
  }
  /* The resting look of a marker box: green once flagged, a faint yellow once
     a training hint has pointed at it, invisible otherwise. */
  function markerRest(item) {
    if (state.found[item.id]) { return "color:#3DDC6A; wireframe:true; opacity:0.35; transparent:true"; }
    if (state.hintShown[item.id]) { return "color:#FFD100; wireframe:true; opacity:0.16; transparent:true"; }
    return "color:#FFD100; wireframe:true; opacity:0; transparent:true";
  }
  function restMarker(item) {
    var g = groupOf(item.id);
    if (g && g.marker) { g.marker.setAttribute("material", markerRest(item)); }
  }
  /* Blue, not hazard yellow: this box says you are here, not this is unsafe.
     It frames the place the list described; the call is still the player's. */
  function litMarker(item) {
    if (state.locate.markTimer) { clearTimeout(state.locate.markTimer); state.locate.markTimer = null; }
    if (state.locate.marked && state.locate.marked !== item) { restMarker(state.locate.marked); }
    state.locate.marked = item;
    var g = groupOf(item.id);
    if (g && g.marker) {
      g.marker.setAttribute("material", "color:#4DA3FF; wireframe:true; opacity:0.3; transparent:true");
    }
    state.locate.markTimer = setTimeout(function () {
      state.locate.markTimer = null;
      state.locate.marked = null;
      restMarker(item);
    }, CONFIG.locate.holdSec * 1000);
  }
  function hideBanner() { $("locate").classList.add("hidden"); }
  function showBanner(item) {
    var tip = STRINGS.listLocateTip;
    if (state.found[item.id]) { tip = STRINGS.listLocateDone; }
    else if (state.listSafe[item.id]) { tip = STRINGS.listLocateSafe; }
    $("locateWhere").textContent = STRINGS.listLocate + LISTINGS[item.id].place;
    $("locateTip").textContent = tip;
    $("locate").classList.remove("hidden");
    if (state.locate.bannerTimer) { clearTimeout(state.locate.bannerTimer); }
    state.locate.bannerTimer = setTimeout(hideBanner, CONFIG.locate.holdSec * 1000);
  }
  function goTo(item) {
    if (state.paused || state.roundOver) { return; }
    setList(false);
    glideTo(standPoint(item), item);
    litMarker(item);
    showBanner(item);
    /* Hand the keyboard back to the bay: E flags whatever is on the centre
       dot, and the list button is one Enter away again. */
    $("btnList").focus();
  }
  function renderList() {
    var ul = $("listItems");
    ul.innerHTML = "";
    orderedItems().forEach(function (item) {
      var L = LISTINGS[item.id];
      var isDistractor = DISTRACTORS.indexOf(item) >= 0;
      var settled = !!state.found[item.id] || !!state.listSafe[item.id];
      var li = document.createElement("li");
      li.className = "list-item" + (settled ? " done" : "");
      var main = document.createElement("div");
      main.className = "list-main";
      var place = document.createElement("strong");
      place.textContent = L.place;
      var sense = document.createElement("span");
      sense.textContent = L.sense;
      main.appendChild(place);
      main.appendChild(sense);
      /* A settled place keeps its row and its button - going back to look at
         something already called is fair - but says what was called there.
         Only then is the item named, because the judgement is behind it. */
      if (settled) {
        var status = document.createElement("span");
        status.className = "list-status";
        status.textContent = (isDistractor ? STRINGS.listSafeCalled : STRINGS.listFlagged) +
          " - " + item.name;
        main.appendChild(status);
      }
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn-flag";
      btn.textContent = STRINGS.listGo;
      btn.addEventListener("click", function () { goTo(item); });
      li.appendChild(main);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }
  function setList(open) {
    if (state.roundOver) { return; }
    state.listOpen = open;
    if (open) { renderList(); }
    $("listMode").classList.toggle("hidden", !open);
    document.body.classList.toggle("list-open", open);
    if (open) {
      var first = $("listItems").querySelector("button:not([disabled])");
      if (first) { first.focus(); }
    }
  }
  function vrCardOpen() {
    return !$("vrCard").classList.contains("hidden");
  }
  /* Focus trap: while an overlay is open, Tab cycles inside it only, so a
     keyboard or screen-reader user never lands on the HUD behind the panel. */
  function openOverlay() {
    var ids = ["listMode", "vrCard", "quiz", "roundEnd", "pause"];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el && !el.classList.contains("hidden")) { return el; }
    }
    return null;
  }
  function trapFocus(e) {
    var ov = openOverlay();
    if (!ov) { return; }
    var nodes = ov.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    var items = Array.prototype.filter.call(nodes, function (n) { return !n.disabled; });
    if (!items.length) { return; }
    var first = items[0], last = items[items.length - 1];
    var active = document.activeElement;
    if (ov.contains && !ov.contains(active)) { first.focus(); e.preventDefault(); return; }
    if (e.shiftKey && active === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && active === last) { first.focus(); e.preventDefault(); }
  }
  function showVrCard() {
    $("vrCard").classList.remove("hidden");
    $("btnVrClose").focus();
  }
  function onVrClick() {
    var scene = $("scene");
    if (navigator.xr && navigator.xr.isSessionSupported && scene.enterVR) {
      navigator.xr.isSessionSupported("immersive-vr").then(function (ok) {
        if (ok) { scene.enterVR(); } else { showVrCard(); }
      }).catch(function () { showVrCard(); });
    } else { showVrCard(); }
  }

  /* ================= engine online ================= */
  function engineOnline() {
    var scene = $("scene");
    function enter() {
      readParams();
      buildRoom(); buildProps(); buildHazardObjects();
      if (DEBUG) { buildDebug(); }
      setInterval(clampMovement, 33);
      $("room").addEventListener("click", function () { onWrong(); });
      $("props").addEventListener("click", function () { onWrong(); });
      $("icoScore").innerHTML = svg("score");
      $("icoStreak").innerHTML = svg("streak");
      $("icoFound").innerHTML = svg("tick");
      $("icoTime").innerHTML = svg("clock");
      $("btnPause").innerHTML = svg("pause");
      $("btnList").innerHTML = svg("list");
      $("btnVR").innerHTML = svg("vr");
      try { state.muted = localStorage.getItem("ss360_mute") === "1"; } catch (e) { /* ignore */ }
      $("btnMute").innerHTML = svg(state.muted ? "mute" : "sound");
      $("btnMute").addEventListener("click", function () {
        state.muted = !state.muted;
        try { localStorage.setItem("ss360_mute", state.muted ? "1" : "0"); } catch (e) { /* ignore */ }
        $("btnMute").innerHTML = svg(state.muted ? "mute" : "sound");
        $("btnMute").title = state.muted ? "Muted" : "Sound";
      });
      $("card").addEventListener("click", function (e) {
        if (e.target.closest("#btnExpand")) { return; }
        hideCard();
      });
      $("btnExpand").addEventListener("click", function () {
        $("card").classList.toggle("open");
        $("cardMore").classList.toggle("hidden");
        /* Heuristic evaluation fix: a learner who expands the card is reading it,
           so the 8-second auto-dismiss is cancelled until they close it. */
        if (state.cardTimer) { clearTimeout(state.cardTimer); state.cardTimer = null; }
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          if (state.listOpen) { setList(false); return; }
          if (vrCardOpen()) { $("vrCard").classList.add("hidden"); return; }
          if (state.roundOver) { return; }
          setPaused(!state.paused);
          return;
        }
        if ((e.key === "e" || e.key === "E") && !state.listOpen && !state.paused &&
            !state.roundOver && !vrCardOpen()) {
          flagCenter();
        }
        if (e.key === "Tab") { trapFocus(e); }
      });
      document.addEventListener("mousedown", unlockAudioOnce);

      /* Phase 4: pause and end panels */
      $("pauseTitle").textContent = STRINGS.pauseTitle;
      $("btnResume").textContent = STRINGS.resumeBtn;
      $("btnRestart").textContent = STRINGS.restartBtn;
      $("btnMenu").textContent = STRINGS.menuBtn;
      $("pauseFine").textContent = STRINGS.pauseFine;
      $("btnAgain").textContent = STRINGS.againBtn;
      $("btnEndMenu").textContent = STRINGS.menuBtn;
      $("pauseInfo").textContent = state.name + " - " +
        (state.mode === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle) +
        " - " + diff().label;
      $("btnPause").addEventListener("click", function () { setPaused(!state.paused); });
      $("btnResume").addEventListener("click", function () { setPaused(false); });
      $("btnRestart").addEventListener("click", function () { window.location.reload(); });
      $("btnMenu").addEventListener("click", function () { window.location.href = "index.html"; });
      $("btnAgain").addEventListener("click", function () { window.location.reload(); });
      $("btnEndMenu").addEventListener("click", function () { window.location.href = "index.html"; });

      /* Phase 5: list mode, VR, review text */
      $("btnList").title = STRINGS.listBtnTitle;
      $("btnVR").title = STRINGS.vrBtnTitle;
      $("listTitle").textContent = STRINGS.listTitle;
      $("listFine").textContent = STRINGS.listFine;
      $("vrTitle").textContent = STRINGS.vrTitle;
      $("vrBody").textContent = STRINGS.vrBody;
      $("btnVrClose").textContent = STRINGS.vrClose;
      $("endMapTitle").textContent = STRINGS.reviewMapTitle;
      $("endChipsTitle").textContent = STRINGS.reviewChipsTitle;
      $("btnList").addEventListener("click", function () { setList(true); });
      $("btnListClose").addEventListener("click", function () { setList(false); });
      $("btnVR").addEventListener("click", onVrClick);
      $("btnVrClose").addEventListener("click", function () { $("vrCard").classList.add("hidden"); });

      /* Quick-check quiz */
      $("btnQuizNext").addEventListener("click", nextQuestion);

      /* Phase 6: hardening. Pointer lock is requested only in a full tab.
         Embedded frames (live preview, LMS embeds) get drag-look directly,
         so nothing depends on a permission the frame may never grant. */
      var embedded = false;
      try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
      if (embedded) {
        $("cam").setAttribute("look-controls", "pointerLockEnabled", false);
      }
      /* Auto-pause when the tab goes to the background: the round clock is
         wall-clock based, so an abandoned tab must not drain the round. */
      document.addEventListener("visibilitychange", function () {
        if (document.hidden && !state.roundOver && !state.paused) { setPaused(true); }
      });

      startBeeps();
      startRound();
      hud();
      $("hud").classList.remove("hidden");
      $("reticle").classList.remove("hidden");
      /* The tag is on screen during a client demonstration, so it names the
         round, not the build phase it was added in. */
      $("phaseTag").textContent =
        (state.mode === "attack" ? STRINGS.modeAttackTitle : STRINGS.modeTrainingTitle) + ", " +
        diff().label + ". Find all nine hazards. Esc pauses.";
    }
    if (scene.hasLoaded) { enter(); }
    else { scene.addEventListener("loaded", enter); }
  }

  /* ================= engine guard (phase 1) ================= */
  function diagnose() {
    var bootErrors = window.__ssErrors || [];
    var webgl = (function () {
      try {
        var c = document.createElement("canvas");
        return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
      } catch (e) { return false; }
    })();
    var why = $("failWhy");
    if (!webgl) {
      why.textContent = "This viewer reports no usable WebGL graphics context, so no 3D page can run here regardless of code. Try Chrome or Edge, and enable hardware acceleration.";
    } else {
      why.textContent = "The 3D library did not load, even after a cache-bypassing retry. Checking your copy of vendor/aframe.min.js now...";
      fetch("vendor/aframe.min.js").then(function (res) {
        if (!res.ok) { var e = new Error("http"); e.status = res.status; throw e; }
        return res.arrayBuffer();
      }).then(function (buf) {
        if (buf.byteLength !== LIB_BYTES) {
          why.textContent = "vendor/aframe.min.js arrived truncated: " + buf.byteLength + " bytes instead of " + LIB_BYTES + ". Your copy is damaged. Restore it from the official download at aframe.io releases 1.6.0.";
          return;
        }
        if (window.crypto && window.crypto.subtle) {
          return window.crypto.subtle.digest("SHA-384", buf).then(function (h) {
            var b64 = btoa(String.fromCharCode.apply(null, new Uint8Array(h)));
            if (b64 !== SRI.slice(7)) {
              why.textContent = "vendor/aframe.min.js arrived altered: its fingerprint does not match the pinned one. Restore it from the official download at aframe.io releases 1.6.0.";
            } else if (bootErrors.some(function (m) { return m.indexOf("Content Security Policy") >= 0 || m.indexOf("EvalError") >= 0; })) {
              why.textContent = "The page's own Content Security Policy blocked the 3D library: the engine needs 'unsafe-eval' in the script-src directive. This is a one-line fix in game.html, and this build should already contain it. Reported error: " +
                bootErrors.filter(function (m) { return m.indexOf("Content Security Policy") >= 0 || m.indexOf("EvalError") >= 0; })[0];
            } else if (bootErrors.some(function (m) { return m.indexOf("script-error") === 0 && m.indexOf("aframe") >= 0; })) {
              why.textContent = "The library file is intact but crashed while starting in this browser: " +
                bootErrors.filter(function (m) { return m.indexOf("aframe") >= 0; })[0] +
                ". This usually means an outdated browser. Update Chrome or Edge to the latest version and reload.";
            } else if (bootErrors.some(function (m) { return m.indexOf("load-failed") === 0 && m.indexOf("aframe") >= 0; })) {
              why.textContent = "The file is intact on the server, but your browser blocked the script tag itself: " +
                bootErrors.filter(function (m) { return m.indexOf("aframe") >= 0; })[0] +
                ". That is an extension or security product intercepting scripts. Retry in a private window with extensions disabled; if it works there, allow-list this site in the extension.";
            } else {
              why.textContent = "vendor/aframe.min.js is present and intact, but the browser refused to run it and reported no reason. Ask your tutor or IT service to check browser policy; then try a different browser entirely.";
            }
          });
        }
        why.textContent = "vendor/aframe.min.js is present with the correct size, but the browser refused to run it. Retry in a private window with extensions disabled, and read the first console line with F12.";
      }).catch(function (err) {
        if (location.protocol === "file:") {
          why.textContent = "This browser does not let a page opened directly from disk check its own files, so the exact cause cannot be read here. Open the live link, or serve the folder (python -m http.server 8000, then http://127.0.0.1:8000) and reload; if the engine still fails, this banner will then name the cause.";
          return;
        }
        why.textContent = "vendor/aframe.min.js could not be fetched from your copy (" + (err && err.status ? "server said " + err.status : "network error") + "). The file is missing from your project folder. Restore it from the official download at aframe.io releases 1.6.0.";
      });
    }
    $("engineFail").classList.remove("hidden");
    $("btnRetry").addEventListener("click", function () { window.location.reload(); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.AFRAME) { engineOnline(); return; }
    /* Second chance: re-inject the library with a cache-busting query. */
    $("engineFail").classList.remove("hidden");
    $("failWhy").textContent = "The 3D engine did not load on the first attempt. Retrying with a cache-bypassing load...";
    var s = document.createElement("script");
    s.src = "vendor/aframe.min.js?retry=" + Date.now();
    if (location.protocol !== "file:") { s.integrity = SRI; }
    s.onload = function () {
      if (window.AFRAME) { $("engineFail").classList.add("hidden"); engineOnline(); }
      else { diagnose(); }
    };
    s.onerror = function () { diagnose(); };
    document.head.appendChild(s);
  });
})();
