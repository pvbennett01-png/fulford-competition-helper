// ------------------------------------------------------------
// TWOS MODULE
// ------------------------------------------------------------
// Handles Two's competition prize calculation and display.
//
// CSV format: Player Name | Handicap | Hole(s)
// Hole field examples:
//   "2 @ 5th"              → 1 share
//   "2 @ 5th, 2 @ 14th"   → 2 shares
//   "1 @ 7th"              → 2 shares (hole-in-one = double)
//   "1 @ 3rd, 2 @ 10th"   → 3 shares
//
// Prize per share = fund ÷ total shares across all players
// Individual prize = player's shares × prize per share (rounded to whole £)
// ------------------------------------------------------------

window.Twos = {

  // Count shares from a hole string
  countShares(holesStr) {
    if (!holesStr) return 0;
    let shares = 0;
    // Split on comma to get individual hole entries
    holesStr.split(",").forEach(entry => {
      const trimmed = entry.trim();
      if (trimmed.startsWith("1 @") || trimmed.startsWith("1@")) {
        shares += 2; // hole-in-one = double
      } else if (trimmed.startsWith("2 @") || trimmed.startsWith("2@")) {
        shares += 1;
      }
    });
    return shares;
  },

  // Compute prizes for a list of Two's players given a fund amount
  compute(players, fund) {
    if (!players || players.length === 0 || fund <= 0) return [];

    // Calculate shares for each player
    const withShares = players.map(p => ({
      ...p,
      shares: this.countShares(p.holes)
    })).filter(p => p.shares > 0); // exclude players with no valid twos

    const totalShares = withShares.reduce((sum, p) => sum + p.shares, 0);
    if (totalShares === 0) return [];

    const prizePerShare = fund / totalShares;

    return withShares.map(p => ({
      ...p,
      prize: (p.shares * prizePerShare).toFixed(2)
    }));
  },

  // Render both Two's result tables in the Results tab
  render() {
    // Read fund values directly from DOM so we always get current values
    // regardless of whether the change event has fired
    const stbFundEl = document.getElementById("twos-stb-fund");
    const medFundEl = document.getElementById("twos-med-fund");
    if (stbFundEl) State.twosStablefordFund = Number(stbFundEl.value || 0);
    if (medFundEl) State.twosMedalFund      = Number(medFundEl.value || 0);

    this._renderSection(
      State.rawTwosStableford,
      State.twosStablefordFund,
      "twos-stb-body",
      "twos-stb-summary"
    );
    this._renderSection(
      State.rawTwosMedal,
      State.twosMedalFund,
      "twos-med-body",
      "twos-med-summary"
    );
  },

  _renderSection(players, fund, bodyId, summaryId) {
    const tbody   = document.getElementById(bodyId);
    const summary = document.getElementById(summaryId);
    if (!tbody) return;

    tbody.innerHTML = "";

    const results = this.compute(players, fund);

    if (results.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" style="color:var(--text-muted);font-size:12px;">No data loaded or fund is £0.</td>`;
      tbody.appendChild(tr);
      if (summary) summary.textContent = "";
      return;
    }

    const totalShares = results.reduce((s, p) => s + p.shares, 0);
    const prizePerShare = (fund / totalShares).toFixed(2);

    if (summary) {
      summary.textContent = `Fund: £${fund} ÷ ${totalShares} share${totalShares !== 1 ? "s" : ""} = £${prizePerShare}/share`;
    }

    results.forEach(p => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.name}</td>
        <td>${p.hcp}</td>
        <td style="font-size:11px;">${p.holes}</td>
        <td class="right">${p.shares}</td>
        <td class="right">£${p.prize}</td>
      `;
      tbody.appendChild(tr);
    });

    // Totals row
    const totalPrize = results.reduce((s, p) => s + Number(p.prize), 0).toFixed(2);
    const tr = document.createElement("tr");
    tr.style.fontWeight = "600";
    tr.style.borderTop = "2px solid var(--border)";
    tr.innerHTML = `
      <td colspan="3">Total</td>
      <td class="right">${totalShares}</td>
      <td class="right">£${totalPrize}</td>
    `;
    tbody.appendChild(tr);
  }
};
