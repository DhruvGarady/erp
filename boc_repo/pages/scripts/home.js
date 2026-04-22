document.addEventListener("DOMContentLoaded", function () {
  initErpShell({
    loginPath: "../index.html",
    logoutPath: "../index.html",
    sidebarStateKey: "ERP_SIDEBAR",
    welcomeSelector: "#welcomeTitle"
  });
});
