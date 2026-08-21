const API_BASE = ""; // Vercel rewrites /api/* to the Render backend.

const $ = (s) => document.querySelector(s);
const sidebar = $("#sidebar");
const menu = $("#menu");
const status = $("#status");
const healthBox = $("#health");
const heroStatus = $("#heroStatus");
const form = $("#pdfForm");
const fileInput = $("#pdfFile");
const dropzone = $("#dropzone");
const fileName = $("#fileName");
const message = $("#message");
const progress = $("#progress");
const pageState = $("#pageState");
const toast = $("#toast");

function setStatus(kind, text) {
  status.className = `server-status ${kind || ""}`;
  status.querySelector("span").textContent = text;
  heroStatus.textContent = kind === "online" ? "Online" : kind === "error" ? "Offline" : "Connecting…";
}

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.remove("show"), 2800);
}

async function health() {
  setStatus("", "Checking backend…");
  try {
    const r = await fetch(`${API_BASE}/api/health`, { cache: "no-store" });
    const data = await r.json();
    if (!r.ok || !data.success) throw new Error(data.error || `HTTP ${r.status}`);
    setStatus("online", `Backend online · ${data.version}`);
    healthBox.textContent = JSON.stringify(data, null, 2);
    pageState.textContent = "Ready";
    pageState.className = "pill success";
  } catch (e) {
    setStatus("error", "Backend unavailable");
    heroStatus.textContent = "Offline";
    healthBox.textContent = `Unable to reach the Render API.\n\n${e.message}`;
    pageState.textContent = "Offline";
    pageState.className = "pill";
  }
}

function selectedFile(file) {
  if (!file) {
    fileName.textContent = "No file selected";
    return;
  }
  const mb = (file.size / 1024 / 1024).toFixed(2);
  fileName.textContent = `${file.name} · ${mb} MB`;
}

fileInput.addEventListener("change", () => selectedFile(fileInput.files[0]));

["dragenter", "dragover"].forEach(type => {
  dropzone.addEventListener(type, e => {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
});
["dragleave", "drop"].forEach(type => {
  dropzone.addEventListener(type, e => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  });
});
dropzone.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    message.textContent = "Please select a PDF file.";
    message.className = "message error";
    return;
  }
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
  } catch (_) {}
  selectedFile(file);
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) return;

  const btn = e.submitter;
  btn.disabled = true;
  progress.hidden = false;
  message.className = "message";
  message.textContent = "Rendering every page…";
  pageState.textContent = "Processing";
  pageState.className = "pill";

  try {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("format", $("#pdfFormat").value);

    const response = await fetch(`${API_BASE}/api/pdf/to-image`, {
      method: "POST",
      body: fd
    });

    if (!response.ok) {
      let error = `HTTP ${response.status}`;
      try {
        const data = await response.json();
        error = data.error || error;
      } catch (_) {}
      throw new Error(error);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wobz-pdf-images.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    message.textContent = "Done — your PDF pages are packaged in the ZIP.";
    message.className = "message ok";
    pageState.textContent = "Complete";
    pageState.className = "pill success";
    showToast("PDF images generated successfully.");
  } catch (err) {
    message.textContent = err.message || "Something went wrong.";
    message.className = "message error";
    pageState.textContent = "Error";
    pageState.className = "pill";
    showToast("PDF processing failed.");
  } finally {
    btn.disabled = false;
    progress.hidden = true;
  }
});

document.querySelectorAll(".nav-item").forEach(a => {
  a.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    a.classList.add("active");
    sidebar?.classList.remove("open");
  });
});

menu?.addEventListener("click", () => {
  if (!sidebar) return;
  sidebar.style.display = sidebar.style.display === "flex" ? "none" : "flex";
});

$("#refreshHealth")?.addEventListener("click", health);

health();
