(function () {
  "use strict";

  var THEME_KEY = "news_juris_theme_v1";
  var FONT_KEY = "news_juris_font_scale_v1";
  var MARGIN_KEY = "news_juris_margin_v1";
  var HIGHLIGHT_COLOR_KEY = "news_juris_highlight_color_v1";
  var HIGHLIGHTS_KEY = "news_juris_highlights_v1";
  var READ_KEY = "news_juris_read_v1";
  var READ_META_KEY = "news_juris_read_meta_v1";
  var READ_FILTER_KEY = "news_juris_read_filter_v1";
  var SYNC_CODE_KEY = "news_juris_sync_code_v1";
  var INSTALL_DISMISSED_KEY = "news_juris_install_dismissed_v1";
  var SYNC_BASE_URL = "https://lucky-cloud-0449stj-proxy.carlosalmeida-enc.workers.dev";
  var THEMES = ["canon", "nord"];
  var HIGHLIGHT_DEFAULT = "gold";
  var HIGHLIGHT_COLORS = ["gold", "blue", "green", "pink"];
  var READ_FILTERS = ["read", "unread", "all"];
  var FONT_MIN = 0.8;
  var FONT_MAX = 1.6;
  var FONT_STEP = 0.1;
  var MARGIN_MIN = 12;
  var MARGIN_MAX = 120;
  var monthIdsByKey = Object.create(null);
  var syncInFlight = false;
  var syncAgain = false;
  var syncTimer = null;
  var highlightListenersBound = false;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    applyTheme(readTheme());
    applyFontScale(readNumber(FONT_KEY, 1, FONT_MIN, FONT_MAX));
    applyMargin(readNumber(MARGIN_KEY, 32, MARGIN_MIN, MARGIN_MAX));
    bindThemeControls();
    bindFontControls();
    bindMarginControl();
    bindHighlightControls();
    bindHistoryBack();
    registerServiceWorker();
    bindInstallPrompt();
    bindReadControls();
    bindReadFilterControls();
    bindReadRefreshHooks();
    bindSyncControls();
    loadMonthSummaries();
    initHighlights();
    bindTimer();
  }

  function getAppBaseUrl() {
    var script = document.currentScript || document.querySelector('script[src$="assets/app.js"]');
    try {
      return new URL("../", script && script.src ? script.src : window.location.href);
    } catch (_error) {
      return new URL("./", window.location.href);
    }
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    var swUrl = new URL("sw.js", getAppBaseUrl());
    window.addEventListener("load", function () {
      navigator.serviceWorker.register(swUrl).catch(function () {});
    });
  }

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  }

  function isIosLike() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || "") ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
  }

  function wasInstallDismissed() {
    try {
      return localStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
    } catch (_error) {
      return false;
    }
  }

  function dismissInstallPrompt() {
    try {
      localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    } catch (_error) {}
    var prompt = document.querySelector("[data-install-prompt]");
    if (prompt) prompt.hidden = true;
  }

  function showInstallPrompt(mode, deferredPrompt) {
    if (isStandalone() || wasInstallDismissed()) return;
    var prompt = document.querySelector("[data-install-prompt]");
    var action = document.querySelector("[data-install-action]");
    var message = document.querySelector("[data-install-message]");
    if (!prompt || !action || !message) return;

    if (mode === "ios") {
      message.textContent = "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.";
      action.textContent = "Entendi";
      action.onclick = dismissInstallPrompt;
    } else {
      message.textContent = "Adicione o app à tela inicial para abrir direto pelo ícone.";
      action.textContent = "Instalar";
      action.onclick = function () {
        if (!deferredPrompt) {
          prompt.hidden = true;
          return;
        }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          prompt.hidden = true;
        });
      };
    }

    prompt.hidden = false;
  }

  function bindInstallPrompt() {
    var dismiss = document.querySelector("[data-install-dismiss]");
    if (dismiss) dismiss.addEventListener("click", dismissInstallPrompt);
    if (isStandalone() || wasInstallDismissed()) return;

    var deferredPrompt = null;
    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showInstallPrompt("native", deferredPrompt);
    });
    window.addEventListener("appinstalled", dismissInstallPrompt);

    if (isIosLike()) {
      window.setTimeout(function () {
        showInstallPrompt("ios", null);
      }, 900);
    }
  }

  function readTheme() {
    try {
      var stored = localStorage.getItem(THEME_KEY);
      return THEMES.indexOf(stored) >= 0 ? stored : "canon";
    } catch (_error) {
      return "canon";
    }
  }

  function applyTheme(theme) {
    var value = THEMES.indexOf(theme) >= 0 ? theme : "canon";
    document.documentElement.setAttribute("data-theme", value);
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch (_error) {}
    document.querySelectorAll("[data-theme-value]").forEach(function (btn) {
      var active = btn.dataset.themeValue === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function bindThemeControls() {
    document.querySelectorAll("[data-theme-value]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyTheme(btn.dataset.themeValue);
      });
    });
  }

  function readNumber(key, fallback, min, max) {
    try {
      var value = Number.parseFloat(localStorage.getItem(key));
      return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function saveNumber(key, value) {
    try {
      localStorage.setItem(key, String(value));
    } catch (_error) {}
  }

  function applyFontScale(value) {
    var next = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX, value)) * 10) / 10;
    document.documentElement.style.setProperty("--reader-font-scale", String(next));
    saveNumber(FONT_KEY, next);
  }

  function bindFontControls() {
    document.querySelectorAll("[data-font-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var current = readNumber(FONT_KEY, 1, FONT_MIN, FONT_MAX);
        var delta = btn.dataset.fontAction === "up" ? FONT_STEP : -FONT_STEP;
        applyFontScale(current + delta);
      });
    });
  }

  function applyMargin(value) {
    var next = Math.round(Math.max(MARGIN_MIN, Math.min(MARGIN_MAX, value)));
    document.documentElement.style.setProperty("--reader-side-margin", next + "px");
    saveNumber(MARGIN_KEY, next);
    var range = document.querySelector("[data-margin-range]");
    if (range) range.value = String(next);
  }

  function bindMarginControl() {
    var range = document.querySelector("[data-margin-range]");
    if (!range) return;
    range.addEventListener("input", function () {
      applyMargin(Number.parseInt(range.value, 10));
    });
  }

  function normalizeHighlightColor(value) {
    var color = String(value || "").trim().toLowerCase();
    return HIGHLIGHT_COLORS.indexOf(color) >= 0 ? color : HIGHLIGHT_DEFAULT;
  }

  function readHighlightColor() {
    try {
      return normalizeHighlightColor(localStorage.getItem(HIGHLIGHT_COLOR_KEY));
    } catch (_error) {
      return HIGHLIGHT_DEFAULT;
    }
  }

  function applyHighlightColor(color) {
    var value = normalizeHighlightColor(color);
    try {
      localStorage.setItem(HIGHLIGHT_COLOR_KEY, value);
    } catch (_error) {}
    document.querySelectorAll("[data-highlight-color]").forEach(function (btn) {
      var active = normalizeHighlightColor(btn.dataset.highlightColor) === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    return value;
  }

  function bindHighlightControls() {
    applyHighlightColor(readHighlightColor());
    document.querySelectorAll("[data-highlight-color]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyHighlightColor(btn.dataset.highlightColor);
      });
    });
    var clearBtn = document.querySelector("[data-highlight-clear]");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        clearHighlights();
      });
    }
  }

  function bindHistoryBack() {
    document.querySelectorAll("[data-history-back]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        window.location.href = "../index.html";
      });
    });
  }

  function readJsonObject(key) {
    try {
      var parsed = JSON.parse(localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function readLegacyReadStore() {
    return readJsonObject(READ_KEY);
  }

  function normalizeReadMeta(value) {
    var source = value && typeof value === "object" ? value : {};
    var items = source.items && typeof source.items === "object" ? source.items : {};
    var normalized = { items: {}, updatedAt: Math.max(0, Number(source.updatedAt) || 0) };
    Object.keys(items).forEach(function (id) {
      var entry = items[id];
      if (!entry || typeof entry !== "object") return;
      var key = String(id || "").trim();
      if (!key) return;
      var updatedAt = Math.max(1, Number(entry.updatedAt) || 1);
      normalized.items[key] = { read: entry.read !== false, updatedAt: updatedAt };
      if (updatedAt > normalized.updatedAt) normalized.updatedAt = updatedAt;
    });
    return normalized;
  }

  function readReadMeta() {
    var meta = normalizeReadMeta(readJsonObject(READ_META_KEY));
    var changed = false;
    var legacy = readLegacyReadStore();
    Object.keys(legacy).forEach(function (id) {
      var key = String(id || "").trim();
      if (!key || !legacy[id] || meta.items[key]) return;
      meta.items[key] = { read: true, updatedAt: 1 };
      meta.updatedAt = Math.max(meta.updatedAt, 1);
      changed = true;
    });
    if (changed) writeReadMeta(meta);
    return meta;
  }

  function metaToReadStore(meta) {
    var normalized = normalizeReadMeta(meta);
    var store = {};
    Object.keys(normalized.items).forEach(function (id) {
      if (normalized.items[id].read !== false) store[id] = true;
    });
    return store;
  }

  function writeReadMeta(meta) {
    var normalized = normalizeReadMeta(meta);
    try {
      localStorage.setItem(READ_META_KEY, JSON.stringify(normalized));
      localStorage.setItem(READ_KEY, JSON.stringify(metaToReadStore(normalized)));
    } catch (_error) {}
  }

  function readReadStore() {
    return metaToReadStore(readReadMeta());
  }

  function writeReadStore(store) {
    var now = Date.now();
    var meta = readReadMeta();
    Object.keys(store || {}).forEach(function (id) {
      if (!id) return;
      meta.items[id] = { read: Boolean(store[id]), updatedAt: now };
    });
    meta.updatedAt = now;
    writeReadMeta(meta);
  }

  function isRead(store, id) {
    return Boolean(store[String(id || "")]);
  }

  function setRead(id, value) {
    var key = String(id || "").trim();
    if (!key) return;
    var now = Date.now();
    var meta = readReadMeta();
    meta.items[key] = { read: Boolean(value), updatedAt: now };
    meta.updatedAt = Math.max(meta.updatedAt, now);
    writeReadMeta(meta);
    refreshReadUi();
    scheduleSync(350);
  }

  function bindReadControls() {
    document.querySelectorAll("[data-read-toggle][data-news-id]").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var id = btn.dataset.newsId;
        setRead(id, !isRead(readReadStore(), id));
      });
    });
    refreshReadUi();
  }

  function normalizeReadFilter(value) {
    var filter = String(value || "").trim().toLowerCase();
    return READ_FILTERS.indexOf(filter) >= 0 ? filter : "all";
  }

  function readReadFilter() {
    try {
      return normalizeReadFilter(localStorage.getItem(READ_FILTER_KEY));
    } catch (_error) {
      return "all";
    }
  }

  function writeReadFilter(filter) {
    var value = normalizeReadFilter(filter);
    try {
      localStorage.setItem(READ_FILTER_KEY, value);
    } catch (_error) {}
    applyReadFilter(value, readReadStore());
  }

  function bindReadFilterControls() {
    document.querySelectorAll("[data-read-filter]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        writeReadFilter(btn.dataset.readFilter);
      });
    });
    applyReadFilter(readReadFilter(), readReadStore());
  }

  function refreshReadUi() {
    applyReadState(readReadStore());
  }

  function bindReadRefreshHooks() {
    window.addEventListener("pageshow", function () {
      refreshReadUi();
      scheduleSync(600);
    });
    window.addEventListener("focus", function () {
      refreshReadUi();
      scheduleSync(600);
    });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        refreshReadUi();
        scheduleSync(600);
      }
    });
    window.addEventListener("storage", function (event) {
      if (!event.key || event.key === READ_KEY || event.key === READ_META_KEY || event.key === READ_FILTER_KEY) {
        refreshReadUi();
      }
      if (!event.key || event.key === SYNC_CODE_KEY) {
        updateSyncControls();
        scheduleSync(600);
      }
    });
  }

  function loadMonthSummaries() {
    var url = new URL("dados/month-summaries.json", getAppBaseUrl());
    fetch(url, { credentials: "same-origin" })
      .then(function (response) {
        return response.ok ? response.json() : [];
      })
      .then(function (summaries) {
        if (!Array.isArray(summaries)) return;
        summaries.forEach(function (summary) {
          if (summary && summary.key && Array.isArray(summary.ids)) {
            monthIdsByKey[summary.key] = summary.ids.map(String);
          }
        });
        applyReadState(readReadStore());
      })
      .catch(function () {});
  }

  function applyReadState(store) {
    var readStore = store || readReadStore();
    document.querySelectorAll("[data-news-item][data-news-id]").forEach(function (item) {
      item.classList.toggle("is-read", isRead(readStore, item.dataset.newsId));
    });
    document.querySelectorAll("[data-read-toggle][data-news-id]").forEach(function (btn) {
      var read = isRead(readStore, btn.dataset.newsId);
      btn.classList.toggle("is-read", read);
      btn.setAttribute("aria-pressed", read ? "true" : "false");
      var label = btn.querySelector("[data-read-label]");
      if (label) label.textContent = read ? "Lida" : "Marcar lida";
    });
    applyReadFilter(readReadFilter(), readStore);
    updateMonthCalendar(readStore);
  }

  function applyReadFilter(filter, store) {
    var value = normalizeReadFilter(filter);
    var readStore = store || readReadStore();
    document.querySelectorAll("[data-read-filter]").forEach(function (btn) {
      var active = normalizeReadFilter(btn.dataset.readFilter) === value;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
    document.querySelectorAll("[data-news-item][data-news-id]").forEach(function (item) {
      var read = isRead(readStore, item.dataset.newsId);
      var hidden = value === "read" ? !read : value === "unread" ? read : false;
      item.classList.toggle("is-filter-hidden", hidden);
    });
    document.querySelectorAll(".day-section").forEach(function (section) {
      var items = Array.prototype.slice.call(section.querySelectorAll("[data-news-item]"));
      var empty = items.length > 0 && items.every(function (item) {
        return item.classList.contains("is-filter-hidden");
      });
      section.classList.toggle("is-filter-empty", empty);
    });
  }

  function updateMonthCalendar(store) {
    document.querySelectorAll("[data-month-key][data-month-count]").forEach(function (cell) {
      var ids = monthIdsForCell(cell);
      var total = ids.length || readMonthCount(cell);
      var readCount = ids.filter(function (id) {
        return isRead(store, id);
      }).length;
      var complete = total > 0 && readCount === total;
      cell.classList.toggle("is-complete", complete);
      cell.classList.toggle("is-empty-month", total === 0);
      cell.classList.toggle("has-read-progress", readCount > 0 && !complete);
      cell.setAttribute("aria-label", monthCellLabel(cell, readCount, total, complete));
      var progress = cell.querySelector("[data-month-progress]");
      if (progress) progress.textContent = total > 0 ? readCount + "/" + total : "0";
    });

    document.querySelectorAll("[data-current-month-progress]").forEach(function (summary) {
      var calendar = summary.closest("[data-month-calendar]");
      var currentKey = calendar ? calendar.dataset.currentMonthKey : "";
      var currentCell = currentKey ? findMonthCell(calendar, currentKey) : null;
      if (!currentCell) {
        summary.textContent = "";
        return;
      }
      var currentIds = monthIdsForCell(currentCell);
      var currentTotal = currentIds.length || readMonthCount(currentCell);
      var currentRead = currentIds.filter(function (id) {
        return isRead(store, id);
      }).length;
      summary.textContent = currentTotal === 0
        ? "0 notícias"
        : currentIds.length && currentRead === currentIds.length
        ? "Mês concluído"
        : currentRead + "/" + currentTotal + " lidas";
    });
  }

  function monthIdsForCell(cell) {
    var key = cell ? cell.dataset.monthKey : "";
    if (key && Array.isArray(monthIdsByKey[key])) return monthIdsByKey[key];
    return String(cell && cell.dataset ? cell.dataset.monthIds || "" : "").split(/\s+/).filter(Boolean);
  }

  function readMonthCount(cell) {
    var count = Number.parseInt(cell && cell.dataset ? cell.dataset.monthCount || "0" : "0", 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  function monthCellLabel(cell, readCount, total, complete) {
    var labelEl = cell.querySelector(".month-cell__label");
    var label = labelEl ? labelEl.textContent : cell.dataset.monthKey;
    if (total === 0) return label + ": sem notícias nas categorias configuradas";
    return label + ": " + (complete ? "todas lidas" : readCount + " de " + total + " lidas");
  }

  function findMonthCell(calendar, key) {
    var root = calendar || document;
    var cells = root.querySelectorAll("[data-month-key]");
    for (var index = 0; index < cells.length; index += 1) {
      if (cells[index].dataset.monthKey === key) return cells[index];
    }
    return null;
  }

  function normalizeSyncCode(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 64);
  }

  function readSyncCode() {
    try {
      return normalizeSyncCode(localStorage.getItem(SYNC_CODE_KEY));
    } catch (_error) {
      return "";
    }
  }

  function writeSyncCode(value) {
    var code = normalizeSyncCode(value);
    try {
      if (code) localStorage.setItem(SYNC_CODE_KEY, code);
      else localStorage.removeItem(SYNC_CODE_KEY);
    } catch (_error) {}
    updateSyncControls();
    if (code) syncNow();
  }

  function updateSyncControls() {
    var input = document.querySelector("[data-sync-code]");
    if (input && document.activeElement !== input) input.value = readSyncCode();
    setSyncStatus(readSyncCode() ? "sync" : "local");
  }

  function setSyncStatus(text) {
    var status = document.querySelector("[data-sync-status]");
    if (status) status.textContent = text || "";
  }

  function bindSyncControls() {
    updateSyncControls();
    var input = document.querySelector("[data-sync-code]");
    var save = document.querySelector("[data-sync-save]");
    var now = document.querySelector("[data-sync-now]");
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          writeSyncCode(input.value);
        }
      });
      input.addEventListener("blur", function () {
        if (normalizeSyncCode(input.value) !== readSyncCode()) writeSyncCode(input.value);
      });
    }
    if (save) {
      save.addEventListener("click", function () {
        writeSyncCode(input ? input.value : "");
      });
    }
    if (now) {
      now.addEventListener("click", function () {
        syncNow();
      });
    }
    if (readSyncCode()) scheduleSync(900);
  }

  function scheduleSync(delay) {
    if (!readSyncCode()) return;
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(function () {
      syncTimer = null;
      syncNow();
    }, Math.max(0, delay || 0));
  }

  function syncEndpointUrl(code) {
    return String(SYNC_BASE_URL || "").replace(/\/+$/, "") + "/sync/read?code=" + encodeURIComponent(code);
  }

  function syncNow() {
    var code = readSyncCode();
    if (!code || !SYNC_BASE_URL) {
      updateSyncControls();
      return Promise.resolve();
    }
    if (syncInFlight) {
      syncAgain = true;
      return Promise.resolve();
    }
    syncInFlight = true;
    setSyncStatus("...");
    var endpoint = syncEndpointUrl(code);
    var local = readReadMeta();
    return fetch(endpoint, { method: "GET", cache: "no-store", credentials: "omit" })
      .then(function (response) {
        if (!response.ok) throw new Error("sync_get_" + response.status);
        return response.json();
      })
      .then(function (remote) {
        var merged = mergeReadMeta(local, remote);
        if (merged.changed) {
          writeReadMeta(merged.meta);
          refreshReadUi();
        }
        return fetch(endpoint, {
          method: "PUT",
          cache: "no-store",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged.meta)
        });
      })
      .then(function (response) {
        if (!response.ok) throw new Error("sync_put_" + response.status);
        return response.json();
      })
      .then(function (serverMeta) {
        var merged = mergeReadMeta(readReadMeta(), serverMeta);
        if (merged.changed) {
          writeReadMeta(merged.meta);
          refreshReadUi();
        }
        setSyncStatus("ok");
      })
      .catch(function (error) {
        var message = String(error && error.message || "");
        setSyncStatus(message.indexOf("_400") >= 0 ? "worker" : message.indexOf("_501") >= 0 ? "storage" : "erro");
      })
      .finally(function () {
        syncInFlight = false;
        if (syncAgain) {
          syncAgain = false;
          scheduleSync(300);
        }
      });
  }

  function mergeReadMeta(localMeta, remoteMeta) {
    var local = normalizeReadMeta(localMeta);
    var remote = normalizeReadMeta(remoteMeta);
    var result = normalizeReadMeta(local);
    var changed = false;
    Object.keys(remote.items).forEach(function (id) {
      var incoming = remote.items[id];
      var current = result.items[id];
      var shouldUseIncoming = !current ||
        incoming.updatedAt > current.updatedAt ||
        (incoming.updatedAt === current.updatedAt && incoming.read && !current.read);
      if (shouldUseIncoming) {
        result.items[id] = { read: incoming.read !== false, updatedAt: incoming.updatedAt };
        changed = true;
      }
    });
    Object.keys(result.items).forEach(function (id) {
      if (result.items[id].updatedAt > result.updatedAt) result.updatedAt = result.items[id].updatedAt;
    });
    return { meta: result, changed: changed || JSON.stringify(local) !== JSON.stringify(result) };
  }

  function pageKey() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function readHighlightsStore() {
    try {
      var parsed = JSON.parse(localStorage.getItem(HIGHLIGHTS_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  function writeHighlightsStore(store) {
    try {
      localStorage.setItem(HIGHLIGHTS_KEY, JSON.stringify(store));
    } catch (_error) {}
  }

  function readPageHighlights() {
    var store = readHighlightsStore();
    var current = store[pageKey()];
    return current && typeof current === "object" ? current : {};
  }

  function writePageHighlights(pageHighlights) {
    var store = readHighlightsStore();
    store[pageKey()] = pageHighlights;
    writeHighlightsStore(store);
  }

  function getTargetId(target) {
    return target && target.dataset ? String(target.dataset.highlightId || "") : "";
  }

  function normalizeRanges(ranges, textLength) {
    var limit = Math.max(0, Number(textLength) || 0);
    if (limit <= 0) return [];
    var colorByPos = new Array(limit);
    (Array.isArray(ranges) ? ranges : []).forEach(function (range) {
      var start = Math.max(0, Math.min(limit, Number.parseInt(range.start, 10)));
      var end = Math.max(0, Math.min(limit, Number.parseInt(range.end, 10)));
      if (!Number.isInteger(start) || !Number.isInteger(end) || end <= start) return;
      var color = normalizeHighlightColor(range.color);
      for (var pos = start; pos < end; pos += 1) colorByPos[pos] = color;
    });
    var result = [];
    var cursor = 0;
    while (cursor < limit) {
      var color = colorByPos[cursor];
      if (!color) {
        cursor += 1;
        continue;
      }
      var start = cursor;
      cursor += 1;
      while (cursor < limit && colorByPos[cursor] === color) cursor += 1;
      result.push({ start: start, end: cursor, color: color });
    }
    return result;
  }

  function renderTarget(target) {
    var baseText = typeof target.__highlightBaseText === "string"
      ? target.__highlightBaseText
      : String(target.textContent || "");
    var ranges = normalizeRanges(target.__highlightRanges || [], baseText.length);
    target.__highlightRanges = ranges;
    target.textContent = "";
    var frag = document.createDocumentFragment();
    var cursor = 0;
    ranges.forEach(function (range, index) {
      if (range.start > cursor) {
        frag.appendChild(document.createTextNode(baseText.slice(cursor, range.start)));
      }
      var mark = document.createElement("mark");
      mark.className = "reader-highlight";
      mark.dataset.highlightIndex = String(index);
      mark.dataset.highlightColor = normalizeHighlightColor(range.color);
      mark.textContent = baseText.slice(range.start, range.end);
      frag.appendChild(mark);
      cursor = range.end;
    });
    if (cursor < baseText.length) {
      frag.appendChild(document.createTextNode(baseText.slice(cursor)));
    }
    target.appendChild(frag);
  }

  function persistTarget(target) {
    var id = getTargetId(target);
    if (!id) return;
    var pageHighlights = readPageHighlights();
    pageHighlights[id] = normalizeRanges(target.__highlightRanges || [], String(target.__highlightBaseText || "").length);
    writePageHighlights(pageHighlights);
  }

  function initHighlights() {
    window.__njReinitHighlights = initHighlights;
    var pageHighlights = readPageHighlights();
    document.querySelectorAll("[data-highlight-target][data-highlight-id]").forEach(function (target) {
      var id = getTargetId(target);
      target.__highlightBaseText = String(target.textContent || "");
      target.__highlightRanges = normalizeRanges(pageHighlights[id] || [], target.__highlightBaseText.length);
      renderTarget(target);
      bindTargetHighlightEvents(target);
    });

    if (!highlightListenersBound) {
      highlightListenersBound = true;
      document.addEventListener("mouseup", function () {
        window.setTimeout(applySelectionHighlight, 0);
      });
      document.addEventListener("keyup", function (event) {
        if (event.key && (event.key.indexOf("Arrow") === 0 || event.key === "Shift")) {
          window.setTimeout(applySelectionHighlight, 0);
        }
      });
    }
  }

  function bindTargetHighlightEvents(target) {
    if (target.__highlightEventsBound) return;
    target.__highlightEventsBound = true;
    var lastTap = { time: 0, x: 0, y: 0 };
    var lastTouchEventAt = 0;

    target.addEventListener("click", function (event) {
      var mark = event.target && event.target.closest ? event.target.closest("mark.reader-highlight") : null;
      if (!mark || !target.contains(mark)) return;
      var index = Number.parseInt(mark.dataset.highlightIndex || "", 10);
      if (!Number.isInteger(index)) return;
      target.__highlightRanges = (target.__highlightRanges || []).filter(function (_range, currentIndex) {
        return currentIndex !== index;
      });
      renderTarget(target);
      persistTarget(target);
      clearSelection();
      event.preventDefault();
    });

    target.addEventListener("dblclick", function (event) {
      if (highlightWordFromPoint(target, event.clientX, event.clientY)) {
        event.preventDefault();
      }
    });

    target.addEventListener("touchend", function (event) {
      if (!event.changedTouches || !event.changedTouches.length) return;
      lastTouchEventAt = Date.now();
      var touch = event.changedTouches[0];
      var handled = handleTapForHighlight(target, touch.clientX, touch.clientY, lastTap);
      lastTap = handled.nextTap;
      if (handled.highlighted) {
        event.preventDefault();
      } else if (handled.secondTap) {
        window.setTimeout(applySelectionHighlight, 80);
      }
    }, { passive: false });

    target.addEventListener("pointerup", function (event) {
      if (event.pointerType === "mouse" || event.pointerType === "touch") return;
      if (Date.now() - lastTouchEventAt < 700) return;
      var handled = handleTapForHighlight(target, event.clientX, event.clientY, lastTap);
      lastTap = handled.nextTap;
      if (handled.highlighted) {
        event.preventDefault();
      } else if (handled.secondTap) {
        window.setTimeout(applySelectionHighlight, 80);
      }
    });
  }

  function handleTapForHighlight(target, clientX, clientY, lastTap) {
    var now = Date.now();
    var previous = lastTap || { time: 0, x: 0, y: 0 };
    var dx = clientX - previous.x;
    var dy = clientY - previous.y;
    var close = Math.sqrt(dx * dx + dy * dy) < 34;
    var secondTap = now - previous.time < 520 && close;
    if (!secondTap) {
      return { highlighted: false, secondTap: false, nextTap: { time: now, x: clientX, y: clientY } };
    }
    var highlighted = highlightWordFromPoint(target, clientX, clientY);
    return { highlighted: highlighted, secondTap: true, nextTap: { time: 0, x: 0, y: 0 } };
  }

  function targetFromNode(node) {
    var el = node && node.nodeType === Node.ELEMENT_NODE ? node : node && node.parentElement;
    return el && el.closest ? el.closest("[data-highlight-target][data-highlight-id]") : null;
  }

  function applySelectionHighlight() {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    var range = selection.getRangeAt(0);
    var target = targetFromNode(range.startContainer);
    if (!target || target !== targetFromNode(range.endContainer)) return;
    var selectedText = String(range.toString() || "");
    if (!selectedText.trim()) return;

    var pre = range.cloneRange();
    pre.selectNodeContents(target);
    pre.setEnd(range.startContainer, range.startOffset);
    var start = pre.toString().length;
    var end = start + selectedText.length;
    if (end <= start) return;

    addHighlightRange(target, start, end);
    selection.removeAllRanges();
  }

  function highlightWordFromPoint(target, clientX, clientY) {
    var offset = textOffsetFromPoint(target, clientX, clientY);
    if (offset === null) return false;
    var baseText = String(target.__highlightBaseText || target.textContent || "");
    var bounds = wordBoundsAt(baseText, offset);
    if (!bounds) return false;
    addHighlightRange(target, bounds.start, bounds.end);
    clearSelection();
    return true;
  }

  function addHighlightRange(target, start, end) {
    var baseText = String(target.__highlightBaseText || target.textContent || "");
    var from = Math.max(0, Math.min(baseText.length, Number(start) || 0));
    var to = Math.max(0, Math.min(baseText.length, Number(end) || 0));
    if (to <= from) return;
    target.__highlightRanges = normalizeRanges(
      (target.__highlightRanges || []).concat([{ start: from, end: to, color: readHighlightColor() }]),
      baseText.length
    );
    renderTarget(target);
    persistTarget(target);
  }

  function textOffsetFromPoint(target, clientX, clientY) {
    var range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clientX, clientY);
    } else if (document.caretPositionFromPoint) {
      var pos = document.caretPositionFromPoint(clientX, clientY);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }
    if (!range || targetFromNode(range.startContainer) !== target) return null;
    var pre = range.cloneRange();
    pre.selectNodeContents(target);
    pre.setEnd(range.startContainer, range.startOffset);
    return pre.toString().length;
  }

  function wordBoundsAt(text, offset) {
    var value = String(text || "");
    if (!value) return null;
    var index = Math.max(0, Math.min(value.length - 1, Number(offset) || 0));
    if (!isWordChar(value.charAt(index)) && index > 0 && isWordChar(value.charAt(index - 1))) {
      index -= 1;
    }
    if (!isWordChar(value.charAt(index))) return null;
    var start = index;
    var end = index + 1;
    while (start > 0 && isWordChar(value.charAt(start - 1))) start -= 1;
    while (end < value.length && isWordChar(value.charAt(end))) end += 1;
    return end > start ? { start: start, end: end } : null;
  }

  function isWordChar(ch) {
    return /[0-9_]/.test(ch) || String(ch || "").toLowerCase() !== String(ch || "").toUpperCase();
  }

  function clearSelection() {
    var selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  }

  function clearHighlights() {
    var pageHighlights = readPageHighlights();
    document.querySelectorAll("[data-highlight-target][data-highlight-id]").forEach(function (target) {
      var id = getTargetId(target);
      target.__highlightRanges = [];
      renderTarget(target);
      if (id) delete pageHighlights[id];
    });
    writePageHighlights(pageHighlights);
    clearSelection();
  }

  function bindTimer() {
    var timer = document.querySelector("[data-reading-timer]");
    if (!timer) return;
    var seconds = 0;
    var interval = null;
    var clickTimeout = null;

    function formatTime(s) {
      var m = Math.floor(s / 60);
      var sec = s % 60;
      return (m < 10 ? "0" : "") + m + ":" + (sec < 10 ? "0" : "") + sec;
    }

    function updateDisplay() {
      timer.textContent = formatTime(seconds);
    }

    function start() {
      if (interval) return;
      interval = setInterval(function () {
        seconds += 1;
        updateDisplay();
      }, 1000);
      timer.classList.add("is-running");
    }

    function pause() {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
      timer.classList.remove("is-running");
    }

    function reset() {
      pause();
      seconds = 0;
      updateDisplay();
    }

    function toggle() {
      if (interval) {
        pause();
      } else {
        start();
      }
    }

    timer.addEventListener("click", function (event) {
      event.preventDefault();
      if (clickTimeout) {
        clearTimeout(clickTimeout);
        clickTimeout = null;
        reset();
        return;
      }
      clickTimeout = setTimeout(function () {
        clickTimeout = null;
        toggle();
      }, 280);
    });

    updateDisplay();
  }
})();
