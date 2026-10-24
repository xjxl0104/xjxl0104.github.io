import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'ukiyoe.html', 'retro-future.html', 'classic.html', 'pixel-room.html'];

async function html(file) {
  return readFile(path.join(root, file), 'utf8');
}

function localLinks(source) {
  return [...source.matchAll(/(?:href|src)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((url) => !/^(?:[a-z]+:|#|\/\/|data:|blob:)/i.test(url))
    .map((url) => decodeURIComponent(url.split(/[?#]/)[0]))
    .filter(Boolean);
}

test('version portal links to all four preserved experiences', async () => {
  const source = await html('index.html');
  for (const target of ['ukiyoe.html', 'retro-future.html', 'classic.html', 'pixel-room.html']) {
    assert.match(source, new RegExp(`href=["']${target.replace('.', '\\.')}(?:[?#][^"']*)?["']`), `missing ${target}`);
  }
  assert.match(source, /id=["']version-grid["']/);
  assert.match(source, /prefers-reduced-motion/);
});

test('every experience has a route back to the version portal', async () => {
  for (const page of pages.slice(1)) {
    const source = await html(page);
    assert.match(source, /href=["'](?:\.\/)?index\.html["']/, `${page} cannot return to portal`);
  }
});

test('retro-future page exposes real portfolio content and accessible controls', async () => {
  const source = await html('retro-future.html');
  for (const id of ['top', 'heritage', 'work', 'portfolio', 'toolbox', 'contact']) {
    assert.match(source, new RegExp(`id=["']${id}["']`), `missing #${id}`);
  }
  for (const text of ['HeritageExplorer', 'VINCI 2025', 'CHI 2025', '15', 'ywang677@connect.hkust-gz.edu.cn']) {
    assert.ok(source.includes(text), `missing real content: ${text}`);
  }
  assert.match(source, /id=["']langBtn["']/);
  assert.match(source, /aria-label=/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /@media\s*\(max-width:/);
});

test('all local HTML and asset references resolve', async () => {
  for (const page of pages) {
    const source = await html(page);
    for (const link of localLinks(source)) {
      if (link.endsWith('.html') || link.startsWith('assets/') || /^CV_Yusong_Wang\.(?:pdf|docx)$/.test(link)) {
        await assert.doesNotReject(readFile(path.join(root, link)), `${page} has broken reference: ${link}`);
      }
    }
  }
});

test('interactive documents declare language, viewport and a useful title', async () => {
  for (const page of pages) {
    const source = await html(page);
    assert.match(source, /<html\s+lang=["']zh-CN["']/, `${page} missing language`);
    assert.match(source, /name=["']viewport["']/, `${page} missing viewport`);
    assert.match(source, /<title>[^<]*Yusong Wang[^<]*<\/title>/, `${page} missing identity in title`);
  }
});
