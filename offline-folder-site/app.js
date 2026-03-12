const pickButton = document.getElementById('pick-folder');
const status = document.getElementById('status');
const fileList = document.getElementById('file-list');
const preview = document.getElementById('preview');

const textExtensions = /\.(txt|md|json|html|css|js|ts|xml|csv|yaml|yml|log|ini|conf)$/i;

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }
}

function isLikelyTextFile(file) {
  if (file.type?.startsWith('text/')) {
    return true;
  }

  if (file.type === 'application/json' || file.type === 'application/xml') {
    return true;
  }

  return textExtensions.test(file.name);
}

async function collectFileHandles(dirHandle, pathPrefix = '') {
  const files = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      files.push({
        handle: entry,
        path: pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name
      });
    }

    if (entry.kind === 'directory') {
      const nestedPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
      files.push(...(await collectFileHandles(entry, nestedPath)));
    }
  }

  return files;
}

async function pickFolder() {
  if (!('showDirectoryPicker' in window)) {
    status.textContent =
      'Your browser does not support folder picking (use Chromium-based browser).';
    return;
  }

  const dirHandle = await window.showDirectoryPicker();
  const fileHandles = await collectFileHandles(dirHandle);

  if (!fileHandles.length) {
    status.textContent = 'No files found in this folder.';
    fileList.innerHTML = '';
    preview.textContent = 'Select a text file to preview it here.';
    return;
  }

  status.textContent = `Loaded ${fileHandles.length} file(s) from "${dirHandle.name}".`;
  renderFileList(fileHandles);

  const firstTextFile = fileHandles.find((entry) => textExtensions.test(entry.path));
  if (firstTextFile) {
    await previewFile(firstTextFile);
  }
}

function renderFileList(files) {
  fileList.innerHTML = '';

  files.sort((a, b) => a.path.localeCompare(b.path));

  for (const fileEntry of files) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'file-button';
    button.textContent = fileEntry.path;
    button.addEventListener('click', () => previewFile(fileEntry));

    li.append(button);
    fileList.append(li);
  }
}

async function previewFile(fileEntry) {
  try {
    const file = await fileEntry.handle.getFile();

    if (!isLikelyTextFile(file)) {
      preview.textContent = `"${fileEntry.path}" is not recognized as a text file.`;
      return;
    }

    const text = await file.text();
    preview.textContent = text.slice(0, 10000) || '(File is empty)';
  } catch (error) {
    preview.textContent = `Could not preview "${fileEntry.path}".`;
    console.error(error);
  }
}

pickButton.addEventListener('click', () => {
  pickFolder().catch((error) => {
    status.textContent = 'Folder access was cancelled or failed.';
    console.error(error);
  });
});

registerServiceWorker();
