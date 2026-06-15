// ------------------------------------------------------------
// MANUAL MODULE
// ------------------------------------------------------------
// Handles manual notes textarea (save to State)
// ------------------------------------------------------------

window.Manual = {

  init() {
    this.initNotes();
  },

  initNotes() {
    const notes = document.getElementById("manual-notes");
    if (!notes) return;

    notes.value = State.manualNotes;

    notes.addEventListener("input", () => {
      State.manualNotes = notes.value;
    });
  }
};
