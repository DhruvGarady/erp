(function () {
  var entity = null;
  var config = null;
  var canManage = false;

  $(function () {
    if (!initErpShell({
      loginPath: "../../index.html",
      logoutPath: "../../index.html",
      sidebarStateKey: "ERP_SIDEBAR"
    })) return;

    entity = getQuery("entity");
    config = window.MASTERDATA_CONFIG[entity];
    if (!config) {
      showWarningDialog("Invalid master entity.");
      return;
    }

    canManage = hasRole(config.roles.manage || []);
    renderShell();
    bindEvents();
    loadList();
  });

  function renderShell() {
    $("#mdPageTitle").text(config.label + " Inquiry");
    $("#mdPageSubtitle").text("Search, review, and maintain " + config.label.toLowerCase() + " master records.");
    $("#mdHeroTitle").text(config.label + " Master");
    $("#mdHeroText").text("List page for " + config.label.toLowerCase() + " with search, status filter, and role-safe actions.");
    $("#btnAdd").text("Add " + config.label);

    var menuHtml = "";
    $.each(window.MASTERDATA_MENU, function (_, item) {
      var active = item.entity === entity ? "active" : "";
      menuHtml += '<a href="master_inq.html?entity=' + encodeURIComponent(item.entity) + '" class="panel-link ' + active + '">' + item.label + "</a>";
    });
    $("#mdSideMenu").html(menuHtml);

    if (!canManage) {
      $("#btnAdd").prop("disabled", true).text("View Only");
    }
  }

  function bindEvents() {
    $("#txtSearch").on("keyup", function () { loadList(); });
    $("#fltStatus").on("change", function () { loadList(); });
    $("#btnAdd").on("click", function () {
      if (!canManage) return;
      location.href = "master_form.html?entity=" + encodeURIComponent(entity) + "&mode=add";
    });
    $(document).on("click", ".btnEditMaster", function () {
      if (!canManage) return;
      location.href = "master_form.html?entity=" + encodeURIComponent(entity) + "&mode=edit&id=" + encodeURIComponent($(this).data("id"));
    });
  }

  function loadList() {
    var search = $.trim($("#txtSearch").val() || "");
    var status = $("#fltStatus").val() || "";
    var query = "limit=300&page=1";
    if (search) query += "&search=" + encodeURIComponent(search);
    if (status) query += "&is_active=" + encodeURIComponent(status);

    $.ajax({
      type: "GET",
      url: request_url + "/api/v1/" + config.table + "?" + query,
      headers: getAuthHeaders(),
      success: function (resp) {
        renderTable(resp.data || []);
      },
      error: function () {
        showSystemError("Unable to load records.");
        renderTable([]);
      }
    });
  }

  function renderTable(rows) {
    var cols = config.listColumns || [];
    var html = "";

    if (!rows.length) {
      $("#mdTableHead").html("");
      $("#mdTableBody").html('<tr><td class="empty-row" colspan="99">No records found.</td></tr>');
      return;
    }

    var head = "<tr>";
    head += "<th>#</th>";
    for (var i = 0; i < cols.length; i++) {
      head += "<th>" + toLabel(cols[i]) + "</th>";
    }
    head += "<th>Status</th>";
    head += "<th>Action</th>";
    head += "</tr>";
    $("#mdTableHead").html(head);

    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      html += "<tr>";
      html += "<td>" + (r + 1) + "</td>";
      for (var c = 0; c < cols.length; c++) {
        var key = cols[c];
        html += "<td>" + safe(row[key]) + "</td>";
      }
      html += '<td><span class="status-pill ' + ((row.is_active || "Y") === "Y" ? "status-active" : "status-inactive") + '">' + (((row.is_active || "Y") === "Y") ? "Active" : "Inactive") + "</span></td>";
      html += "<td>";
      if (canManage) {
        html += '<button type="button" class="btn-edit btnEditMaster" data-id="' + row[config.pk] + '">Edit</button>';
      } else {
        html += '<span class="text-muted">View</span>';
      }
      html += "</td>";
      html += "</tr>";
    }
    $("#mdTableBody").html(html);
  }

  function hasRole(allowed) {
    var role = (sessionStorage.getItem("ROLE_NAME") || "").toLowerCase();
    return $.inArray(role, $.map(allowed, function (v) { return (v || "").toLowerCase(); })) > -1;
  }

  function getAuthHeaders() {
    var token = sessionStorage.getItem("TOKEN");
    if (!token) return {};
    return { Authorization: "Bearer " + token };
  }

  function getQuery(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function safe(v) {
    return v === null || v === undefined || v === "" ? "-" : String(v);
  }

  function toLabel(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }
})();
