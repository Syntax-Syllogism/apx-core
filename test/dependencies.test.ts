import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

// apx-core must stay usable outside the sf CLI (boundary rule 1), so the
// CLI framework and terminal-prompt packages may never become dependencies,
// and no source file may import them.
const FORBIDDEN = /^@oclif\/|sf-plugins-core|^@inquirer\//;
const SPECIFIER = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)['"]([^'"]+)['"]/g;

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? sourceFiles(join(dir, entry.name)) : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : []
  );

describe('dependency boundary', () => {
  it('has no CLI framework or prompt dependencies', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as PackageJson;
    const names = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ];
    expect(names.filter((name) => FORBIDDEN.test(name))).to.deep.equal([]);
  });

  it('imports no CLI framework or prompt packages from src', () => {
    const offenders = sourceFiles(fileURLToPath(new URL('../src', import.meta.url))).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(SPECIFIER)]
        .map((match) => match[1])
        .filter((specifier) => FORBIDDEN.test(specifier))
        .map((specifier) => `${file}: ${specifier}`)
    );
    expect(offenders).to.deep.equal([]);
  });
});
