(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = null;

  var toastTimer = null;
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg || '保存しました';
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1600);
  }

  function save(patch, msg) {
    Object.assign(state, patch);
    MW.setSettings(patch).then(function () { toast(msg); });
  }

  function isRegex(t) {
    return t.charAt(0) === '/' && t.lastIndexOf('/') > 0;
  }

  function renderKeywords() {
    var chips = $('chips');
    chips.textContent = '';
    $('kwCount').textContent = state.keywords.length;
    $('empty').hidden = state.keywords.length > 0;

    state.keywords.forEach(function (kw, i) {
      var chip = document.createElement('span');
      chip.className = 'chip' + (isRegex(kw) ? ' regex' : '');
      var text = document.createElement('span');
      text.className = 'chip-text';
      text.textContent = kw;
      var del = document.createElement('button');
      del.className = 'chip-del';
      del.type = 'button';
      del.textContent = '×';
      del.title = '削除';
      del.addEventListener('click', function () {
        var next = state.keywords.slice();
        next.splice(i, 1);
        save({ keywords: next }, '「' + kw + '」を削除しました');
        renderKeywords();
      });
      chip.appendChild(text);
      chip.appendChild(del);
      chips.appendChild(chip);
    });
  }

  function addKeyword(raw) {
    var t = raw.trim();
    if (!t) return;
    if (state.keywords.indexOf(t) !== -1) {
      toast('すでに登録済みです');
      return;
    }
    save({ keywords: state.keywords.concat([t]) }, '「' + t + '」を追加しました');
    renderKeywords();
  }

  function renderStats(stats) {
    $('statTotal').textContent = stats.total.toLocaleString();
    var list = $('ranking');
    list.textContent = '';
    var entries = Object.keys(stats.byKeyword)
      .map(function (k) { return [k, stats.byKeyword[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; })
      .slice(0, 8);
    var max = entries.length ? entries[0][1] : 1;
    entries.forEach(function (e) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = e[0];
      var n = document.createElement('span');
      n.className = 'n';
      n.textContent = e[1].toLocaleString() + ' 件';
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.width = Math.max(4, (e[1] / max) * 100) + '%';
      li.appendChild(name);
      li.appendChild(n);
      li.appendChild(bar);
      list.appendChild(li);
    });
  }

  function renderAll() {
    $('enabled').checked = state.enabled;
    $('matchCase').checked = state.matchCase;
    document.querySelectorAll('input[name="mode"]').forEach(function (r) {
      r.checked = r.value === state.mode;
    });
    document.querySelectorAll('[data-site]').forEach(function (c) {
      c.checked = !!state.sites[c.dataset.site];
    });
    renderKeywords();
  }

  $('kwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    addKeyword($('kwInput').value);
    $('kwInput').value = '';
    $('kwInput').focus();
  });

  $('enabled').addEventListener('change', function () {
    save({ enabled: this.checked }, this.checked ? 'フィルターを有効にしました' : 'フィルターを停止しました');
  });

  $('matchCase').addEventListener('change', function () {
    save({ matchCase: this.checked });
  });

  document.querySelectorAll('input[name="mode"]').forEach(function (r) {
    r.addEventListener('change', function () {
      if (this.checked) save({ mode: this.value });
    });
  });

  document.querySelectorAll('[data-site]').forEach(function (c) {
    c.addEventListener('change', function () {
      var site = this.dataset.site;
      var on = this.checked;
      var box = this;

      var commit = function () {
        var next = Object.assign({}, state.sites);
        next[site] = on;
        save({ sites: next });
        if (site === 'generic') chrome.runtime.sendMessage({ type: 'syncGeneric' });
      };

      if (site === 'generic' && on) {
        chrome.permissions.request({ origins: ['*://*/*'] }, function (granted) {
          if (!granted) {
            box.checked = false;
            toast('すべてのサイトへのアクセスが許可されませんでした');
            return;
          }
          commit();
        });
        return;
      }
      commit();
    });
  });

  $('toggleBulk').addEventListener('click', function () {
    var openBulk = $('bulkView').hidden;
    $('bulkView').hidden = !openBulk;
    $('chipView').hidden = openBulk;
    this.textContent = openBulk ? 'リスト表示' : '一括編集';
    if (openBulk) {
      $('bulkInput').value = state.keywords.join('\n');
      $('bulkInput').focus();
    }
  });

  $('bulkCancel').addEventListener('click', function () {
    $('toggleBulk').click();
  });

  $('bulkSave').addEventListener('click', function () {
    var list = $('bulkInput').value.split('\n')
      .map(function (s) { return s.trim(); })
      .filter(function (s, i, a) { return s && a.indexOf(s) === i; });
    save({ keywords: list }, list.length + ' 件のキーワードを保存しました');
    renderKeywords();
    $('toggleBulk').click();
  });

  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mutewords-settings.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });

  $('importFile').addEventListener('change', function () {
    var file = this.files && this.files[0];
    if (!file) return;
    file.text().then(function (txt) {
      var data;
      try {
        data = JSON.parse(txt);
      } catch (e) {
        toast('ファイルを読み込めませんでした');
        return;
      }
      var patch = {};
      if (Array.isArray(data.keywords)) patch.keywords = data.keywords.map(String);
      if (data.mode === 'hide' || data.mode === 'collapse') patch.mode = data.mode;
      if (typeof data.matchCase === 'boolean') patch.matchCase = data.matchCase;
      if (typeof data.enabled === 'boolean') patch.enabled = data.enabled;
      if (data.sites) {
        patch.sites = Object.assign({}, MW.DEFAULTS.sites, data.sites, { generic: state.sites.generic });
      }
      save(patch, '設定を読み込みました');
      renderAll();
    });
    this.value = '';
  });

  $('resetStats').addEventListener('click', function () {
    if (!confirm('ブロック実績をリセットします。よろしいですか？')) return;
    chrome.storage.local.set({ stats: { total: 0, byKeyword: {} } }, function () {
      renderStats({ total: 0, byKeyword: {} });
      toast('実績をリセットしました');
    });
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes.stats) renderStats(changes.stats.newValue);
  });

  MW.getSettings().then(function (s) {
    state = s;
    renderAll();
  });
  MW.getStats().then(renderStats);
})();
