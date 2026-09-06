// Household profile picker (no password) — lets game saves follow a
// person across every device on the network instead of being stuck in one
// browser's localStorage. The chosen profile id is remembered locally per
// browser (like the theme/language choice), while the profile list itself
// lives on the server.
const PROFILE_STORAGE_KEY = "flashback:profile";

function getActiveProfileId() {
  return localStorage.getItem(PROFILE_STORAGE_KEY) || "";
}

function setActiveProfileId(id) {
  if (id) localStorage.setItem(PROFILE_STORAGE_KEY, id);
  else localStorage.removeItem(PROFILE_STORAGE_KEY);
}

async function initProfileToggle(selectEl) {
  if (!selectEl) return;

  async function populate() {
    let list = [];
    try {
      const res = await fetch("/api/profiles");
      if (res.ok) list = await res.json();
    } catch (err) {
      // Offline or server hiccup — leave the select as-is.
      return;
    }

    selectEl.innerHTML = "";
    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = t("profile_none");
    selectEl.appendChild(noneOption);

    for (const profile of list) {
      const option = document.createElement("option");
      option.value = profile.id;
      option.textContent = profile.name;
      selectEl.appendChild(option);
    }

    const addOption = document.createElement("option");
    addOption.value = "__new__";
    addOption.textContent = t("profile_new");
    selectEl.appendChild(addOption);

    const active = getActiveProfileId();
    selectEl.value = list.some((p) => p.id === active) ? active : "";
  }

  await populate();

  selectEl.addEventListener("change", async () => {
    if (selectEl.value === "__new__") {
      const name = prompt(t("prompt_profile_name"));
      selectEl.value = getActiveProfileId();
      if (!name || !name.trim()) return;

      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        alert(t("error_creating_profile"));
        return;
      }
      const profile = await res.json();
      await populate();
      selectEl.value = profile.id;
      setActiveProfileId(profile.id);
      window.dispatchEvent(new CustomEvent("flashback:profile-changed"));
      return;
    }

    setActiveProfileId(selectEl.value);
    window.dispatchEvent(new CustomEvent("flashback:profile-changed"));
  });
}
