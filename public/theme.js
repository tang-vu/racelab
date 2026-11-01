const button = document.getElementById("theme-toggle");
const apply = (dark) => {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute(
    "aria-label",
    dark ? "Switch to light theme" : "Switch to dark theme",
  );
};
try {
  apply(localStorage.getItem("racelab-theme") === "dark");
} catch {
  apply(false);
}
button.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  apply(dark);
  try {
    localStorage.setItem("racelab-theme", dark ? "dark" : "light");
  } catch {}
});
