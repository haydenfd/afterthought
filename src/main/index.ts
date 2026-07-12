import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';

import { createEntryStorage } from './entry-storage';
import { createJournalService } from './journal-service';
import { loadEnvFile } from './load-env';
import { createMemoryService } from './memory-service';
import { generateOpeningQuestions } from './opening-questions';
import { createOpeningQuestionsStorage } from './opening-questions-storage';
import { createPreferencesStorage } from './preferences-storage';
import { createSupermemoryClient } from './supermemory-client';
import { createJournalMemoryIngestor } from './supermemory-ingestion';

loadEnvFile();

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
  const preferencesStorage = createPreferencesStorage(
    join(app.getPath('userData'), 'preferences.json'),
  );
  const openingQuestionsStorage = createOpeningQuestionsStorage(
    join(app.getPath('userData'), 'opening-questions.json'),
  );
  const supermemoryClient = createSupermemoryClient();
  const memory = createMemoryService(supermemoryClient);
  const journal = createJournalService(
    entryStorage,
    createJournalMemoryIngestor(supermemoryClient, preferencesStorage),
  );

  ipcMain.handle('supermemory:check-connection', (_event, url: unknown) =>
    checkSupermemoryConnection(url),
  );
  ipcMain.handle('entries:create', async (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid journal entry.');
    }

    const { prompt, content, title } = input as Record<string, unknown>;
    const entry = await journal.createEntry({
      prompt: typeof prompt === 'string' ? prompt : '',
      content: typeof content === 'string' ? content : '',
      ...(typeof title === 'string' ? { title } : {}),
    });
    await openingQuestionsStorage.clear();
    return entry;
  });
  ipcMain.handle('entries:get', (_event, id: unknown) =>
    entryStorage.getEntry(typeof id === 'string' ? id : ''),
  );
  ipcMain.handle('entries:list', () => entryStorage.listEntries());
  ipcMain.handle('memory:refresh', () => memory.refresh());
  ipcMain.handle('preferences:get', () => preferencesStorage.getPreferences());
  ipcMain.handle('preferences:set', (_event, update: unknown) => {
    if (!update || typeof update !== 'object') {
      throw new Error('Invalid preferences update.');
    }

    const { userName, appearance, supermemoryUrl } = update as Record<string, unknown>;
    return preferencesStorage.setPreferences({
      ...(typeof userName === 'string' ? { userName } : {}),
      ...(appearance === 'light' || appearance === 'dark' || appearance === 'system'
        ? { appearance }
        : {}),
      ...(typeof supermemoryUrl === 'string' ? { supermemoryUrl } : {}),
    });
  });
  ipcMain.handle('reflection:opening-questions', async () => {
    const cached = await openingQuestionsStorage.get();
    if (cached) {
      return { primaryQuestion: cached.primaryQuestion, source: 'ai' as const };
    }

    const bundle = await generateOpeningQuestions(
      entryStorage,
      supermemoryClient,
      preferencesStorage,
    );

    if (!bundle) {
      return { primaryQuestion: null, source: 'fallback' as const };
    }

    await openingQuestionsStorage.set(bundle);
    return { primaryQuestion: bundle.primaryQuestion, source: 'ai' as const };
  });
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
