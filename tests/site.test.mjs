import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'ukiyoe.html', 'retro-future.html'];

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

test('portal contains exactly two interactive scene experiences', async () => {
  const source = await html('index.html');
  for (const target of ['ukiyoe.html', 'retro-future.html']) {
    assert.match(source, new RegExp(`href=["']${target.replace('.', '\\.')}(?:[?#][^"']*)?["']`), `missing ${target}`);
  }
  assert.match(source, /id=["']version-grid["']/);
  assert.match(source, /02\s*<small>WORLDS/);
  assert.match(source, /prefers-reduced-motion/);
});

test('classic, pixel and document-style retro versions are removed', async () => {
  for (const file of ['classic.html', 'pixel-room.html']) {
    await assert.rejects(readFile(path.join(root, file)), `${file} should be deleted`);
  }
  for (const page of pages) {
    const source = await html(page);
    assert.doesNotMatch(source, /(?:classic|pixel-room)\.html/, `${page} still links to a removed version`);
  }
  const retro = await html('retro-future.html');
  assert.doesNotMatch(retro, /Personal Orbit Program|orbitctl/);
});

test('both retained homepages use the interactive WebGL scene architecture', async () => {
  for (const page of pages.slice(1)) {
    const source = await html(page);
    for (const marker of ['id="gl"', 'id="stage"', 'id="panel"', 'id="reader"', 'type="module"', 'WebGLRenderer', 'function register(', 'function openSection(', 'function setReader(']) {
      assert.ok(source.includes(marker), `${page} missing scene marker: ${marker}`);
    }
    assert.match(source, /href=["'](?:\.\/)?index\.html["']/, `${page} cannot return to portal`);
    assert.match(source, /prefers-reduced-motion/);
  }
});

test('retro-future scene has futuristic objects and real portfolio content', async () => {
  const source = await html('retro-future.html');
  for (const marker of ['HABITAT 86', 'CRT', 'rocket', 'hologram', 'communicator', 'orbital', "register('about'", "register('heritage'", "register('contact'"]) {
    assert.ok(source.includes(marker), `missing futuristic scene detail: ${marker}`);
  }
  for (const text of ['HeritageExplorer', 'VINCI 2025', 'CHI 2025', '15', 'ywang677@connect.hkust-gz.edu.cn']) {
    assert.ok(source.includes(text), `missing real content: ${text}`);
  }
  assert.match(source, /id=["']btnLang["']/);
  assert.match(source, /id=["']btnMode["']/);
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
