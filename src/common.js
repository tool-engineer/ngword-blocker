/* 設定のデフォルト値・ストレージ・マッチング処理（content / options / popup で共用） */
var MW = (function () {
  'use strict';

  var DEFAULTS = {
    enabled: true,
    keywords: [],          // 文字列の配列。"/正規表現/i" 形式も可
    mode: 'collapse',      // 'collapse' = 折りたたみ / 'hide' = 完全非表示
    matchCase: false,
    sites: {
      x: true,
      yahoo: true,
      googlenews: true,
      hatena: true,
      generic: false       // 汎用モード（任意のサイト）
    }
  };

  function getSettings() {
    return new Promise(function (resolve) {
      chrome.storage.sync.get(DEFAULTS, function (items) {
        items.sites = Object.assign({}, DEFAULTS.sites, items.sites || {});
        resolve(items);
      });
    });
  }

  function setSettings(patch) {
    return new Promise(function (resolve) {
      chrome.storage.sync.set(patch, resolve);
    });
  }

  function getStats() {
    return new Promise(function (resolve) {
      chrome.storage.local.get({ stats: { total: 0, byKeyword: {} } }, function (items) {
        resolve(items.stats);
      });
    });
  }

  function normalize(s) {
    try {
      return s.normalize('NFKC').toLowerCase();
    } catch (e) {
      return s.toLowerCase();
    }
  }

  /* キーワード配列 → 判定ルールへコンパイル */
  function compile(keywords, matchCase) {
    var rules = [];
    (keywords || []).forEach(function (raw) {
      var t = String(raw == null ? '' : raw).trim();
      if (!t) return;
      var last = t.lastIndexOf('/');
      if (t.charAt(0) === '/' && last > 0) {
        var body = t.slice(1, last);
        var flags = t.slice(last + 1).replace(/[^gimsuy]/g, '').replace(/g/g, '');
        if (!matchCase && flags.indexOf('i') === -1) flags += 'i';
        try {
          rules.push({ raw: t, re: new RegExp(body, flags) });
          return;
        } catch (e) { /* 不正な正規表現は通常文字列として扱う */ }
      }
      rules.push({ raw: t, needle: matchCase ? t : normalize(t) });
    });
    return rules;
  }

  /* マッチしたルールを返す（なければ null） */
  function match(text, rules, matchCase) {
    if (!text) return null;
    var norm = matchCase ? text : normalize(text);
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (r.re) {
        r.re.lastIndex = 0;
        if (r.re.test(text)) return r;
      } else if (norm.indexOf(r.needle) !== -1) {
        return r;
      }
    }
    return null;
  }

  return {
    DEFAULTS: DEFAULTS,
    getSettings: getSettings,
    setSettings: setSettings,
    getStats: getStats,
    normalize: normalize,
    compile: compile,
    match: match
  };
})();

if (typeof module !== 'undefined') module.exports = MW;
