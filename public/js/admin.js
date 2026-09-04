const form = document.getElementById("upload-form");
const statusEl = document.getElementById("upload-status");
const submitBtn = document.getElementById("submit-btn");
const tableBody = document.getElementById("games-table-body");

const collectionForm = document.getElementById("collection-form");
const collectionStatusEl = document.getElementById("collection-status");
const collectionSubmitBtn = document.getElementById("collection-submit-btn");
const collectionsListEl = document.getElementById("collections-list");

let allCollections = [];

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---- Games ----

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

    const tagsCell = document.createElement("td");
    tagsCell.appendChild(buildTagsEditor(game));

    const collectionsCell = document.createElement("td");
    collectionsCell.appendChild(buildCollectionChips(game));

    const actionsCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = iconSvg("trash") + " Remover";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => deleteGame(game.slug, game.title));
    actionsCell.appendChild(deleteBtn);

    row.append(coverCell, titleCell, fileCell, sizeCell, tagsCell, collectionsCell, actionsCell);
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

function buildTagsEditor(game) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "tags-input";
  input.value = (game.tags || []).join(", ");
  input.placeholder = "tag1, tag2";

  input.addEventListener("change", async () => {
    const tags = input.value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const res = await fetch(`/api/admin/games/${encodeURIComponent(game.slug)}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });

    if (res.ok) {
      const updated = await res.json();
      input.value = (updated.tags || []).join(", ");
    } else {
      alert("Erro ao salvar tags.");
    }
  });

  return input;
}

function buildCollectionChips(game) {
  const wrap = document.createElement("div");
  wrap.className = "collection-chips";

  if (allCollections.length === 0) {
    const hint = document.createElement("span");
    hint.className = "collection-hint";
    hint.textContent = "Crie uma coleção acima";
    wrap.appendChild(hint);
    return wrap;
  }

  for (const collection of allCollections) {
    const inCollection = collection.games.includes(game.slug);

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "collection-chip" + (inCollection ? " active" : "");
    chip.textContent = collection.name;
    chip.title = inCollection
      ? `Remover de "${collection.name}"`
      : `Adicionar a "${collection.name}"`;

    chip.addEventListener("click", async () => {
      const method = inCollection ? "DELETE" : "POST";
      const url = inCollection
        ? `/api/admin/collections/${encodeURIComponent(collection.slug)}/games/${encodeURIComponent(game.slug)}`
        : `/api/admin/collections/${encodeURIComponent(collection.slug)}/games`;

      const res = await fetch(url, {
        method,
        headers: inCollection ? undefined : { "Content-Type": "application/json" },
        body: inCollection ? undefined : JSON.stringify({ gameSlug: game.slug }),
      });

      if (res.ok) {
        await loadCollections();
        loadGames();
      } else {
        alert("Erro ao atualizar coleção.");
      }
    });

    wrap.appendChild(chip);
  }

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
    submitBtn.innerHTML = iconSvg("save") + " Enviar jogo";
  }
});

// ---- Collections ----

async function loadCollections() {
  const res = await fetch("/api/admin/collections");
  if (!res.ok) return;
  allCollections = await res.json();
  renderCollectionsList();
}

function renderCollectionsList() {
  collectionsListEl.innerHTML = "";

  if (allCollections.length === 0) {
    const li = document.createElement("li");
    li.className = "collection-hint";
    li.textContent = "Nenhuma coleção criada ainda.";
    collectionsListEl.appendChild(li);
    return;
  }

  for (const collection of allCollections) {
    const li = document.createElement("li");
    li.className = "collection-item";

    li.appendChild(buildCollectionCoverUploader(collection));

    const info = document.createElement("span");
    info.textContent = `${collection.name} (${collection.games.length} jogo${collection.games.length === 1 ? "" : "s"})`;

    const editBtn = document.createElement("button");
    editBtn.innerHTML = iconSvg("pencil") + " Editar";
    editBtn.className = "collection-edit-btn";
    editBtn.addEventListener("click", () => editCollection(collection));

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = iconSvg("trash") + " Excluir";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => deleteCollection(collection));

    li.append(info, editBtn, deleteBtn);
    collectionsListEl.appendChild(li);
  }
}

function buildCollectionCoverUploader(collection) {
  const wrap = document.createElement("div");
  wrap.className = "cover-uploader";

  const thumb = document.createElement(collection.cover ? "img" : "div");
  thumb.className = "cover-thumb";
  if (collection.cover) {
    thumb.src = `covers/collections/${collection.slug}.${collection.cover}?t=${Date.now()}`;
    thumb.alt = collection.name;
  } else {
    thumb.textContent = collection.name.slice(0, 1).toUpperCase();
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".jpg,.jpeg,.png,.webp";
  input.className = "cover-input";
  input.title = "Trocar capa da coleção";

  input.addEventListener("change", async () => {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append("cover", input.files[0]);

    const res = await fetch(`/api/admin/collections/${encodeURIComponent(collection.slug)}/cover`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      loadCollections();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Erro ao enviar a capa.");
    }
  });

  wrap.append(thumb, input);
  return wrap;
}

async function editCollection(collection) {
  const newName = prompt("Nome da coleção:", collection.name);
  if (newName === null) return;
  const newDescription = prompt("Descrição:", collection.description || "");
  if (newDescription === null) return;

  const res = await fetch(`/api/admin/collections/${encodeURIComponent(collection.slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName, description: newDescription }),
  });

  if (res.ok) {
    loadCollections();
  } else {
    alert("Erro ao editar coleção.");
  }
}

async function deleteCollection(collection) {
  if (!confirm(`Excluir a coleção "${collection.name}"? Os jogos não serão apagados.`)) return;

  const res = await fetch(`/api/admin/collections/${encodeURIComponent(collection.slug)}`, {
    method: "DELETE",
  });

  if (res.ok) {
    await loadCollections();
    loadGames();
  } else {
    alert("Erro ao excluir coleção.");
  }
}

collectionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  collectionStatusEl.textContent = "";
  collectionStatusEl.className = "upload-status";

  const formData = new FormData(collectionForm);
  collectionSubmitBtn.disabled = true;

  try {
    const res = await fetch("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      collectionStatusEl.textContent = data.error || "Erro ao criar coleção.";
      collectionStatusEl.classList.add("error");
    } else {
      collectionStatusEl.textContent = `Coleção "${data.name}" criada!`;
      collectionStatusEl.classList.add("success");
      collectionForm.reset();
      await loadCollections();
      loadGames();
    }
  } catch (err) {
    collectionStatusEl.textContent = "Erro de rede ao criar coleção.";
    collectionStatusEl.classList.add("error");
  } finally {
    collectionSubmitBtn.disabled = false;
  }
});

document.getElementById("back-link").innerHTML = iconSvg("arrow-left") + " Biblioteca";
submitBtn.innerHTML = iconSvg("save") + " Enviar jogo";
collectionSubmitBtn.innerHTML = iconSvg("plus") + " Criar coleção";
initThemeToggle(document.getElementById("theme-toggle"));

async function init() {
  await loadCollections();
  loadGames();
}

init();
