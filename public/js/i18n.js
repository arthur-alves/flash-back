// Translation dictionaries + a tiny i18n runtime. Default language is
// English; see LANGUAGES.md for how to add another one. No async loading,
// no build step — this is just a plain JS object, same pattern as
// themes-registry.js.
const LANGUAGES = [
  { id: "en", name: "English" },
  { id: "pt", name: "Português" },
];

const DEFAULT_LANG = "en";
const LANG_STORAGE_KEY = "flashback:lang";

const TRANSLATIONS = {
  en: {
    tag_all: "All",
    nav_all_games: "All games",
    nav_collections: "Collections",
    search_placeholder: "Search game...",
    view_grid: "Grid",
    view_list: "List",
    admin_link: "Administration",
    logout: "Log out",
    loading: "Loading...",

    empty_games: "No games found.",
    empty_collections: "No collections created yet.",
    empty_collection_games: "No games in this collection yet.",

    footer_credits_html:
      'Collection maintained by the community for historical preservation purposes. All game rights belong to their original creators. Games sourced from ' +
      '<a href="https://github.com/AmmarSAA/flash-games-directory" target="_blank" rel="noopener">AmmarSAA/flash-games-directory</a>. ' +
      'Emulated via <a href="https://ruffle.rs" target="_blank" rel="noopener">Ruffle</a>.',

    collection_not_specified: "Collection not specified",
    collection_not_found: "Collection not found",
    game_not_specified: "Game not specified",
    game_not_found: "Game not found",

    crt_effect_title: "CRT effect",
    crt_button: "CRT",
    fullscreen_title: "Fullscreen",
    capture_cover_title: "Capture a screenshot from the game as its cover",
    capture_cover_button: "Capture cover",
    capturing_cover: "Capturing...",
    cover_captured_success: "Cover captured!",
    error_capturing_cover: "Error capturing cover.",
    canvas_not_ready: "Game hasn't rendered anything yet — wait a moment and try again.",
    fullscreen_button: "Fullscreen",
    exit_fullscreen_button: "Exit fullscreen",

    games_count_one: "{n} game",
    games_count_other: "{n} games",

    // Admin
    admin_title: "Administration",
    add_game_heading: "Add new game",
    label_swf_file: ".swf file",
    label_title: "Title",
    label_description_optional: "Description (optional)",
    label_cover_optional: "Cover (optional — JPG, PNG or WebP)",
    label_tags_optional: "Tags (optional, comma-separated)",
    tags_input_placeholder: "action, platformer, classic",
    submit_game: "Submit game",
    sending: "Sending...",
    game_added_success: '"{title}" added successfully!',
    error_submitting_game: "Error submitting the game.",
    network_error_submitting_game: "Network error submitting the game.",

    collections_heading: "Collections",
    label_name: "Name",
    submit_collection: "Create collection",
    collection_created: 'Collection "{name}" created!',
    error_creating_collection: "Error creating collection.",
    network_error_creating_collection: "Network error creating the collection.",
    create_collection_hint: "Create a collection above",
    no_collections_yet: "No collections created yet.",

    registered_games_heading: "Registered games",
    th_cover: "Cover",
    th_title: "Title",
    th_file: "File",
    th_size: "Size",
    th_tags: "Tags",
    th_collections: "Collections",

    remove_btn: "Remove",
    edit_btn: "Edit",
    delete_btn: "Delete",
    change_cover_title: "Change cover",
    change_collection_cover_title: "Change collection cover",

    confirm_remove_game: 'Remove "{title}" from the library? The file will be deleted from the server.',
    confirm_delete_collection: 'Delete the collection "{name}"? Its games won\'t be deleted.',
    prompt_collection_name: "Collection name:",
    prompt_collection_description: "Description:",
    remove_from_collection_title: 'Remove from "{name}"',
    add_to_collection_title: 'Add to "{name}"',

    error_uploading_cover: "Error uploading cover.",
    error_saving_tags: "Error saving tags.",
    error_updating_collection: "Error updating collection.",
    error_removing_game: "Error removing the game.",
    error_editing_collection: "Error editing collection.",
    error_deleting_collection: "Error deleting collection.",

    // Auth
    setup_title: "Initial setup",
    setup_hint:
      "First time using this server. Create the admin username and password — you'll use this to access the panel and manage games.",
    label_username: "Username",
    label_password_min: "Password (minimum 8 characters)",
    label_password: "Password",
    label_password_confirm: "Confirm password",
    create_account: "Create account",
    creating: "Creating...",
    login_title: "Log in",
    login_button: "Log in",
    passwords_dont_match: "Passwords don't match.",
    error_creating_account: "Error creating account.",
    network_error_creating_account: "Network error creating account.",
    error_logging_in: "Error logging in.",
    network_error_logging_in: "Network error logging in.",

    // Server error codes, translated client-side
    err_no_file: "No file uploaded.",
    err_title_required: "Title is required.",
    err_invalid_swf: "Invalid file: content doesn't match a .swf file (FWS/CWS/ZWS signature not found).",
    err_invalid_cover: "Invalid cover: please upload a real JPG, PNG or WebP image.",
    err_no_image: "No image uploaded.",
    err_game_not_found: "Game not found.",
    err_collection_not_found: "Collection not found.",
    err_collection_name_required: "Collection name is required.",
    err_already_configured: "An account is already configured.",
    err_username_too_short: "Username must be at least 3 characters.",
    err_password_too_short: "Password must be at least 8 characters.",
    err_invalid_credentials: "Incorrect username or password.",
    err_not_configured: "No account configured yet.",
  },

  pt: {
    tag_all: "Todos",
    nav_all_games: "Todos os jogos",
    nav_collections: "Coleções",
    search_placeholder: "Buscar jogo...",
    view_grid: "Grade",
    view_list: "Lista",
    admin_link: "Administração",
    logout: "Sair",
    loading: "Carregando...",

    empty_games: "Nenhum jogo encontrado.",
    empty_collections: "Nenhuma coleção criada ainda.",
    empty_collection_games: "Nenhum jogo nesta coleção ainda.",

    footer_credits_html:
      'Coleção mantida pela comunidade a título de preservação histórica. Todos os direitos dos jogos pertencem aos seus respectivos criadores. Jogos obtidos de ' +
      '<a href="https://github.com/AmmarSAA/flash-games-directory" target="_blank" rel="noopener">AmmarSAA/flash-games-directory</a>. ' +
      'Emulado via <a href="https://ruffle.rs" target="_blank" rel="noopener">Ruffle</a>.',

    collection_not_specified: "Coleção não especificada",
    collection_not_found: "Coleção não encontrada",
    game_not_specified: "Jogo não especificado",
    game_not_found: "Jogo não encontrado",

    crt_effect_title: "Efeito CRT",
    crt_button: "CRT",
    fullscreen_title: "Tela cheia",
    capture_cover_title: "Capturar uma imagem do jogo como capa",
    capture_cover_button: "Capturar capa",
    capturing_cover: "Capturando...",
    cover_captured_success: "Capa capturada!",
    error_capturing_cover: "Erro ao capturar a capa.",
    canvas_not_ready: "O jogo ainda não renderizou nada — espere um instante e tente de novo.",
    fullscreen_button: "Tela cheia",
    exit_fullscreen_button: "Sair da tela cheia",

    games_count_one: "{n} jogo",
    games_count_other: "{n} jogos",

    // Admin
    admin_title: "Administração",
    add_game_heading: "Adicionar novo jogo",
    label_swf_file: "Arquivo .swf",
    label_title: "Título",
    label_description_optional: "Descrição (opcional)",
    label_cover_optional: "Capa (opcional — JPG, PNG ou WebP)",
    label_tags_optional: "Tags (opcional, separadas por vírgula)",
    tags_input_placeholder: "ação, plataforma, clássico",
    submit_game: "Enviar jogo",
    sending: "Enviando...",
    game_added_success: '"{title}" adicionado com sucesso!',
    error_submitting_game: "Erro ao enviar o jogo.",
    network_error_submitting_game: "Erro de rede ao enviar o jogo.",

    collections_heading: "Coleções",
    label_name: "Nome",
    submit_collection: "Criar coleção",
    collection_created: 'Coleção "{name}" criada!',
    error_creating_collection: "Erro ao criar coleção.",
    network_error_creating_collection: "Erro de rede ao criar coleção.",
    create_collection_hint: "Crie uma coleção acima",
    no_collections_yet: "Nenhuma coleção criada ainda.",

    registered_games_heading: "Jogos cadastrados",
    th_cover: "Capa",
    th_title: "Título",
    th_file: "Arquivo",
    th_size: "Tamanho",
    th_tags: "Tags",
    th_collections: "Coleções",

    remove_btn: "Remover",
    edit_btn: "Editar",
    delete_btn: "Excluir",
    change_cover_title: "Trocar capa",
    change_collection_cover_title: "Trocar capa da coleção",

    confirm_remove_game: 'Remover "{title}" da biblioteca? O arquivo será apagado do servidor.',
    confirm_delete_collection: 'Excluir a coleção "{name}"? Os jogos não serão apagados.',
    prompt_collection_name: "Nome da coleção:",
    prompt_collection_description: "Descrição:",
    remove_from_collection_title: 'Remover de "{name}"',
    add_to_collection_title: 'Adicionar a "{name}"',

    error_uploading_cover: "Erro ao enviar a capa.",
    error_saving_tags: "Erro ao salvar tags.",
    error_updating_collection: "Erro ao atualizar coleção.",
    error_removing_game: "Erro ao remover o jogo.",
    error_editing_collection: "Erro ao editar coleção.",
    error_deleting_collection: "Erro ao excluir coleção.",

    // Auth
    setup_title: "Configuração inicial",
    setup_hint:
      "Primeira vez usando este servidor. Crie o usuário e a senha do administrador — você vai usar isso pra acessar o painel e gerenciar os jogos.",
    label_username: "Usuário",
    label_password_min: "Senha (mínimo 8 caracteres)",
    label_password: "Senha",
    label_password_confirm: "Confirmar senha",
    create_account: "Criar conta",
    creating: "Criando...",
    login_title: "Entrar",
    login_button: "Entrar",
    passwords_dont_match: "As senhas não conferem.",
    error_creating_account: "Erro ao criar conta.",
    network_error_creating_account: "Erro de rede ao criar conta.",
    error_logging_in: "Erro ao entrar.",
    network_error_logging_in: "Erro de rede ao entrar.",

    // Server error codes, translated client-side
    err_no_file: "Nenhum arquivo enviado.",
    err_title_required: "Título é obrigatório.",
    err_invalid_swf: "Arquivo inválido: o conteúdo não corresponde a um arquivo .swf (assinatura FWS/CWS/ZWS não encontrada).",
    err_invalid_cover: "Capa inválida: envie uma imagem JPG, PNG ou WebP de verdade.",
    err_no_image: "Nenhuma imagem enviada.",
    err_game_not_found: "Jogo não encontrado.",
    err_collection_not_found: "Coleção não encontrada.",
    err_collection_name_required: "Nome da coleção é obrigatório.",
    err_already_configured: "Já existe uma conta configurada.",
    err_username_too_short: "Usuário deve ter pelo menos 3 caracteres.",
    err_password_too_short: "Senha deve ter pelo menos 8 caracteres.",
    err_invalid_credentials: "Usuário ou senha incorretos.",
    err_not_configured: "Nenhuma conta configurada ainda.",
  },
};

function currentLang() {
  return localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG;
}

// t("key", { name: "Foo" }) -> looks up TRANSLATIONS[lang].key, replacing
// {name} placeholders. Falls back to the English string, then to the key
// itself, so a missing translation never renders as "undefined".
function t(key, vars) {
  const lang = currentLang();
  let str = (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS[DEFAULT_LANG][key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return str;
}

// Pluralization helper for the "N game(s)" pattern.
function tCount(baseKey, n) {
  return t(n === 1 ? `${baseKey}_one` : `${baseKey}_other`, { n });
}

// Translates a server error code (e.g. {"error": "title_required"}) into
// the current language, falling back to the raw string if it's not one of
// our known codes (e.g. a multer error message, which is already in English).
function tError(code) {
  const key = `err_${code}`;
  const lang = currentLang();
  if ((TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) || TRANSLATIONS[DEFAULT_LANG][key]) {
    return t(key);
  }
  return code;
}

// Applies translations to every element with data-i18n / data-i18n-html /
// data-i18n-placeholder / data-i18n-title in the current document.
function applyI18n() {
  document.documentElement.lang = currentLang();

  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-html]")) {
    el.innerHTML = t(el.dataset.i18nHtml);
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of document.querySelectorAll("[data-i18n-title]")) {
    el.title = t(el.dataset.i18nTitle);
  }
}

function initLangToggle(selectEl) {
  selectEl.innerHTML = "";
  for (const lang of LANGUAGES) {
    const option = document.createElement("option");
    option.value = lang.id;
    option.textContent = lang.name;
    selectEl.appendChild(option);
  }

  selectEl.value = currentLang();

  selectEl.addEventListener("change", () => {
    localStorage.setItem(LANG_STORAGE_KEY, selectEl.value);
    applyI18n();
    if (typeof onLanguageChange === "function") onLanguageChange();
  });

  applyI18n();
}
