import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export class NewsStore {
  constructor(directory) {
    this.directory = directory;
    this.file = join(directory, 'news.json');
    this.mediaDirectory = join(directory, 'media');
    this.items = [];
    this.queue = Promise.resolve();
  }

  async init() {
    await mkdir(this.mediaDirectory, { recursive: true, mode: 0o700 });
    try {
      const items = JSON.parse(await readFile(this.file, 'utf8'));
      if (!Array.isArray(items)) throw new Error('Formato de noticias inválido.');
      this.items = items;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  list() {
    return [...this.items].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }

  published() {
    return this.list().filter((item) => item.status === 'published');
  }

  async mutate(callback) {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.items);
      const result = callback(next);
      const temporary = join(this.directory, `.news-${randomUUID()}.tmp`);
      try {
        await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
        await rename(temporary, this.file);
      } catch (error) {
        const { unlink } = await import('node:fs/promises');
        await unlink(temporary).catch(() => {});
        throw error;
      }
      this.items = next;
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
