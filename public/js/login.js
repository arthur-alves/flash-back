const form = document.getElementById("login-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

initThemeToggle(document.getElementById("theme-select"));
initLangToggle(document.getElementById("lang-select"));

fetch("/api/setup/status")
  .then((r) => r.json())
  .then((data) => {
    if (!data.configured) window.location.href = "setup.html";
  });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "upload-status";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error ? tError(data.error) : t("error_logging_in");
      statusEl.classList.add("error");
      submitBtn.disabled = false;
    } else {
      window.location.href = "admin.html";
    }
  } catch (err) {
    statusEl.textContent = t("network_error_logging_in");
    statusEl.classList.add("error");
    submitBtn.disabled = false;
  }
});
