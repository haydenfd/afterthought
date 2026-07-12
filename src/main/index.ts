import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';

import { createEntryStorage } from './entry-storage';
import { createJournalService } from './journal-service';
import { createMemoryService } from './memory-service';
import { createSupermemoryClient } from './supermemory-client';
import { createJournalMemoryIngestor } from './supermemory-ingestion';

app.setName('Afterthought');

const isDevelopment = !app.isPackaged;

interface SupermemoryConnectionResult {
  status: 'connected' | 'offline';
  url: string;
  message?: string;
}

async function checkSupermemoryConnection(
  value: unknown,
): Promise<SupermemoryConnectionResult> {
  if (typeof value !== 'string') {
    return {
      status: 'offline',
      url: '',
      message: 'Invalid local URL',
    };
  }

  const url = value.trim().replace(/\/+$/, '');

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new TypeError('Unsupported protocol');
    }
  } catch {
    return {
      status: 'offline',
      url: value,
      message: 'Enter a valid http:// or https:// local URL.',
    };
  }

  try {
    await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(1_500),
    });

    return { status: 'connected', url };
  } catch {
    return {
      status: 'offline',
      url,
      message: 'Could not reach Supermemory Local at this address.',
    };
  }
}

function createMainWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: 'Afterthought',
    backgroundColor: '#f4efe7',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDevelopment && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  const entryStorage = createEntryStorage(join(app.getPath('userData'), 'entries'));
  const supermemoryClient = createSupermemoryClient();
  const memory = createMemoryService(supermemoryClient);
  const journal = createJournalService(
    entryStorage,
    createJournalMemoryIngestor(supermemoryClient),
  );

  ipcMain.handle('supermemory:check-connection', (_event, url: unknown) =>
    checkSupermemoryConnection(url),
  );
  ipcMain.handle('entries:create', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid journal entry.');
    }

    const { prompt, content, title } = input as Record<string, unknown>;
    return journal.createEntry({
      prompt: typeof prompt === 'string' ? prompt : '',
      content: typeof content === 'string' ? content : '',
      ...(typeof title === 'string' ? { title } : {}),
    });
  });
  ipcMain.handle('entries:get', (_event, id: unknown) =>
    entryStorage.getEntry(typeof id === 'string' ? id : ''),
  );
  ipcMain.handle('entries:list', () => entryStorage.listEntries());
  ipcMain.handle('memory:refresh', () => memory.refresh());
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
