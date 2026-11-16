// 데모 언어: ?lang=en|ko > 지난번에 고른 언어(localStorage) > 영어.
// <head>에서 바로 불러서, 그리기 전에 <html class="lang-en|lang-ko">를 붙인다.
// 화면 글자는 <span class="en">…</span><span class="ko">…</span>로 두 언어를 쓰고 CSS로 하나만 보인다.
(function () {
  var KEY = "pyogrid-demo-lang";
  var q = new URLSearchParams(location.search).get("lang");
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  var lang = q === "ko" || q === "en" ? q : saved === "ko" ? "ko" : "en";
  if (q === "ko" || q === "en") {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }
  var root = document.documentElement;
  root.lang = lang;
  root.classList.add("lang-" + lang);

  window.DemoI18n = {
    lang: lang,
    /** 영어·한국어 중 지금 언어 글자 */
    t: function (en, ko) { return lang === "ko" ? ko : en; }
  };

  // 언어 바꾸기 링크: 지금 주소에 lang만 바꿔 붙인다
  document.addEventListener("DOMContentLoaded", function () {
    var links = document.querySelectorAll("[data-lang-switch]");
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var to = a.getAttribute("data-lang-switch");
      var p = new URLSearchParams(location.search);
      p.set("lang", to);
      a.href = location.pathname.split("/").pop() + "?" + p.toString() + location.hash;
      if (to === lang) a.setAttribute("aria-current", "true");
    }
  });
})();
