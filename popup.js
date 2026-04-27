const STORAGE_KEY = "typingSimulatorSnippets";
const EXT = globalThis.browser || globalThis.chrome;
const ROUTE_KEY_DELIMITER = "::route::";

const listRoot = document.getElementById("snippet-list");
const snippetTemplate = document.getElementById("snippet-template");
const searchInput = document.getElementById("snippet-search");
const searchWrap = document.querySelector(".search-wrap");
const clearSiteButton = document.getElementById("clear-site-interactions");
let searchQuery = "";

init().catch((error) => {
  listRoot.textContent = `Failed to load snippets: ${error?.message || error}`;
});

async function init() {
  searchInput.addEventListener("input", async (event) => {
    searchQuery = event.target.value || "";
    await render();
  });
  clearSiteButton.addEventListener("click", async () => {
    await clearAllInteractionsForActiveOrigin();
  });
  await render();
}

async function render() {
  const store = await getStore();
  const activeOrigin = await getActiveTabOrigin();
  const urls = getUrlsForOrigin(store, activeOrigin);
  updateClearSiteButton(activeOrigin, urls.length);

  listRoot.innerHTML = "";
  if (urls.length === 0) {
    updateSearchVisibility(false);
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = activeOrigin
      ? `No snippets for ${activeOrigin}. Use your record shortcut on this site to save one.`
      : "No snippets recorded yet. Use your record shortcut on a field to save one.";
    listRoot.appendChild(empty);
    return;
  }

  const flattenedItems = [];
  let originalIndex = 0;
  for (const url of urls) {
    const storageSelectorKeys = Object.keys(store[url] || {});

    for (const storageSelectorKey of storageSelectorKeys) {
      const snippet = store[url][storageSelectorKey];
      const parsedSelector = parseSelectorStorageKey(storageSelectorKey);
      flattenedItems.push({
        url,
        storageSelectorKey,
        selector: parsedSelector.selector,
        routePath: parsedSelector.routePath,
        snippet,
        createdAt: getRecordCreatedAt(snippet),
        originalIndex
      });
      originalIndex += 1;
    }
  }

  flattenedItems.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt - b.createdAt;
    }
    return a.originalIndex - b.originalIndex;
  });
  const hasRecordedInteractions = flattenedItems.some(
    ({ snippet }) => normalizeSnippetRecord(snippet).interactions.length > 0
  );
  updateSearchVisibility(hasRecordedInteractions);

  const groupedBySelector = new Map();
  for (const item of flattenedItems) {
    if (!groupedBySelector.has(item.selector)) {
      groupedBySelector.set(item.selector, []);
    }
    groupedBySelector.get(item.selector).push(item);
  }

  let renderedCount = 0;
  for (const [selector, selectorItems] of groupedBySelector.entries()) {
    const sortedSelectorItems = [...selectorItems].sort((a, b) => {
      const aIsAllRoutes = !a.routePath;
      const bIsAllRoutes = !b.routePath;
      if (aIsAllRoutes !== bIsAllRoutes) {
        return aIsAllRoutes ? -1 : 1;
      }
      return 0;
    });
    const group = document.createElement("section");
    group.className = "sequence-group";
    if (sortedSelectorItems.length === 1) {
      group.classList.add("single-selector-entry-group");
    }
    const groupHeaderRow = document.createElement("div");
    groupHeaderRow.className = "sequence-group-header";
    const groupHeader = document.createElement("code");
    groupHeader.className = "sequence-group-title";
    groupHeader.textContent = selector;
    groupHeaderRow.appendChild(groupHeader);
    group.appendChild(groupHeaderRow);

    const groupItems = document.createElement("div");
    groupItems.className = "sequence-group-items";
    const selectorMatches = fuzzyMatch(selector, searchQuery);
    const routeColorIndexByRoute = buildRouteColorMap(sortedSelectorItems);

    for (const { url, storageSelectorKey, routePath, snippet } of sortedSelectorItems) {
      const record = normalizeSnippetRecord(snippet);
      if (record.interactions.length === 0) {
        continue;
      }
      const routeDisplay = routePath ? `/${routePath}` : "all routes";
      const routeMatches = fuzzyMatch(routeDisplay, searchQuery);

      for (let interactionIndex = 0; interactionIndex < record.interactions.length; interactionIndex += 1) {
        const interaction = record.interactions[interactionIndex];
        if (!interaction) {
          continue;
        }
        const interactionMatches = selectorMatches || routeMatches;
        if (!interactionMatches) {
          continue;
        }

        const card = snippetTemplate.content.firstElementChild.cloneNode(true);
        const stepNode = card.querySelector(".snippet-step");
        const nextNode = card.querySelector(".snippet-next-indicator");
        const durationNode = card.querySelector(".snippet-duration");
        const optionsNode = card.querySelector(".snippet-options");
        const previewNode = card.querySelector(".snippet-preview");
        const actionsNode = card.querySelector(".snippet-actions");
        const editBtn = card.querySelector('button[data-action="edit"]');
        const deleteBtn = card.querySelector('button[data-action="delete"]');

        stepNode.textContent = `Step ${interactionIndex + 1}`;
        const routeColorIndex = routeColorIndexByRoute.get(routePath || "") || 0;
        stepNode.classList.add(`route-color-${routeColorIndex}`);
        card.classList.add(`route-line-color-${routeColorIndex}`);
        if (record.interactions.length === 1) {
          card.classList.add("single-interaction-card");
          if (sortedSelectorItems.length === 1) {
            card.classList.add("single-interaction-no-line");
          }
        }
        durationNode.textContent = `${interaction.durationSec}s`;
        const clearLabel = interaction.clearBeforeType
          ? "clear field before replay"
          : "append to existing text";
        const isNextStep = interactionIndex === getPreviewInteractionIndex(record);
        if (isNextStep && record.interactions.length > 1) {
          card.classList.add("next-step");
          nextNode.textContent = "Next";
          nextNode.classList.add("active");
        }
        if (record.interactions.length === 1) {
          durationNode.style.display = "none";
          optionsNode.classList.add("single-interaction-options");
          const optionsTextNode = document.createElement("span");
          optionsTextNode.textContent = `Options: ${clearLabel}`;
          const inlineDurationNode = document.createElement("span");
          inlineDurationNode.className = "single-interaction-inline-duration";
          inlineDurationNode.textContent = `${interaction.durationSec}s`;
          optionsNode.replaceChildren(optionsTextNode, inlineDurationNode);
        } else {
          optionsNode.textContent = `Options: ${clearLabel}`;
        }
        previewNode.textContent = interaction.text;
        const previewWrap = document.createElement("div");
        previewWrap.className = "snippet-preview-wrap";
        const copyButton = document.createElement("button");
        copyButton.type = "button";
        copyButton.className = "snippet-copy-btn";
        copyButton.title = "Copy text";
        copyButton.setAttribute("aria-label", "Copy text");
        copyButton.textContent = "⧉";
        previewNode.replaceWith(previewWrap);
        previewWrap.append(copyButton, previewNode);

        const routeNode = document.createElement("span");
        routeNode.className = "snippet-route-label";
        routeNode.textContent = `Route: ${routeDisplay}`;
        routeNode.title = routeNode.textContent;

        const buttonWrap = document.createElement("div");
        buttonWrap.className = "snippet-actions-buttons";
        buttonWrap.append(editBtn, deleteBtn);
        actionsNode.replaceChildren(routeNode, buttonWrap);

        editBtn.addEventListener("click", () =>
          openEditor(card, url, storageSelectorKey, selector, routePath, record, interactionIndex)
        );
        copyButton.addEventListener("click", async () => {
          const copied = await copyInteractionText(interaction.text);
          if (!copied) {
            return;
          }
          const previousIcon = copyButton.textContent;
          copyButton.textContent = "✓";
          copyButton.classList.add("copied");
          window.setTimeout(() => {
            copyButton.textContent = previousIcon;
            copyButton.classList.remove("copied");
          }, 900);
        });
        deleteBtn.addEventListener("click", async () => {
          await deleteInteraction(url, storageSelectorKey, interactionIndex);
          await render();
        });
        card.addEventListener("dblclick", (event) => {
          if (card.dataset.editing === "true") {
            return;
          }
          if (event.target instanceof HTMLElement && event.target.closest("button")) {
            return;
          }
          openEditor(card, url, storageSelectorKey, selector, routePath, record, interactionIndex);
        });

        groupItems.appendChild(card);
        renderedCount += 1;
      }
    }
    if (groupItems.children.length > 0) {
      group.appendChild(groupItems);
      listRoot.appendChild(group);
    }
  }

  if (renderedCount === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = searchQuery.trim()
      ? `No interactions match "${searchQuery.trim()}".`
      : "No interactions available for this site.";
    listRoot.appendChild(empty);
  }
}

function updateSearchVisibility(visible) {
  if (!searchWrap) {
    return;
  }
  searchWrap.style.display = visible ? "" : "none";
}

function updateClearSiteButton(activeOrigin, scopedUrlCount) {
  if (!clearSiteButton) {
    return;
  }
  const hasScopedData = Boolean(activeOrigin) && scopedUrlCount > 0;
  clearSiteButton.disabled = !hasScopedData;
  clearSiteButton.title = hasScopedData
    ? `Delete all interactions for ${activeOrigin}`
    : "No interactions for the current site";
}

async function clearAllInteractionsForActiveOrigin() {
  const activeOrigin = await getActiveTabOrigin();
  if (!activeOrigin) {
    return;
  }
  const store = await getStore();
  const scopedUrls = getUrlsForOrigin(store, activeOrigin);
  if (scopedUrls.length === 0) {
    await render();
    return;
  }

  for (const scopedUrl of scopedUrls) {
    delete store[scopedUrl];
  }
  await setStore(store);
  await render();
}

function openEditor(card, url, storageSelectorKey, selector, routePath, record, interactionIndex) {
  card.dataset.editing = "true";
  card.innerHTML = "";
  const interaction = record.interactions[interactionIndex];
  if (!interaction) {
    render();
    return;
  }

  const editor = document.createElement("div");
  editor.className = "editor";

  if (record.interactions.length === 1) {
    const editorTarget = document.createElement("code");
    editorTarget.className = "editor-target";
    editorTarget.textContent = routePath ? `${selector} • /${routePath}` : `${selector} • all routes`;
    editor.appendChild(editorTarget);
  } else {
    const editorStep = document.createElement("div");
    editorStep.className = "editor-step";
    editorStep.textContent = `Step ${interactionIndex + 1} of ${record.interactions.length}`;
    editor.appendChild(editorStep);
  }

  const textArea = document.createElement("textarea");
  textArea.value = interaction.text;
  textArea.addEventListener("input", () => autoSizeEditorTextarea(textArea));
  editor.appendChild(textArea);

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "0.1";
  durationInput.step = "0.1";
  durationInput.value = String(interaction.durationSec);
  editor.appendChild(durationInput);

  const clearLabel = document.createElement("label");
  clearLabel.className = "editor-checkbox";
  const clearCheckbox = document.createElement("input");
  clearCheckbox.type = "checkbox";
  clearCheckbox.checked = Boolean(interaction.clearBeforeType);
  const clearText = document.createElement("span");
  clearText.textContent = "Clear field before replay";
  clearLabel.append(clearCheckbox, clearText);
  editor.appendChild(clearLabel);

  const actions = document.createElement("div");
  actions.className = "snippet-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  actions.append(cancelBtn, saveBtn);
  editor.appendChild(actions);

  cancelBtn.addEventListener("click", () => render());
  saveBtn.addEventListener("click", async () => {
    const durationSec = Number(durationInput.value);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return;
    }

    const nextRecord = normalizeSnippetRecord(record);
    nextRecord.interactions[interactionIndex] = {
      ...nextRecord.interactions[interactionIndex],
      text: textArea.value,
      durationSec,
      clearBeforeType: clearCheckbox.checked
    };
    await upsertSnippet(url, storageSelectorKey, nextRecord);
    await render();
  });

  card.appendChild(editor);
  // Recalculate after mount so wrapped content width is accurate.
  requestAnimationFrame(() => autoSizeEditorTextarea(textArea));
  textArea.focus();
  textArea.setSelectionRange(textArea.value.length, textArea.value.length);
}

async function getStore() {
  const data = await EXT.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function setStore(store) {
  await EXT.storage.local.set({ [STORAGE_KEY]: store });
}

async function upsertSnippet(url, selector, snippet) {
  const store = await getStore();
  store[url] = store[url] || {};
  store[url][selector] = snippet;
  await setStore(store);
}

async function deleteSnippet(url, selector) {
  const store = await getStore();
  if (!store[url]?.[selector]) {
    return;
  }

  delete store[url][selector];
  if (Object.keys(store[url]).length === 0) {
    delete store[url];
  }
  await setStore(store);
}

async function deleteInteraction(url, selector, interactionIndex) {
  const store = await getStore();
  const current = store[url]?.[selector];
  if (!current) {
    return;
  }

  const record = normalizeSnippetRecord(current);
  if (!record.interactions[interactionIndex]) {
    return;
  }

  record.interactions.splice(interactionIndex, 1);
  if (record.interactions.length === 0) {
    await deleteSnippet(url, selector);
    return;
  }

  record.replayIndex = normalizeReplayIndex(record.replayIndex, record.interactions.length);
  record.updatedAt = Date.now();
  store[url][selector] = record;
  await setStore(store);
}

function getUrlsForOrigin(store, origin) {
  const urls = Object.keys(store || {});
  if (!origin) {
    return urls;
  }
  return urls
    .filter((url) => url === origin || url.startsWith(`${origin}/`));
}

async function getActiveTabOrigin() {
  const [tab] = await EXT.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return "";
  }
  try {
    const parsed = new URL(tab.url);
    if (!/^https?:$/.test(parsed.protocol)) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

function normalizeSnippetRecord(record) {
  if (!record || typeof record !== "object") {
    return { interactions: [], replayIndex: 0, targetProfile: null, updatedAt: Date.now() };
  }
  if (Array.isArray(record.interactions)) {
    return {
      interactions: record.interactions.filter((item) => item && typeof item.text === "string"),
      replayIndex: normalizeReplayIndex(record.replayIndex, record.interactions.length),
      targetProfile: record.targetProfile || null,
      updatedAt: record.updatedAt || Date.now()
    };
  }
  if (typeof record.text === "string") {
    return {
      interactions: [
        {
          text: record.text,
          durationSec: Number(record.durationSec) || 1,
          clearBeforeType: Boolean(record.clearBeforeType),
          contentType: record.contentType === "html" ? "html" : "text",
          updatedAt: record.updatedAt || Date.now()
        }
      ],
      replayIndex: 0,
      targetProfile: record.targetProfile || null,
      updatedAt: record.updatedAt || Date.now()
    };
  }
  return { interactions: [], replayIndex: 0, targetProfile: record.targetProfile || null, updatedAt: Date.now() };
}

function normalizeReplayIndex(index, length) {
  if (!length || length <= 0) {
    return 0;
  }
  if (!Number.isInteger(index) || index < 0) {
    return 0;
  }
  return index % length;
}

function getPreviewInteractionIndex(record) {
  return normalizeReplayIndex(record.replayIndex, record.interactions.length);
}

function getRecordCreatedAt(record) {
  const normalized = normalizeSnippetRecord(record);
  if (!normalized.interactions.length) {
    return Number.MAX_SAFE_INTEGER;
  }
  const first = normalized.interactions[0];
  const raw = Number(first?.updatedAt || normalized.updatedAt || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : Number.MAX_SAFE_INTEGER;
}

function parseSelectorStorageKey(storageSelector) {
  const delimiterIndex = storageSelector.indexOf(ROUTE_KEY_DELIMITER);
  if (delimiterIndex < 0) {
    return { selector: storageSelector, routePath: "" };
  }
  return {
    selector: storageSelector.slice(0, delimiterIndex),
    routePath: storageSelector.slice(delimiterIndex + ROUTE_KEY_DELIMITER.length)
  };
}

function buildRouteColorMap(items) {
  const paletteSize = 5;
  const map = new Map();
  let nextIndex = 0;
  for (const item of items) {
    const key = item.routePath || "";
    if (map.has(key)) {
      continue;
    }
    map.set(key, nextIndex % paletteSize);
    nextIndex += 1;
  }
  return map;
}

function normalizeSearchText(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function fuzzyMatch(haystack, needle) {
  const normalizedNeedle = normalizeSearchText(needle);
  if (!normalizedNeedle) {
    return true;
  }
  const normalizedHaystack = normalizeSearchText(haystack);
  if (normalizedHaystack.includes(normalizedNeedle)) {
    return true;
  }

  // Loose fuzzy fallback: query chars appear in order.
  let queryIndex = 0;
  for (let i = 0; i < normalizedHaystack.length && queryIndex < normalizedNeedle.length; i += 1) {
    if (normalizedHaystack[i] === normalizedNeedle[queryIndex]) {
      queryIndex += 1;
    }
  }
  return queryIndex === normalizedNeedle.length;
}

function autoSizeEditorTextarea(textArea) {
  const minHeightPx = 100;
  const maxHeightPx = 350;
  textArea.style.height = "auto";
  const targetHeight = Math.min(maxHeightPx, Math.max(minHeightPx, textArea.scrollHeight));
  textArea.style.height = `${targetHeight}px`;
  textArea.style.overflowY = textArea.scrollHeight > maxHeightPx ? "auto" : "hidden";
}

async function copyInteractionText(text) {
  const value = typeof text === "string" ? text : "";
  if (!value) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

