// ------------------------------------------------------------
// UI MODULE
// ------------------------------------------------------------
// Handles:
// - Tab click navigation
// - Import "Next" button
// - Print mode toggle
// - Export buttons (clipboard + CSV)
// ------------------------------------------------------------

window.UI = {

  init() {
    this.initTabs();
    this.initImportNext();
    this.initPrintToggle();
    this.initExportButtons();
  },

  // -----------------------------
  // TAB CLICK NAVIGATION
  // -----------------------------
  initTabs() {
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => {
        Utils.switchTab(btn.dataset.tab);
      });
    });
  },

  // -----------------------------
  // IMPORT → CONFIGURE NEXT BUTTON
  // -----------------------------
  initImportNext() {
    const btn = document.getElementById("btn-import-next");
    if (!btn) return;
    btn.addEventListener("click", () => {
      Configure.recomputeDivisionsAndPreview();
      Utils.switchTab("configure");
    });
  },

  // -----------------------------
  // PRINT MODE
  // -----------------------------
  initPrintToggle() {
    const btn = document.getElementById("btn-toggle-print");
    if (!btn) return;
    btn.addEventListener("click", () => {
      this.updatePrintHeader();
      window.print();
    });
  },

  updatePrintHeader() {
    const nameEl = document.getElementById("print-comp-name");
    const dateEl = document.getElementById("print-comp-date");

    if (nameEl) nameEl.textContent = State.compName || "Prize Results";

    if (dateEl && State.compDate) {
      // Format date nicely: YYYY-MM-DD → e.g. 12 May 2026
      const d = new Date(State.compDate + "T00:00:00");
      dateEl.textContent = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    } else if (dateEl) {
      dateEl.textContent = "";
    }
  },

  // -----------------------------
  // EXPORT BUTTONS
  // -----------------------------
  initExportButtons() {
    const btnClipboard = document.getElementById("btn-export-clipboard");
    const btnCSV = document.getElementById("btn-export-csv");

    if (btnClipboard) {
      btnClipboard.addEventListener("click", () => {
        const text = this.buildResultsText("\t");
        navigator.clipboard.writeText(text).then(() => {
          btnClipboard.textContent = "Copied!";
          setTimeout(() => { btnClipboard.textContent = "Copy results to clipboard"; }, 2000);
        });
      });
    }

    if (btnCSV) {
      btnCSV.addEventListener("click", () => {
        const csv = this.buildResultsText(",");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const date = State.compDate || new Date().toISOString().slice(0, 10);
        a.download = `${State.compName || "results"}_${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  },

  // Build tab or comma-delimited results text
  buildResultsText(sep) {
    const sections = [
      { key: "div1", label: "Division 1" },
      { key: "div2", label: "Division 2" },
      { key: "div3", label: "Division 3" },
      { key: "stableford", label: "Stableford" }
    ];

    const lines = [];
    const compLine = State.compName
      ? `${State.compName}${State.compDate ? " — " + State.compDate : ""}`
      : "";
    if (compLine) lines.push(compLine, "");

    sections.forEach(({ key, label }) => {
      const list = State.divisions[key] || [];
      const prizes = State.prizeData[key] || [];
      if (!list.length) return;

      lines.push(label);
      lines.push(["Pos", "Name", "Hcp", "Score", "Prize (£)"].join(sep));

      list.forEach((p, i) => {
        lines.push([i + 1, p.name, p.hcp, p.score, (prizes[i] || 0).toFixed(2)].join(sep));
      });

      lines.push("");
    });

    return lines.join("\n");
  }
};
