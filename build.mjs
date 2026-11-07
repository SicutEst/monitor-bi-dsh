/**
 * Build monitor-bi-dsh:
 *   lib/index.js  — host bundle (ESM, @deepseek-ai/* and node:* kept external)
 *   lib/client.js — browser bundle wrapped for window.__ModuleLoader__ (CJS,
 *                   react / @deepseek-ai/* kept external)
 */
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, 'lib');
mkdirSync(outDir, { recursive: true });

// ---------- host ----------
await esbuild.build({
  entryPoints: [join(root, 'src/host/index.js')],
  outfile: join(outDir, 'index.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['@deepseek-ai/*', 'node:*'],
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
  banner: {
    js: [
      'import { createRequire as __cr } from "node:module";',
      'import { fileURLToPath as __fu } from "node:url";',
      'import { dirname as __dn } from "node:path";',
      'const __filename = __fu(import.meta.url);',
      'const __dirname = __dn(__filename);',
      'const require = __cr(import.meta.url);',
    ].join('\n'),
  },
});

// ---------- client ----------
const pkgVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const loaderBanner = [
  'window.__ModuleLoader__.load({',
  `\tid: "${'monitor-bi-dsh'}",`,
  '\tfactory: (require) => {',
  '\t\tvar module = { exports: {} };',
  '\t\tvar exports = module.exports;',
  '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
].join('\n');
const loaderFooter = ['\t\treturn module.exports;', '\t}', '});'].join('\n');

await esbuild.build({
  entryPoints: [join(root, 'src/client/index.jsx')],
  outfile: join(outDir, 'client.js'),
  bundle: true,
  platform: 'browser',
  format: 'cjs',
  target: 'chrome120',
  jsx: 'automatic',
  jsxImportSource: 'react',
  loader: { '.css': 'text' },
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/*'],
  sourcemap: false,
  legalComments: 'none',
  logLevel: 'info',
  define: { __APP_VERSION__: JSON.stringify(pkgVersion) },
  banner: { js: loaderBanner },
  footer: { js: loaderFooter },
});

console.log(`host   ${statSync(join(outDir, 'index.js')).size / 1024 | 0} KB`);
console.log(`client ${statSync(join(outDir, 'client.js')).size / 1024 | 0} KB`);
