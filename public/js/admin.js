const form = document.getElementById("upload-form");
const statusEl = document.getElementById("upload-status");
const submitBtn = document.getElementById("submit-btn");
const tableBody = document.getElementById("games-table-body");

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function loadGames() {
  const res = await fetch("/api/admin/games");
  if (!res.ok) return;
  const games = await res.json();

  tableBody.innerHTML = "";
  for (const game of games) {
    const row = document.createElement("tr");

    const coverCell = document.createElement("td");
    coverCell.appendChild(buildCoverUploader(game));

    const titleCell = document.createElement("td");
    titleCell.textContent = game.title;

    const fileCell = document.createElement("td");
    fileCell.textContent = game.file;

    const sizeCell = document.createElement("td");
    sizeCell.textContent = formatSize(game.sizeBytes || 0);

    const actionsCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Remover";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => deleteGame(game.slug, game.title));
    actionsCell.appendChild(deleteBtn);

    row.append(coverCell, titleCell, fileCell, sizeCell, actionsCell);
    tableBody.appendChild(row);
  }
}

function buildCoverUploader(game) {
  const wrap = document.createElement("div");
  wrap.className = "cover-uploader";

  const thumb = document.createElement(game.cover ? "img" : "div");
  thumb.className = "cover-thumb";
  if (game.cover) {
    thumb.src = `covers/${game.slug}.${game.cover}?t=${Date.now()}`;
    thumb.alt = game.title;
  } else {
    thumb.textContent = game.title.slice(0, 1).toUpperCase();
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".jpg,.jpeg,.png,.webp";
  input.className = "cover-input";
  input.title = "Trocar capa";

  input.addEventListener("change", async () => {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append("cover", input.files[0]);

    const res = await fetch(`/api/admin/games/${encodeURIComponent(game.slug)}/cover`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      loadGames();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Erro ao enviar a capa.");
    }
  });

  wrap.append(thumb, input);
  return wrap;
}

async function deleteGame(slug, title) {
  if (!confirm(`Remover "${title}" da biblioteca? O arquivo será apagado do servidor.`)) return;

  const res = await fetch(`/api/admin/games/${encodeURIComponent(slug)}`, { method: "DELETE" });
  if (res.ok) {
    loadGames();
  } else {
    alert("Erro ao remover o jogo.");
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "upload-status";

  const formData = new FormData(form);

  submitBtn.disabled = true;
  submitBtn.textContent = "Enviando...";

  try {
    const res = await fetch("/api/admin/games", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error || "Erro ao enviar o jogo.";
      statusEl.classList.add("error");
    } else {
      statusEl.textContent = `"${data.title}" adicionado com sucesso!`;
      statusEl.classList.add("success");
      form.reset();
      loadGames();
    }
  } catch (err) {
    statusEl.textContent = "Erro de rede ao enviar o jogo.";
    statusEl.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Enviar jogo";
  }
});

loadGames();
