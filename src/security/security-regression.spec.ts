import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function collectTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.ts') && !fullPath.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

describe('Security Regression Guards', () => {
  const srcRoot = resolve(__dirname, '..');
  const sourceFiles = collectTypeScriptFiles(srcRoot);

  it('does not construct guest access token URLs anywhere in source', () => {
    const forbiddenPatterns = [/guestAccessToken=/, /accessToken=/];

    for (const file of sourceFiles) {
      const contents = readFileSync(file, 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(contents).not.toMatch(pattern);
      }
    }
  });

  it('does not leave UUID-backed params unvalidated in controllers', () => {
    const controllerFiles = sourceFiles.filter((file) =>
      file.endsWith('.controller.ts'),
    );
    const unvalidatedParamPattern =
      /@Param\('(id|itemId|productId|tagId|conversationId)'\)(?!\s*,\s*ParseUUIDPipe)/;

    for (const file of controllerFiles) {
      const contents = readFileSync(file, 'utf8');
      expect(contents).not.toMatch(unvalidatedParamPattern);
    }
  });
});
