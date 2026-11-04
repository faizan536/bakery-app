// Wires the buttons on the printable bill page (inline handlers are blocked by CSP).
const printButton = document.querySelector("[data-print]");
if (printButton) {
  printButton.addEventListener("click", () => window.print());
}
