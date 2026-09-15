/* サイトごとの「1件分の要素」の見つけ方 */
var MW_ADAPTERS = [
  {
    id: 'x',
    label: 'X (Twitter)',
    test: function (h) { return /(^|\.)(x|twitter)\.com$/.test(h); },
    itemSelector: 'article[data-testid="tweet"]',
    minLength: 1,
    container: function (el) {
      return el.closest('[data-testid="cellInnerDiv"]') || el;
    }
  },
  {
    id: 'yahoo',
    label: 'Yahoo!ニュース / Yahoo! JAPAN',
    test: function (h) { return /(^|\.)yahoo\.co\.jp$/.test(h); },
    itemSelector: 'article, li',
    minLength: 8,
    container: function (el) { return el; }
  },
  {
    id: 'googlenews',
    label: 'Google ニュース',
    test: function (h) { return /(^|\.)news\.google\.com$/.test(h); },
    itemSelector: 'article, c-wiz article',
    minLength: 8,
    container: function (el) { return el; }
  },
  {
    id: 'hatena',
    label: 'はてなブックマーク',
    test: function (h) { return /(^|\.)hatena\.ne\.jp$/.test(h); },
    itemSelector: 'li.entrylist-item, article, li',
    minLength: 8,
    container: function (el) { return el; }
  },
  {
    id: 'generic',
    label: 'その他のサイト（汎用モード）',
    test: function () { return true; },
    itemSelector: 'article, [role="article"], li',
    minLength: 12,
    requireLink: true,
    container: function (el) { return el; }
  }
];
