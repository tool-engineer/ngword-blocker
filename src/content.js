(function () {
  'use strict';
  if (window.__mwLoaded) return;
  window.__mwLoaded = true;

  var settings = null;
  var rules = [];
  var adapter = null;
  var version = 0;           // 設定が変わるたびに増える。再判定の目印
  var pending = [];          // ブロック件数のバッファ
  var flushTimer = null;
  var scanTimer = null;
  var observer = null;

  function pickAdapter(s) {
    var host = location.hostname;
    for (var i = 0; i < MW_ADAPTERS.length; i++) {
      var a = MW_ADAPTERS[i];
      if (a.id === 'generic') continue;
      if (a.test(host)) return s.sites[a.id] ? a : null;
    }
    if (s.sites.generic) {
      for (var j = 0; j < MW_ADAPTERS.length; j++) {
        if (MW_ADAPTERS[j].id === 'generic') return MW_ADAPTERS[j];
      }
    }
    return null;
  }

  function makeBar(keyword) {
    var bar = document.createElement('div');
    bar.className = 'mw-bar';
    var label = document.createElement('span');
    label.className = 'mw-bar-label';
    label.textContent = 'ミュートワード「' + keyword + '」を含むため非表示';
    var btn = document.createElement('button');
    btn.className = 'mw-bar-btn';
    btn.type = 'button';
    btn.textContent = '表示する';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var c = bar.parentElement;
      if (!c) return;
      var on = c.classList.toggle('mw-revealed');
      btn.textContent = on ? '隠す' : '表示する';
    }, true);
    bar.appendChild(label);
    bar.appendChild(btn);
    return bar;
  }

  function block(container, keyword) {
    if (container.__mwBlocked) return false;
    container.__mwBlocked = true;
    if (settings.mode === 'hide') {
      container.classList.add('mw-hidden');
    } else {
      container.classList.add('mw-collapsed');
      container.insertBefore(makeBar(keyword), container.firstChild);
    }
    return true;
  }

  function unblock(container) {
    if (!container.__mwBlocked) return;
    container.__mwBlocked = false;
    container.classList.remove('mw-hidden', 'mw-collapsed', 'mw-revealed');
    var bar = container.querySelector(':scope > .mw-bar');
    if (bar) bar.remove();
  }

  function countUp(keyword) {
    pending.push(keyword);
    if (flushTimer) return;
    flushTimer = setTimeout(function () {
      flushTimer = null;
      var batch = pending;
      pending = [];
      try {
        chrome.runtime.sendMessage({ type: 'blocked', keywords: batch });
      } catch (e) { /* 拡張機能のリロード直後など */ }
    }, 600);
  }

  function processItem(el) {
    var container = adapter.container(el) || el;

    // より内側に「1件分の要素」があるなら、そちらに任せる
    if (el.querySelector(adapter.itemSelector)) return;

    var text = (el.textContent || '').trim();
    if (text.length < (adapter.minLength || 1)) return;
    if (adapter.requireLink && !el.querySelector('a[href]')) return;

    if (container.__mwV === version && container.__mwLen === text.length) return;
    container.__mwV = version;
    container.__mwLen = text.length;

    var hit = MW.match(text, rules, settings.matchCase);
    if (hit) {
      // 仮想スクロールで要素が使い回された場合に備え、別ワードなら作り直す
      if (container.__mwBlocked && container.__mwKw !== hit.raw) unblock(container);
      container.__mwKw = hit.raw;
      if (block(container, hit.raw)) countUp(hit.raw);
    } else {
      unblock(container);
    }
  }

  function scan() {
    if (!adapter || !settings || !settings.enabled || !rules.length) return;
    var nodes;
    try {
      nodes = document.querySelectorAll(adapter.itemSelector);
    } catch (e) { return; }
    for (var i = 0; i < nodes.length; i++) processItem(nodes[i]);
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      requestAnimationFrame(scan);
    }, 120);
  }

  function clearAll() {
    var nodes = document.querySelectorAll('.mw-hidden, .mw-collapsed');
    for (var i = 0; i < nodes.length; i++) unblock(nodes[i]);
  }

  function start() {
    if (observer) return;
    observer = new MutationObserver(scheduleScan);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('scroll', scheduleScan, { passive: true });
  }

  function apply(s) {
    settings = s;
    rules = MW.compile(s.keywords, s.matchCase);
    adapter = pickAdapter(s);
    version++;
    clearAll();
    if (adapter && s.enabled && rules.length) {
      start();
      scheduleScan();
      // 初期描画が遅いページ向けの追い打ちスキャン
      [300, 1000, 2500].forEach(function (ms) { setTimeout(scheduleScan, ms); });
    }
  }

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'sync') return;
    MW.getSettings().then(apply);
  });

  MW.getSettings().then(apply);
})();
