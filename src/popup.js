(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var state = null;

  function renderChips() {
    var box = $('chips');
    box.textContent = '';
    $('kwCount').textContent = state.keywords.length;
    $('empty').hidden = state.keywords.length > 0;

    state.keywords.forEach(function (kw, i) {
      var chip = document.createElement('span');
      chip.className = 'p-chip';
      var text = document.createElement('span');
      text.textContent = kw;
      var del = document.createElement('button');
      del.type = 'button';
      del.textContent = '×';
      del.title = '削除';
      del.addEventListener('click', function () {
        state.keywords.splice(i, 1);
        MW.setSettings({ keywords: state.keywords });
        renderChips();
      });
      chip.appendChild(text);
      chip.appendChild(del);
      box.appendChild(chip);
    });
  }

  function renderStatus() {
    $('enabled').checked = state.enabled;
    $('status').textContent = state.enabled ? '有効' : '停止中';
  }

  function renderSiteState(tab) {
    var label = '対象外のページ';
    try {
      var host = new URL(tab.url).hostname;
      for (var i = 0; i < MW_ADAPTERS.length; i++) {
        var a = MW_ADAPTERS[i];
        if (a.id === 'generic') continue;
        if (a.test(host)) {
          label = state.sites[a.id] ? a.label + ' で動作中' : a.label + ' は無効';
          $('siteState').textContent = label;
          return;
        }
      }
      if (state.sites.generic) label = '汎用モードで動作中';
    } catch (e) { /* chrome:// など */ }
    $('siteState').textContent = label;
  }

  $('enabled').addEventListener('change', function () {
    state.enabled = this.checked;
    MW.setSettings({ enabled: state.enabled });
    renderStatus();
  });

  $('kwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('kwInput').value.trim();
    if (!t || state.keywords.indexOf(t) !== -1) {
      $('kwInput').value = '';
      return;
    }
    state.keywords.push(t);
    MW.setSettings({ keywords: state.keywords });
    $('kwInput').value = '';
    renderChips();
  });

  $('openOptions').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
    window.close();
  });

  MW.getSettings().then(function (s) {
    state = s;
    renderStatus();
    renderChips();
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs.length) return;
      renderSiteState(tabs[0]);
      chrome.runtime.sendMessage({ type: 'getTabCount', tabId: tabs[0].id }, function (res) {
        if (chrome.runtime.lastError || !res) return;
        $('tabCount').textContent = res.count;
      });
    });
  });

  MW.getStats().then(function (stats) {
    $('total').textContent = stats.total.toLocaleString();
  });
})();
