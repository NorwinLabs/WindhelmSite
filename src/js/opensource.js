document.getElementById("copyright-year").textContent =
  new Date().getFullYear();

var count = document.getElementById("repo-count").textContent;
document.getElementById("term-count").textContent = count;

var clock = document.getElementById("clock");
function tick() {
  // Visitor's local date and time, 12-hour format
  clock.textContent = new Date().toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
tick();
setInterval(tick, 1000);
