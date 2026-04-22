(function () {
  var entity = null;
  var mode = null;
  var id = null;
  var config = null;
  var canManage = false;

  $(function () {
    if (!initErpShell({
      loginPath: "../../index.html",
      logoutPath: "../../index.html",
      sidebarStateKey: "ERP_SIDEBAR"
    })) return;

    entity = getQuery("entity");
    mode = getQuery("mode") || "add";
    id = getQuery("id");
    config = window.MASTERDATA_CONFIG[entity];
    if (!config) {
      showWarningDialog("Invalid master entity.");
      return;
    }

    canManage = hasRole(config.roles.manage || []);
    renderShell();
    renderForm();
    bindEvents();
    loadReferences().then(function () {
      if (mode === "edit" && id) loadRecord();
    });
  });

  function renderShell() {
    var action = mode === "edit" ? "Edit" : "Add";
    $("#mdPageTitle").text(action + " " + config.label);
    $("#mdPageSubtitle").text("Maintain " + config.label.toLowerCase() + " master details with enterprise-safe controls.");
    $("#mdHeroTitle").text(config.label + " Master Form");
    $("#mdHeroText").text((mode === "edit" ? "Update" : "Create") + " reusable " + config.label.toLowerCase() + " records for cross-module ERP usage.");
    $("#btnSave").text((mode === "edit" ? "Update " : "Save ") + config.label);
    $("#btnDeactivate").toggle(mode === "edit");

    var menuHtml = "";
    $.each(window.MASTERDATA_MENU, function (_, item) {
      var active = item.entity === entity ? "active" : "";
      menuHtml += '<a href="master_inq.html?entity=' + encodeURIComponent(item.entity) + '" class="panel-link ' + active + '">' + item.label + "</a>";
    });
    $("#mdSideMenu").html(menuHtml);

    if (!canManage) {
      showWarningDialog("You have view access only.");
      $("#mdForm :input").prop("disabled", true);
      $("#btnCancel").prop("disabled", false);
      $("#btnDeactivate").hide();
      $("#btnSave").hide();
    }
  }

  function renderForm() {
    var html = "";
    $.each(config.formFields || [], function (_, f) {
      html += '<div class="col-lg-4 md-field">';
      html += '<div class="md-label-row"><label class="md-label" for="' + f.key + '">' + f.label + (f.required ? ' <span class="req">*</span>' : "") + "</label></div>";
      if (f.type === "textarea") {
        html += '<textarea class="md-textarea" id="' + f.key + '" maxlength="500"></textarea>';
      } else if (f.type === "select" || f.type === "ref") {
        html += '<select class="md-select" id="' + f.key + '"></select>';
      } else {
        var inputType = (f.type === "number" || f.type === "email") ? f.type : "text";
        html += '<input type="' + inputType + '" class="md-input" id="' + f.key + '">';
      }
      html += "</div>";
    });
    $("#mdFields").html(html);

    $.each(config.formFields || [], function (_, f) {
      if (f.type === "select" && f.options) {
        var options = '<option value="">Select</option>';
        $.each(f.options, function (_, o) {
          options += '<option value="' + o.v + '">' + o.t + "</option>";
        });
        $("#" + f.key).html(options);
      }
    });
  }

  function bindEvents() {
    $("#btnCancel").on("click", function () {
      location.href = "master_inq.html?entity=" + encodeURIComponent(entity);
    });

    $("#mdForm").on("submit", function (e) {
      e.preventDefault();
      if (!canManage) return;
      saveRecord();
    });

    $("#btnDeactivate").on("click", function () {
      if (!canManage || !id) return;
      showConfirmDialog("Deactivate this record?", function () {
        $.ajax({
          type: "DELETE",
          url: request_url + "/api/v1/" + config.table + "/" + encodeURIComponent(id),
          headers: getAuthHeaders(),
          contentType: "application/json",
          data: JSON.stringify({ updated_by: sessionStorage.getItem("USERNAME") || "system" }),
          success: function () {
            showSuccessDialog("Record deactivated successfully.", function () { location.href = "master_inq.html?entity=" + encodeURIComponent(entity); });
          },
          error: function (xhr) {
            showSystemError((xhr.responseJSON && xhr.responseJSON.error) || "Unable to deactivate record.");
          }
        });
      });
    });
  }

  function saveRecord() {
    var payload = collectPayload();
    var error = validate(payload);
    if (error) {
      showWarningDialog(error);
      return;
    }

    $("#btnSave").prop("disabled", true);
    duplicateCheck(payload).then(function (dupErr) {
      if (dupErr) {
        showWarningDialog(dupErr);
        $("#btnSave").prop("disabled", false);
        return;
      }

      var method = mode === "edit" ? "PUT" : "POST";
      var url = request_url + "/api/v1/" + config.table + (mode === "edit" ? "/" + encodeURIComponent(id) : "");

      $.ajax({
        type: method,
        url: url,
        headers: getAuthHeaders(),
        contentType: "application/json",
        data: JSON.stringify(payload),
        success: function () {
          showSuccessDialog("Record saved successfully.", function () { location.href = "master_inq.html?entity=" + encodeURIComponent(entity); });
        },
        error: function (xhr) {
          showSystemError((xhr.responseJSON && xhr.responseJSON.error) || "Unable to save record.");
        },
        complete: function () {
          $("#btnSave").prop("disabled", false);
        }
      });
    });
  }

  function collectPayload() {
    var actor = sessionStorage.getItem("USERNAME") || "system";
    var data = {};
    $.each(config.formFields || [], function (_, f) {
      var val = $("#" + f.key).val();
      if (f.type === "number") {
        data[f.key] = (val === "" || val === null) ? null : Number(val);
      } else {
        data[f.key] = val === "" ? null : val;
      }
    });
    if (mode === "add") data.created_by = actor;
    data.updated_by = actor;
    return data;
  }

  function validate(payload) {
    var fields = config.formFields || [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.required && (payload[f.key] === null || payload[f.key] === undefined || payload[f.key] === "")) {
        return f.label + " is required.";
      }
      if (f.type === "number" && payload[f.key] !== null && isNaN(payload[f.key])) {
        return f.label + " must be numeric.";
      }
      if (f.type === "email" && payload[f.key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload[f.key])) {
        return "Invalid email format.";
      }
    }
    return "";
  }

  function duplicateCheck(payload) {
    if (!config.uniqueKeys || !config.uniqueKeys.length) return Promise.resolve("");
    return $.ajax({
      type: "GET",
      url: request_url + "/api/v1/" + config.table + "?is_active=Y&limit=500&page=1",
      headers: getAuthHeaders()
    }).then(function (resp) {
      var rows = resp.data || [];
      for (var i = 0; i < config.uniqueKeys.length; i++) {
        var key = config.uniqueKeys[i];
        var value = payload[key];
        if (!value) continue;
        var exists = $.grep(rows, function (r) {
          return (mode !== "edit" || String(r[config.pk]) !== String(id)) &&
            String(r[key] || "").toLowerCase() === String(value).toLowerCase();
        }).length > 0;
        if (exists) return toLabel(key) + " already exists.";
      }
      return "";
    }).catch(function () { return ""; });
  }

  function loadRecord() {
    $.ajax({
      type: "GET",
      url: request_url + "/api/v1/" + config.table + "/" + encodeURIComponent(id),
      headers: getAuthHeaders(),
      success: function (row) {
        $.each(config.formFields || [], function (_, f) {
          var val = row[f.key];
          $("#" + f.key).val(val === null || val === undefined ? "" : String(val));
        });
      },
      error: function () {
        showSystemError("Unable to load record details.");
      }
    });
  }

  function loadReferences() {
    var refs = [];
    $.each(config.formFields || [], function (_, f) {
      if (f.type === "ref" && f.ref && f.ref.entity) refs.push(f);
    });
    if (!refs.length) return Promise.resolve();

    var requests = $.map(refs, function (f) {
      var refCfg = window.MASTERDATA_CONFIG[f.ref.entity];
      return $.ajax({
        type: "GET",
        url: request_url + "/api/v1/" + refCfg.table + "?is_active=Y&limit=300&page=1",
        headers: getAuthHeaders()
      }).then(function (resp) {
        var rows = resp.data || [];
        var html = '<option value="">Select</option>';
        $.each(rows, function (_, row) {
          var parts = [];
          $.each(f.ref.labelKeys || [], function (__, lk) { if (row[lk]) parts.push(row[lk]); });
          html += '<option value="' + row[f.ref.key] + '">' + parts.join(" - ") + "</option>";
        });
        $("#" + f.key).html(html);
      });
    });
    return Promise.all(requests);
  }

  function hasRole(allowed) {
    var role = (sessionStorage.getItem("ROLE_NAME") || "").toLowerCase();
    return $.inArray(role, $.map(allowed, function (v) { return (v || "").toLowerCase(); })) > -1;
  }

  function getQuery(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function getAuthHeaders() {
    var token = sessionStorage.getItem("TOKEN");
    if (!token) return {};
    return { Authorization: "Bearer " + token };
  }

  function toLabel(key) {
    return key.replace(/_/g, " ").replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }
})();
