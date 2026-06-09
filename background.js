chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-form') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    });
  } catch (err) {
    console.error('InstaForm: inject failed', err.message);
  }
});
