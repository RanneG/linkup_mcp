(function () {
  const FRAME_COUNT = 24;
  const pad = (n) => String(n).padStart(3, "0");
  const frameEl = document.getElementById("frame");
  const labelEl = document.getElementById("frame-label");
  const totalEl = document.getElementById("frame-total");
  const stage = document.getElementById("stage-wrap");

  totalEl.textContent = String(FRAME_COUNT);

  function frameSrc(i) {
    return `frames/frame_${pad(i)}.svg`;
  }

  function setFrame(index) {
    const clamped = Math.max(0, Math.min(FRAME_COUNT - 1, index));
    frameEl.src = frameSrc(clamped);
    labelEl.textContent = String(clamped + 1);
  }

  function onScroll() {
    const rect = stage.getBoundingClientRect();
    const scrollable = stage.offsetHeight - window.innerHeight;
    if (scrollable <= 0) {
      setFrame(0);
      return;
    }
    const progressed = Math.min(1, Math.max(0, -rect.top / scrollable));
    const index = Math.round(progressed * (FRAME_COUNT - 1));
    setFrame(index);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();
})();
