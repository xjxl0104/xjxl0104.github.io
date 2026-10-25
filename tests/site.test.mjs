import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = ['index.html', 'os.html', 'dos.html', 'worlds.html', 'ukiyoe.html', 'retro-future.html'];
const scenes = ['ukiyoe.html', 'retro-future.html'];

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
  for (const target of ['index.html', 'os.html', 'worlds.html', 'ukiyoe.html', 'retro-future.html', 'CV_Yusong_Wang.pdf']) {
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

test('worlds overview contains exactly two interactive scene experiences', async () => {
  const source = await html('worlds.html');
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
  for (const page of scenes) {
    const source = await html(page);
    for (const marker of ['id="gl"', 'id="stage"', 'id="panel"', 'id="reader"', 'type="module"', 'WebGLRenderer', 'function register(', 'function openSection(', 'function setReader(']) {
      assert.ok(source.includes(marker), `${page} missing scene marker: ${marker}`);
    }
    assert.match(source, /href=["'](?:\.\/)?worlds\.html["']/, `${page} cannot return to the worlds overview`);
    assert.match(source, /id=["']btnWork["']/, `${page} needs a direct work entry`);
    const switcher = source.match(/<(?:nav|div)[^>]*id=["']sceneSwitcher["'][^>]*>([\s\S]*?)<\/(?:nav|div)>/)?.[1];
    assert.ok(switcher, `${page} needs a visible scene switcher`);
    for (const target of scenes) assert.match(switcher, new RegExp(`href=["'](?:\\./)?${target.replace('.', '\\.')}["']`), `${page} needs a direct link to ${target}`);
    assert.match(source, /prefers-reduced-motion/);
  }
});

test('both original scenes retain nine entries and the five real projects', async () => {
  const source = await html('retro-future.html');
  assert.ok(source.includes('YW/OS 98'), 'missing workstation identity');
  for (const page of ['index.html', 'retro-future.html']) {
    assert.doesNotMatch(await html(page), /СТУДИЯ|MOSCOW|concrete study|constructivis[mt]|rotary telephone|drafting table|radiator|苏联|苏维埃|劳动\s*[·・]\s*1974/i, `${page} retains Soviet styling`);
  }
  const sections = ['about', 'heritage', 'work', 'exp', 'portfolio', 'toolbox', 'contact', 'cv', 'door'];
  assert.match(source, /\bROOM\b/, 'the original retro room must remain');
  assert.match(source, /const\s+room\s*=\s*new THREE\.Group\(/, 'the retro room geometry must remain');
  for (const id of sections) assert.match(source, new RegExp(`register\\(['"]${id}['"]\\s*,`), `retro scene lost interactive object: ${id}`);
  const projects = [
    ['dipark', /DIPARK/i],
    ['ai-gateway', /AI\s*(?:Gateway|网关|中台)|LLM\s*(?:Gateway|网关)/i],
    ['tunan-data-lab', /Tunan|图南/i],
    ['ops-monitor', /Ops\s*Monitor|运维/i],
    ['enterprise-portal', /Enterprise(?:\s+application)?\s*Portal|企业(?:应用)?门户|企业应用|工作门户|Workspace/i],
  ];
  for (const page of scenes) {
    const scene = await html(page);
    const templates = [...scene.matchAll(/<template\s+id=["']t-([^"']+)["']/g)].map((match) => match[1]);
    assert.deepEqual(templates.sort(), [...sections].sort(), `${page}: all nine content entries need one unique template`);
    const portfolio = scene.match(/<template\s+id=["']t-portfolio["']\s*>([\s\S]*?)<\/template>/)?.[1];
    assert.ok(portfolio, `${page}: missing real-project portfolio`);
    const imagePaths = [...portfolio.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/g)].map((match) => match[1]);
    assert.deepEqual(imagePaths.sort(), projects.map(([slug]) => `assets/work/${slug}.webp`).sort(), `${page}: portfolio must show each of the five real project screenshots once`);
    for (const [slug, name] of projects) assert.match(portfolio, name, `${page}: ${slug} needs a readable project name`);
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
