// ------------------------------------------------------------
// PRIZES MODULE
// ------------------------------------------------------------
// Dynamic prize engine:
//
//   1. Compute prize pot for section (player count × fee × retention)
//   2. Calculate how many prize places fit between maxPrize and minPrize
//   3. Build tapered prize array (linear taper by default)
//   4. Enforce descending order
//   5. Apply tie handling (Method A = average split, Method B = duplicate higher)
//   6. Re-apply any locked (manually set) rows
//
// Practical Taper: smooths an existing prize array so prizes step
// evenly from 1st down to last, re-respecting max/min caps.
// ------------------------------------------------------------

window.Prizes = {

  // -----------------------------
  // MAIN ENTRY POINT
  // -----------------------------
  compute(section) {
    if (State.prizeMode && State.prizeMode[section] === "secretary") {
      return this._computeSecretary(section);
    }

    const list = State.divisions[section];
    if (!list || list.length === 0) { State.prizeData[section] = []; return []; }

    const pot  = this.computePrizePot(this.countEntries(section));
    let prizes = this.buildTaperedPrizes(pot, list.length);

    prizes = this.enforceDescending(prizes);
    prizes = this.applyTieHandling(section, list, prizes);
    prizes = this.applyLockedRows(section, prizes);

    // Round all prizes to whole pounds
    prizes = prizes.map(p => Math.round(p * 2) / 2);

    State.prizeData[section] = prizes;
    return prizes;
  },

  _computeSecretary(section) {
    const list = State.divisions[section];
    if (!list || list.length === 0) { State.prizeData[section] = []; return []; }

    const pot    = this.computePrizePot(this.countEntries(section));
    const groups = this._buildGroups(list);
    let prizes   = this._secretaryBuild(pot, groups);

    prizes = this.applyLockedRows(section, prizes);
    prizes = prizes.map(p => Math.round(p * 2) / 2);
    State.prizeData[section] = prizes;
    return prizes;
  },

  _buildGroups(list) {
    const groups = [];
    let i = 0;
    while (i < list.length) {
      let j = i + 1;
      while (j < list.length && list[j].score === list[i].score) j++;
      groups.push(j - i);
      i = j;
    }
    return groups;
  },

  _secretaryBuild(fund, groups) {
    const step     = 5;
    const topPrize = State.maxPrize;
    const minPrize = State.minPrize;

    if (fund <= 0 || groups.length === 0) return [];

    const maxPos = Math.floor((topPrize - minPrize) / step) + 1;

    let nPos = 0;
    let accumulated = 0;
    for (let k = 0; k < groups.length && k < maxPos; k++) {
      nPos = k + 1;
      accumulated += groups[k];
      if (accumulated >= 5) break;
    }
    if (nPos === 0) nPos = Math.min(1, groups.length);

    let canExtend = true;

    while (true) {  // eslint-disable-line no-constant-condition
      const P = Array.from({ length: nPos }, (_, k) => topPrize - k * step);

      let total = 0, totalW = 0;
      for (let k = 0; k < nPos; k++) {
        total += P[k] * groups[k];
        totalW += groups[k];
      }

      if (total <= fund) {
        if (canExtend && nPos < groups.length && nPos < maxPos) {
          const nextPrize = topPrize - nPos * step;
          if (nextPrize >= minPrize) { nPos++; continue; }
        }
        return this._expandGroups(groups, nPos, P, 0);

      } else {
        const X = (total - fund) / totalW;
        const maxXBottom = P[nPos - 1] - minPrize;
        const maxXTop    = topPrize > 25 ? topPrize - 26 : Infinity;
        const maxX       = Math.min(maxXBottom, maxXTop);

        if (maxX >= 0 && X <= maxX) {
          return this._expandGroups(groups, nPos, P, X);
        }

        canExtend = false;
        if (nPos > 1) { nPos--; continue; }

        const fallbackX = Math.min(X, P[0] - minPrize);
        return this._expandGroups(groups, 1, P, Math.max(fallbackX, 0));
      }
    }
  },

  _expandGroups(groups, nPos, P, reduction) {
    const out = [];
    for (let k = 0; k < nPos; k++) {
      const prize = P[k] - reduction;
      for (let j = 0; j < groups[k]; j++) out.push(prize);
    }
    return out;
  },

  // -----------------------------
  // PRIZE POT (per section)
  // -----------------------------
  computePrizePot(count) {
    const gross = State.entryFee * count;
    return State.retention ? gross * 0.75 : gross;
  },

  countEntries(section) {
    // Count ALL entrants (including NR/DQ) — they all paid entry fees.
    // NR/DQ players have score=null so they are excluded from prize lists
    // automatically, but their fees must count toward the prize pot.
    if (section === "stableford") {
      return State.rawStablefordAll.length;
    }

    if (section === "pairs") {
      return State.rawPairsAll.length * 2;
    }

    // Single-division import: everyone goes to div1
    if (State.rawMedalSingleAll.length) {
      return section === "div1" ? State.rawMedalSingleAll.length : 0;
    }

    const allMedal = State.rawMedalAll;
    if (!allMedal.length) return 0;

    const numDivs  = State.medalDivisions || 3;
    const division = Number(section.replace("div", ""));
    const b        = State.boundaries;
    const explicitDivisions = allMedal.some(p => p.division >= 1 && p.division <= 3);

    return allMedal.filter(p => {
      // NR/DQ players still have hcp set — use it to assign them to a division
      let rawDiv;
      if (explicitDivisions && p.division >= 1) {
        rawDiv = p.division;
      } else if (Number.isFinite(p.hcp)) {
        if      (p.hcp >= b.d1min && p.hcp <= b.d1max) rawDiv = 1;
        else if (p.hcp >= b.d2min && p.hcp <= b.d2max) rawDiv = 2;
        else rawDiv = 3;
      } else {
        return false;
      }
      return Math.min(rawDiv, numDivs) === division;
    }).length;
  },

  // -----------------------------
  // BUILD TAPERED PRIZE ARRAY
  // -----------------------------
  // Simpler logic:
  //   - compute a sensible 1st prize, capped between min/max
  //   - build candidate linear tapers for each prize count
  //   - prefer the largest count with an acceptable drop size
  buildTaperedPrizes(pot, playerCount) {
    if (pot <= 0 || playerCount <= 0) return [];

    const maxP = State.maxPrize;
    const minP = State.minPrize;
    const first = Math.min(Math.max(pot * 0.35, minP), maxP);
    const maxDrop = 5;

    const prizes = [first];
    let remaining = pot - first;
    let prev = first;

    while (prizes.length < playerCount) {
      if (remaining < minP) break;

      const candidate = Math.max(prev - maxDrop, minP);

      if (candidate === minP) {
        if (remaining >= minP) {
          prizes.push(minP);
        }
        break;
      }

      if (remaining < candidate) break;
      if (remaining - candidate < minP) break;

      prizes.push(candidate);
      remaining -= candidate;
      prev = candidate;
    }

    if (remaining > 0 && remaining < minP && prizes.length > 0) {
      prizes[prizes.length - 1] = Math.round((prizes[prizes.length - 1] + remaining) * 100) / 100;
    }

    return prizes;
  },

  // -----------------------------
  // ENFORCE DESCENDING
  // -----------------------------
  enforceDescending(prizes) {
    for (let i = 1; i < prizes.length; i++) {
      if (prizes[i] > prizes[i - 1]) prizes[i] = prizes[i - 1];
    }
    return prizes;
  },

  // -----------------------------
  // TIE HANDLING
  // -----------------------------
  // Method A: tied players split the combined prize money
  // Method B: tied players both receive the higher prize
  applyTieHandling(section, list, prizes) {
    const method = State.tieMethod[section];
    if (method !== "A" && method !== "B") return prizes;

    const out = [...prizes];
    let i = 0;

    while (i < list.length - 1) {
      if (list[i].score === list[i + 1].score) {
        // Find the full tie group
        let j = i + 1;
        while (j < list.length && list[j].score === list[i].score) j++;

        // Positions i..j-1 are tied
        const tiedIndices = [];
        for (let k = i; k < j && k < out.length; k++) tiedIndices.push(k);

        if (method === "A") {
          const total = tiedIndices.reduce((sum, k) => sum + (out[k] || 0), 0);
          const avg   = tiedIndices.length > 0 ? total / tiedIndices.length : 0;
          tiedIndices.forEach(k => { out[k] = avg; });
        } else {
          // Method B: all get the best prize in the group
          const best = tiedIndices.reduce((max, k) => Math.max(max, out[k] || 0), 0);
          tiedIndices.forEach(k => { out[k] = best; });
        }

        i = j;
      } else {
        i++;
      }
    }

    return out;
  },

  // -----------------------------
  // LOCKED ROWS (manual overrides)
  // -----------------------------
  applyLockedRows(section, prizes) {
    const locks    = State.lockedRows[section];
    const original = State.prizeData[section] || [];
    const out      = [...prizes];

    locks.forEach(idx => {
      if (original[idx] != null) out[idx] = original[idx];
    });

    return out;
  },

  // -----------------------------
  // PRACTICAL TAPER
  // Redistributes existing prizes in a smooth linear step from
  // 1st (unchanged) down to last, then re-applies max/min/descending.
  // Locked rows are preserved and excluded from redistribution.
  // -----------------------------
  applyPracticalTaper(section) {
    const list = State.divisions[section];
    if (!list || list.length === 0) return;

    const prizes = [...(State.prizeData[section] || [])];
    if (prizes.length === 0) return;

    const locks = State.lockedRows[section];

    // Find top unlocked prize
    let top = prizes[0];
    for (let i = 0; i < prizes.length; i++) {
      if (!locks.has(i)) { top = prizes[i]; break; }
    }

    // Find last unlocked prize
    let bottom = State.minPrize;
    for (let i = prizes.length - 1; i >= 0; i--) {
      if (!locks.has(i)) { bottom = prizes[i]; break; }
    }

    const n    = prizes.length;
    const step = n > 1 ? (top - bottom) / (n - 1) : 0;

    const tapered = prizes.map((_, i) => {
      if (locks.has(i)) return prizes[i];
      const v = top - step * i;
      return Math.min(Math.max(Math.round(v * 100) / 100, State.minPrize), State.maxPrize);
    });

    // Re-enforce descending
    for (let i = 1; i < tapered.length; i++) {
      if (!locks.has(i) && tapered[i] > tapered[i - 1]) tapered[i] = tapered[i - 1];
    }

    State.prizeData[section] = tapered.map(p => Math.round(p * 2) / 2);
  }
};
