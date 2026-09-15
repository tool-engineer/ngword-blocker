importScripts('common.js');

var tabCounts = {};

function setBadge(tabId, n) {
  var text = n > 0 ? (n > 999 ? '999+' : String(n)) : '';
  chrome.action.setBadgeText({ tabId: tabId, text: text });
  chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#6c5ce7' });
}

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  if (!msg) return;

  if (msg.type === 'blocked' && sender.tab) {
    var id = sender.tab.id;
    tabCounts[id] = (tabCounts[id] || 0) + msg.keywords.length;
    setBadge(id, tabCounts[id]);
    chrome.storage.local.get({ stats: { total: 0, byKeyword: {} } }, function (items) {
      var s = items.stats;
      msg.keywords.forEach(function (k) {
        s.total++;
        s.byKeyword[k] = (s.byKeyword[k] || 0) + 1;
      });
      chrome.storage.local.set({ stats: s });
    });
    return;
  }

  if (msg.type === 'getTabCount') {
    sendResponse({ count: tabCounts[msg.tabId] || 0 });
    return true;
  }

  if (msg.type === 'syncGeneric') {
    syncGenericScript();
    return;
  }
});

chrome.tabs.onUpdated.addListener(function (tabId, info) {
  if (info.status === 'loading' && info.url !== undefined) {
    tabCounts[tabId] = 0;
    setBadge(tabId, 0);
  }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  delete tabCounts[tabId];
});

/* 汎用モード：任意のサイトへ動的にコンテンツスクリプトを登録する */
function syncGenericScript() {
  MW.getSettings().then(function (s) {
    chrome.permissions.contains({ origins: ['*://*/*'] }, function (granted) {
      var want = !!(s.sites.generic && granted);
      chrome.scripting.getRegisteredContentScripts({ ids: ['mw-generic'] }, function (list) {
        var registered = !chrome.runtime.lastError && list && list.length > 0;
        if (want && !registered) {
          chrome.scripting.registerContentScripts([{
            id: 'mw-generic',
            matches: ['*://*/*'],
            js: ['src/common.js', 'src/adapters.js', 'src/content.js'],
            css: ['src/content.css'],
            runAt: 'document_start',
            allFrames: false
          }], function () { void chrome.runtime.lastError; });
        } else if (!want && registered) {
          chrome.scripting.unregisterContentScripts({ ids: ['mw-generic'] }, function () {
            void chrome.runtime.lastError;
          });
        }
      });
    });
  });
}

chrome.runtime.onInstalled.addListener(syncGenericScript);
chrome.runtime.onStartup.addListener(syncGenericScript);
chrome.permissions.onRemoved.addListener(syncGenericScript);
chrome.permissions.onAdded.addListener(syncGenericScript);
