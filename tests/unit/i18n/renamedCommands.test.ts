jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const updateMany = jest.fn();
jest.mock('../../../src/models/CommandConfig', () => ({
  CommandConfigModel: { updateMany: (...args: unknown[]) => updateMany(...args) },
}));

import run, { RENAMED_COMMANDS } from '../../../src/events/clientReady/renamedCommandsMigration';
import * as fs from 'fs';
import * as path from 'path';

describe('renamed commands migration', () => {
  beforeEach(() => updateMany.mockReset().mockResolvedValue({ modifiedCount: 0 }));

  it('moves every disabled old command name to its new English name', async () => {
    await run();
    expect(updateMany).toHaveBeenCalledTimes(Object.keys(RENAMED_COMMANDS).length);
    expect(updateMany).toHaveBeenCalledWith({ disabledCommands: 'wisielec' }, { $set: { 'disabledCommands.$': 'hangman' } });
  });

  it('never throws when the database fails', async () => {
    updateMany.mockRejectedValue(new Error('db down'));
    await expect(run()).resolves.toBeUndefined();
  });

  it('no command file still registers an old Polish name', () => {
    const root = path.join(__dirname, '../../../src/commands');
    const files: string[] = [];
    const walk = (dir: string) =>
      fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : files.push(path.join(dir, e.name))));
    walk(root);
    const source = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const oldName of Object.keys(RENAMED_COMMANDS)) {
      expect(source).not.toContain(`.setName('${oldName}')`);
    }
  });
});
