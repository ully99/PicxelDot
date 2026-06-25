(function () {
  var storageKey = "dot-maker-language";

  function getInitialLanguage() {
    try {
      return localStorage.getItem(storageKey) === "ko" ? "ko" : "en";
    } catch (error) {
      return "en";
    }
  }

  function applyLanguage(language) {
    document.documentElement.lang = language;

    try {
      localStorage.setItem(storageKey, language);
    } catch (error) {}

    document.querySelectorAll("[data-lang]").forEach(function (element) {
      element.hidden = element.getAttribute("data-lang") !== language;
    });

    document.querySelectorAll("[data-language-button]").forEach(function (button) {
      var isActive = button.getAttribute("data-language-button") === language;
      button.setAttribute("aria-pressed", String(isActive));
      button.classList.toggle("bg-amber-300", isActive);
      button.classList.toggle("text-zinc-950", isActive);
      button.classList.toggle("text-zinc-300", !isActive);
    });
  }

  window.setStaticLanguage = applyLanguage;

  document.addEventListener("DOMContentLoaded", function () {
    var language = getInitialLanguage();

    document.querySelectorAll("[data-language-button]").forEach(function (button) {
      button.addEventListener("click", function () {
        applyLanguage(button.getAttribute("data-language-button") || "en");
      });
    });

    applyLanguage(language);
  });
})();
