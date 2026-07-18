import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron';
import { join } from 'node:path';

import type { SupermemoryConnectionResult } from '../shared/supermemory';
import type { DeeperReflection } from '../shared/journal-entry';
import type {
  DeeperQuestionInput,
  MemoryEvidenceItem,
  OpeningQuestions,
} from '../shared/reflection';
import { generateDeeperQuestion } from './deeper-reflection';
import { createEntryStorage } from './entry-storage';
import { configureGroqApiKey, validateGroqApiKey } from './groq-client';
import { createGroqApiKeyStorage } from './groq-key-storage';
import { createJournalService } from './journal-service';
import { createMemoryService } from './memory-service';
import { createMemoryIngestionStorage } from './memory-ingestion-storage';
import { generateOpeningQuestions } from './opening-questions';
import { createOpeningQuestionsStorage } from './opening-questions-storage';
import { createPreferencesStorage } from './preferences-storage';
import { createSupermemoryClient, resolveSupermemoryUrl } from './supermemory-client';
import { createJournalMemoryIngestor } from './supermemory-ingestion';
import { generateTemporalMirror } from './temporal-mirror';

app.setName('Afterthought');

const isDevelopment = !app.isPackaged;

// Tracks the app-boot attempt to reach (and if needed, auto-start) Supermemory
// Local, so the Settings status can show "starting" instead of a flat
// "offline" while a first-run install is still downloading in the background.
let supermemoryStartupState: 'starting' | 'ready' | 'failed' = 'starting';
let supermemoryStartupUrl = '';

function getWindowIconPath(): string | undefined {
  if (process.platform === 'darwin') {
    return undefined;
  }

  return isDevelopment
    ? join(__dirname, '../../resources/icon.png')
    : join(process.resourcesPath, 'icon.png');
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

  if (supermemoryStartupState === 'starting' && url === supermemoryStartupUrl) {
    return {
      status: 'starting',
      url,
      message: 'Starting Supermemory Local — this can take a minute on first run.',
    };
  }

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
  const windowIconPath = getWindowIconPath();
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 640,
    title: 'Afterthought',
    backgroundColor: '#f4efe7',
    ...(windowIconPath ? { icon: windowIconPath } : {}),
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

void app.whenReady().then(async () => {
  const entryStorage = createEntryStorage(join(app.getPath('userData'), 'entries'));
  const preferencesStorage = createPreferencesStorage(
    join(app.getPath('userData'), 'preferences.json'),
  );
  const groqApiKeyStorage = createGroqApiKeyStorage(
    join(app.getPath('userData'), 'groq-api-key.json'),
    {
      isAvailable: () => safeStorage.isEncryptionAvailable(),
      encryptString: (value) => safeStorage.encryptString(value),
      decryptString: (value) => safeStorage.decryptString(value),
    },
  );
  configureGroqApiKey(await groqApiKeyStorage.getApiKey());
  const storedPreferences = await preferencesStorage.getPreferences();
  const preferences = storedPreferences.installedAt
    ? storedPreferences
    : await preferencesStorage.setPreferences({
        installedAt: new Date().toISOString(),
      });
  const openingQuestionsStorage = createOpeningQuestionsStorage(
    join(app.getPath('userData'), 'opening-questions.json'),
  );
  const resolvedSupermemoryUrl = resolveSupermemoryUrl(preferences);
  supermemoryStartupUrl = resolvedSupermemoryUrl.trim().replace(/\/+$/, '');
  const supermemoryClient = createSupermemoryClient(resolvedSupermemoryUrl);
  supermemoryClient.then(
    () => {
      supermemoryStartupState = 'ready';
    },
    (error: unknown) => {
      supermemoryStartupState = 'failed';
      console.error('[supermemory] local server did not start', error);
    },
  );
  const memoryIngestion = createJournalMemoryIngestor(
    supermemoryClient,
    preferencesStorage,
    {
      entryStorage,
      stateStorage: createMemoryIngestionStorage(
        join(app.getPath('userData'), 'memory-ingestion.json'),
      ),
    },
  );
  const memory = createMemoryService(supermemoryClient, memoryIngestion);
  const journal = createJournalService(entryStorage, memoryIngestion);
  void memoryIngestion.start?.();

  ipcMain.handle('supermemory:check-connection', (_event, url: unknown) =>
    checkSupermemoryConnection(url),
  );
  ipcMain.handle('entries:create', async (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid journal entry.');
    }

    const {
      prompt,
      content,
      title,
      openingQuestions,
      openingContext,
      deeperReflection,
      themes,
    } = input as Record<string, unknown>;
    const parsedOpeningContext = parseMemoryEvidenceItems(openingContext);
    const entry = await journal.createEntry({
      prompt: typeof prompt === 'string' ? prompt : '',
      content: typeof content === 'string' ? content : '',
      ...(typeof title === 'string' ? { title } : {}),
      ...(isOpeningQuestions(openingQuestions) ? { openingQuestions } : {}),
      ...(parsedOpeningContext.length > 0
        ? { openingContext: parsedOpeningContext }
        : {}),
      ...(isDeeperReflection(deeperReflection) ? { deeperReflection } : {}),
      ...(Array.isArray(themes)
        ? {
            themes: themes.filter(
              (theme): theme is string => typeof theme === 'string',
            ),
          }
        : {}),
    });
    await openingQuestionsStorage.clear();
    return entry;
  });
  ipcMain.handle('entries:get', (_event, id: unknown) =>
    entryStorage.getEntry(typeof id === 'string' ? id : ''),
  );
  ipcMain.handle('entries:list', () => entryStorage.listEntries());
  ipcMain.handle('memory:refresh', () => memory.refresh());
  ipcMain.handle('memory:retry-ingestion', () => memoryIngestion.retryFailed?.());
  ipcMain.handle('groq:get-status', () => groqApiKeyStorage.getStatus());
  ipcMain.handle('groq:validate-api-key', async (_event, value: unknown) => {
    const apiKey =
      typeof value === 'string' && value.trim()
        ? value.trim()
        : await groqApiKeyStorage.getApiKey();
    const currentStatus = await groqApiKeyStorage.getStatus();

    if (!apiKey) {
      return {
        ...currentStatus,
        valid: false,
        message: 'Paste a Groq API key before continuing.',
      };
    }

    const validation = await validateGroqApiKey(apiKey);
    return {
      ...currentStatus,
      valid: validation.valid,
      ...(validation.message ? { message: validation.message } : {}),
    };
  });
  ipcMain.handle('groq:set-api-key', async (_event, value: unknown) => {
    if (typeof value !== 'string') {
      throw new Error('Invalid Groq API key.');
    }

    const validation = await validateGroqApiKey(value);
    if (!validation.valid) {
      throw new Error(validation.message ?? 'The Groq API key could not be validated.');
    }

    const status = await groqApiKeyStorage.setApiKey(value);
    configureGroqApiKey(value);
    return { ...status, valid: true };
  });
  ipcMain.handle('groq:clear-api-key', async () => {
    const status = await groqApiKeyStorage.clearApiKey();
    configureGroqApiKey(null);
    return { ...status, valid: false };
  });
  ipcMain.handle('preferences:get', () => preferencesStorage.getPreferences());
  ipcMain.handle('preferences:set', (_event, update: unknown) => {
    if (!update || typeof update !== 'object') {
      throw new Error('Invalid preferences update.');
    }

    const { onboardingCompletedAt, userName, appearance, supermemoryUrl } =
      update as Record<string, unknown>;
    return preferencesStorage.setPreferences({
      ...(typeof onboardingCompletedAt === 'string' ? { onboardingCompletedAt } : {}),
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
      return {
        questions: cached.questions,
        source: 'ai' as const,
        ...(cached.sourceMemories?.length
          ? { sourceMemories: cached.sourceMemories }
          : {}),
      };
    }

    const bundle = await generateOpeningQuestions(
      entryStorage,
      supermemoryClient,
      preferencesStorage,
    );

    if (!bundle) {
      return { questions: null, source: 'fallback' as const };
    }

    await openingQuestionsStorage.set(bundle);
    return {
      questions: bundle.questions,
      source: 'ai' as const,
      ...(bundle.sourceMemories?.length
        ? { sourceMemories: bundle.sourceMemories }
        : {}),
    };
  });
  ipcMain.handle('reflection:deeper-question', (_event, input: unknown) => {
    if (!input || typeof input !== 'object') {
      throw new Error('Invalid reflection.');
    }

    const { openingQuestions, initialResponse } = input as Record<string, unknown>;
    if (!isOpeningQuestions(openingQuestions) || typeof initialResponse !== 'string') {
      throw new Error('Invalid reflection.');
    }

    const deeperInput: DeeperQuestionInput = {
      openingQuestions,
      initialResponse,
    };
    return generateDeeperQuestion(entryStorage, supermemoryClient, deeperInput);
  });
  ipcMain.handle('reflection:temporal-mirror', async (_event, input: unknown) => {
    if (typeof input !== 'string') {
      throw new Error('Ask a question about your journal.');
    }

    const entries = await entryStorage.listEntries().catch(() => []);
    return generateTemporalMirror(supermemoryClient, input, entries);
  });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

function isOpeningQuestions(value: unknown): value is OpeningQuestions {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (question) => typeof question === 'string' && question.trim().length > 0,
    )
  );
}

function isDeeperReflection(value: unknown): value is DeeperReflection {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).question === 'string'
  );
}

function parseMemoryEvidenceItems(value: unknown): MemoryEvidenceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const memories: MemoryEvidenceItem[] = [];
  for (const candidate of value) {
    const memory = parseMemoryEvidenceItem(candidate);
    if (memory) {
      memories.push(memory);
    }
  }

  return memories;
}

function parseMemoryEvidenceItem(value: unknown): MemoryEvidenceItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  const similarity =
    typeof record.similarity === 'number' && Number.isFinite(record.similarity)
      ? record.similarity
      : NaN;
  if (!id || !text || !Number.isFinite(similarity)) {
    return null;
  }

  const sourceDate =
    typeof record.sourceDate === 'string' && record.sourceDate.trim()
      ? record.sourceDate.trim()
      : undefined;

  return {
    id,
    text,
    similarity,
    ...(sourceDate === undefined ? {} : { sourceDate }),
    sourceDocumentIds: stringArray(record.sourceDocumentIds),
    sourceEntryIds: stringArray(record.sourceEntryIds),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
