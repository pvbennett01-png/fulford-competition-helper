// ------------------------------------------------------------
// MAIN CONTROLLER
// ------------------------------------------------------------
// Initialises every module after DOM is ready.
// Load order matters: state → utils → ui → import → configure → prizes → results → manual
// ------------------------------------------------------------

// Prevent the browser navigating away if a file is dropped outside a drop zone
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("drop",     e => e.preventDefault());

document.addEventListener("DOMContentLoaded", () => {
  UI.init();
  Import.init();
  Configure.init();
  Results.init();
  Manual.init();
  Export.init();
  Guide.init();

  const recalcBtn = document.getElementById("btn-recalc-twos");
  if (recalcBtn) recalcBtn.addEventListener("click", () => Twos.render());

  console.log("Fulford GC Prize Calculator V13 — initialised.");
});
