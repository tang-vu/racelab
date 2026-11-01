const video = document.querySelector("video");
const chapters = [...document.querySelectorAll("[data-seek]")];
for (const button of chapters)
  button.addEventListener("click", async () => {
    if (video.readyState < 1)
      await new Promise((done) =>
        video.addEventListener("loadedmetadata", done, { once: true }),
      );
    video.currentTime = Number(button.dataset.seek);
    await video.play().catch(() => {});
  });
video.addEventListener("timeupdate", () => {
  const current = chapters.findLast(
    (button) => Number(button.dataset.seek) <= video.currentTime,
  );
  for (const button of chapters) {
    if (button === current) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  }
});
