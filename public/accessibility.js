// Manual-activation tabs: arrow keys move focus; Enter/Space activate normally.
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const items = [
      ...dialog.querySelectorAll(
        "button, input, textarea, select, a[href], [tabindex]",
      ),
    ].filter(
      (el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length,
    );
    const first = items[0],
      last = items.at(-1);
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
for (const list of document.querySelectorAll('[role="tablist"]')) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const sync = () => {
    const active =
      tabs.find(
        (tab) => tab.getAttribute("aria-selected") === "true" && !tab.disabled,
      ) ?? tabs.find((tab) => !tab.disabled);
    for (const tab of tabs) tab.tabIndex = tab === active ? 0 : -1;
    const panel = document.getElementById(
      active?.getAttribute("aria-controls"),
    );
    if (panel) panel.setAttribute("aria-labelledby", active.id);
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(list, {
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-selected", "disabled"],
  });
  list.addEventListener("keydown", (event) => {
    const current = event.target.closest('[role="tab"]');
    if (
      !tabs.includes(current) ||
      !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
    )
      return;
    const available = tabs.filter((tab) => !tab.disabled && !tab.hidden);
    if (!available.length) return;
    event.preventDefault();
    const index = available.indexOf(current);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? available.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + available.length) %
            available.length;
    for (const tab of tabs) tab.tabIndex = tab === available[next] ? 0 : -1;
    available[next].focus();
  });
}
