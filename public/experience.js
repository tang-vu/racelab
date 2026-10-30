import { chapterSteps, replayFrame } from "./motion-data.js";

// Original motion/art direction. No remote scripts, trackers or copied site assets.
const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const safelyRead = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safelyWrite = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage is optional. */
  }
};
let context = null,
  chapter = 0,
  scrollQueued = false;
let paused = reduced.matches || safelyRead("racelab-motion") === "paused";
let heroActive = false;
const format = (value) =>
  value === undefined
    ? "\u2014"
    : value === null
      ? "empty"
      : typeof value === "object"
        ? "{...}"
        : String(value);

function setPaused(next) {
  paused = reduced.matches || next;
  document.body.classList.toggle("motion-paused", paused);
  document.documentElement.dataset.motion = paused ? "paused" : "running";
  if ($("motion-toggle")) {
    $("motion-toggle").setAttribute("aria-pressed", String(paused));
    $("motion-toggle").disabled = reduced.matches;
    $("motion-toggle").innerHTML = reduced.matches
      ? "Reduced motion enabled"
      : paused
        ? 'Resume motion <span aria-hidden="true">&#9655;</span>'
        : 'Pause motion <span aria-hidden="true">&#8545;</span>';
  }
  if (paused && $("sculpture")) {
    $("sculpture").style.setProperty("--pointer-x", "0deg");
    $("sculpture").style.setProperty("--pointer-y", "0deg");
  }
}
setPaused(paused);
$("motion-toggle")?.addEventListener("click", () => {
  setPaused(!paused);
  safelyWrite("racelab-motion", paused ? "paused" : "running");
});
reduced.addEventListener?.("change", () =>
  setPaused(reduced.matches || safelyRead("racelab-motion") === "paused"),
);

function theme(dark) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $("theme-toggle")?.setAttribute("aria-pressed", String(dark));
  $("theme-toggle")?.setAttribute(
    "aria-label",
    dark ? "Switch to light theme" : "Switch to dark theme",
  );
}
theme(safelyRead("racelab-theme") === "dark");
$("theme-toggle")?.addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme !== "dark";
  theme(dark);
  safelyWrite("racelab-theme", dark ? "dark" : "light");
});

function renderSculpture() {
  if (!$("sculpture")) return;
  const frame = replayFrame(context?.fixture, context?.run, context?.step);
  $("sculpture").classList.toggle("has-execution", Boolean(frame));
  $("sculpture-key").textContent = frame?.key ?? "shared state";
  $("sculpture-value").textContent = format(frame?.memory);
  $("sculpture-read-a").textContent = format(frame?.readA);
  $("sculpture-read-b").textContent = format(frame?.readB);
  $("sculpture-outcome").textContent = frame
    ? `${frame.impact.actual} / ${frame.impact.expected} ${frame.impact.label.toLowerCase()}`
    : "Execute a handler to inspect its state";
  $("sculpture-caption").textContent = frame
    ? `Actual local trace / operation ${frame.step} of ${frame.total}`
    : "Original geometry. Waiting for a local trace.";
  $("sculpture-wrap").dataset.verdict =
    frame?.verdict.toLowerCase() ?? "waiting";
}

function renderStory() {
  if (!$("replay-board")) return;
  const steps = chapterSteps(context?.run, context?.fixture?.id);
  const frame = replayFrame(context?.fixture, context?.run, steps[chapter]);
  $("replay-board").dataset.chapter = String(chapter);
  $("replay-board").dataset.verdict = frame?.verdict.toLowerCase() ?? "waiting";
  $("story-version").textContent =
    context?.version === "candidate" ? "CANDIDATE B" : "ORIGINAL A";
  $("story-step").textContent = frame
    ? `OP. ${String(frame.step).padStart(2, "0")} / ${String(frame.total).padStart(2, "0")}`
    : "NO EXECUTION";
  $("story-read-a").textContent = format(frame?.readA);
  $("story-read-b").textContent = format(frame?.readB);
  $("story-key").textContent = frame?.key ?? "shared state";
  $("story-value").textContent = format(frame?.memory);
  $("story-impact-label").textContent =
    frame?.impact.label ?? "OBSERVED / EXPECTED";
  $("story-actual").textContent = format(frame?.impact.actual);
  $("story-expected").textContent = format(frame?.impact.expected);
  $("story-verdict").textContent = frame?.verdict ?? "WAITING";
  $("story-phase").textContent =
    chapter === 0
      ? frame?.sharedRead
        ? "Same value. Separate copies."
        : "Reads, in order."
      : chapter === 1
        ? "A write changes the shared state."
        : frame?.verdict === "PASS"
          ? "This execution meets the contract."
          : "A verdict, outside the model.";
  $("story-caption").textContent = !frame
    ? "Run a handler in the lab to create an execution."
    : chapter === 2
      ? "The final verdict is independently computed. It covers this store, schedule and input case."
      : "Scrubbed from the current local execution. The contract judges the full run, not this intermediate frame.";
  document
    .querySelectorAll(".story-chapter")
    .forEach((node, i) =>
      node.classList.toggle("chapter-active", i === chapter),
    );
}

document.addEventListener("racelab:frame", (event) => {
  context = event.detail;
  renderSculpture();
  renderStory();
});

const revealNodes = document.querySelectorAll(
  "[data-reveal], .experiment-intro, .lab-intro, .repair-section, .artifact-bar",
);
if ("IntersectionObserver" in window) {
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          reveal.unobserve(entry.target);
        }
    },
    { threshold: 0.12 },
  );
  revealNodes.forEach((node) => reveal.observe(node));
  if ($("sculpture-wrap")) {
    const active = new IntersectionObserver(
      ([entry]) => {
        heroActive = entry.isIntersecting;
        $("sculpture-wrap").classList.toggle("hero-active", heroActive);
      },
      { threshold: 0 },
    );
    active.observe($("sculpture-wrap"));
  }
} else revealNodes.forEach((node) => node.classList.add("in-view"));

function scrollUpdate() {
  scrollQueued = false;
  const nodes = [...document.querySelectorAll(".story-chapter")];
  if (nodes.length) {
    const middle = innerHeight * 0.5;
    let closest = 0,
      distance = Infinity;
    nodes.forEach((node, i) => {
      const rect = node.getBoundingClientRect();
      const next = Math.abs(rect.top + rect.height * 0.5 - middle);
      if (next < distance) {
        distance = next;
        closest = i;
      }
    });
    if (chapter !== closest) {
      chapter = closest;
      renderStory();
    }
  }
  const workbench = $("workspace");
  if (workbench)
    document.body.classList.toggle(
      "inside-lab",
      workbench.getBoundingClientRect().top < 180,
    );
}
function scheduleScroll() {
  if (!scrollQueued) {
    scrollQueued = true;
    requestAnimationFrame(scrollUpdate);
  }
}
addEventListener("scroll", scheduleScroll, { passive: true });
addEventListener("resize", scheduleScroll, { passive: true });
document.addEventListener("visibilitychange", () =>
  document.body.classList.toggle("page-hidden", document.hidden),
);

$("sculpture-wrap")?.addEventListener("pointermove", (event) => {
  if (paused || !finePointer.matches || !heroActive) return;
  const rect = $("sculpture-wrap").getBoundingClientRect();
  const x = Math.max(
    -1,
    Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1),
  );
  const y = Math.max(
    -1,
    Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1),
  );
  $("sculpture").style.setProperty("--pointer-x", `${-y * 7}deg`);
  $("sculpture").style.setProperty("--pointer-y", `${x * 10}deg`);
});
$("sculpture-wrap")?.addEventListener("pointerleave", () => {
  $("sculpture").style.setProperty("--pointer-x", "0deg");
  $("sculpture").style.setProperty("--pointer-y", "0deg");
});

// Anchor navigation remains native when smooth motion is reduced or unavailable.
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    return;
  const id = link.getAttribute("href").slice(1),
    target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({
    behavior: reduced.matches || paused ? "instant" : "smooth",
    block: "start",
  });
  // Move keyboard focus with navigation as well as the viewport.
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  history.replaceState(null, "", `#${id}`);
});

document.body.classList.add("motion-ready");
requestAnimationFrame(() => document.body.classList.add("intro-done"));
scheduleScroll();
document.dispatchEvent(new Event("racelab:request-frame"));
