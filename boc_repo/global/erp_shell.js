(function (window, document) {
  "use strict";

  function getValue(value, fallback) {
    return value === undefined || value === null || value === "" ? fallback : value;
  }

  function getUserName() {
    return (
      sessionStorage.getItem("FULL_NAME") ||
      sessionStorage.getItem("USERNAME") ||
      "User"
    );
  }

  function getUserRole() {
    return sessionStorage.getItem("ROLE_NAME") || "User";
  }

  function getInitials(name) {
    var parts = name.replace(/\s+/g, " ").trim().split(" ").slice(0, 2);
    var initials = "";
    for (var i = 0; i < parts.length; i++) {
      initials += parts[i].charAt(0).toUpperCase();
    }
    return initials || "U";
  }

  function applyRoleVisibility(container) {
    var roleName = getUserRole().toLowerCase();
    var root = container || document;
    var roleItems = root.querySelectorAll("[data-roles]");

    for (var i = 0; i < roleItems.length; i++) {
      var node = roleItems[i];
      var roles = getValue(node.getAttribute("data-roles"), "")
        .split(",")
        .map(function (entry) { return entry.trim().toLowerCase(); });
      var allowed = roles.indexOf(roleName) > -1;
      node.style.display = allowed ? "" : "none";
    }
  }

  function applyTheme() {
    var mode = localStorage.getItem("ERP_THEME") || "light";
    document.documentElement.setAttribute("data-theme", mode);
    var toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.textContent = mode === "dark" ? "LT" : "DK";
      toggle.setAttribute("aria-label", mode === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
  }

  function toggleTheme() {
    var mode = localStorage.getItem("ERP_THEME") || "light";
    var next = mode === "dark" ? "light" : "dark";
    localStorage.setItem("ERP_THEME", next);
    applyTheme();
  }

  function ensureLoggedIn(loginPath) {
    var token = sessionStorage.getItem("TOKEN");
    var userId = sessionStorage.getItem("USER_ID");
    if (!token || !userId) {
      window.location.href = loginPath;
      return false;
    }
    return true;
  }

  function applyUserMeta(options) {
    var name = getUserName();
    var role = getUserRole();
    var initials = getInitials(name);

    var userNameNode = document.getElementById("userName");
    var userRoleNode = document.getElementById("userRole");
    var railAvatarNode = document.getElementById("railAvatar");
    var welcomeNode = options && options.welcomeSelector ? document.querySelector(options.welcomeSelector) : null;

    if (userNameNode) userNameNode.textContent = name;
    if (userRoleNode) userRoleNode.textContent = role;
    if (railAvatarNode) railAvatarNode.textContent = initials;
    if (welcomeNode) welcomeNode.textContent = "Welcome back, " + name;
  }

  function applySidebarState(options) {
    var sidebar = document.getElementById("sidebar");
    var content = document.getElementById("contentArea");
    var key = options.sidebarStateKey;
    if (!sidebar || !content) return;

    var state = sessionStorage.getItem(key) || "FULL";
    if (state === "COLLAPSED") {
      sidebar.classList.add("collapsed");
      content.classList.add("expanded");
    }
  }

  function bindSidebarToggle(options) {
    var sidebar = document.getElementById("sidebar");
    var content = document.getElementById("contentArea");
    var toggle = document.getElementById("sidebarToggle");
    var key = options.sidebarStateKey;
    if (!sidebar || !content || !toggle) return;

    toggle.addEventListener("click", function () {
      sidebar.classList.toggle("collapsed");
      content.classList.toggle("expanded");
      sessionStorage.setItem(key, sidebar.classList.contains("collapsed") ? "COLLAPSED" : "FULL");
    });
  }

  function bindLogout(logoutPath) {
    var button = document.getElementById("logoutBtn");
    if (!button) return;
    button.addEventListener("click", function () {
      sessionStorage.clear();
      localStorage.clear();
      window.location.href = logoutPath;
    });
  }

  function initErpShell(config) {
    var options = {
      loginPath: getValue(config && config.loginPath, "../index.html"),
      logoutPath: getValue(config && config.logoutPath, "../index.html"),
      sidebarStateKey: getValue(config && config.sidebarStateKey, "ERP_SIDEBAR"),
      welcomeSelector: config && config.welcomeSelector ? config.welcomeSelector : null
    };

    if (!ensureLoggedIn(options.loginPath)) {
      return false;
    }

    applyTheme();
    applyUserMeta(options);
    applyRoleVisibility(document);
    applySidebarState(options);
    bindSidebarToggle(options);
    bindLogout(options.logoutPath);

    var themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", toggleTheme);
    }

    return true;
  }

  window.initErpShell = initErpShell;
})(window, document);
