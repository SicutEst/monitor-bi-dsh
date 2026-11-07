// 更新核心:下载 tgz → 解 tar → 覆盖插件自身文件。全程进程内,无子进程。
// 放独立模块以便脱离 DSH 依赖做单元测试。
import { gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** 解析 tar buffer(ustar/gnu,支持 PAX 长名),返回文件条目 */
export function parseTar(buf) {
  const entries = [];
  let off = 0;
  let paxPath = null;
  while (off + 512 <= buf.length) {
    const block = buf.subarray(off, off + 512);
    if (block.every((b) => b === 0)) break; // 结束块
    const name = block.toString('utf8', 0, 100).replace(/\0[\s\S]*$/, '').trim();
    const size = parseInt(block.toString('utf8', 124, 136).replace(/[\0\s]+$/, ''), 8) || 0;
    const type = String.fromCharCode(block[156] || 48);
    const prefix = block.toString('utf8', 345, 500).replace(/\0[\s\S]*$/, '').trim();
    off += 512;
    const data = size > 0 ? buf.subarray(off, off + size) : buf.subarray(0, 0);
    off += Math.ceil(size / 512) * 512;
    if (type === 'x' || type === 'g') {
      const pax = data.toString('utf8');
      const m = pax.match(/\d+ path=([^\n]+)/);
      if (m && type === 'x') paxPath = m[1].trim();
      continue;
    }
    if (type === '0' || type === '\0') {
      const finalPath = (paxPath || (prefix ? prefix + '/' + name : name)).replace(/\/+$/, '');
      paxPath = null;
      if (finalPath) entries.push({ path: finalPath, data });
    } else {
      paxPath = null; // 目录/链接等不落盘
    }
  }
  return entries;
}

/** 把 tgz 内容覆盖写入 pluginRoot(tar 内 package/ 前缀剥离,防路径穿越)。返回写入文件数 */
export function applyUpdate(tgzBuf, pluginRoot) {
  const tar = gunzipSync(tgzBuf);
  const entries = parseTar(tar);
  let files = 0;
  for (const e of entries) {
    const rel = e.path.replace(/^package\//, '');
    if (!rel || rel.includes('..') || path.isAbsolute(rel)) continue;
    const full = path.join(pluginRoot, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, e.data);
    files++;
  }
  return files;
}
