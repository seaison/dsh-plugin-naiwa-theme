import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root));
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.name, 'dsh-plugin-naiwa-theme');
assert.match(pkg.version, /^\d+\.\d+\.\d+$/, 'A formal release must use a stable version.');
assert.equal(pkg.main, 'lib/index.js');
assert.equal(pkg.repository.url, 'git+https://github.com/seaison/dsh-plugin-naiwa-theme.git');
assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'This package has no runtime npm dependencies.');

// Inspect npm's actual allowlist without recursively invoking prepack.
const npmArgs = ['pack', '--dry-run', '--ignore-scripts', '--json'];
const output = execFileSync(process.env.npm_execpath ? process.execPath : 'npm', process.env.npm_execpath ? [process.env.npm_execpath, ...npmArgs] : npmArgs, {
  cwd: fileURLToPath(root), encoding: 'utf8',
  env: { ...process.env, npm_config_cache: fileURLToPath(new URL('.cache/npm/', root)) }
});
const [{ files }] = JSON.parse(output);
const paths = new Set(files.map(file => file.path));
const allowed = /^(?:package\.json|README\.md|CHANGELOG\.md|NOTICE\.md|LICENSE|cordis\.patch\.yml|lib\/(?:index\.js|balance\.mjs|client\.js|manifest\.json)|assets\/[a-z0-9-]+\.(?:png|json)|wallpapers\/(?:[a-z0-9-]+\.(?:png|json)|README\.md)|media\/(?:[a-z0-9-]+\.(?:png|jpg|gif|mp4|mp3|m4a|json)|README\.md))$/;
for (const file of files) {
  assert(allowed.test(file.path), `Unexpected publish path: ${file.path}`);
  assert(file.size < 50 * 1024 * 1024, `Oversized file: ${file.path}`);
  assert.equal(file.mode & 0o111, 0, `Unexpected executable file: ${file.path}`);
  if (/\.(?:json|js|mjs|md|yml)$/.test(file.path)) {
    const text = read(file.path).toString('utf8');
    assert(!/(?:\/Users\/|\/home\/|[A-Z]:\\Users\\)/.test(text), `Machine-specific path: ${file.path}`);
    assert(!/(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(text), `Credential-like content: ${file.path}`);
    assert(text.endsWith('\n'), `Missing final newline: ${file.path}`);
  }
}
for (const path of ['package.json', 'README.md', 'CHANGELOG.md', 'NOTICE.md', 'LICENSE', 'cordis.patch.yml', 'lib/index.js', 'lib/balance.mjs', 'lib/client.js', 'lib/manifest.json', 'assets/focus-prompts.json', 'media/reactions.json']) assert(paths.has(path), `Missing release file: ${path}`);

const manifest = JSON.parse(read('lib/manifest.json'));
const assetNames = new Set();
for (const asset of manifest) {
  assert(!assetNames.has(asset.file), `Duplicate asset route: ${asset.file}`);
  assetNames.add(asset.file);
  const path = `${asset.folder}/${asset.file}`, data = read(path);
  assert(paths.has(path), `Unpacked runtime asset: ${path}`);
  assert.equal(data.length, asset.bytes, `Stale asset length: ${path}`);
  assert.equal(createHash('sha256').update(data).digest('hex'), asset.sha256, `Stale asset hash: ${path}`);
}
assert(read('lib/client.js').toString().includes('window.__ModuleLoader__.load('));
console.log(`Release ${pkg.version}: ${files.length} allowlisted files, ${manifest.length} verified assets, no local paths or credential patterns.`);
