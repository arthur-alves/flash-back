const form = document.getElementById("setup-form");
const statusEl = document.getElementById("status");
const submitBtn = document.getElementById("submit-btn");

initThemeToggle(document.getElementById("theme-toggle"));

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
    statusEl.textContent = "As senhas não conferem.";
    statusEl.classList.add("error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = iconSvg("save") + " Criando...";

  try {
    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error || "Erro ao criar conta.";
      statusEl.classList.add("error");
      submitBtn.disabled = false;
      submitBtn.innerHTML = iconSvg("save") + " Criar conta";
    } else {
      window.location.href = "admin.html";
    }
  } catch (err) {
    statusEl.textContent = "Erro de rede ao criar conta.";
    statusEl.classList.add("error");
    submitBtn.disabled = false;
    submitBtn.innerHTML = iconSvg("save") + " Criar conta";
  }
});
