const form = document.getElementById("setup-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

initThemeToggle(document.getElementById("theme-select"));
initLangToggle(document.getElementById("lang-select"));

// If setup was already completed (e.g. opened in two tabs), bounce to login.
fetch("/api/setup/status")
  .then((r) => r.json())
  .then((data) => {
    if (data.configured) window.location.href = "login.html";
  });

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "upload-status";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("password-confirm").value;

  if (password !== passwordConfirm) {
    statusEl.textContent = t("passwords_dont_match");
    statusEl.classList.add("error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = iconSvg("save") + " " + t("creating");

  try {
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error ? tError(data.error) : t("error_creating_account");
      statusEl.classList.add("error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = iconSvg("save") + " " + t("create_account");
    } else {
      window.location.href = "admin.html";
    }
  } catch (err) {
    statusEl.textContent = t("network_error_creating_account");
    statusEl.classList.add("error");
    submitBtn.disabled = false;
    submitBtn.innerHTML = iconSvg("save") + " " + t("create_account");
  }
});
