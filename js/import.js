// ------------------------------------------------------------
// IMPORT MODULE
// ------------------------------------------------------------
// Handles Stableford and Medal CSV import via:
// - Textarea parse buttons
// - File input browse
// - Drag & drop
// - Paste onto drop zone
//
// Medal CSV note: the scoring software can export either a single-division
// file or a three-division file with "Division 1/2/3" header rows.
// The importer now supports both formats.
// ------------------------------------------------------------

window.Import = {

  init() {
    this.initTextareaButtons();
    this.initFileInputs();
    this.initPasteHandlers();
    this.initDragAndDrop();
  },

  // -----------------------------
  // TEXTAREA PARSE BUTTONS
  // -----------------------------
  initTextareaButtons() {
    const pairs = [
      { btnId: "btn-parse-stableford",      txtId: "txt-stableford",       statusId: "status-stableford",       handler: rows => this.handleStablefordCSV(rows) },
      { btnId: "btn-parse-medal",            txtId: "txt-medal",            statusId: "status-medal",            handler: rows => this.handleMedalCSV(rows) },
      { btnId: "btn-parse-medal-single",     txtId: "txt-medal-single",     statusId: "status-medal-single",     handler: rows => this.handleMedalSingleCSV(rows) },
      { btnId: "btn-parse-twos-stableford",  txtId: "txt-twos-stableford",  statusId: "status-twos-stableford",  handler: rows => this.handleTwosStablefordCSV(rows) },
      { btnId: "btn-parse-twos-medal",       txtId: "txt-twos-medal",       statusId: "status-twos-medal",       handler: rows => this.handleTwosMedalCSV(rows) },
    ];

    pairs.forEach(({ btnId, txtId, statusId, handler }) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener("click", () => {
        const text = document.getElementById(txtId).value.trim();
        if (!text) { Utils.setStatus(statusId, "No data to parse", "warn"); return; }
        handler(Utils.parseCSV(text));
      });
    });
  },

  // -----------------------------
  // FILE INPUTS
  // -----------------------------
  initFileInputs() {
    // File inputs are now overlaid inside drop zones — bind by type
    const map = [
      { id: "file-stableford",      txt: "txt-stableford",      type: "stableford"      },
      { id: "file-medal",           txt: "txt-medal",           type: "medal"           },
      { id: "file-medal-single",    txt: "txt-medal-single",    type: "medal-single"    },
      { id: "file-twos-stableford", txt: "txt-twos-stableford", type: "twos-stableford" },
      { id: "file-twos-medal",      txt: "txt-twos-medal",      type: "twos-medal"      },
    ];

    map.forEach(({ id, txt, type }) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          document.getElementById(txt).value = reader.result;
          this._routeRows(type, Utils.parseCSV(reader.result));
        };
        reader.readAsText(file);
        // Reset so same file can be reloaded
        input.value = "";
      });
    });
  },

  // -----------------------------
  // PASTE HANDLERS
  // -----------------------------
  initPasteHandlers() {
    this._bindPaste('[data-type="stableford"]',      "txt-stableford",      rows => this.handleStablefordCSV(rows));
    this._bindPaste('[data-type="medal"]',           "txt-medal",           rows => this.handleMedalCSV(rows));
    this._bindPaste('[data-type="medal-single"]',    "txt-medal-single",    rows => this.handleMedalSingleCSV(rows));
    this._bindPaste('[data-type="twos-stableford"]', "txt-twos-stableford", rows => this.handleTwosStablefordCSV(rows));
    this._bindPaste('[data-type="twos-medal"]',      "txt-twos-medal",      rows => this.handleTwosMedalCSV(rows));
  },

  _bindPaste(selector, textareaId, handler) {
    const zone = document.querySelector(selector);
    if (!zone) return;
    zone.addEventListener("paste", e => {
      e.preventDefault();
      const text = e.clipboardData.getData("text");
      document.getElementById(textareaId).value = text;
      handler(Utils.parseCSV(text));
    });
  },

  // -----------------------------
  // DRAG & DROP
  // -----------------------------
  initDragAndDrop() {
    // File inputs are overlaid on drop zones so click-to-browse is native.
    // We still handle drag-and-drop visuals and routing here.
    document.querySelectorAll(".drop-zone").forEach(zone => {

      zone.addEventListener("dragover", e => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add("dragover");
      });

      zone.addEventListener("dragleave", e => {
        e.preventDefault();
        zone.classList.remove("dragover");
      });

      zone.addEventListener("drop", e => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove("dragover");

        const file = e.dataTransfer.files[0];
        if (!file) return;

        const type = zone.dataset.type;
        const reader = new FileReader();
        reader.onload = () => {
          const txtId = "txt-" + type;
          document.getElementById(txtId).value = reader.result;
          this._routeRows(type, Utils.parseCSV(reader.result));
        };
        reader.readAsText(file);
      });
    });
  },

  // ------------------------------------------------------------
  // ROUTE parsed rows to the correct handler by zone type
  // ------------------------------------------------------------
  _routeRows(type, rows) {
    switch (type) {
      case "stableford":      return this.handleStablefordCSV(rows);
      case "medal":           return this.handleMedalCSV(rows);
      case "medal-single":    return this.handleMedalSingleCSV(rows);
      case "twos-stableford": return this.handleTwosStablefordCSV(rows);
      case "twos-medal":      return this.handleTwosMedalCSV(rows);
      default: console.warn("Unknown import type:", type);
    }
  },

  _extractComment(row, startIndex) {
    return row.slice(startIndex).map(cell => cell && cell.toString().trim()).filter(Boolean).join(" ").trim();
  },

  _normalizeStatus(cell) {
    if (!cell) return "";
    return cell.trim().toUpperCase();
  },

  _assignMedalDivisionByHcp(hcp) {
    const b = State.boundaries;
    if (!Number.isFinite(hcp)) return null;
    if (hcp >= b.d1min && hcp <= b.d1max) return 1;
    if (hcp >= b.d2min && hcp <= b.d2max) return 2;
    if (hcp >= b.d3min && hcp <= b.d3max) return 3;
    return null;
  },

  // ------------------------------------------------------------
  // CSV PROCESSORS
  // ------------------------------------------------------------

  // ------------------------------------------------------------------
  // STABLEFORD PARSER
  // Format: plain unquoted CSV
  // Columns: Pos | Name | Gross | Hcp | Stableford Pts
  // Sort: descending (higher points = better)
  // No division header rows in this file format.
  // ------------------------------------------------------------------
  handleStablefordCSV(rows) {
    const eligible = [];
    const all = [];

    rows.forEach((r, idx) => {
      if (!r || r.length < 5) return;

      const posCell = r[0].trim().replace(/^﻿/, ""); // strip BOM if present
      const lowerPos = posCell.toLowerCase();
      const name  = (r[1] || "").trim();
      const gross = Number(r[2]);
      const hcp   = Number(r[3]);
      const pts   = Number(r[4]);   // column 4 = stableford points
      const ptsRaw = (r[4] || "").trim().toUpperCase();
      const start = !isNaN(pts) ? 5 : 4;
      const comment = this._extractComment(r, start);

      if (lowerPos === "pos") return;

      if (!name) return;

      const player = {
        id: "S" + idx,
        name,
        hcp: isNaN(hcp) ? null : hcp,
        gross: isNaN(gross) ? null : gross,
        type: "stableford",
        comment: comment || ""
      };

      if (!isNaN(Number(posCell)) && !isNaN(pts)) {
        player.points = pts;
        player.score = pts;
        player.status = "";
        eligible.push(player);
      } else {
        player.points = null;
        player.score = null;
        player.status = ["NR", "DQ"].includes(ptsRaw) ? ptsRaw : this._normalizeStatus(posCell) || "NR";
      }

      all.push(player);
    });

    State.rawStableford = eligible;
    State.rawStablefordAll = all;
    Utils.setStatus("status-stableford", `Loaded ${eligible.length} players (${all.length} total)`, eligible.length ? "ok" : "warn");
    document.getElementById("hint-stableford").textContent =
      all.length ? `${eligible.length} eligible Stableford players and ${all.length - eligible.length} DQ/NR entries loaded.` : "No valid rows found — check CSV format.";
    Configure.recomputeDivisionsAndPreview();
  },

  // ------------------------------------------------------------------
  // MEDAL PARSER
  // Format: quoted CSV exported by scoring software
  // Columns: Pos | Name | Gross | Hcp | Nett
  // Sort: ascending (lower nett score = better)
  // Supports either single-division CSV or three-division CSV with
  // explicit "Division 1/2/3" header rows.
  // ------------------------------------------------------------------
  handleMedalCSV(rows) {
    const players = [];
    const all = [];
    let currentDivision = null;

    rows.forEach((r, idx) => {
      if (!r || r.length < 5) return;

      const posCell = r[0].trim().replace(/^﻿/, ""); // strip BOM if present
      const lowerPos = posCell.toLowerCase();

      // Preserve explicit division headers.
      if (lowerPos.startsWith("division")) {
        const match = posCell.match(/division\s*([1-3])/i);
        currentDivision = match ? Number(match[1]) : currentDivision;
        return;
      }

      if (lowerPos === "pos") return;

      const name  = (r[1] || "").trim();
      const gross = Number(r[2]);
      const hcp   = Number(r[3]);
      const nett  = Number(r[4]);   // column 4 = nett score
      const nettRaw = (r[4] || "").trim().toUpperCase();
      const comment = this._extractComment(r, 5);

      if (!name) return;

      const player = {
        id: "M" + idx,
        name,
        hcp: isNaN(hcp) ? null : hcp,
        gross: isNaN(gross) ? null : gross,
        type: "medal",
        comment: comment || ""
      };

      if (!isNaN(Number(posCell)) && !isNaN(nett)) {
        player.nett = nett;
        player.score = nett;
        player.status = "";
        player.division = currentDivision || null;
        players.push(player);
      } else {
        player.nett = null;
        player.score = null;
        player.status = ["NR", "DQ"].includes(nettRaw) ? nettRaw : this._normalizeStatus(posCell) || "NR";
        player.division = currentDivision || this._assignMedalDivisionByHcp(hcp);
      }

      all.push(player);
    });

    State.rawMedal = players;
    State.rawMedalAll = all;
    State.rawMedalSingle = [];
    State.rawMedalSingleAll = [];
    Utils.setStatus("status-medal", `Loaded ${players.length} players (${all.length} total)`, players.length ? "ok" : "warn");
    document.getElementById("hint-medal").textContent =
      all.length ? `${players.length} eligible Medal players and ${all.length - players.length} DQ/NR entries loaded.` : "No valid rows found — check CSV format.";
    Configure.recomputeDivisionsAndPreview();
  },

  handleMedalSingleCSV(rows) {
    const players = [];
    const all = [];

    rows.forEach((r, idx) => {
      if (!r || r.length < 5) return;

      const posCell = r[0].trim().replace(/^﻿/, ""); // strip BOM if present
      const lowerPos = posCell.toLowerCase();
      const name  = (r[1] || "").trim();
      const gross = Number(r[2]);
      const hcp   = Number(r[3]);
      const nett  = Number(r[4]);   // column 4 = nett score
      const nettRaw = (r[4] || "").trim().toUpperCase();
      const start = !isNaN(nett) ? 5 : 4;
      const comment = this._extractComment(r, start);

      if (lowerPos === "pos") return;
      if (!name) return;

      const player = {
        id: "MS" + idx,
        name,
        hcp: isNaN(hcp) ? null : hcp,
        gross: isNaN(gross) ? null : gross,
        type: "medal-single",
        comment: comment || "",
        division: 1
      };

      if (!isNaN(Number(posCell)) && !isNaN(nett)) {
        player.nett = nett;
        player.score = nett;
        player.status = "";
        players.push(player);
      } else {
        player.nett = null;
        player.score = null;
        player.status = ["NR", "DQ"].includes(nettRaw) ? nettRaw : this._normalizeStatus(posCell) || "NR";
      }

      all.push(player);
    });

    State.rawMedalSingle = players;
    State.rawMedalSingleAll = all;
    State.rawMedal = [];
    State.rawMedalAll = [];
    Utils.setStatus("status-medal-single", `Loaded ${players.length} players (${all.length} total)`, players.length ? "ok" : "warn");
    document.getElementById("hint-medal-single").textContent =
      all.length ? `${players.length} eligible single-division Medal players and ${all.length - players.length} DQ/NR entries loaded.` : "No valid rows found — check CSV format.";
    Configure.recomputeDivisionsAndPreview();
  },

  // Two's CSV format: Player Name | Handicap | Hole
  // "Division N" header rows are skipped.
  // Hole field e.g. "2 @ 5th" or "2 @ 5th, 2 @ 14th" or "1 @ 7th" (hole-in-one)
  _parseTwosRows(rows, idPrefix) {
    const players = [];

    rows.forEach((r, idx) => {
      if (!r || r.length < 3) return;
      const first = r[0].toLowerCase().trim();

      // Skip header and division rows
      if (first === "player name" || first === "player" || first.includes("division")) return;
      if (!r[0].trim()) return;

      const name  = r[0].trim();
      const hcp   = Number(r[1]);
      const holes = r[2] ? r[2].trim() : "";

      if (!name || !holes) return;

      players.push({ id: idPrefix + idx, name, hcp, holes });
    });

    return players;
  },

  handleTwosStablefordCSV(rows) {
    const players = this._parseTwosRows(rows, "TS");
    State.rawTwosStableford = players;
    Utils.setStatus("status-twos-stableford", `Loaded ${players.length} players`, players.length ? "ok" : "warn");
    document.getElementById("hint-twos-stableford").textContent =
      players.length ? `${players.length} Two's Stableford players loaded.` : "No valid rows found — check CSV format.";
    Twos.render();
  },

  handleTwosMedalCSV(rows) {
    const players = this._parseTwosRows(rows, "TM");
    State.rawTwosMedal = players;
    Utils.setStatus("status-twos-medal", `Loaded ${players.length} players`, players.length ? "ok" : "warn");
    document.getElementById("hint-twos-medal").textContent =
      players.length ? `${players.length} Two's Medal players loaded.` : "No valid rows found — check CSV format.";
    Twos.render();
  }
};
