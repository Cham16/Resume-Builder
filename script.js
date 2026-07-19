(function () {
  "use strict";

  const API_BASE = ""; // same-origin: works once frontend + backend are on the same Render service

  const nameInput = document.getElementById("fullName");
  const rollInput = document.getElementById("rollNumber");
  const collegeInput = document.getElementById("collegeName");
  const courseSelect = document.getElementById("course");
  const yearSelect = document.getElementById("courseYear");
  const skillsInput = document.getElementById("skills");

  const certUpload = document.getElementById("certUpload");
  const uploadHint = document.getElementById("uploadHint");
  const certChipList = document.getElementById("certChipList");
  const certCount = document.getElementById("certCount");

  const viewerGroup = document.getElementById("viewerGroup");
  const viewerFileName = document.getElementById("viewerFileName");
  const viewerBox = document.getElementById("viewerBox");

  const pvCollege = document.getElementById("pv-college");
  const pvName = document.getElementById("pv-name");
  const pvCourse = document.getElementById("pv-course");
  const pvYear = document.getElementById("pv-year");
  const pvRoll = document.getElementById("pv-roll");
  const pvRollMini = document.getElementById("pv-roll-mini");
  const pvStatus = document.getElementById("pv-status");
  const pvCertList = document.getElementById("pv-cert-list");
  const pvSkills = document.getElementById("pv-skills");
  const pvDate = document.getElementById("pv-date");
  const sealEl = document.getElementById("seal");
  const sealInitials = document.getElementById("seal-initials");
  const saveStatus = document.getElementById("saveStatus");

  const STORAGE_KEY = "resumeBuilderDraft";
  // Each certificate: { id, name, type, file (File|null, in-memory only), localUrl (object URL|null), cloudUrl (server path|null) }
  let certificates = [];
  let cloudId = null;
  let activeCertId = null;

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function getInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "SD";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function shortCourseLabel(value) {
    if (!value) return "";
    return value.split(" — ")[0];
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function fileKind(cert) {
    const name = (cert.name || "").toLowerCase();
    const type = cert.type || "";
    if (type.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/.test(name)) return "image";
    if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (name.endsWith(".docx")) return "docx";
    if (name.endsWith(".doc")) return "doc";
    return "other";
  }

  function chipIcon(kind) {
    return { image: "🖼", pdf: "📄", docx: "📝", doc: "📝", other: "📎" }[kind] || "📎";
  }

  function render() {
    const name = nameInput.value.trim();
    const roll = rollInput.value.trim();
    const college = collegeInput.value.trim();
    const course = courseSelect.value;
    const year = yearSelect.value;
    const skills = skillsInput.value.trim();

    pvName.textContent = name || "Full Name";
    pvCollege.textContent = college || "Your College Name";
    pvCourse.textContent = course ? shortCourseLabel(course) : "Course not selected";
    pvYear.textContent = year || "Year not selected";
    pvRoll.textContent = roll || "—";
    pvRollMini.textContent = roll || "—";
    sealInitials.textContent = getInitials(name || "Student Dossier");
    pvSkills.textContent = skills || "Not provided";

    if (certificates.length === 0) {
      pvCertList.innerHTML = '<li class="empty-row">None uploaded yet</li>';
    } else {
      pvCertList.innerHTML = certificates
        .map((cert) => `<li>${escapeHtml(cert.name)}</li>`)
        .join("");
    }

    const isComplete = Boolean(name && roll && college && course);
    pvStatus.textContent = isComplete ? "Verified" : "Incomplete";
    pvStatus.classList.toggle("status-complete", isComplete);
    if (isComplete && !sealEl.classList.contains("complete")) {
      sealEl.classList.add("complete");
    } else if (!isComplete) {
      sealEl.classList.remove("complete");
    }

    saveDraftLocally();
  }

  function renderCertChips() {
    if (certificates.length === 0) {
      certChipList.innerHTML = '<li class="empty-row">No certificates uploaded yet</li>';
    } else {
      certChipList.innerHTML = certificates
        .map(
          (cert) => `
        <li class="cert-chip${cert.id === activeCertId ? " active" : ""}" data-id="${cert.id}">
          <span class="chip-icon">${chipIcon(fileKind(cert))}</span>
          <span class="chip-name">${escapeHtml(cert.name)}</span>
          <button type="button" class="chip-remove" data-remove-id="${cert.id}" aria-label="Remove ${escapeHtml(cert.name)}">×</button>
        </li>`
        )
        .join("");
    }
    certCount.textContent =
      certificates.length === 1
        ? "1 certificate added"
        : `${certificates.length} certificates added`;
  }

  certChipList.addEventListener("click", (e) => {
    const removeBtn = e.target.closest("[data-remove-id]");
    if (removeBtn) {
      removeCertificate(removeBtn.getAttribute("data-remove-id"));
      return;
    }
    const chip = e.target.closest(".cert-chip");
    if (chip) {
      previewCertificate(chip.getAttribute("data-id"));
    }
  });

  function removeCertificate(id) {
    const cert = certificates.find((c) => c.id === id);
    if (cert && cert.localUrl) URL.revokeObjectURL(cert.localUrl);
    certificates = certificates.filter((c) => c.id !== id);
    if (activeCertId === id) {
      activeCertId = null;
      viewerGroup.hidden = true;
    }
    renderCertChips();
    render();
  }

  // ---------- Preview ----------
  async function previewCertificate(id) {
    const cert = certificates.find((c) => c.id === id);
    if (!cert) return;
    activeCertId = id;
    renderCertChips();

    viewerGroup.hidden = false;
    viewerFileName.textContent = cert.name;
    viewerBox.innerHTML = '<p class="viewer-fallback">Loading preview…</p>';

    const kind = fileKind(cert);
    const source = cert.localUrl || cert.cloudUrl;

    if (!source) {
      viewerBox.innerHTML =
        '<p class="viewer-fallback">This file was only saved locally on a previous device/session and its content isn\'t available anymore. Re-upload it, or open a cloud-saved link that includes the original file.</p>';
      return;
    }

    try {
      if (kind === "image") {
        viewerBox.innerHTML = `<img src="${source}" alt="${escapeHtml(cert.name)}">`;
      } else if (kind === "pdf") {
        viewerBox.innerHTML = `<iframe src="${source}"></iframe>`;
      } else if (kind === "docx") {
        viewerBox.innerHTML = "";
        const buffer = cert.file
          ? await cert.file.arrayBuffer()
          : await (await fetch(source)).arrayBuffer();
        await window.docx.renderAsync(buffer, viewerBox);
      } else {
        viewerBox.innerHTML = `<p class="viewer-fallback">Preview isn't supported for this file type.<br><a href="${source}" target="_blank" rel="noopener">Open "${escapeHtml(
          cert.name
        )}" in a new tab</a></p>`;
      }
    } catch (err) {
      viewerBox.innerHTML = '<p class="viewer-fallback">Couldn\'t preview this file.</p>';
    }
  }

  // ---------- Local autosave (browser-only, survives refresh; file bytes are NOT persisted) ----------
  function collectFormData() {
    return {
      fullName: nameInput.value,
      rollNumber: rollInput.value,
      collegeName: collegeInput.value,
      course: courseSelect.value,
      courseYear: yearSelect.value,
      skills: skillsInput.value,
      certificates: certificates.map((c) => ({
        name: c.name,
        type: c.type,
        cloudUrl: c.cloudUrl || null,
      })),
    };
  }

  function saveDraftLocally() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormData()));
    } catch (e) {
      // localStorage unavailable (private browsing etc.) - fail silently
    }
  }

  function applyFormData(data) {
    if (!data) return;
    nameInput.value = data.fullName || "";
    rollInput.value = data.rollNumber || "";
    collegeInput.value = data.collegeName || "";
    courseSelect.value = data.course || "";
    yearSelect.value = data.courseYear || "";
    skillsInput.value = data.skills || "";
    certificates = Array.isArray(data.certificates)
      ? data.certificates.map((c) => ({
          id: uid(),
          name: c.name,
          type: c.type || "",
          file: null,
          localUrl: null,
          cloudUrl: c.cloudUrl || null,
        }))
      : [];
    activeCertId = null;
    viewerGroup.hidden = true;
    renderCertChips();
    render();
  }

  function loadDraftLocally() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) applyFormData(JSON.parse(raw));
    } catch (e) {
      // ignore corrupt data
    }
  }

  // ---------- Cloud save/load (backend + database + file storage) ----------
  async function loadFromCloud(id) {
    setStatus("Loading saved resume…");
    try {
      const res = await fetch(`${API_BASE}/api/resume/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      applyFormData(data);
      cloudId = id;
      setStatus("Loaded from cloud link.");
    } catch (err) {
      setStatus("Couldn't load that cloud link.", true);
    }
  }

  async function uploadPendingFiles() {
    const uploads = certificates.filter((c) => c.file && !c.cloudUrl);
    for (const cert of uploads) {
      const form = new FormData();
      form.append("file", cert.file, cert.name);
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(`Failed to upload ${cert.name}`);
      const data = await res.json();
      cert.cloudUrl = data.url;
    }
  }

  async function saveToCloud() {
    setStatus("Uploading certificate files…");
    try {
      await uploadPendingFiles();
      setStatus("Saving to cloud…");
      const res = await fetch(`${API_BASE}/api/save`, {
        method: cloudId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          cloudId ? { id: cloudId, ...collectFormData() } : collectFormData()
        ),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      cloudId = data.id;
      const shareUrl = `${window.location.origin}${window.location.pathname}?id=${cloudId}`;
      const url = new URL(window.location.href);
      url.searchParams.set("id", cloudId);
      window.history.replaceState({}, "", url);
      try {
        await navigator.clipboard.writeText(shareUrl);
        setStatus(`Saved. Shareable link copied to clipboard: ${shareUrl}`);
      } catch (e) {
        setStatus(`Saved. Shareable link: ${shareUrl}`);
      }
    } catch (err) {
      setStatus(
        "Couldn't save to cloud. Is the backend server running?",
        true
      );
    }
  }

  function setStatus(message, isError) {
    saveStatus.textContent = message;
    saveStatus.classList.toggle("status-error", Boolean(isError));
  }

  // ---------- Certificate upload ----------
  certUpload.addEventListener("change", () => {
    const files = Array.from(certUpload.files || []);
    if (files.length === 0) return;
    files.forEach((file) => {
      certificates.push({
        id: uid(),
        name: file.name,
        type: file.type,
        file: file,
        localUrl: URL.createObjectURL(file),
        cloudUrl: null,
      });
    });
    uploadHint.textContent =
      files.length === 1 ? files[0].name : `${files.length} files selected`;
    renderCertChips();
    render();
    certUpload.value = "";
  });

  // ---------- Download as PDF ----------
  document.getElementById("downloadBtn").addEventListener("click", () => {
    const dossier = document.getElementById("dossier");
    const name = nameInput.value.trim() || "resume";
    const filename = `${name.replace(/\s+/g, "_")}_dossier.pdf`;
    html2pdf()
      .set({
        margin: 0.3,
        filename: filename,
        html2canvas: { scale: 2, backgroundColor: "#0D1526" },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      })
      .from(dossier)
      .save();
  });

  document.getElementById("saveCloudBtn").addEventListener("click", saveToCloud);

  document.getElementById("resetBtn").addEventListener("click", () => {
    document.getElementById("resume-form").reset();
    certificates.forEach((c) => c.localUrl && URL.revokeObjectURL(c.localUrl));
    certificates = [];
    cloudId = null;
    activeCertId = null;
    viewerGroup.hidden = true;
    uploadHint.textContent = "No file chosen";
    renderCertChips();
    render();
    localStorage.removeItem(STORAGE_KEY);
    setStatus("");
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url);
  });

  [nameInput, rollInput, collegeInput, skillsInput].forEach((el) =>
    el.addEventListener("input", render)
  );
  [courseSelect, yearSelect].forEach((el) => el.addEventListener("change", render));

  pvDate.textContent = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // ---------- Init ----------
  const params = new URLSearchParams(window.location.search);
  const urlId = params.get("id");
  if (urlId) {
    cloudId = urlId;
    loadFromCloud(urlId);
  } else {
    loadDraftLocally();
  }

  renderCertChips();
  render();
})();