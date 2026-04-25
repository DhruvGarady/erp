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
    var accessItems = root.querySelectorAll("[data-permission], [data-roles]");
    var permissionMap = window.ERP_ROLE_PERMISSIONS || {
      admin: ["*"],
      manager: [
        "md.customer.view", "md.vendor.view", "md.material.view", "md.material_group.view",
        "md.uom.view", "md.currency.view", "md.tax.view", "md.payment_terms.view",
        "md.warehouse.view", "md.gl_account.view", "md.bom.view"
      ],
      sales: ["md.customer.view", "md.material.view", "md.currency.view", "md.tax.view", "md.payment_terms.view"],
      procurement: ["md.vendor.view", "md.material.view", "md.material_group.view", "md.uom.view", "md.warehouse.view"],
      accounts: ["md.currency.view", "md.tax.view", "md.payment_terms.view", "md.gl_account.view", "md.customer.view", "md.vendor.view"],
      production: ["md.material.view", "md.uom.view", "md.bom.view"],
      user: ["md.customer.view"]
    };
    var granted = permissionMap[roleName] || permissionMap.user || [];

    function matchesPermission(rule, need) {
      if (rule === "*" || rule === need) return true;
      if (rule.slice(-2) === ".*") {
        return need.indexOf(rule.slice(0, -1)) === 0;
      }
      return false;
    }

    for (var i = 0; i < accessItems.length; i++) {
      var node = accessItems[i];
      var allowed = true;
      var roleRule = getValue(node.getAttribute("data-roles"), "");
      var permissionRule = getValue(node.getAttribute("data-permission"), "");

      if (permissionRule) {
        allowed = false;
        var requested = permissionRule.split(",");
        for (var r = 0; r < requested.length; r++) {
          var needed = requested[r].trim();
          for (var g = 0; g < granted.length; g++) {
            if (matchesPermission(granted[g], needed)) {
              allowed = true;
              break;
            }
          }
          if (allowed) break;
        }
      } else if (roleRule) {
        var roles = roleRule
          .split(",")
          .map(function (entry) { return entry.trim().toLowerCase(); });
        allowed = roles.indexOf(roleName) > -1;
      }

      node.style.display = allowed ? "" : "none";
    }

    var sections = root.querySelectorAll(".sidebar-section");
    for (var s = 0; s < sections.length; s++) {
      var section = sections[s];
      var links = section.querySelectorAll(".section-body .panel-link");
      var visibleCount = 0;
      for (var n = 0; n < links.length; n++) {
        if (links[n].style.display !== "none") visibleCount++;
      }
      section.style.display = visibleCount > 0 ? "" : "none";
    }
  }

  function bindSidebarSections() {
    var sections = document.querySelectorAll(".sidebar-section");
    for (var i = 0; i < sections.length; i++) {
      (function (section) {
        var toggle = section.querySelector(".section-toggle");
        if (!toggle) return;

        var initialOpen = section.getAttribute("data-default-open") === "true";
        section.classList.toggle("is-open", initialOpen);
        toggle.setAttribute("aria-expanded", initialOpen ? "true" : "false");

        toggle.addEventListener("click", function () {
          var isOpen = section.classList.contains("is-open");
          section.classList.toggle("is-open", !isOpen);
          toggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
        });
      })(sections[i]);
    }
  }

  function applyTheme() {
    var mode = localStorage.getItem("ERP_THEME") || "light";
    document.documentElement.setAttribute("data-theme", mode);
    var toggle = document.getElementById("themeToggle");
    if (toggle) {
      toggle.setAttribute("data-mode", mode);
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
    if (window.innerWidth <= 900) {
      sidebar.classList.remove("collapsed");
      content.classList.remove("expanded");
      return;
    }

    if (state === "COLLAPSED") {
      sidebar.classList.add("collapsed");
      content.classList.add("expanded");
    }
  }

  function bindSidebarToggle(options) {
    var sidebar = document.getElementById("sidebar");
    var content = document.getElementById("contentArea");
    var toggle = document.getElementById("sidebarToggle");
    var mobileToggle = document.getElementById("mobileSidebarBtn");
    var backdrop = document.getElementById("sidebarBackdrop");
    var key = options.sidebarStateKey;
    if (!sidebar || !content || !toggle) return;

    toggle.addEventListener("click", function () {
      if (window.innerWidth <= 900) {
        sidebar.classList.toggle("open");
        if (backdrop) {
          backdrop.classList.toggle("show", sidebar.classList.contains("open"));
        }
        return;
      }

      sidebar.classList.toggle("collapsed");
      content.classList.toggle("expanded");
      sessionStorage.setItem(key, sidebar.classList.contains("collapsed") ? "COLLAPSED" : "FULL");
    });

    if (mobileToggle) {
      mobileToggle.addEventListener("click", function () {
        sidebar.classList.add("open");
        if (backdrop) backdrop.classList.add("show");
      });
    }

    if (backdrop) {
      backdrop.addEventListener("click", function () {
        sidebar.classList.remove("open");
        backdrop.classList.remove("show");
      });
    }

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) {
        sidebar.classList.remove("open");
        if (backdrop) backdrop.classList.remove("show");
      }
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
    bindSidebarSections();
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
