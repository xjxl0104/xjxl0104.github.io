import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'os.html', 'dos.html'];

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

test('home is the 3D desk whose monitor runs the YW/OS portfolio', async () => {
  const source = await html('index.html');
  for (const marker of ['id="loader"', 'id="hud"', 'id="gl"', 'CSS3DRenderer', "'os.html?embed'", 'WebGLRenderer', 'prefers-reduced-motion']) {
    assert.ok(source.includes(marker), `home missing marker: ${marker}`);
  }
  assert.match(source, /class="skip" href="os\.html"/, 'keyboard users need a way past the 3D scene');
  for (const file of ['assets/vendor/CSS3DRenderer.js', 'assets/vendor/RoomEnvironment.js']) {
    const addon = await readFile(path.join(root, file), 'utf8');
    assert.match(addon, /from '\.\/three\.module\.min\.js'/, `${file} must import the vendored three.js`);
  }
});

test('YW/OS portfolio has every page and real content, without borrowed branding', async () => {
  const source = await html('os.html');
  for (const page of ['home', 'about', 'experience', 'projects', 'contact']) assert.match(source, new RegExp(`data-page="${page}"`), `missing page ${page}`);
  for (const sub of ['heritage', 'systems', 'papers', 'art', 'early']) assert.match(source, new RegExp(`data-sub="${sub}"`), `missing project ${sub}`);
  for (const text of ['HeritageExplorer', 'VINCI 2025', 'CHI 2025', 'DIPARK', 'ywang677@connect.hkust-gz.edu.cn', 'CV_Yusong_Wang.pdf', 'dos.html']) {
    assert.ok(source.includes(text), `missing real content: ${text}`);
  }
  assert.match(source, /Henry Heffernan/, 'credits must acknowledge the inspiration');
  assert.doesNotMatch(source, /\bWindows\b|Microsoft(?! YaHei)/, 'no third-party OS branding (a YaHei font fallback is fine)');
});

test('YSDOS archive keeps all nine files', async () => {
  const source = await html('dos.html');
  assert.ok(source.includes('YSDOS'), 'dos.html must be the retro archive');
  const sections = ['about', 'heritage', 'work', 'portfolio', 'exp', 'toolbox', 'contact', 'cv', 'door'];
  for (const id of sections) {
    assert.equal(source.match(new RegExp(`<section class="doc" id="s-${id}"`, 'g'))?.length, 1, `missing file ${id}`);
    assert.match(source, new RegExp(`data-sec="${id}"`), `menu misses ${id}`);
  }
  for (const target of ['index.html', 'os.html', 'CV_Yusong_Wang.pdf']) {
    assert.match(source, new RegExp(`href=["']${target.replace('.', '\\.')}["']`), `archive must link to ${target}`);
  }
  for (const text of ['HeritageExplorer', 'VINCI 2025', 'CHI 2025', 'DIPARK', 'ywang677@connect.hkust-gz.edu.cn']) {
    assert.ok(source.includes(text), `missing real content: ${text}`);
  }
  assert.match(source, /url\(["']assets\/retro\/fusion-pixel-12-subset\.woff2["']\)/, 'pixel font must be self-hosted');
  await assert.doesNotReject(readFile(path.join(root, 'assets/retro/OFL-fusion-pixel.txt')), 'font licence must ship with the font');
  assert.match(source, /id=["']btnLang["']/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /<noscript>/);
  assert.match(source, /@media\s*\(max-width:/);
});

test('retired standalone versions are absent from the published tree', async () => {
  for (const file of ['classic.html', 'pixel-room.html', 'worlds.html', 'ukiyoe.html', 'retro-future.html']) {
    await assert.rejects(readFile(path.join(root, file)), { code: 'ENOENT' }, `${file} must stay off the live site`);
  }
});

test('portfolio and DOS navigation expose only the current desk', async () => {
  for (const page of pages) {
    const source = await html(page);
    for (const target of localLinks(source).filter((link) => link.endsWith('.html'))) {
      assert.ok(pages.includes(target), `${page} exposes a retired route: ${target}`);
    }
    assert.doesNotMatch(source, /(?:worlds|ukiyoe|retro-future|classic|pixel-room)\.html/, `${page} still contains an alternate navigation handler`);
  }
  const os = await html('os.html');
  assert.doesNotMatch(os, /data-open=["']views["']|views:function/, 'the other-versions launcher must be removed, including the start menu');
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
