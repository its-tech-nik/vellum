(() => {
if (window.__typingSimulatorContentLoaded) {
  return;
}
window.__typingSimulatorContentLoaded = true;

const STORAGE_KEY = "typingSimulatorSnippets";
const OVERLAY_ID = "typing-simulator-overlay";
const OVERLAY_STYLE_ID = "typing-simulator-style";
const EXT = globalThis.browser || globalThis.chrome;

let activeElement = null;
let activeSelector = null;

document.addEventListener("focusin", (event) => {
  updateActiveElement(event.target);
});

document.addEventListener("pointerdown", (event) => {
  updateActiveElement(event.target);
});

EXT.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_RECORDER") {
    openRecorderOverlay();
    sendResponse({ ok: true });
    return;
  }

  if (message?.type === "PLAY_SNIPPET") {
    playRecordedSnippet().then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: String(error?.message || error) })
    );
    return true;
  }
});

function isSupportedField(element) {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  if (element.matches("textarea")) {
    return true;
  }

  if (element.matches('input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"])')) {
    return true;
  }

  return element.isContentEditable || element.getAttribute("contenteditable") === "true";
}

function updateActiveElement(target) {
  if (!(target instanceof HTMLElement)) {
    return;
  }
  if (target.closest(`#${OVERLAY_ID}`)) {
    return;
  }

  const supported = target.closest('textareva, input, [contenteditable="true"], [contenteditable=""], [contenteditable]');
  if (!supported || !isSupportedField(supported)) {
    return;
  }

  activeElement = supported;
  activeSelector = getUniqueSelector(supported);
}

function getUniqueSelector(element) {
  const typingTarget = element.getAttribute("data-typing-target");
  if (typingTarget) {
    return `[data-typing-target="${escapeAttributeValue(typingTarget)}"]`;
  }

  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  return "";
}

function getSiblingIndex(element) {
  let index = 1;
  let sibling = element;
  while ((sibling = sibling.previousElementSibling)) {
    if (sibling.tagName === element.tagName) {
      index += 1;
    }
  }
  return index;
}

function isUniqueSelector(selector, expectedElement) {
  try {
    const matches = document.querySelectorAll(selector);
    return matches.length === 1 && matches[0] === expectedElement;
  } catch {
    return false;
  }
}

function escapeAttributeValue(value) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function isLikelyStableClassName(className) {
  if (!className) {
    return false;
  }
  if (className.length > 60) {
    return false;
  }
  if (/^[a-f0-9]{8,}$/i.test(className)) {
    return false;
  }
  if (/\d{4,}/.test(className)) {
    return false;
  }
  if (/^(css-|sc-|jsx-|emotion-|styled-)/i.test(className)) {
    return false;
  }
  return true;
}

function isLikelyStableToken(value) {
  if (!value) {
    return false;
  }
  if (/headlessui/i.test(value)) {
    return false;
  }
  if (/_r_[a-z0-9]+_/i.test(value)) {
    return false;
  }
  if (/^radix-/i.test(value)) {
    return false;
  }
  if (value.length > 120) {
    return false;
  }
  if (/^[a-f0-9-]{16,}$/i.test(value)) {
    return false;
  }
  if (/\d{5,}/.test(value)) {
    return false;
  }
  return true;
}

async function getStore() {
  const data = await EXT.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || {};
}

async function setStore(store) {
  await EXT.storage.local.set({ [STORAGE_KEY]: store });
}

function getUrlKey() {
  return window.location.origin;
}

function getOriginRelatedEntries(store) {
  const origin = window.location.origin;
  const relatedKeys = Object.keys(store).filter(
    (key) => key === origin || key.startsWith(`${origin}/`)
  );

  const mergedEntries = {};
  for (const key of relatedKeys) {
    Object.assign(mergedEntries, store[key] || {});
  }
  return mergedEntries;
}

function ensureOverlayStyles() {
  if (document.getElementById(OVERLAY_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = OVERLAY_STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      width: 320px;
      z-index: 2147483647;
      background: #111827;
      color: #f9fafb;
      border: 1px solid #374151;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
      font-family: Arial, sans-serif;
      padding: 12px;
    }
    #${OVERLAY_ID} h3 {
      margin: 0 0 10px;
      font-size: 14px;
    }
    #${OVERLAY_ID} .typing-sim-target {
      margin: 0 0 10px;
      font-size: 11px;
      color: #cbd5e1;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
      overflow-wrap: anywhere;
    }
    #${OVERLAY_ID} .typing-sim-target[data-missing="true"] {
      color: #fca5a5;
    }
    #${OVERLAY_ID} .typing-sim-warning {
      margin: -4px 0 10px;
      font-size: 11px;
      color: #fca5a5;
    }
    #${OVERLAY_ID} label {
      font-size: 12px;
      display: block;
      margin-bottom: 6px;
    }
    #${OVERLAY_ID} textarea,
    #${OVERLAY_ID} input[type="number"] {
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 10px;
      background: #1f2937;
      color: #f9fafb;
      border: 1px solid #4b5563;
      border-radius: 6px;
      padding: 8px;
    }
    #${OVERLAY_ID} textarea {
      min-height: 120px;
      white-space: pre-wrap;
      resize: vertical;
    }
    #${OVERLAY_ID} .typing-sim-duration-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: -4px 0 10px;
    }
    #${OVERLAY_ID} .typing-sim-duration-preset-btn {
      flex: 1 1 0;
      background: #1f2937;
      color: #e5e7eb;
      border: 1px solid #4b5563;
      border-radius: 999px;
      padding: 4px 8px;
      font-size: 11px;
      line-height: 1;
      text-align: center;
    }
    #${OVERLAY_ID} .typing-sim-checkbox {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 10px;
      font-size: 12px;
    }
    #${OVERLAY_ID} .typing-sim-checkbox input {
      margin: 0;
    }
    #${OVERLAY_ID} .typing-sim-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
    #${OVERLAY_ID} button {
      border: 0;
      border-radius: 6px;
      padding: 6px 10px;
      cursor: pointer;
    }
    #${OVERLAY_ID} button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    #${OVERLAY_ID} button[data-kind="cancel"] {
      background: #374151;
      color: #f3f4f6;
    }
    #${OVERLAY_ID} button[data-kind="save"] {
      background: #2563eb;
      color: #ffffff;
    }
    #${OVERLAY_ID} button[data-kind="append"] {
      background: #0f766e;
      color: #ffffff;
    }
  `;
  document.documentElement.appendChild(style);
}

async function openRecorderOverlay() {
  updateActiveElement(document.activeElement);
  if (!activeElement) {
    return;
  }
  const recorderTargetElement = activeElement;
  const recorderTargetSelector = activeSelector;
  const hasTargetSelector = Boolean(recorderTargetSelector);

  ensureOverlayStyles();
  document.getElementById(OVERLAY_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;

  const title = document.createElement("h3");
  title.textContent = "Record Interaction";
  overlay.appendChild(title);

  const targetInfo = document.createElement("div");
  targetInfo.className = "typing-sim-target";
  targetInfo.dataset.missing = hasTargetSelector ? "false" : "true";
  targetInfo.textContent = hasTargetSelector ? recorderTargetSelector : "none";
  overlay.appendChild(targetInfo);

  if (!hasTargetSelector) {
    const warning = document.createElement("div");
    warning.className = "typing-sim-warning";
    warning.textContent =
      "No id or data-typing-target found on this field. Saving is disabled.";
    overlay.appendChild(warning);
  }

  const textLabel = document.createElement("label");
  textLabel.textContent = "Snippet Text";
  const textArea = document.createElement("textarea");
  textArea.placeholder = "Type or paste multiline content...";
  textLabel.appendChild(textArea);
  overlay.appendChild(textLabel);

  const durationLabel = document.createElement("label");
  durationLabel.textContent = "Total Duration (seconds)";
  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "0.1";
  durationInput.step = "0.1";
  durationInput.value = "1";
  durationLabel.appendChild(durationInput);
  overlay.appendChild(durationLabel);
  const durationPresets = document.createElement("div");
  durationPresets.className = "typing-sim-duration-presets";
  const presetDurations = [
    { value: "0.1", label: "0.1s" },
    { value: "0.2", label: "0.2s" },
    { value: "0.4", label: "0.4s" },
    { value: "1", label: "1s" },
    { value: "2", label: "2s" },
    { value: "5", label: "5s" },
    { value: "10", label: "10s" }
  ];
  for (const preset of presetDurations) {
    const presetButton = document.createElement("button");
    presetButton.type = "button";
    presetButton.className = "typing-sim-duration-preset-btn";
    presetButton.textContent = preset.label;
    presetButton.addEventListener("click", () => {
      durationInput.value = preset.value;
    });
    durationPresets.appendChild(presetButton);
  }
  overlay.appendChild(durationPresets);

  const clearLabel = document.createElement("label");
  clearLabel.className = "typing-sim-checkbox";
  const clearCheckbox = document.createElement("input");
  clearCheckbox.type = "checkbox";
  clearCheckbox.checked = true;
  const clearText = document.createElement("span");
  clearText.textContent = "Clear field before replay";
  clearLabel.append(clearCheckbox, clearText);
  overlay.appendChild(clearLabel);

  const richLabel = document.createElement("label");
  richLabel.className = "typing-sim-checkbox";
  const richCheckbox = document.createElement("input");
  richCheckbox.type = "checkbox";
  const richText = document.createElement("span");
  richText.textContent = "Preserve rich formatting (HTML)";
  richLabel.append(richCheckbox, richText);
  if (!(recorderTargetElement instanceof HTMLElement && recorderTargetElement.isContentEditable)) {
    richLabel.style.display = "none";
  }
  overlay.appendChild(richLabel);

  const actions = document.createElement("div");
  actions.className = "typing-sim-actions";
  const cancelButton = document.createElement("button");
  cancelButton.dataset.kind = "cancel";
  cancelButton.textContent = "Cancel";
  cancelButton.title = "Cancel (Esc)";
  const saveButton = document.createElement("button");
  saveButton.dataset.kind = "save";
  saveButton.textContent = "Save";
  saveButton.title = "Save (Ctrl+Enter)";
  const appendButton = document.createElement("button");
  appendButton.dataset.kind = "append";
  appendButton.textContent = "Add to sequence";
  appendButton.title = "Add to sequence (Ctrl+Shift+Enter)";
  appendButton.style.display = "none";
  actions.append(cancelButton, appendButton, saveButton);
  overlay.appendChild(actions);

  const existingEntry = await getSnippetForSelector(recorderTargetSelector, recorderTargetElement);
  const existing = existingEntry
    ? getInteractionForReplace(existingEntry.record)
    : null;
  if (existing) {
    textArea.value = existing.text;
    durationInput.value = String(existing.durationSec);
    clearCheckbox.checked = Boolean(existing.clearBeforeType);
    richCheckbox.checked = existing.contentType === "html";
  }
  const fieldSnapshot = getFieldContentForRecording(recorderTargetElement, richCheckbox.checked);
  if (fieldSnapshot) {
    textArea.value = fieldSnapshot;
  }
  if (existingEntry?.record?.interactions?.length > 0) {
    appendButton.style.display = "";
  }
  saveButton.disabled = !hasTargetSelector;
  appendButton.disabled = !hasTargetSelector;

  function onOverlayFieldKeyDown(event) {
    if (!event.ctrlKey || event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      if (!appendButton.disabled && appendButton.style.display !== "none") {
        appendButton.click();
      }
      return;
    }
    if (!saveButton.disabled) {
      saveButton.click();
    }
  }

  textArea.addEventListener("keydown", onOverlayFieldKeyDown);
  durationInput.addEventListener("keydown", onOverlayFieldKeyDown);

  function closeOverlay() {
    window.removeEventListener("keydown", onWindowKeyDown, true);
    window.removeEventListener("resize", updateOverlayPosition);
    window.removeEventListener("scroll", updateOverlayPosition, true);
    overlay.remove();
  }

  function onWindowKeyDown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
    }
  }

  function updateOverlayPosition() {
    const margin = 12;
    const rect = recorderTargetElement.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    const preferredTop = rect.bottom + 8;
    const preferredLeft = rect.left;
    const top = Math.max(
      margin,
      Math.min(window.innerHeight - overlayRect.height - margin, preferredTop)
    );
    const left = Math.max(
      margin,
      Math.min(window.innerWidth - overlayRect.width - margin, preferredLeft)
    );
    overlay.style.top = `${top}px`;
    overlay.style.left = `${left}px`;
  }

  cancelButton.addEventListener("click", closeOverlay);
  async function persistInteraction(mode) {
    const text = textArea.value;
    const durationSec = Number(durationInput.value);
    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return;
    }

    await saveSnippetForSelector(recorderTargetSelector, {
      text,
      durationSec,
      clearBeforeType: clearCheckbox.checked,
      contentType: richCheckbox.checked ? "html" : "text",
      targetElement: recorderTargetElement
    }, mode);
    closeOverlay();
  }

  saveButton.addEventListener("click", async () => {
    await persistInteraction("replace");
  });
  appendButton.addEventListener("click", async () => {
    await persistInteraction("append");
  });

  document.body.appendChild(overlay);
  updateOverlayPosition();
  window.addEventListener("keydown", onWindowKeyDown, true);
  window.addEventListener("resize", updateOverlayPosition);
  window.addEventListener("scroll", updateOverlayPosition, true);
  textArea.focus();
}

async function saveSnippetForSelector(selector, payload, mode = "replace") {
  if (!selector) {
    return;
  }

  const url = getUrlKey();
  const store = await getStore();
  store[url] = store[url] || {};
  const existingRecord = normalizeSnippetRecord(store[url][selector]);
  const replaceIndex =
    mode === "replace" && existingRecord.interactions.length > 0
      ? getReplaceInteractionIndex(existingRecord)
      : -1;
  const existingInteraction = replaceIndex >= 0 ? existingRecord.interactions[replaceIndex] : null;
  const interaction = {
    text: payload.text,
    durationSec: payload.durationSec,
    clearBeforeType: Boolean(payload.clearBeforeType),
    contentType: payload.contentType === "html" ? "html" : "text",
    // Keep timestamp stable when replacing so ordering does not jump.
    updatedAt: existingInteraction?.updatedAt || Date.now()
  };

  let interactions;
  if (mode === "append" && existingRecord.interactions.length > 0) {
    interactions = [...existingRecord.interactions, interaction];
  } else if (mode === "replace" && existingRecord.interactions.length > 0) {
    interactions = [...existingRecord.interactions];
    interactions[replaceIndex] = {
      ...interactions[replaceIndex],
      ...interaction
    };
  } else {
    interactions = [interaction];
  }

  store[url][selector] = {
    interactions,
    replayIndex: normalizeReplayIndex(existingRecord.replayIndex, interactions.length),
    updatedAt: Date.now(),
    targetProfile: getElementProfile(payload.targetElement || activeElement)
  };
  await setStore(store);
}

async function getSnippetForSelector(selector, element) {
  if (!selector && !element) {
    return null;
  }

  const url = getUrlKey();
  const store = await getStore();
  const pairs = getOriginRelatedEntryPairs(store);
  if (selector) {
    const directMatch = pairs.find((pair) => pair.selector === selector && pair.sourceKey === url);
    if (directMatch) {
      return {
        sourceKey: directMatch.sourceKey,
        selector: directMatch.selector,
        record: normalizeSnippetRecord(directMatch.record)
      };
    }
    const looseExactMatch = pairs.find((pair) => pair.selector === selector);
    if (looseExactMatch) {
      return {
        sourceKey: looseExactMatch.sourceKey,
        selector: looseExactMatch.selector,
        record: normalizeSnippetRecord(looseExactMatch.record)
      };
    }
  }
  if (!element) {
    return null;
  }
  return null;
}

async function playRecordedSnippet() {
  updateActiveElement(document.activeElement);
  if (!activeElement || !activeSelector) {
    return;
  }

  const resolved = await getSnippetForSelector(activeSelector, activeElement);
  if (!resolved?.record?.interactions?.length) {
    return;
  }
  const interactionIndex = normalizeReplayIndex(
    resolved.record.replayIndex,
    resolved.record.interactions.length
  );
  const snippet = resolved.record.interactions[interactionIndex];
  if (!snippet?.text?.length) {
    return;
  }

  activeElement.focus();
  if (snippet.clearBeforeType) {
    clearFieldValue(activeElement);
  }
  if (snippet.contentType === "html" && activeElement instanceof HTMLElement && activeElement.isContentEditable) {
    applyHtmlContent(activeElement, snippet.text, snippet.clearBeforeType);
    await sleep(Math.max(100, snippet.durationSec * 1000));
  } else {
    await typeLikeHuman(activeElement, snippet.text, snippet.durationSec);
  }

  const nextIndex = (interactionIndex + 1) % resolved.record.interactions.length;
  await persistReplayIndex(resolved.sourceKey, resolved.selector, nextIndex);
}

async function typeLikeHuman(element, text, durationSec) {
  const totalDurationMs = Math.max(100, durationSec * 1000);
  const chars = Array.from(text);
  const delays = buildTypingDelays(chars.length, totalDurationMs);

  for (let index = 0; index < chars.length; index += 1) {
    const char = chars[index];
    if (char === "\n") {
      await typeNewline(element);
    } else {
      await typeCharacter(element, char);
    }
    keepTypingVisible(element);

    const delayMs = delays[index];
    await sleep(delayMs);
  }
}

async function typeCharacter(element, char) {
  dispatchKeyboardEvent(element, "keydown", char);
  dispatchBeforeInputEvent(element, char, "insertText");

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    insertTextInInput(element, char);
  } else {
    insertTextInEditable(element, char);
  }

  dispatchInputEvent(element, char, "insertText");
  dispatchKeyboardEvent(element, "keyup", char);
}

async function typeNewline(element) {
  dispatchKeyboardEvent(element, "keydown", "Enter");
  dispatchBeforeInputEvent(element, "\n", "insertLineBreak");

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    insertTextInInput(element, "\n");
  } else {
    const entered = triggerEnterForEditable(element);
    if (!entered) {
      insertLineBreakInEditable(element);
    }
  }

  dispatchInputEvent(element, "\n", "insertLineBreak");
  dispatchKeyboardEvent(element, "keyup", "Enter");
}

function insertTextInInput(element, text) {
  const supportsSelectionRange =
    typeof element.selectionStart === "number" && typeof element.selectionEnd === "number";

  if (supportsSelectionRange) {
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    try {
      element.setRangeText(text, start, end, "end");
      return;
    } catch {
      // Some input types (notably email) can reject setRangeText.
    }
  }

  element.value = `${element.value || ""}${text}`;
}

function keepTypingVisible(element) {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.scrollIntoView({ block: "nearest", inline: "nearest" });

  if (element instanceof HTMLTextAreaElement) {
    // Keep the latest typed text in view in multiline fields.
    element.scrollTop = element.scrollHeight;
    element.scrollLeft = element.scrollWidth;
    return;
  }

  if (element instanceof HTMLInputElement) {
    // Keep caret visibility in single-line overflowing inputs.
    element.scrollLeft = element.scrollWidth;
    return;
  }

  if (element.isContentEditable) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    if (container instanceof HTMLElement) {
      container.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else if (container?.parentElement) {
      container.parentElement.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
}

function insertTextInEditable(element, text) {
  element.focus();
  if (document.queryCommandSupported?.("insertText")) {
    const ok = document.execCommand("insertText", false, text);
    if (ok) {
      return;
    }
  }

  const selection = window.getSelection();
  if (!selection) {
    element.textContent = `${element.textContent || ""}${text}`;
    return;
  }

  if (selection.rangeCount === 0) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.addRange(range);
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(document.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function triggerEnterForEditable(element) {
  element.focus();
  if (document.queryCommandSupported?.("insertLineBreak")) {
    const ok = document.execCommand("insertLineBreak");
    if (ok) {
      return true;
    }
  }
  return false;
}

function insertLineBreakInEditable(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    element.appendChild(document.createElement("br"));
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const br = document.createElement("br");
  range.insertNode(br);
  range.setStartAfter(br);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function dispatchKeyboardEvent(element, type, key) {
  const code = key === "Enter" ? "Enter" : `Key${String(key).toUpperCase()}`;
  element.dispatchEvent(
    new KeyboardEvent(type, {
      key,
      code,
      bubbles: true,
      cancelable: true
    })
  );
}

function dispatchBeforeInputEvent(element, data, inputType) {
  const event = new InputEvent("beforeinput", {
    data,
    inputType,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(event);
}

function dispatchInputEvent(element, data, inputType) {
  const event = new InputEvent("input", {
    data,
    inputType,
    bubbles: true,
    cancelable: false
  });
  element.dispatchEvent(event);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSnippetRecord(record) {
  if (!record || typeof record !== "object") {
    return { interactions: [], replayIndex: 0, targetProfile: null };
  }
  if (Array.isArray(record.interactions)) {
    return {
      interactions: record.interactions.filter((item) => item && typeof item.text === "string"),
      replayIndex: normalizeReplayIndex(record.replayIndex, record.interactions.length),
      targetProfile: record.targetProfile || null
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
      targetProfile: record.targetProfile || null
    };
  }
  return { interactions: [], replayIndex: 0, targetProfile: record.targetProfile || null };
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

function getLatestInteraction(record) {
  const normalized = normalizeSnippetRecord(record);
  if (normalized.interactions.length === 0) {
    return null;
  }
  return normalized.interactions[normalized.interactions.length - 1];
}

function getReplaceInteractionIndex(record) {
  const normalized = normalizeSnippetRecord(record);
  const length = normalized.interactions.length;
  if (length <= 0) {
    return 0;
  }
  const nextIndex = normalizeReplayIndex(normalized.replayIndex, length);
  return (nextIndex + length - 1) % length;
}

function getInteractionForReplace(record) {
  const normalized = normalizeSnippetRecord(record);
  if (normalized.interactions.length === 0) {
    return null;
  }
  return normalized.interactions[getReplaceInteractionIndex(normalized)];
}

function getOriginRelatedEntryPairs(store) {
  const origin = window.location.origin;
  const relatedKeys = Object.keys(store).filter(
    (key) => key === origin || key.startsWith(`${origin}/`)
  );
  const pairs = [];
  for (const sourceKey of relatedKeys) {
    const bucket = store[sourceKey] || {};
    for (const [selector, record] of Object.entries(bucket)) {
      pairs.push({ sourceKey, selector, record });
    }
  }
  return pairs;
}

async function persistReplayIndex(sourceKey, selector, replayIndex) {
  if (!sourceKey || !selector) {
    return;
  }
  const store = await getStore();
  const currentRecord = store[sourceKey]?.[selector];
  if (!currentRecord) {
    return;
  }
  const normalized = normalizeSnippetRecord(currentRecord);
  normalized.replayIndex = normalizeReplayIndex(replayIndex, normalized.interactions.length);
  store[sourceKey][selector] = {
    ...currentRecord,
    interactions: normalized.interactions,
    replayIndex: normalized.replayIndex
  };
  await setStore(store);
}

function buildTypingDelays(length, totalDurationMs) {
  if (length <= 0) {
    return [];
  }

  const baseDelay = Math.floor(totalDurationMs / length);
  const remainder = Math.max(0, Math.round(totalDurationMs - baseDelay * length));
  const delays = new Array(length).fill(baseDelay);

  for (let i = 0; i < remainder && i < delays.length; i += 1) {
    delays[i] += 1;
  }

  return delays;
}

function clearFieldValue(element) {
  dispatchKeyboardEvent(element, "keydown", "Backspace");
  dispatchBeforeInputEvent(element, "", "deleteContentBackward");

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    const supportsSelectionRange =
      typeof element.selectionStart === "number" && typeof element.selectionEnd === "number";
    if (supportsSelectionRange) {
      try {
        element.setRangeText("", 0, element.value.length, "start");
      } catch {
        element.value = "";
      }
    } else {
      element.value = "";
    }
  } else if (element instanceof HTMLElement && element.isContentEditable) {
    element.textContent = "";
  }

  dispatchInputEvent(element, "", "deleteContentBackward");
  dispatchKeyboardEvent(element, "keyup", "Backspace");
}

function getFieldContentForRecording(element, asHtml) {
  if (element instanceof HTMLElement && element.isContentEditable) {
    return asHtml ? element.innerHTML : getContentEditablePlainText(element);
  }
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value || "";
  }
  return "";
}

function getContentEditablePlainText(element) {
  if (!(element instanceof HTMLElement)) {
    return "";
  }

  // Prefer the browser's visual text extraction because it preserves rendered line breaks.
  const visualText = typeof element.innerText === "string" ? element.innerText : "";
  if (visualText) {
    return normalizePlainTextLineBreaks(visualText);
  }

  // Fallback for editors where innerText can be empty/stale.
  const chunks = [];
  appendNodeTextWithLineBreaks(element, chunks);
  return normalizePlainTextLineBreaks(chunks.join(""));
}

function appendNodeTextWithLineBreaks(node, chunks) {
  if (!node) {
    return;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    chunks.push(node.nodeValue || "");
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return;
  }

  const element = node;
  const tagName = element.tagName ? element.tagName.toLowerCase() : "";
  if (tagName === "br") {
    chunks.push("\n");
    return;
  }

  const isBlockElement = /^(address|article|aside|blockquote|div|dl|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|tr|ul)$/.test(tagName);
  const needsLeadingBreak = isBlockElement && chunks.length > 0 && !chunks[chunks.length - 1].endsWith("\n");
  if (needsLeadingBreak) {
    chunks.push("\n");
  }
  for (const child of element.childNodes) {
    appendNodeTextWithLineBreaks(child, chunks);
  }
  if (isBlockElement && !chunks[chunks.length - 1]?.endsWith("\n")) {
    chunks.push("\n");
  }
}

function normalizePlainTextLineBreaks(value) {
  return (value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function applyHtmlContent(element, html, replace) {
  element.focus();
  if (replace) {
    element.innerHTML = html;
    dispatchInputEvent(element, html, "insertFromPaste");
    return;
  }

  if (document.queryCommandSupported?.("insertHTML")) {
    const ok = document.execCommand("insertHTML", false, html);
    if (ok) {
      dispatchInputEvent(element, html, "insertFromPaste");
      return;
    }
  }

  element.innerHTML = `${element.innerHTML}${html}`;
  dispatchInputEvent(element, html, "insertFromPaste");
}

function getElementProfile(element) {
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  const tag = element.tagName.toLowerCase();
  const type = element instanceof HTMLInputElement ? element.type || "text" : "";
  const name = sanitizeToken(element.getAttribute("name"));
  const placeholder = sanitizeToken(element.getAttribute("placeholder"));
  const ariaLabel = sanitizeToken(element.getAttribute("aria-label"));
  const role = sanitizeToken(element.getAttribute("role"));
  const label = sanitizeToken(getAssociatedLabelText(element));
  const typingTarget = sanitizeToken(element.getAttribute("data-typing-target"));
  const typingScope = sanitizeToken(getTypingScopeValue(element));
  const stableClasses = Array.from(element.classList)
    .filter(isLikelyStableClassName)
    .slice(0, 4)
    .map((value) => sanitizeToken(value));

  return {
    tag,
    type,
    name,
    placeholder,
    ariaLabel,
    role,
    label,
    typingTarget,
    typingScope,
    stableClasses
  };
}

function getTypingScopeValue(element) {
  if (!(element instanceof HTMLElement)) {
    return "";
  }
  const scopeElement = element.closest("[data-typing-scope]");
  return scopeElement?.getAttribute("data-typing-scope") || "";
}

function getAssociatedLabelText(element) {
  if (!(element instanceof HTMLElement)) {
    return "";
  }
  if (element.id) {
    const escapedId = CSS.escape(element.id);
    const explicitLabel = document.querySelector(`label[for="${escapedId}"]`);
    if (explicitLabel?.textContent) {
      return explicitLabel.textContent;
    }
  }
  const wrapperLabel = element.closest("label");
  return wrapperLabel?.textContent || "";
}

function sanitizeToken(value) {
  if (!value) {
    return "";
  }
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function profileSimilarity(current, saved) {
  if (!current || !saved) {
    return 0;
  }

  let score = 0;
  if (current.tag && current.tag === saved.tag) {
    score += 2;
  }
  if (current.type && current.type === saved.type) {
    score += 2;
  }
  if (current.name && current.name === saved.name) {
    score += 4;
  }
  if (current.placeholder && current.placeholder === saved.placeholder) {
    score += 4;
  }
  if (current.ariaLabel && current.ariaLabel === saved.ariaLabel) {
    score += 4;
  }
  if (current.role && current.role === saved.role) {
    score += 2;
  }
  if (current.label && current.label === saved.label) {
    score += 4;
  }
  if (current.typingTarget && current.typingTarget === saved.typingTarget) {
    score += 10;
  }
  if (current.typingScope && current.typingScope === saved.typingScope) {
    score += 6;
  }

  if (Array.isArray(current.stableClasses) && Array.isArray(saved.stableClasses)) {
    const savedClasses = new Set(saved.stableClasses);
    for (const className of current.stableClasses) {
      if (savedClasses.has(className)) {
        score += 1;
      }
    }
  }

  return score;
}
})();
