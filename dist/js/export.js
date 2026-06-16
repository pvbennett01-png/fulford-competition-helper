// ------------------------------------------------------------
// EXPORT / PRINT MODULE
// ------------------------------------------------------------
// Each button on the Export tab opens a dedicated print window
// with a clean, formatted version of the requested report.
// Print formatting is built per report type.
// ------------------------------------------------------------

window.Export = {

  init() {
    document.querySelectorAll(".export-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const report = btn.dataset.report;
        this.openReport(report);
      });
    });
  },

  // -----------------------------
  // OPEN PRINT WINDOW
  // -----------------------------
  openReport(report) {
    const handlers = {
      "stb-full":       () => this.printStablefordFull(),
      "stb-prizes":     () => this.printStablefordPrizes(),
      "stb-twos":       () => this.printTwos("stableford"),
      "med-full":       () => this.printMedalFull(),
      "med-div1":       () => this.printMedalDiv("div1", "Division 1"),
      "med-div2":       () => this.printMedalDiv("div2", "Division 2"),
      "med-div3":       () => this.printMedalDiv("div3", "Division 3"),
      "med-twos":       () => this.printTwos("medal"),
      "med-prizes":     () => this.printMedalPrizes(),
      "export-all-csv": () => this.exportAllCSV(),
    };

    const fn = handlers[report];
    if (fn) fn();
    else console.warn("Unknown report:", report);
  },

  // -----------------------------
  // SHARED: open a print window with HTML content
  // -----------------------------
  _openWindow(title, bodyHtml) {
    const win = window.open("", "_blank", "width=900,height=700");
    const base = window.location.href.replace(/[^/]*$/, "");
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <base href="${base}">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; margin: 24px 36px; color: #1a2e1d; background: #fff; }
    h3  { font-size: 14px; margin: 20px 0 6px; color: #134325; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px; }
    th   { background: #134325; color: #fff; font-weight: 700; font-size: 11px;
           text-transform: uppercase; letter-spacing: 0.4px;
           padding: 6px 10px; text-align: left; }
    td   { padding: 5px 10px; border-bottom: 1px solid #e4ede6; }
    tbody tr:nth-child(even) td { background: #f4f8f5; }
    .right { text-align: right; }
    .prize { font-weight: 700; color: #134325; }
    .section-title { font-family: 'Playfair Display', Georgia, serif;
                     font-size: 16px; font-weight: 700; color: #134325;
                     margin: 24px 0 8px; padding-bottom: 6px;
                     border-bottom: 2px solid #134325; }
    .meta  { font-size: 12px; color: #5a6e5c; margin-bottom: 16px; }
    .print-btn { margin-top: 28px; text-align: right; }
    .print-btn button { padding: 9px 20px; font-size: 13px; font-family: inherit;
                        background: #134325; color: #fff; border: none;
                        border-radius: 6px; cursor: pointer; font-weight: 600; }
    .print-btn button:hover { background: #1e6b3a; }
    @media print {
      .print-btn { display: none; }
      body { margin: 10px; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
  <div class="print-btn">
    <button onclick="window.print()">🖨 Print / Save PDF</button>
  </div>
</body>
</html>`);
    win.document.close();
  },

  // -----------------------------
  // SHARED: build header HTML
  // -----------------------------
  _header(subtitle) {
    const name = State.compName || "";
    const date = State.compDate
      ? new Date(State.compDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "";
    return `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #134325;">
        <img src="Logo.png" alt="Fulford Golf Club" style="height:70px;width:auto;">
        <div>
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#134325;font-weight:600;">Fulford Golf Club</div>
          ${name ? `<div style="font-size:18px;font-weight:700;margin:2px 0;">${name}</div>` : ""}
          <div style="font-size:14px;color:#57606a;">${subtitle}${date ? " &mdash; " + date : ""}</div>
        </div>
      </div>`;
  },

  // -----------------------------
  // SHARED: build a results table for a division/section
  // -----------------------------
  _sectionTable(key, title, scoreHeader, showPrizes) {
    const list   = State.divisions[key] || [];
    const prizes = State.prizeData[key] || [];
    if (!list.length) return `<p style="color:#888;font-size:12px;">No data for ${title}.</p>`;

    const prizeCol = showPrizes ? `<th class="right">Prize</th>` : "";

    let rows = "";
    const displayed = showPrizes ? list.slice(0, prizes.length) : list;

    displayed.forEach((p, i) => {
      const prizeCell = showPrizes
        ? `<td class="right prize">${prizes[i] != null ? "£" + prizes[i] : ""}</td>`
        : "";
      rows += `<tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.hcp}</td>
        <td class="right">${p.score}</td>
        ${prizeCell}
      </tr>`;
    });

    return `
      <div class="section-title">${title}</div>
      <table>
        <thead><tr>
          <th>Pos</th><th>Name</th><th>Hcp</th>
          <th class="right">${scoreHeader}</th>${prizeCol}
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  // -----------------------------
  // SHARED: Two's table HTML
  // -----------------------------
  _twosTable(players, fund, title) {
    const results = Twos.compute(players, fund);
    if (!results.length) return `<p style="color:#888;font-size:12px;">No Two's data for ${title}.</p>`;

    const totalShares = results.reduce((s, p) => s + p.shares, 0);
    const prizePerShare = (fund / totalShares).toFixed(2);

    let rows = results.map(p => `<tr>
      <td>${p.name}</td>
      <td>${p.hcp}</td>
      <td>${p.holes}</td>
      <td class="right">${p.shares}</td>
      <td class="right prize">£${p.prize}</td>
    </tr>`).join("");

    const total = results.reduce((s, p) => s + Number(p.prize), 0).toFixed(2);
    rows += `<tr style="font-weight:600;border-top:2px solid #d0d7de;">
      <td colspan="3">Total</td>
      <td class="right">${totalShares}</td>
      <td class="right">£${total}</td>
    </tr>`;

    return `
      <div class="section-title">${title}</div>
      <p class="meta">Fund: £${fund} &divide; ${totalShares} shares = £${prizePerShare}/share</p>
      <table>
        <thead><tr>
          <th>Name</th><th>Hcp</th><th>Hole(s)</th>
          <th class="right">Shares</th><th class="right">Prize</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  },

  // ============================================================
  // REPORT BUILDERS
  // ============================================================

  printStablefordFull() {
    const stablefordSource = State.rawStablefordAll.length ? State.rawStablefordAll : State.rawStableford;
    const list = [...stablefordSource].sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });

    const rows = list.map((p, i) => `<tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.hcp != null ? p.hcp : ""}</td>
        <td class="right">${p.score != null ? p.score : ""}</td>
        <td>${p.status || ""}</td>
        <td>${p.comment || ""}</td>
      </tr>`).join("");

    const table = list.length
      ? `<table>
          <thead><tr>
            <th>Pos</th><th>Name</th><th>Hcp</th><th class="right">Pts</th><th>Status</th><th>Comment</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : `<p style="color:#888;font-size:12px;">No Stableford data loaded.</p>`;

    this._openWindow("Stableford Full Results", this._header("Stableford — Full Results") + table);
  },

  printStablefordPrizes() {
    const body = this._header("Stableford — Prizes")
      + this._sectionTable("stableford", "Stableford", "Pts", true);
    this._openWindow("Stableford Prizes", body);
  },

  printTwos(type) {
    const isStb   = type === "stableford";
    const players = isStb ? State.rawTwosStableford : State.rawTwosMedal;
    const fund    = isStb ? State.twosStablefordFund : State.twosMedalFund;
    const label   = isStb ? "Two's — Stableford" : "Two's — Medal";

    const body = this._header(label)
      + this._twosTable(players, fund, label);
    this._openWindow(label, body);
  },

  printMedalFull() {
    const allMedal = State.rawMedalSingleAll.length ? State.rawMedalSingleAll : State.rawMedalAll;
    const source = allMedal.length ? allMedal : State.rawMedal;
    const list = [...source].sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return a.score - b.score;
    });

    let rows = "";
    list.forEach((p, i) => {
      rows += `<tr>
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.hcp != null ? p.hcp : ""}</td>
        <td class="right">${p.score != null ? p.score : ""}</td>
        <td>${p.status || ""}</td>
        <td>${p.comment || ""}</td>
      </tr>`;
    });

    const table = list.length
      ? `<table>
          <thead><tr>
            <th>Pos</th><th>Name</th><th>Hcp</th><th class="right">Nett</th><th>Status</th><th>Comment</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`
      : `<p style="color:#888;font-size:12px;">No Medal data loaded.</p>`;

    this._openWindow("Medal Full Results", this._header("Medal — Full Results") + table);
  },

  printMedalDiv(key, label) {
    const body = this._header(`Medal — ${label}`)
      + this._sectionTable(key, label, "Nett", false);
    this._openWindow(`Medal ${label}`, body);
  },

  printMedalPrizes() {
    const n = State.medalDivisions || 3;
    let body = this._header("Medal — Prizes")
      + this._sectionTable("div1", "Division 1", "Nett", true);
    if (n >= 2) body += this._sectionTable("div2", "Division 2", "Nett", true);
    if (n >= 3) body += this._sectionTable("div3", "Division 3", "Nett", true);
    this._openWindow("Medal Prizes", body);
  },

  // ============================================================
  // EXPORT ALL — single CSV with every table stacked vertically
  // ============================================================
  exportAllCSV() {
    const compName = State.compName || "Competition";
    const compDate = State.compDate
      ? new Date(State.compDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const numDivs = State.medalDivisions || 3;
    const rows = [];

    const pushSection = (title, dataRows) => {
      rows.push([title]);
      dataRows.forEach(r => rows.push(r));
      rows.push([]);
    };

    rows.push([`Competition: ${compName}`, `Date: ${compDate}`]);
    rows.push([]);

    // Medal full results
    const allMedal = State.rawMedalSingleAll.length ? State.rawMedalSingleAll : State.rawMedalAll;
    const medalSrc = allMedal.length ? allMedal : State.rawMedal;
    const medalList = [...medalSrc].sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return a.score - b.score;
    });
    if (medalList.length) {
      const r = [["Pos", "Name", "Hcp", "Nett", "Status", "Comment"]];
      medalList.forEach((p, i) => r.push([i + 1, p.name, p.hcp ?? "", p.score ?? "", p.status || "", p.comment || ""]));
      pushSection("MEDAL — FULL RESULTS", r);
    }

    // Medal prizes per active division
    for (let d = 1; d <= numDivs; d++) {
      const key    = `div${d}`;
      const list   = State.divisions[key] || [];
      const prizes = State.prizeData[key] || [];
      if (list.length && prizes.length) {
        const r = [["Pos", "Name", "Hcp", "Nett", "Prize (£)"]];
        list.slice(0, prizes.length).forEach((p, i) => r.push([i + 1, p.name, p.hcp, p.score, prizes[i]]));
        pushSection(`DIVISION ${d} — PRIZES`, r);
      }
    }

    // Stableford full results
    const stbSrc  = State.rawStablefordAll.length ? State.rawStablefordAll : State.rawStableford;
    const stbList = [...stbSrc].sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });
    if (stbList.length) {
      const r = [["Pos", "Name", "Hcp", "Pts", "Status", "Comment"]];
      stbList.forEach((p, i) => r.push([i + 1, p.name, p.hcp ?? "", p.score ?? "", p.status || "", p.comment || ""]));
      pushSection("STABLEFORD — FULL RESULTS", r);
    }

    // Stableford prizes
    const stbDiv    = State.divisions["stableford"] || [];
    const stbPrizes = State.prizeData["stableford"] || [];
    if (stbDiv.length && stbPrizes.length) {
      const r = [["Pos", "Name", "Hcp", "Pts", "Prize (£)"]];
      stbDiv.slice(0, stbPrizes.length).forEach((p, i) => r.push([i + 1, p.name, p.hcp, p.score, stbPrizes[i]]));
      pushSection("STABLEFORD — PRIZES", r);
    }

    // Two's (only if data present)
    [["stableford", State.rawTwosStableford, State.twosStablefordFund, "TWO'S — STABLEFORD"],
     ["medal",      State.rawTwosMedal,      State.twosMedalFund,      "TWO'S — MEDAL"]
    ].forEach(([, players, fund, title]) => {
      if (!players.length) return;
      const results = Twos.compute(players, fund);
      if (!results.length) return;
      const r = [["Name", "Hcp", "Hole(s)", "Shares", "Prize (£)"]];
      results.forEach(p => r.push([p.name, p.hcp, p.holes, p.shares, p.prize]));
      pushSection(title, r);
    });

    const namePart = compName.replace(/[^a-z0-9]/gi, "-");
    const datePart = State.compDate || "export";
    this._downloadCSV(`${namePart}-${datePart}.csv`, rows);
  },

  _downloadCSV(filename, rows) {
    const bom    = "﻿";
    const escape = v => {
      const s = v == null ? "" : String(v);
      return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv  = bom + rows.map(r => r.map(escape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
