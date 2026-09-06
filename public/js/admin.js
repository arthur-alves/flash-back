const form = document.getElementById("upload-form");
const statusEl = document.getElementById("upload-status");
const submitBtn = document.getElementById("submit-btn");
const gamesListEl = document.getElementById("games-list");
const gamesEmptyEl = document.getElementById("games-empty");

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
  gamesListEl.innerHTML = "";
  gamesEmptyEl.classList.toggle("hidden", allGames.length > 0);

  for (const game of allGames) {
    const card = document.createElement("div");
    card.className = "game-row";

    card.appendChild(buildCoverUploader(game));

    const main = document.createElement("div");
    main.className = "game-row-main";
    main.appendChild(buildInfoEditor(game));

    const meta = document.createElement("div");
    meta.className = "game-row-meta";
    meta.textContent = `${game.file} · ${formatSize(game.sizeBytes || 0)}`;
    main.appendChild(meta);

    main.appendChild(buildTagsEditor(game));
    main.appendChild(buildCollectionChips(game));
    card.appendChild(main);

    const deleteBtn = document.createElement("button");
    deleteBtn.innerHTML = iconSvg("trash") + " " + t("remove_btn");
    deleteBtn.className = "delete-btn game-row-delete";
    deleteBtn.addEventListener("click", () => deleteGame(game.slug, game.title));
    card.appendChild(deleteBtn);

    gamesListEl.appendChild(card);
  }
}

// Shared by game and collection cover uploaders: a thumbnail (image or a
// color+initial placeholder) with a hidden file input on top, plus a
// hover-revealed camera icon so it's obvious the thumbnail is clickable —
// without it, it just looks like a plain, inert swatch of color.
function buildCoverUploaderBase({ imageUrl, alt, initial, title }) {
  const wrap = document.createElement("div");
  wrap.className = "cover-uploader";

  const thumb = document.createElement(imageUrl ? "img" : "div");
  thumb.className = "cover-thumb";
  if (imageUrl) {
    thumb.src = imageUrl;
    thumb.alt = alt;
  } else {
    thumb.textContent = initial;
  }

  const hint = document.createElement("div");
  hint.className = "cover-uploader-hint";
  hint.innerHTML = iconSvg("camera");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".jpg,.jpeg,.png,.webp";
  input.className = "cover-input";
  input.title = title;

  wrap.append(thumb, hint, input);
  return { wrap, input };
}

function buildCoverUploader(game) {
  const { wrap, input } = buildCoverUploaderBase({
    imageUrl: game.cover ? `covers/${game.slug}.${game.cover}?t=${Date.now()}` : null,
    alt: game.title,
    initial: game.title.slice(0, 1).toUpperCase(),
    title: t("change_cover_title"),
  });

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
  const { wrap, input } = buildCoverUploaderBase({
    imageUrl: collection.cover ? `covers/collections/${collection.slug}.${collection.cover}?t=${Date.now()}` : null,
    alt: collection.name,
    initial: collection.name.slice(0, 1).toUpperCase(),
    title: t("change_collection_cover_title"),
  });

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
  flashpointSearchBtn.innerHTML = iconSvg("search") + " " + t("flashpoint_search_btn");
}

// ---- Import from Flashpoint Archive ----

const flashpointForm = document.getElementById("flashpoint-search-form");
const flashpointQueryInput = document.getElementById("flashpoint-query");
const flashpointSearchBtn = document.getElementById("flashpoint-search-btn");
const flashpointStatusEl = document.getElementById("flashpoint-status");
const flashpointResultsEl = document.getElementById("flashpoint-results");

function renderFlashpointResults(results) {
  flashpointResultsEl.innerHTML = "";
  for (const result of results) {
    const li = document.createElement("li");
    li.className = "flashpoint-result";

    const img = document.createElement("img");
    img.src = result.logo;
    img.alt = result.title;
    img.loading = "lazy";
    img.onerror = () => (img.style.visibility = "hidden");

    const title = document.createElement("span");
    title.className = "flashpoint-result-title";
    title.textContent = result.title;
    if (result.type) {
      const typeTag = document.createElement("span");
      typeTag.className = "flashpoint-result-type";
      typeTag.textContent = result.type;
      title.appendChild(typeTag);
    }

    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.innerHTML = iconSvg("plus") + " " + t("flashpoint_import_btn");
    importBtn.addEventListener("click", () => importFromFlashpoint(result.id, importBtn));

    li.append(img, title, importBtn);
    flashpointResultsEl.appendChild(li);
  }
}

flashpointForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = flashpointQueryInput.value.trim();
  if (!query) return;

  flashpointStatusEl.textContent = "";
  flashpointStatusEl.className = "upload-status";
  flashpointResultsEl.innerHTML = "";
  flashpointSearchBtn.disabled = true;

  try {
    const res = await af(`/api/admin/flashpoint/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!res.ok) {
      flashpointStatusEl.textContent = data.error ? tError(data.error) : t("error_searching_flashpoint");
      flashpointStatusEl.classList.add("error");
    } else if (data.length === 0) {
      flashpointStatusEl.textContent = t("flashpoint_no_results");
    } else {
      renderFlashpointResults(data);
    }
  } catch (err) {
    flashpointStatusEl.textContent = t("network_error_searching_flashpoint");
    flashpointStatusEl.classList.add("error");
  } finally {
    flashpointSearchBtn.disabled = false;
  }
});

async function importFromFlashpoint(id, button) {
  button.disabled = true;
  button.innerHTML = iconSvg("save") + " " + t("flashpoint_importing");

  try {
    const res = await af("/api/admin/flashpoint/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();

    if (res.ok) {
      button.innerHTML = iconSvg("save") + " " + t("flashpoint_imported");
      loadGames();
    } else {
      button.disabled = false;
      button.innerHTML = iconSvg("plus") + " " + t("flashpoint_import_btn");
      alert(data.error ? tError(data.error) : t("error_importing_flashpoint"));
    }
  } catch (err) {
    button.disabled = false;
    button.innerHTML = iconSvg("plus") + " " + t("flashpoint_import_btn");
    alert(t("network_error_importing_flashpoint"));
  }
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
