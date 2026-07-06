// ------------------------------------------------------------
// RESULTS MODULE
// ------------------------------------------------------------
// Handles:
// - Rendering results tables (all four sections)
// - Lock/unlock buttons per row
// - REVERT: clears locks and recomputes
// - PRACTICAL: applies practical taper smoothing
// - MANUAL: switches to manual tab for that section
// - Tie method toggle buttons
// - Syncing manual tab tables
// ------------------------------------------------------------

window.Results = {

  init() {
    this.initActionButtons();
    this.initTieButtons();
  },

  // -----------------------------
  // ACTION BUTTONS (per results card)
  // -----------------------------
  initActionButtons() {
    document.querySelectorAll(".results-card .results-buttons button").forEach(btn => {
      btn.addEventListener("click", () => {
        const action  = btn.dataset.action;
        const section = btn.closest(".results-card").dataset.section;

        if (action === "revert") {
          State.lockedRows[section].clear();
          State.prizeMode[section] = "auto";
          Prizes.compute(section);
          this.renderResults();
          this.syncManualTab();
        }

        if (action === "practical") {
          State.prizeMode[section] = "secretary";
          Prizes.compute(section);
          this.renderResults();
          this.syncManualTab();
        }

        if (action === "manual") {
          // Make sure results are current before switching
          if (!State.prizeData[section] || State.prizeData[section].length === 0) {
            Prizes.compute(section);
          }
          this.syncManualTab();
          Utils.switchTab("manual");
        }
      });
    });
  },

  // -----------------------------
  // TIE METHOD TOGGLE BUTTONS
  // -----------------------------
  initTieButtons() {
    document.querySelectorAll(".tie-group").forEach(group => {
      group.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          const section = group.dataset.section;
          const value   = btn.dataset.value;

          State.tieMethod[section] = value;

          group.querySelectorAll("button").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          Prizes.compute(section);
          this.renderResults();
          this.syncManualTab();
        });
      });
    });
  },

  // -----------------------------
  // RENDER ALL RESULTS TABLES
  // -----------------------------
  renderResults() {
    const map = [
      { key: "div1",       body: "results-div1-body",  scoreLabel: "Score" },
      { key: "div2",       body: "results-div2-body",  scoreLabel: "Score" },
      { key: "div3",       body: "results-div3-body",  scoreLabel: "Score" },
      { key: "stableford", body: "results-stb-body",   scoreLabel: "Pts"   },
      { key: "pairs",      body: "results-pairs-body", scoreLabel: "Nett"  }
    ];

    map.forEach(({ key, body }) => {
      const tbody = document.getElementById(body);
      if (!tbody) return;
      tbody.innerHTML = "";

      const list = State.divisions[key];
      if (!list || list.length === 0) return;

      const prizes = Prizes.compute(key);
      const fmt    = v => v % 1 === 0 ? String(v) : v.toFixed(2);

      // Only show entries that have been awarded a prize (skip zero-prize rows)
      list.slice(0, prizes.length).forEach((p, idx) => {
        const locked = State.lockedRows[key].has(idx);
        const prize  = prizes[idx];
        if (prize === 0) return;
        const tr     = document.createElement("tr");

        if (key === "pairs") {
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${p.name}</td>
            <td class="right">${p.score}</td>
            <td class="right mono">${locked ? "🔒 " : ""}£${fmt(prize)}</td>
          `;
        } else {
          tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${p.name}</td>
            <td>${p.hcp != null ? p.hcp : "—"}</td>
            <td class="right">${p.score}</td>
            <td class="right mono">${locked ? "🔒 " : ""}£${fmt(prize)}</td>
          `;
        }

        tbody.appendChild(tr);
      });
    });

    // Show/hide inactive medal division result cards
    const numDivs = State.medalDivisions || 3;
    ["div2", "div3"].forEach(key => {
      const card = document.querySelector(`.results-card[data-section="${key}"]`);
      if (card) card.style.display = (key === "div2" ? numDivs >= 2 : numDivs >= 3) ? "" : "none";
    });

    // Show/hide pairs results card
    const pairsCard = document.querySelector('.results-card[data-section="pairs"]');
    if (pairsCard) pairsCard.style.display = (State.divisions.pairs || []).length > 0 ? "" : "none";

    // Refresh per-section audit boxes and Two's results
    this.updateAuditBoxes();
    Twos.render();
  },

  // -----------------------------
  // PER-SECTION AUDIT BOXES
  // -----------------------------
  updateAuditBoxes() {
    const numDivs = State.medalDivisions || 3;
    const sections = [
      { key: "div1",       prefix: "ab-div1", active: true        },
      { key: "div2",       prefix: "ab-div2", active: numDivs >= 2 },
      { key: "div3",       prefix: "ab-div3", active: numDivs >= 3 },
      { key: "stableford", prefix: "ab-stb",  active: true        }
    ];

    let grandPlayers = 0, grandFund = 0, grandAllocated = 0;

    sections.forEach(({ key, prefix, active }) => {
      const box = document.querySelector(`.audit-box[data-audit="${key}"]`);
      if (box) box.style.display = active ? "" : "none";

      if (!active) return;

      const count     = Prizes.countEntries(key);
      const gross     = State.entryFee * count;
      const fund      = Math.round(State.retention ? gross * 0.75 : gross);
      const allocated = Math.round((State.prizeData[key] || []).reduce((s, v) => s + v, 0));
      const surplus   = fund - allocated;

      grandPlayers   += count;
      grandFund      += fund;
      grandAllocated += allocated;

      this._setAudit(prefix, count, fund, allocated, surplus);
    });

    // Pairs audit: entry fee is per person so playerCount = pairs × 2
    const pairsAuditBox = document.querySelector('.audit-box[data-audit="pairs"]');
    const pairsActive = State.rawPairsAll.length > 0;
    if (pairsAuditBox) pairsAuditBox.style.display = pairsActive ? "" : "none";
    if (pairsActive) {
      const pairsCount  = State.rawPairsAll.length;
      const playerCount = pairsCount * 2;
      const gross       = State.entryFee * playerCount;
      const fund        = Math.round(State.retention ? gross * 0.75 : gross);
      const allocated   = Math.round((State.prizeData.pairs || []).reduce((s, v) => s + v, 0));
      const surplus     = fund - allocated;

      grandPlayers   += playerCount;
      grandFund      += fund;
      grandAllocated += allocated;

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl("ab-pairs-pairs",     pairsCount);
      setEl("ab-pairs-fund",      `£${fund}`);
      setEl("ab-pairs-allocated", `£${allocated}`);
      const surplusEl = document.getElementById("ab-pairs-surplus");
      if (surplusEl) {
        surplusEl.textContent = `£${surplus}`;
        surplusEl.style.color = surplus < 0 ? "var(--danger)" : surplus === 0 ? "var(--success)" : "var(--warning)";
      }
    }

    this._setAudit("ab-total", grandPlayers, grandFund, grandAllocated, grandFund - grandAllocated);
  },

  _setAudit(prefix, players, fund, allocated, surplus) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set(`${prefix}-players`,   players);
    set(`${prefix}-fund`,      `£${fund}`);
    set(`${prefix}-allocated`, `£${allocated}`);

    const surplusEl = document.getElementById(`${prefix}-surplus`);
    if (surplusEl) {
      surplusEl.textContent = `£${surplus}`;
      surplusEl.style.color = surplus < 0 ? "var(--danger)" : surplus === 0 ? "var(--success)" : "var(--warning)";
    }
  },

  // -----------------------------
  // SYNC MANUAL TAB
  // Populates all four manual override tables
  // -----------------------------
  syncManualTab() {
    const sections = [
      { key: "div1",       bodyId: "manual-div1-body"   },
      { key: "div2",       bodyId: "manual-div2-body"   },
      { key: "div3",       bodyId: "manual-div3-body"   },
      { key: "stableford", bodyId: "manual-stb-body"    },
      { key: "pairs",      bodyId: "manual-pairs-body"  }
    ];

    sections.forEach(({ key, bodyId }) => {
      const tbody = document.getElementById(bodyId);
      if (!tbody) return;
      tbody.innerHTML = "";

      const list   = State.divisions[key] || [];
      const prizes = State.prizeData[key] || [];
      const showUpTo = this._findNextTwoGroups(list, prizes.length);

      const groups = [];
      let idx = 0;
      while (idx < showUpTo) {
        const score = list[idx]?.score;
        const start = idx;
        while (idx < showUpTo && list[idx].score === score) idx++;

        const count  = idx - start;
        const prize  = start < prizes.length ? prizes[start] : 0;
        const locked = Array.from({ length: count }, (_, i) => start + i)
                               .every(i => State.lockedRows[key].has(i));

        groups.push({ start, count, prize, locked });
      }

      groups.forEach(group => {
        const tr = document.createElement("tr");
        if (group.locked) tr.style.background = "#fffbea";

        tr.innerHTML = `
          <td>${this._ordinal(group.start + 1)}</td>
          <td>${group.count}</td>
          <td>
            <input type="number" step="1" min="0"
                   data-section="${key}" data-start="${group.start}"
                   data-count="${group.count}"
                   value="${group.prize}"
                   style="width:80px"
                   placeholder="0">
          </td>
        `;

        tbody.appendChild(tr);
      });

      tbody.querySelectorAll("input[type='number']").forEach(input => {
        input.addEventListener("change", () => {
          const section = input.dataset.section;
          const start   = Number(input.dataset.start);
          const count   = Number(input.dataset.count);
          const val     = Number(input.value || 0);

          while (State.prizeData[section].length < start + count) {
            State.prizeData[section].push(0);
          }

          for (let offset = 0; offset < count; offset++) {
            const rowIndex = start + offset;
            State.prizeData[section][rowIndex] = val;
            State.lockedRows[section].add(rowIndex);
          }

          this.renderResults();
          this.syncManualTab();
        });
      });
    });

    // Show/hide inactive medal division manual cards
    const numDivsM = State.medalDivisions || 3;
    ["div2", "div3"].forEach(key => {
      const tbody = document.getElementById(`manual-${key}-body`);
      if (tbody) {
        const card = tbody.closest(".manual-card");
        if (card) card.style.display = (key === "div2" ? numDivsM >= 2 : numDivsM >= 3) ? "" : "none";
      }
    });

    // Show/hide pairs manual card
    const pairsManualCard = document.getElementById("manual-pairs-card");
    if (pairsManualCard) pairsManualCard.style.display = State.rawPairsAll.length > 0 ? "" : "none";

    const notes = document.getElementById("manual-notes");
    if (notes) notes.value = State.manualNotes;

    // Update fund / allocated pills in each manual card header
    [
      { key: "div1",       fundId: "mfund-div1",   totalId: "mtotal-div1",   boxId: "mtotal-box-div1"   },
      { key: "div2",       fundId: "mfund-div2",   totalId: "mtotal-div2",   boxId: "mtotal-box-div2"   },
      { key: "div3",       fundId: "mfund-div3",   totalId: "mtotal-div3",   boxId: "mtotal-box-div3"   },
      { key: "stableford", fundId: "mfund-stb",    totalId: "mtotal-stb",    boxId: "mtotal-box-stb"    },
      { key: "pairs",      fundId: "mfund-pairs",  totalId: "mtotal-pairs",  boxId: "mtotal-box-pairs"  }
    ].forEach(({ key, fundId, totalId, boxId }) => {
      const fund    = Math.round(Prizes.computePrizePot(Prizes.countEntries(key)));
      const total   = Math.round((State.prizeData[key] || []).reduce((s, v) => s + (Number(v) || 0), 0));
      const fundEl  = document.getElementById(fundId);
      const totalEl = document.getElementById(totalId);
      const boxEl   = document.getElementById(boxId);
      if (fundEl)  fundEl.textContent  = fund;
      if (totalEl) totalEl.textContent = total;
      if (boxEl)   boxEl.style.color   = total > fund ? "var(--danger)" : "";
    });
  },

  // -----------------------------
  // HELPER: find index limit for "prize winners + next 2 tied groups"
  // -----------------------------
  // Starting after the last prize position, walk the sorted player list
  // and collect players from the next 2 distinct score values.
  _findNextTwoGroups(list, prizeCount) {
    if (prizeCount >= list.length) return list.length; // all players are prized

    let groupsFound = 0;
    let currentScore = null;
    let i = prizeCount;

    while (i < list.length && groupsFound < 2) {
      if (list[i].score !== currentScore) {
        currentScore = list[i].score;
        groupsFound++;
      }
      i++;
    }

    return i; // exclusive upper bound
  },

  _ordinal(position) {
    const suffix = (n) => {
      const rem100 = n % 100;
      if (rem100 >= 11 && rem100 <= 13) return "th";
      switch (n % 10) {
        case 1: return "st";
        case 2: return "nd";
        case 3: return "rd";
        default: return "th";
      }
    };
    return `${position}${suffix(position)}`;
  }
};
