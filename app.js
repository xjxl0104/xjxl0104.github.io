/*
 * Small, dependency-free interactions for the pixel portfolio.
 * The page may load this file with `defer`; the ready guard also makes it safe
 * to include from the document head.
 */
(function () {
  'use strict';

  var EMAIL = 'ywang677@connect.hkust-gz.edu.cn';
  var LANG_KEY = 'site-lang';
  var currentDialogItem = null;
  var refreshDialogTitle = null;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function getStoredLanguage() {
    try {
      var stored = window.localStorage.getItem(LANG_KEY);
      return stored === 'en' || stored === 'zh' ? stored : null;
    } catch (error) {
      return null;
    }
  }

  function setupLanguage() {
    var body = document.body;
    var root = document.documentElement;
    if (!body || !root) return function () { return 'zh'; };

    var langButton = document.getElementById('langBtn');
    var language = getStoredLanguage() || (body.getAttribute('data-lang') === 'en' ? 'en' : 'zh');

    function setLanguage(next) {
      language = next === 'en' ? 'en' : 'zh';
      body.setAttribute('data-lang', language);
      root.setAttribute('lang', language);
      if (langButton) {
        langButton.setAttribute('aria-pressed', language === 'en' ? 'true' : 'false');
        langButton.setAttribute('aria-label', language === 'zh' ? '切换到英文' : 'Switch to Chinese');
      }
      try {
        window.localStorage.setItem(LANG_KEY, language);
      } catch (error) {
        // Private browsing and disabled storage are both valid environments.
      }
      if (typeof refreshDialogTitle === 'function') refreshDialogTitle();
      return language;
    }

    setLanguage(language);
    if (langButton) {
      langButton.addEventListener('click', function () {
        setLanguage(language === 'zh' ? 'en' : 'zh');
      });
    }
    return function () { return language; };
  }

  function setupClock() {
    var clock = document.getElementById('clock');
    var footerTime = document.getElementById('footerTime');
    if (!clock && !footerTime) return;

    function paint() {
      var text;
      try {
        text = new Intl.DateTimeFormat('zh-CN', {
          timeZone: 'Asia/Shanghai',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(new Date());
      } catch (error) {
        text = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      // A few engines include a narrow no-break space in the formatted value.
      text = text.replace(/\u200e|\u202f/g, '');
      if (clock) clock.textContent = text;
      if (footerTime) footerTime.textContent = text;
    }
    paint();
    window.setInterval(paint, 30000);
  }

  function setupNavigation() {
    var links = Array.prototype.slice.call(document.querySelectorAll('nav a[href^="#s"], a.nav-link[href^="#s"]'));
    if (!links.length) return;

    links.forEach(function (link) {
      link.addEventListener('click', function (event) {
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;
        var target = document.getElementById(href.slice(1));
        if (!target) return; // preserve normal browser behavior for an unknown link
        event.preventDefault();
        var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        try { target.focus({ preventScroll: true }); } catch (error) { target.focus(); }
      });
    });

    var sections = links.map(function (link) {
      var href = link.getAttribute('href') || '';
      return document.getElementById(href.slice(1));
    }).filter(Boolean);
    var linkById = {};
    links.forEach(function (link) {
      var href = link.getAttribute('href') || '';
      linkById[href.slice(1)] = link;
    });

    function mark(id) {
      links.forEach(function (link) {
        var isCurrent = link.getAttribute('href') === '#' + id;
        if (isCurrent) {
          link.setAttribute('aria-current', 'page');
          link.classList.add('active');
        } else {
          link.removeAttribute('aria-current');
          link.classList.remove('active');
        }
      });
    }

    if (sections.length) mark(sections[0].id);
    if ('IntersectionObserver' in window && sections.length) {
      var visible = new Map();
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.intersectionRatio);
          else visible.delete(entry.target.id);
        });
        var best = null;
        visible.forEach(function (ratio, id) {
          if (!best || ratio > best.ratio) best = { id: id, ratio: ratio };
        });
        if (best) mark(best.id);
      }, { rootMargin: '-22% 0px -58% 0px', threshold: [0, 0.1, 0.35, 0.65, 1] });
      sections.forEach(function (section) { observer.observe(section); });
    } else {
      mark((sections[0] && sections[0].id) || Object.keys(linkById)[0]);
    }
  }

  function setupTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'), function (container) {
      var buttons = Array.prototype.slice.call(container.querySelectorAll('button[data-tab]'));
      var scope = container.parentElement || container;
      var panels = Array.prototype.slice.call(scope.querySelectorAll('[data-panel]'));
      var filterPanel = panels.length === 1 && panels[0].getAttribute('data-panel') === 'all' ? panels[0] : null;
      var cards = filterPanel ? Array.prototype.slice.call(filterPanel.querySelectorAll('.work-card[data-category]')) : [];
      if (!buttons.length) return;
      if (!container.getAttribute('role')) container.setAttribute('role', 'tablist');

      function activate(value, moveFocus) {
        buttons.forEach(function (button) {
          var selected = button.getAttribute('data-tab') === value;
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-selected', selected ? 'true' : 'false');
          button.tabIndex = selected ? 0 : -1;
          if (selected && moveFocus) button.focus();
        });
        if (filterPanel) {
          filterPanel.hidden = false;
          filterPanel.setAttribute('role', 'tabpanel');
          cards.forEach(function (card) {
            card.hidden = value !== 'all' && card.getAttribute('data-category') !== value;
          });
        } else {
          panels.forEach(function (panel) {
            var shown = panel.getAttribute('data-panel') === value;
            panel.hidden = !shown;
            if (!panel.hasAttribute('role')) panel.setAttribute('role', 'tabpanel');
          });
        }
      }

      var initial = buttons.find(function (button) { return button.getAttribute('aria-selected') === 'true'; }) || buttons[0];
      activate(initial.getAttribute('data-tab') || '', false);

      buttons.forEach(function (button, index) {
        button.addEventListener('click', function () { activate(button.getAttribute('data-tab') || '', false); });
        button.addEventListener('keydown', function (event) {
          var next = index;
          if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % buttons.length;
          else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + buttons.length) % buttons.length;
          else if (event.key === 'Home') next = 0;
          else if (event.key === 'End') next = buttons.length - 1;
          else return;
          event.preventDefault();
          activate(buttons[next].getAttribute('data-tab') || '', true);
        });
      });
    });
  }

  function setupGallery(getLanguage) {
    var dialog = document.getElementById('galleryDialog');
    var allButtons = document.querySelectorAll('[data-gallery] button, button[data-src]');
    if (!dialog || !allButtons.length) return;

    var image = dialog.querySelector('#galleryImage img') || dialog.querySelector('img#galleryImage') || document.getElementById('galleryImage');
    var title = dialog.querySelector('#galleryTitle') || document.getElementById('galleryTitle');
    var close = dialog.querySelector('#galleryClose') || document.getElementById('galleryClose');

    function titleFor(button) {
      if (!button) return '';
      var lang = getLanguage() === 'en' ? 'en' : 'zh';
      var preferred = button.getAttribute('data-title-' + lang);
      var fallback = button.getAttribute('data-title-' + (lang === 'en' ? 'zh' : 'en'));
      return preferred || fallback || button.getAttribute('aria-label') || '';
    }
    function paintTitle() {
      if (title && currentDialogItem) title.textContent = titleFor(currentDialogItem);
    }
    refreshDialogTitle = paintTitle;

    function closeDialog() {
      currentDialogItem = null;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
    }
    function openDialog(button) {
      currentDialogItem = button;
      var src = button.getAttribute('data-src') || '';
      var caption = titleFor(button);
      if (image) {
        image.src = src;
        image.alt = caption;
      }
      if (title) title.textContent = caption;
      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    Array.prototype.forEach.call(allButtons, function (button) {
      button.addEventListener('click', function () { openDialog(button); });
    });
    if (close) close.addEventListener('click', closeDialog);
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener('cancel', function () { currentDialogItem = null; });
    dialog.addEventListener('close', function () { currentDialogItem = null; });
  }

  function setupCopyEmail(getLanguage) {
    var button = document.getElementById('copyEmail');
    var status = document.getElementById('copyStatus');
    if (!button) return;
    if (status && !status.getAttribute('role')) status.setAttribute('role', 'status');

    function announce(message) {
      if (!status) return;
      status.textContent = '';
      window.setTimeout(function () { status.textContent = message; }, 20);
    }
    function fallbackCopy() {
      var textarea = document.createElement('textarea');
      textarea.value = EMAIL;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (error) { copied = false; }
      textarea.remove();
      if (!copied) throw new Error('copy failed');
    }
    button.addEventListener('click', function () {
      var copy = window.navigator.clipboard && typeof window.navigator.clipboard.writeText === 'function'
        ? window.navigator.clipboard.writeText(EMAIL)
        : Promise.resolve().then(fallbackCopy);
      Promise.resolve(copy).then(function () {
        announce(getLanguage() === 'en' ? 'Email copied.' : '邮箱已复制。');
      }).catch(function () {
        announce(getLanguage() === 'en' ? 'Copy failed. Please copy manually: ' + EMAIL : '复制失败，请手动复制：' + EMAIL);
      });
    });
  }

  function setupLife() {
    var canvas = document.getElementById('lifeCanvas');
    if (!canvas || !canvas.getContext) return;
    var toggle = document.getElementById('lifeToggle');
    var reset = document.getElementById('lifeReset');
    var status = document.getElementById('lifeStatus');
    var columns = 24;
    var rows = 14;
    var defaultWidth = 288;
    var defaultHeight = 168;
    if (!canvas.width || canvas.width < columns) canvas.width = defaultWidth;
    if (!canvas.height || canvas.height < rows) canvas.height = defaultHeight;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var running = !reduced;
    var offscreen = false;
    var visible = document.visibilityState !== 'hidden';
    var generation = new Uint8Array(columns * rows);
    var raf = 0;
    var last = 0;
    var elapsed = 0;

    function seed() {
      generation.fill(0);
      [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]].forEach(function (point) {
        generation[point[1] * columns + point[0] + columns * 3] = 1;
      });
      // A small still life makes the 24x14 field legible before the glider moves.
      [[17, 8], [18, 8], [17, 9], [18, 9]].forEach(function (point) {
        generation[point[1] * columns + point[0]] = 1;
      });
    }
    function paint() {
      var width = canvas.width;
      var height = canvas.height;
      var cellWidth = width / columns;
      var cellHeight = height / rows;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#111117';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#70707b';
      for (var y = 1; y < rows; y += 1) ctx.fillRect(0, Math.floor(y * cellHeight), width, 1);
      for (var x = 1; x < columns; x += 1) ctx.fillRect(Math.floor(x * cellWidth), 0, 1, height);
      ctx.fillStyle = '#f19bb4';
      generation.forEach(function (alive, index) {
        if (!alive) return;
        var x = index % columns;
        var y = Math.floor(index / columns);
        ctx.fillRect(Math.floor(x * cellWidth) + 1, Math.floor(y * cellHeight) + 1,
          Math.max(1, Math.ceil(cellWidth) - 2), Math.max(1, Math.ceil(cellHeight) - 2));
      });
    }
    function step() {
      var next = new Uint8Array(generation.length);
      for (var y = 0; y < rows; y += 1) {
        for (var x = 0; x < columns; x += 1) {
          var neighbors = 0;
          for (var dy = -1; dy <= 1; dy += 1) {
            for (var dx = -1; dx <= 1; dx += 1) {
              if (!dx && !dy) continue;
              var nx = (x + dx + columns) % columns;
              var ny = (y + dy + rows) % rows;
              neighbors += generation[ny * columns + nx];
            }
          }
          var alive = generation[y * columns + x];
          next[y * columns + x] = alive ? (neighbors === 2 || neighbors === 3 ? 1 : 0) : (neighbors === 3 ? 1 : 0);
        }
      }
      generation = next;
    }
    function canRun() { return running && !offscreen && visible; }
    function frame(time) {
      raf = 0;
      if (!canRun()) return;
      if (!last) last = time;
      elapsed += Math.min(100, time - last);
      last = time;
      if (elapsed >= 180) { elapsed = 0; step(); paint(); }
      raf = window.requestAnimationFrame(frame);
    }
    function ensureFrame() {
      if (canRun() && !raf) raf = window.requestAnimationFrame(frame);
    }
    function setRunning(next) {
      running = !!next;
      if (!running) { last = 0; elapsed = 0; }
      if (toggle) {
        toggle.setAttribute('aria-pressed', running ? 'true' : 'false');
        toggle.setAttribute('data-running', running ? 'true' : 'false');
        toggle.textContent = running ? 'PAUSE' : 'RUN';
      }
      if (status) status.textContent = running ? 'RUNNING' : 'PAUSED';
      ensureFrame();
    }

    seed();
    paint();
    setRunning(running);
    if (toggle) toggle.addEventListener('click', function () { setRunning(!running); });
    if (reset) reset.addEventListener('click', function () { seed(); paint(); });
    canvas.addEventListener('click', function (event) {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var x = Math.floor((event.clientX - rect.left) / rect.width * columns);
      var y = Math.floor((event.clientY - rect.top) / rect.height * rows);
      if (x < 0 || x >= columns || y < 0 || y >= rows) return;
      var index = y * columns + x;
      generation[index] = generation[index] ? 0 : 1;
      paint();
    });
    document.addEventListener('visibilitychange', function () {
      visible = document.visibilityState !== 'hidden';
      if (!visible) { last = 0; elapsed = 0; }
      ensureFrame();
    });
    if (window.matchMedia) {
      var preference = window.matchMedia('(prefers-reduced-motion: reduce)');
      var motionChanged = function (event) { if (event.matches) setRunning(false); };
      if (preference.addEventListener) preference.addEventListener('change', motionChanged);
      else if (preference.addListener) preference.addListener(motionChanged);
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (entries[0]) {
          offscreen = !entries[0].isIntersecting;
          if (offscreen) { last = 0; elapsed = 0; }
          ensureFrame();
        }
      }, { threshold: 0.01 });
      observer.observe(canvas);
    }
  }

  function hash(x, y, seed) {
    var value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
    return value - Math.floor(value);
  }

  function setupLandscape() {
    var canvas = document.getElementById('landscape');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    function draw() {
      var rect = canvas.getBoundingClientRect();
      var width = Math.max(160, Math.round(rect.width || Number(canvas.getAttribute('width')) || 960));
      var height = Math.max(80, Math.round(rect.height || Number(canvas.getAttribute('height')) || 320));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.imageSmoothingEnabled = false;
      var ink = '#111117';
      var gray = '#70707b';
      var pink = '#e99ab2';
      var blush = '#f3cad4';
      ctx.fillStyle = ink;
      ctx.fillRect(0, 0, width, height);

      // Sparse, deterministic sky dithering keeps every redraw identical.
      for (var sy = 8; sy < height * 0.52; sy += 5) {
        for (var sx = 5; sx < width; sx += 7) {
          var skyNoise = hash(sx, sy, 2);
          if (skyNoise > 0.9) {
            ctx.fillStyle = skyNoise > 0.965 ? blush : pink;
            ctx.fillRect(sx, sy, 2, 2);
          } else if (skyNoise < 0.035) {
            ctx.fillStyle = gray;
            ctx.fillRect(sx, sy, 1, 1);
          }
        }
      }

      function mountain(base, amplitude, color, seed) {
        var points = [[0, height]];
        var x = 0;
        while (x <= width + 12) {
          var n = hash(x, seed, seed);
          var y = base - Math.round((0.32 + n * 0.68) * amplitude / 4) * 4;
          points.push([x, Math.max(0, y)]);
          x += 5 + Math.floor(hash(x, seed + 8, seed) * 10);
        }
        points.push([width, height]);
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (var i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        // Offset pixels provide a four-colour, screen-print-like dither.
        for (var dy = Math.max(0, base - amplitude); dy < height; dy += 7) {
          for (var dx = 0; dx < width; dx += 9) {
            if (hash(dx, dy, seed + 12) > 0.82) {
              ctx.fillStyle = hash(dx, dy, seed + 16) > 0.5 ? blush : ink;
              ctx.fillRect(dx, dy, 2, 2);
            }
          }
        }
      }
      mountain(height * 0.63, height * 0.34, gray, 3);
      mountain(height * 0.75, height * 0.31, pink, 11);
      mountain(height * 0.9, height * 0.25, blush, 23);
      ctx.fillStyle = ink;
      ctx.fillRect(0, Math.floor(height * 0.94), width, Math.ceil(height * 0.06));
    }

    draw();
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(canvas);
    else window.addEventListener('resize', draw);
  }

  function setupReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
    if (!items.length) return;
    var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (item) { observer.observe(item); });
  }

  ready(function () {
    var getLanguage = setupLanguage();
    setupClock();
    setupReveal();
    setupNavigation();
    setupTabs();
    setupGallery(getLanguage);
    setupCopyEmail(getLanguage);
    setupLife();
    setupLandscape();
  });
}());
