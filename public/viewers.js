const viewerList = document.querySelector("#viewerList");
const viewerCount = document.querySelector("#viewerCount");

loadViewers();
setInterval(loadViewers, 5000);

async function loadViewers() {
  try {
    const response = await fetch("/api/admin/viewers", { cache: "no-store" });
    const data = await response.json();
    renderViewers(data.viewers || []);
  } catch {
    viewerList.classList.add("empty");
    viewerList.textContent = "Could not load live viewers.";
  }
}

function renderViewers(viewers) {
  viewerCount.textContent = `${viewers.length} live`;
  viewerList.classList.toggle("empty", viewers.length === 0);
  viewerList.innerHTML = viewers.length
    ? viewers.map(renderViewer).join("")
    : "No live viewers.";
}

function renderViewer(viewer) {
  const forwardedFor = viewer.forwardedFor && viewer.forwardedFor !== viewer.ip
    ? `Forwarded: ${viewer.forwardedFor}`
    : "";
  return `
    <article class="viewer-card">
      <div class="viewer-main">
        <strong>${escapeHtml(formatPage(viewer.page))}</strong>
        <span>${escapeHtml(viewer.ip || "unknown ip")}</span>
      </div>
      <div class="viewer-meta">
        <span>${viewer.visible ? "Live now" : "Background"}</span>
        <span>Connected ${formatTime(viewer.connectedAt)}</span>
        <span>Seen ${formatTime(viewer.lastSeenAt)}</span>
      </div>
      ${forwardedFor ? `<div class="viewer-forwarded">${escapeHtml(forwardedFor)}</div>` : ""}
      <div class="viewer-agent">${escapeHtml(viewer.userAgent || "")}</div>
    </article>
  `;
}

function formatTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatPage(page) {
  if (page === "monitor") return "Monitor";
  if (page === "dashboard") return "TV Dashboard";
  return page || "unknown";
}
