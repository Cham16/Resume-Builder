(function () {
  "use strict";

  const nameInput = document.getElementById("fullName");
  const rollInput = document.getElementById("rollNumber");
  const collegeInput = document.getElementById("collegeName");
  const courseSelect = document.getElementById("course");
  const yearSelect = document.getElementById("courseYear");
  const skillsInput = document.getElementById("skills");

  const certUpload = document.getElementById("certUpload");
  const uploadHint = document.getElementById("uploadHint");
  const certList = document.getElementById("certList");
  const certCount = document.getElementById("certCount");
  const removeCertBtn = document.getElementById("removeCertBtn");

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

  let certificates = [];

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
        .map((cert) => `<li>${escapeHtml(cert)}</li>`)
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
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function refreshCertSelect() {
    certList.innerHTML = "";
    certificates.forEach((cert, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = cert;
      certList.appendChild(opt);
    });
    certCount.textContent =
      certificates.length === 1
        ? "1 certificate added"
        : `${certificates.length} certificates added`;
  }

  certUpload.addEventListener("change", () => {
    const files = Array.from(certUpload.files || []);
    if (files.length === 0) return;
    files.forEach((file) => certificates.push(file.name));
    uploadHint.textContent =
      files.length === 1 ? files[0].name : `${files.length} files selected`;
    refreshCertSelect();
    render();
    certUpload.value = "";
  });

  removeCertBtn.addEventListener("click", () => {
    const selected = Array.from(certList.selectedOptions).map((o) => Number(o.value));
    if (selected.length === 0) return;
    certificates = certificates.filter((_, i) => !selected.includes(i));
    refreshCertSelect();
    render();
  });

  document.getElementById("printBtn").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    document.getElementById("resume-form").reset();
    certificates = [];
    uploadHint.textContent = "No file chosen";
    refreshCertSelect();
    render();
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

  refreshCertSelect();
  render();
})();
