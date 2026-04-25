chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "record_snippet" && command !== "play_snippet") {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }

  const type = command === "record_snippet" ? "OPEN_RECORDER" : "PLAY_SNIPPET";
  await sendWithAutoInject(tab.id, type, tab.url || "");
});

async function sendWithAutoInject(tabId, type, url) {
  try {
    await chrome.tabs.sendMessage(tabId, { type });
    return;
  } catch (error) {
    const msg = String(error?.message || error);
    const noReceiver = msg.includes("Receiving end does not exist");
    if (!noReceiver) {
      throw error;
    }
  }

  if (isRestrictedUrl(url)) {
    console.warn("Vellum: cannot inject on restricted page", url);
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    await chrome.tabs.sendMessage(tabId, { type });
  } catch (error) {
    console.warn("Vellum: failed to inject/send message", error);
  }
}

function isRestrictedUrl(url) {
  return /^(chrome|edge|brave|opera):\/\//.test(url) || url.startsWith("chrome.google.com/webstore");
}
