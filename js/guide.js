// ------------------------------------------------------------
// GUIDE MODULE
// ------------------------------------------------------------
// Shows a "Do you need instructions?" prompt on first load.
// Stores the user's choice in localStorage so it only appears once.
// The help button in the header always reopens the full guide.
// ------------------------------------------------------------

window.Guide = {

  STORAGE_KEY: "fulford_guide_seen",

  init() {
    this.buildModal();
    document.getElementById("btn-help").addEventListener("click", () => this.showGuide());

    if (!localStorage.getItem(this.STORAGE_KEY)) {
      this.showPrompt();
    }
  },

  // -----------------------------
  // BUILD MODAL SKELETON (once)
  // -----------------------------
  buildModal() {
    const overlay = document.getElementById("guide-overlay");
    overlay.innerHTML = `
      <div id="guide-modal">
        <div id="guide-modal-body"></div>
      </div>`;
    overlay.addEventListener("click", e => {
      if (e.target === overlay) this.close();
    });
  },

  // -----------------------------
  // PROMPT: Do you need instructions?
  // -----------------------------
  showPrompt() {
    const body = document.getElementById("guide-modal-body");
    body.innerHTML = `
      <div class="guide-prompt">
        <div class="guide-prompt-icon">?</div>
        <h2 class="guide-prompt-title">Do you need instructions?</h2>
        <p class="guide-prompt-sub">A step-by-step guide is available if you're new to the Prize Calculator.</p>
        <div class="guide-prompt-btns">
          <button id="guide-btn-no"  class="guide-btn-no">No thanks</button>
          <button id="guide-btn-yes" class="guide-btn-yes">Yes, show me</button>
        </div>
        <label class="guide-dont-show">
          <input type="checkbox" id="guide-chk-dont-show"> Don't show this again
        </label>
      </div>`;

    const persist = () => {
      if (document.getElementById("guide-chk-dont-show").checked) {
        localStorage.setItem(this.STORAGE_KEY, "1");
      }
    };

    document.getElementById("guide-btn-yes").addEventListener("click", () => {
      persist();
      this.showGuide();
    });
    document.getElementById("guide-btn-no").addEventListener("click", () => {
      persist();
      this.close();
    });

    this.open();
  },

  // -----------------------------
  // FULL GUIDE VIEW
  // -----------------------------
  showGuide() {
    const body = document.getElementById("guide-modal-body");
    body.innerHTML = `
      <div class="guide-header">
        <h2 class="guide-title">Prize Calculator — User Guide</h2>
        <button class="guide-close-btn" id="guide-close-top" title="Close">&#x2715;</button>
      </div>
      <div class="guide-content">${this.renderMarkdown(this.GUIDE_MD)}</div>
      <div class="guide-footer">
        <button class="guide-btn-no" id="guide-close-bottom">Close</button>
      </div>`;

    document.getElementById("guide-close-top").addEventListener("click",    () => this.close());
    document.getElementById("guide-close-bottom").addEventListener("click", () => this.close());
    this.open();
  },

  open()  { document.getElementById("guide-overlay").classList.add("visible"); },
  close() { document.getElementById("guide-overlay").classList.remove("visible"); },

  // -----------------------------
  // MINIMAL MARKDOWN RENDERER
  // Handles: headings, bold, hr, tables, lists, paragraphs
  // -----------------------------
  renderMarkdown(md) {
    const lines = md.split("\n");
    const out   = [];
    let inTable = false;
    let inList  = false;
    let inPara  = false;

    const flushList = () => { if (inList) { out.push("</ul>"); inList = false; } };
    const flushPara = () => { if (inPara) { out.push("</p>"); inPara = false; } };

    const inline = s =>
      s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
       .replace(/`(.+?)`/g, "<code>$1</code>");

    for (let i = 0; i < lines.length; i++) {
      const raw  = lines[i];
      const line = raw.trim();

      // Heading
      if (/^#{1,3} /.test(line)) {
        flushList(); flushPara();
        const level = line.match(/^(#+)/)[1].length;
        const text  = inline(line.replace(/^#+\s*/, ""));
        out.push(`<h${level} class="guide-h${level}">${text}</h${level}>`);
        continue;
      }

      // Horizontal rule
      if (/^---+$/.test(line)) {
        flushList(); flushPara();
        out.push("<hr class='guide-hr'>");
        continue;
      }

      // Table row
      if (/^\|/.test(line)) {
        flushList(); flushPara();
        if (!inTable) { out.push('<table class="guide-table"><tbody>'); inTable = true; }
        if (/^\|[-| ]+\|$/.test(line)) continue; // separator row
        const cells = line.replace(/^\||\|$/g, "").split("|");
        const isHead = (lines[i - 1] || "").trim() === "" || i === 0 || !/^\|/.test((lines[i - 1] || "").trim());
        const tag  = "td";
        out.push("<tr>" + cells.map(c => `<${tag}>${inline(c.trim())}</${tag}>`).join("") + "</tr>");
        continue;
      } else if (inTable) {
        out.push("</tbody></table>");
        inTable = false;
      }

      // List item
      if (/^[-*] /.test(line)) {
        flushPara();
        if (!inList) { out.push("<ul class='guide-ul'>"); inList = true; }
        out.push(`<li>${inline(line.replace(/^[-*] /, ""))}</li>`);
        continue;
      }

      // Blank line
      if (line === "") {
        flushList(); flushPara();
        continue;
      }

      // Paragraph
      if (!inPara) { out.push("<p class='guide-p'>"); inPara = true; }
      else out.push(" ");
      out.push(inline(line));
    }

    flushList(); flushPara();
    if (inTable) out.push("</tbody></table>");

    return out.join("");
  },

  // -----------------------------
  // GUIDE CONTENT (mirrors USER_GUIDE.md)
  // -----------------------------
  GUIDE_MD: `# Fulford Golf Club — Prize Calculator: Idiot's Guide

---

## What does it do?
This tool takes competition results exported from your golf system (as CSV files), splits players into divisions by handicap, calculates prize money automatically, and prints tidy prize sheets.

---

## The 5 steps (tabs across the top)

---

### STEP 1 — IMPORT

This is where you load the competition scores.

**You have 4 boxes to fill (only the ones relevant to your competition):**

| Box | What to put in it |
|-----|-------------------|
| Stableford CSV | The main Stableford results file |
| Medal CSV | The main Medal results file |
| Two's Stableford CSV | Two's competition results (Stableford) |
| Two's Medal CSV | Two's competition results (Medal) |

**How to get data in:**
- **Drag and drop** a CSV file onto the dashed box, OR
- **Click the dashed box** to browse for a file, OR
- **Paste** the CSV text directly into the text area below the box

**After loading each file, click the green "Parse" button** (e.g. "Parse Stableford"). You'll see a green "OK" badge appear when it's been read successfully.

You don't need all four — just load whichever ones apply to today's competition.

When done, click **Next: Configure ▸**

---

### STEP 2 — CONFIGURE

Set up the competition details and prize structure.

**Competition Details**
- **Competition name** — type a name (e.g. "Saturday Stableford"). This appears on printouts.
- **Competition date** — pick the date from the calendar.

**Division Boundaries** (handicap ranges)
- Default is: Div 1 = 5–8, Div 2 = 9–14, Div 3 = 15–54
- Change these numbers if your club uses different ranges
- Click **"Parse divisions"** after changing to re-sort players

**Entry Fee & Retention**
- **Entry fee** — the amount each player paid to enter (e.g. £4.00)
- **Retention** — set to **Yes** if the club keeps 25% (so 75% goes to prizes). Set to **No** for 100% to prizes.

**Two's Prize Funds**
- Enter the total pot for Two's Stableford and/or Two's Medal
- Leave at £0 if there's no Two's competition today

**Prize Limits**
- **Max 1st prize** — the most anyone can win (e.g. £30)
- **Min prize** — the smallest prize worth giving out (e.g. £7)
- The calculator works out how many prize places fit automatically

The **Preview table** at the bottom shows the top 5 players per division so you can sense-check the data before proceeding.

When done, click **Next: Results ▸**

---

### STEP 3 — RESULTS

This shows the full prize allocation. The calculator has already done the maths.

**At the top** you'll see a summary box for each division showing:
- How many players are in it
- The total prize fund for that division
- How much has been allocated
- Any surplus

**For each division you have 3 buttons:**

| Button | What it does |
|--------|--------------|
| REVERT | Goes back to the original automatically calculated prizes |
| PRACTICAL | Smooths the prizes into neat, even steps (good for tidy round numbers) |
| MANUAL | Lets you type in prize amounts yourself |

**Tie Handling** (shown above each division):
- **Duplicate (B)** — tied players both get the higher prize (more generous)
- **Average (A)** — tied players split the combined prize between them

When you're happy with the numbers, go to the Export tab.

---

### STEP 4 — MANUAL

Use this tab if you want to enter prize amounts from scratch without importing any CSV data. Useful for one-off adjustments or if the CSV import isn't available.

---

### STEP 5 — EXPORT

This is where you print everything.

Click any button to open a print-ready page in a new window, then use the **Print / Save PDF** button on that page.

**Available reports:**

| Button | What it prints |
|--------|---------------|
| Stableford Full Results | Every Stableford player and their score |
| Stableford Prizes | Only the prize winners |
| Two's — Stableford | Two's competition winners and payouts |
| Medal Full Results | Every Medal player and their nett score |
| Medal Division 1 | Division 1 Medal results |
| Medal Division 2 | Division 2 Medal results |
| Medal Division 3 | Division 3 Medal results |
| Medal Prizes | All three divisions with prize amounts |

---

## Quick reference — typical workflow

- Export CSV files from your golf system
- Open the Prize Calculator in your browser
- **Tab 1:** Drop in the CSV files, click Parse
- **Tab 2:** Set competition name, date, entry fee, and division boundaries
- **Tab 3:** Check the prize allocations look right. Use PRACTICAL to tidy up numbers if needed.
- **Tab 5:** Print the sheets you need

---

## Common questions

**The status badge says "Error" — what do I do?**
The CSV file format doesn't match what the calculator expects. Check you've exported the right file from your golf system and that it's a proper CSV (comma-separated).

**Prizes don't look right — what can I do?**
Click **PRACTICAL** to smooth them out, or **MANUAL** to enter the amounts yourself. Click **REVERT** to go back to the auto-calculated amounts at any time.

**A player is in the wrong division**
Check the handicap ranges on the Configure tab. Adjust Div 1/2/3 min and max, then click "Parse divisions" to re-sort.

**Two's prizes aren't calculating**
Make sure you've entered a fund amount on the Configure tab (Two's prize funds section) — it defaults to £0.`
};
