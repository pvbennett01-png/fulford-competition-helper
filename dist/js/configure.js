// ------------------------------------------------------------
// CONFIGURE MODULE
// ------------------------------------------------------------
// Handles:
// - Reading UI settings (boundaries, fees, retention, prize limits)
// - Building player lists (Medal → divisions, Stableford → stableford)
// - Assigning handicap-based divisions
// - Building preview tables
// - Updating audit block
// ------------------------------------------------------------

window.Configure = {

  init() {
    this.initButtons();
    this.initCompDetails();
    this.initRetentionToggle();
    this.initEntryFee();
    this.initPrizeLimits();
    this.initTwosFunds();
    this.initDivisionCountToggle();
  },

  // -----------------------------
  // COMPETITION DETAILS (live update)
  // -----------------------------
  initCompDetails() {
    const nameEl = document.getElementById("comp-name");
    const dateEl = document.getElementById("comp-date");
    if (nameEl) {
      State.compName = nameEl.value.trim();
      nameEl.addEventListener("input", () => { State.compName = nameEl.value.trim(); });
    }
    if (dateEl) {
      State.compDate = dateEl.value;
      dateEl.addEventListener("change", () => { State.compDate = dateEl.value; });
    }
  },

  // -----------------------------
  // DIVISION COUNT TOGGLE (1 / 2 / 3)
  // -----------------------------
  initDivisionCountToggle() {
    document.querySelectorAll("#divisions-count-toggle button").forEach(btn => {
      btn.addEventListener("click", () => {
        State.medalDivisions = Number(btn.dataset.value);
        document.querySelectorAll("#divisions-count-toggle button")
          .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this._applyDivisionBoundaryDefaults(State.medalDivisions);
        this._applyDivisionVisibility();
        this.recomputeDivisionsAndPreview();
        Results.renderResults();
        Results.syncManualTab();
      });
    });
  },

  _applyDivisionBoundaryDefaults(n) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    if (n === 1) {
      set("d1-min", -5);  set("d1-max", 54);
    } else if (n === 2) {
      set("d1-min", -5);  set("d1-max", 11);
      set("d2-min", 12);  set("d2-max", 54);
    } else {
      set("d1-min", -5);  set("d1-max", 8);
      set("d2-min", 9);   set("d2-max", 14);
      set("d3-min", 15);  set("d3-max", 54);
    }
  },

  _applyDivisionVisibility() {
    const n = State.medalDivisions || 3;
    const d2row = document.getElementById("div2-bounds-row");
    const d3row = document.getElementById("div3-bounds-row");
    if (d2row) d2row.style.display = n >= 2 ? "" : "none";
    if (d3row) d3row.style.display = n >= 3 ? "" : "none";
    const d2card = document.querySelector('.preview-card[data-block="div2"]');
    const d3card = document.querySelector('.preview-card[data-block="div3"]');
    if (d2card) d2card.style.display = n >= 2 ? "" : "none";
    if (d3card) d3card.style.display = n >= 3 ? "" : "none";
  },

  // -----------------------------
  // BUTTONS
  // -----------------------------
  initButtons() {
    const parseBtn = document.getElementById("btn-parse-divisions");
    if (parseBtn) {
      parseBtn.addEventListener("click", () => this.recomputeDivisionsAndPreview());
    }

    const nextBtn = document.getElementById("btn-config-next");
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        this.recomputeDivisionsAndPreview();
        Results.renderResults();
        Results.syncManualTab();
        Utils.switchTab("results");
      });
    }
  },

  // -----------------------------
  // ENTRY FEE
  // -----------------------------
  initEntryFee() {
    const fee = document.getElementById("entry-fee");
    if (!fee) return;
    fee.addEventListener("change", () => {
      State.entryFee = Number(fee.value || 0);
      this.recomputeDivisionsAndPreview();
    });
  },

  // -----------------------------
  // PRIZE LIMITS
  // -----------------------------
  initPrizeLimits() {
    const maxEl = document.getElementById("max-prize");
    const minEl = document.getElementById("min-prize");

    if (maxEl) {
      maxEl.addEventListener("change", () => {
        State.maxPrize = Number(maxEl.value || 30);
        this.recomputeDivisionsAndPreview();
      });
    }

    if (minEl) {
      minEl.addEventListener("change", () => {
        State.minPrize = Number(minEl.value || 7);
        this.recomputeDivisionsAndPreview();
      });
    }
  },

  // -----------------------------
  // RETENTION TOGGLE
  // -----------------------------
  initRetentionToggle() {
    document.querySelectorAll("#retention-toggle button").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll("#retention-toggle button")
          .forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        State.retention = btn.dataset.value === "yes";
        this.recomputeDivisionsAndPreview();
      });
    });
  },

  // -----------------------------
  // READ BOUNDARIES FROM UI
  // -----------------------------
  readBoundaries() {
    State.boundaries = {
      d1min: Number(document.getElementById("d1-min").value || -5),
      d1max: Number(document.getElementById("d1-max").value || 8),
      d2min: Number(document.getElementById("d2-min").value || 9),
      d2max: Number(document.getElementById("d2-max").value || 14),
      d3min: Number(document.getElementById("d3-min").value || 15),
      d3max: Number(document.getElementById("d3-max").value || 54)
    };
  },

  readCompDetails() {
    State.compName = document.getElementById("comp-name").value.trim();
    State.compDate = document.getElementById("comp-date").value;
  },

  // -----------------------------
  // BUILD PLAYER LISTS
  // Medal players → div1/2/3 by handicap
  // Stableford players → stableford leaderboard only
  // -----------------------------
  assignDivisions() {
    const b = State.boundaries;
    const numDivs = State.medalDivisions || 3;
    const div1 = [], div2 = [], div3 = [], stb = [], pairs = [];
    const medalSource = State.rawMedalSingle.length ? State.rawMedalSingle : State.rawMedal;

    if (State.rawMedalSingle.length) {
      medalSource.forEach(p => div1.push(p));
    } else {
      const explicitDivisions = State.rawMedal.some(p => p.division >= 1 && p.division <= 3);

      medalSource.forEach(p => {
        // Determine the "natural" division (1, 2, or 3), then cap at numDivs
        // so overflow players merge into the last active division.
        let rawDiv;
        if (explicitDivisions && p.division >= 1) {
          rawDiv = p.division;
        } else if (p.hcp >= b.d1min && p.hcp <= b.d1max) {
          rawDiv = 1;
        } else if (p.hcp >= b.d2min && p.hcp <= b.d2max) {
          rawDiv = 2;
        } else {
          rawDiv = 3;
        }
        const target = Math.min(rawDiv, numDivs);
        if (target === 1) div1.push(p);
        else if (target === 2) div2.push(p);
        else div3.push(p);
      });
    }

    // Stableford players form their own separate leaderboard
    State.rawStableford.forEach(p => stb.push(p));

    // Pairs: already in position order from ClubV1; re-sort ascending (lower nett = better)
    State.rawPairs.forEach(p => pairs.push(p));

    // Medal: sort ascending (lower nett score = better)
    div1.sort((a, b) => a.score - b.score);
    div2.sort((a, b) => a.score - b.score);
    div3.sort((a, b) => a.score - b.score);

    // Stableford: sort descending (higher points = better)
    stb.sort((a, b) => b.score - a.score);

    // Pairs: sort ascending (lower nett = better)
    pairs.sort((a, b) => a.score - b.score);

    State.divisions = { div1, div2, div3, stableford: stb, pairs };
  },

  // -----------------------------
  // BUILD PREVIEW TABLES (top 5)
  // -----------------------------
  buildPreview() {
    const map = [
      { key: "div1",       body: "preview-div1-body",   count: "preview-div1-count"   },
      { key: "div2",       body: "preview-div2-body",   count: "preview-div2-count"   },
      { key: "div3",       body: "preview-div3-body",   count: "preview-div3-count"   },
      { key: "stableford", body: "preview-stb-body",    count: "preview-stb-count"    },
      { key: "pairs",      body: "preview-pairs-body",  count: "preview-pairs-count"  }
    ];

    map.forEach(({ key, body, count }) => {
      const tbody   = document.getElementById(body);
      const countEl = document.getElementById(count);
      if (!tbody || !countEl) return;
      tbody.innerHTML = "";

      const list = State.divisions[key] || [];
      countEl.textContent = key === "pairs" ? `${list.length} pairs` : `${list.length} players`;

      list.slice(0, 5).forEach((p, idx) => {
        const tr = document.createElement("tr");
        if (key === "pairs") {
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${p.name}</td>
            <td class="right">${p.score}</td>
          `;
        } else {
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${p.name}</td>
            <td>${p.hcp != null ? p.hcp : "—"}</td>
            <td class="right">${p.score}</td>
          `;
        }
        tbody.appendChild(tr);
      });
    });
  },

  // -----------------------------
  // TWO'S FUND INPUTS
  // -----------------------------
  initTwosFunds() {
    const stbEl = document.getElementById("twos-stb-fund");
    const medEl = document.getElementById("twos-med-fund");

    if (stbEl) {
      stbEl.addEventListener("change", () => {
        State.twosStablefordFund = Number(stbEl.value || 0);
      });
    }
    if (medEl) {
      medEl.addEventListener("change", () => {
        State.twosMedalFund = Number(medEl.value || 0);
      });
    }
  },

  // Audit display has moved to the Results tab — see Results.updateAuditBoxes()
  updateAuditBlock() {},

  // -----------------------------
  // MAIN PIPELINE
  // -----------------------------
  recomputeDivisionsAndPreview() {
    this.readBoundaries();
    this.readCompDetails();
    this.assignDivisions();
    this.buildPreview();
    this.updateAuditBlock();
    if (window.Results) {
      Results.renderResults();
      Results.syncManualTab();
    }
  }
};
