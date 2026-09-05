const form = document.getElementById("upload-form");
const statusEl = document.getElementById("upload-status");
const submitBtn = document.getElementById("submit-btn");
const tableBody = document.getElementById("games-table-body");

const collectionForm = document.getElementById("collection-form");
const collectionStatusEl = document.getElementById("collection-status");
const collectionSubmitBtn = document.getElementById("collection-submit-btn");
const collectionsListEl = document.getElementById("collections-list");

let allCollections = [];
let allGames = [];

// Wraps fetch() for /api/admin/* calls: redirects to the login page if the
// session has expired or was never established, instead of failing silently.
async function af(url, opts) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = "login";
    throw new Error("unauthenticated");
  }
  return res;
}

document.getElementById("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.href = "login";
});

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ---- Games ----

async function loadGames() {
  const res = await af("/api/admin/games");
  if (!res.ok) return;
  allGames = await res.json();
  renderGames();
}

function renderGames() {
  tableBody.innerHTML = "";
  for (const game of allGames) {
    const row = document.createElement("tr");

    const coverCell = document.createElement("td");
    coverCell.appendChild(buildCoverUploader(game));

    const titleCell = document.createElement("td");
    titleCell.appendChild(buildInfoEditor(game));

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
    deleteBtn.innerHTML = iconSvg("trash") + " " + t("remove_btn");
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
  input.title = t("change_cover_title");

  input.addEventListener("change", async () => {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append("cover", input.files[0]);

    const res = await af(`/api/admin/games/${encodeURIComponent(game.slug)}/cover`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      loadGames();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ? tError(data.error) : t("error_uploading_cover"));
    }
  });

  wrap.append(thumb, input);
  return wrap;
}

function buildInfoEditor(game) {
  const wrap = document.createElement("div");
  wrap.className = "info-editor";

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "title-input";
  titleInput.value = game.title;

  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.className = "description-input";
  descInput.placeholder = t("description_placeholder");
  descInput.value = game.description || "";

  async function save(body, revert) {
    const res = await af(`/api/admin/games/${encodeURIComponent(game.slug)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const updated = await res.json();
      Object.assign(game, updated);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ? tError(data.error) : t("error_saving_game_info"));
      revert();
    }
  }

  titleInput.addEventListener("change", () => {
    const value = titleInput.value.trim();
    if (!value) {
      titleInput.value = game.title;
      return;
    }
    save({ title: value }, () => (titleInput.value = game.title));
  });

  descInput.addEventListener("change", () => {
    save({ description: descInput.value }, () => (descInput.value = game.description || ""));
  });

  wrap.append(titleInput, descInput);
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

    const res = await af(`/api/admin/games/${encodeURIComponent(game.slug)}/tags`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });

    if (res.ok) {
      const updated = await res.json();
      input.value = (updated.tags || []).join(", ");
    } else {
      alert(t("error_saving_tags"));
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
    hint.textContent = t("create_collection_hint");
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
      ? t("remove_from_collection_title", { name: collection.name })
      : t("add_to_collection_title", { name: collection.name });

    chip.addEventListener("click", async () => {
      const method = inCollection ? "DELETE" : "POST";
      const url = inCollection
        ? `/api/admin/collections/${encodeURIComponent(collection.slug)}/games/${encodeURIComponent(game.slug)}`
        : `/api/admin/collections/${encodeURIComponent(collection.slug)}/games`;

      const res = await af(url, {
        method,
        headers: inCollection ? undefined : { "Content-Type": "application/json" },
        body: inCollection ? undefined : JSON.stringify({ gameSlug: game.slug }),
      });

      if (res.ok) {
        await loadCollections();
        loadGames();
      } else {
        alert(t("error_updating_collection"));
      }
    });

    wrap.appendChild(chip);
  }

  return wrap;
}

async function deleteGame(slug, title) {
  if (!confirm(t("confirm_remove_game", { title }))) return;

  const res = await af(`/api/admin/games/${encodeURIComponent(slug)}`, { method: "DELETE" });
  if (res.ok) {
    loadGames();
  } else {
    alert(t("error_removing_game"));
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "upload-status";

  const formData = new FormData(form);

  submitBtn.disabled = true;
  submitBtn.textContent = t("sending");

  try {
    const res = await af("/api/admin/games", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      statusEl.textContent = data.error ? tError(data.error) : t("error_submitting_game");
      statusEl.classList.add("error");
    } else {
      statusEl.textContent = t("game_added_success", { title: data.title });
      statusEl.classList.add("success");
      form.reset();
      loadGames();
    }
  } catch (err) {
    statusEl.textContent = t("network_error_submitting_game");
    statusEl.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = iconSvg("save") + " " + t("submit_game");
  }
});

// ---- Collections ----

async function loadCollections() {
  const res = await af("/api/admin/collections");
  if (!res.ok) return;
  allCollections = await res.json();
  renderCollectionsList();
}

function renderCollectionsList() {
  collectionsListEl.innerHTML = "";

  if (allCollections.length === 0) {
    const li = document.createElement("li");
    li.className = "collection-hint";
    li.textContent = t("no_collections_yet");
    collectionsListEl.appendChild(li);
    return;
  }

  for (const collection of allCollections) {
    const li = document.createElement("li");
    li.className = "collection-item";

    li.appendChild(buildCollectionCoverUploader(collection));

    const info = document.createElement("span");
    info.textContent = `${collection.name} (${tCount("games_count", collection.games.length)})`;

    const editBtn = document.createElement("button");
    editBtn.innerHTML = iconSvg("pencil") + " " + t("edit_btn");
    editBtn.className = "collection-edit-btn";
    editBtn.addEventListener("click", () => editCollection(collection));

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = iconSvg("trash") + " " + t("delete_btn");
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
  input.title = t("change_collection_cover_title");

  input.addEventListener("change", async () => {
    if (!input.files[0]) return;
    const formData = new FormData();
    formData.append("cover", input.files[0]);

    const res = await af(`/api/admin/collections/${encodeURIComponent(collection.slug)}/cover`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      loadCollections();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error ? tError(data.error) : t("error_uploading_cover"));
    }
  });

  wrap.append(thumb, input);
  return wrap;
}

async function editCollection(collection) {
  const newName = prompt(t("prompt_collection_name"), collection.name);
  if (newName === null) return;
  const newDescription = prompt(t("prompt_collection_description"), collection.description || "");
  if (newDescription === null) return;

  const res = await af(`/api/admin/collections/${encodeURIComponent(collection.slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: newName, description: newDescription }),
  });

  if (res.ok) {
    loadCollections();
  } else {
    alert(t("error_editing_collection"));
  }
}

async function deleteCollection(collection) {
  if (!confirm(t("confirm_delete_collection", { name: collection.name }))) return;

  const res = await af(`/api/admin/collections/${encodeURIComponent(collection.slug)}`, {
    method: "DELETE",
  });

  if (res.ok) {
    await loadCollections();
    loadGames();
  } else {
    alert(t("error_deleting_collection"));
  }
}

collectionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  collectionStatusEl.textContent = "";
  collectionStatusEl.className = "upload-status";

  const formData = new FormData(collectionForm);
  collectionSubmitBtn.disabled = true;

  try {
    const res = await af("/api/admin/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description"),
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      collectionStatusEl.textContent = data.error ? tError(data.error) : t("error_creating_collection");
      collectionStatusEl.classList.add("error");
    } else {
      collectionStatusEl.textContent = t("collection_created", { name: data.name });
      collectionStatusEl.classList.add("success");
      collectionForm.reset();
      await loadCollections();
      loadGames();
    }
  } catch (err) {
    collectionStatusEl.textContent = t("network_error_creating_collection");
    collectionStatusEl.classList.add("error");
  } finally {
    collectionSubmitBtn.disabled = false;
  }
});

function updateStaticText() {
  document.getElementById("back-link").innerHTML = iconSvg("arrow-left") + " " + t("nav_all_games");
  submitBtn.innerHTML = iconSvg("save") + " " + t("submit_game");
  collectionSubmitBtn.innerHTML = iconSvg("plus") + " " + t("submit_collection");
}

initThemeToggle(document.getElementById("theme-select"));
initLangToggle(document.getElementById("lang-select"));
updateStaticText();

function onLanguageChange() {
  updateStaticText();
  renderGames();
  renderCollectionsList();
}

async function init() {
  await loadCollections();
  loadGames();
}

init();
