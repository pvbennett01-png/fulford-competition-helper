// ------------------------------------------------------------
// UTILITY FUNCTIONS
// ------------------------------------------------------------

window.Utils = {

  formatGBP(n) {
    const num = Number(n || 0);
    return "£" + num.toFixed(2);
  },

  // CSV Parser — handles quoted fields and embedded commas
  parseCSV(text) {
    const rows = [];
    let cur = "";
    let row = [];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const next = text[i + 1];

      if (ch === '"') {
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (ch === "," && !inQuotes) {
        row.push(cur.trim());
        cur = "";
        continue;
      }

      if ((ch === "\n" || ch === "\r") && !inQuotes) {
        if (cur.length || row.length) {
          row.push(cur.trim());
          rows.push(row);
        }
        cur = "";
        row = [];
        continue;
      }

      cur += ch;
    }

    if (cur.length || row.length) {
      row.push(cur.trim());
      rows.push(row);
    }

    return rows;
  },

  setStatus(id, text, type = "") {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.remove("ok", "warn", "err");
    if (type) el.classList.add(type);
  },

  switchTab(tabName) {
    document.querySelectorAll(".tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
    document.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.toggle("active", panel.id === "tab-" + tabName);
    });
  }
};
