(function () {
  var entity = null;
  var cfg = null;
  var canManage = false;
  var currentId = null;

  $(function () {
    if (!initErpShell({
      loginPath: "../../index.html",
      logoutPath: "../../index.html",
      sidebarStateKey: "ERP_SIDEBAR"
    })) return;

    entity = window.MASTER_ENTITY;
    cfg = window.MASTERDATA_CONFIG[entity];
    if (!cfg) {
      showWarningDialog("Invalid master configuration.");
      return;
    }

    canManage = hasRole((cfg.roles && cfg.roles.manage) || []);
    buildStatic();
    renderSideMenu();
    renderListHead();
    renderFormFields();
    bindEvents();
    loadRefs().then(loadList);
  });

  function buildStatic() {
    $("#spTopTitle").text(cfg.label + " Inquiry");
    $("#spHeroTitle").text(cfg.label + " Master");
    $("#spHeroText").text("Simple inquiry, add, and edit flow on one screen for " + cfg.label.toLowerCase() + " master data.");
    $("#spBtnAdd").text("Add " + cfg.label);
    $("#spCardTitle").text(cfg.label + " List");
    $("#spFormTitle").text("Add / Edit " + cfg.label);
    $("#spSaveBtn").text("Save " + cfg.label);
    if (!canManage) {
      $("#spBtnAdd").prop("disabled", true).text("View Only");
      $("#spSaveBtn").hide();
      $("#spDeactivateBtn").hide();
    }
  }

  function renderSideMenu() {
    var html = "";
    $.each(window.MASTERDATA_MENU, function (_, m) {
      html += '<a href="' + m.entity + '_inq.html" class="panel-link ' + (m.entity === entity ? "active" : "") + '">' + m.label + "</a>";
    });
    $("#mdSideMenu").html(html);
  }

  function renderListHead() {
    var th = "<tr><th>#</th>";
    $.each(cfg.listColumns || [], function (_, c) {
      th += "<th>" + labelize(c) + "</th>";
    });
    th += "<th>Status</th><th>Action</th></tr>";
    $("#spTableHead").html(th);
  }

  function renderFormFields() {
    var html = "";
    $.each(cfg.formFields || [], function (_, f) {
      html += '<div class="col-lg-4 col-md-6 form-group">';
      html += '<label class="sp-label" for="' + f.key + '">' + f.label + (f.required ? " *" : "") + "</label>";
      if (f.type === "textarea") {
        html += '<textarea class="sp-textarea" id="' + f.key + '"></textarea>';
      } else if (f.type === "select" || f.type === "ref") {
        html += '<select class="sp-select" id="' + f.key + '"></select>';
      } else {
        var t = (f.type === "email" || f.type === "number") ? f.type : "text";
        html += '<input type="' + t + '" class="sp-input" id="' + f.key + '">';
      }
      html += "</div>";
    });
    $("#spFormFields").html(html);

    $.each(cfg.formFields || [], function (_, f) {
      if (f.type === "select" && f.options) {
        var opt = '<option value="">Select</option>';
        $.each(f.options, function (_, o) { opt += '<option value="' + o.v + '">' + o.t + "</option>"; });
        $("#" + f.key).html(opt);
      }
    });
  }

  function bindEvents() {
    $("#spBtnSearch").on("click", loadList);
    $("#spSearch").on("keyup", function (e) { if (e.key === "Enter") loadList(); });
    $("#spBtnRefresh").on("click", loadList);

    $("#spBtnAdd").on("click", function () {
      if (!canManage) return;
      resetForm();
    });

    $(document).on("click", ".spEditRow", function () {
      if (!canManage) return;
      loadRecord($(this).data("id"));
    });

    $("#spForm").on("submit", function (e) {
      e.preventDefault();
      if (!canManage) return;
      saveRecord();
    });

    $("#spCancelBtn").on("click", function () { resetForm(); });
    $("#spDeactivateBtn").on("click", deactivateRecord);
  }

  function loadList() {
    var query = "limit=300&page=1";
    var s = $.trim($("#spSearch").val() || "");
    if (s) query += "&search=" + encodeURIComponent(s);
    $.ajax({
      type: "GET",
      url: request_url + "/api/v1/" + cfg.table + "?" + query,
      headers: auth(),
      success: function (r) { renderRows(r.data || []); },
      error: function () { renderRows([]); showSystemError("Unable to load records."); }
    });
  }

  function renderRows(rows) {
    if (!rows.length) {
      $("#spTableBody").html('<tr><td class="sp-empty" colspan="99">No records found.</td></tr>');
      return;
    }
    var html = "";
    $.each(rows, function (i, row) {
      html += "<tr><td>" + (i + 1) + "</td>";
      $.each(cfg.listColumns || [], function (_, c) {
        html += "<td>" + safe(row[c]) + "</td>";
      });
      var active = (row.is_active || "Y") === "Y";
      html += '<td><span class="sp-tag">' + (active ? "Active" : "Inactive") + "</span></td>";
      html += "<td>" + (canManage ? ('<button type="button" class="sp-btn-edit spEditRow" data-id="' + row[cfg.pk] + '">Edit</button>') : "View") + "</td></tr>";
    });
    $("#spTableBody").html(html);
  }

  function loadRecord(id) {
    $.ajax({
      type: "GET",
      url: request_url + "/api/v1/" + cfg.table + "/" + encodeURIComponent(id),
      headers: auth(),
      success: function (row) {
        currentId = id;
        $.each(cfg.formFields || [], function (_, f) {
          $("#" + f.key).val(row[f.key] === null || row[f.key] === undefined ? "" : row[f.key]);
        });
        $("#spFormTitle").text("Edit " + cfg.label);
        $("#spSaveBtn").text("Update " + cfg.label);
      },
      error: function () { showSystemError("Unable to load record details."); }
    });
  }

  function saveRecord() {
    var payload = collect();
    var err = validate(payload);
    if (err) {
      showWarningDialog(err);
      return;
    }

    $("#spSaveBtn").prop("disabled", true);
    checkDup(payload).then(function (dup) {
      if (dup) {
        $("#spSaveBtn").prop("disabled", false);
        showWarningDialog(dup);
        return;
      }

      var method = currentId ? "PUT" : "POST";
      var url = request_url + "/api/v1/" + cfg.table + (currentId ? "/" + encodeURIComponent(currentId) : "");
      $.ajax({
        type: method,
        url: url,
        headers: auth(),
        contentType: "application/json",
        data: JSON.stringify(payload),
        success: function () {
          showSuccessDialog("Saved successfully.");
          resetForm();
          loadList();
        },
        error: function (x) {
          showSystemError((x.responseJSON && x.responseJSON.error) || "Save failed.");
        },
        complete: function () {
          $("#spSaveBtn").prop("disabled", false);
        }
      });
    });
  }

  function deactivateRecord() {
    if (!currentId) {
      showWarningDialog("Select a record first.");
      return;
    }
    showConfirmDialog("Deactivate this record?", function () {
      $.ajax({
        type: "DELETE",
        url: request_url + "/api/v1/" + cfg.table + "/" + encodeURIComponent(currentId),
        headers: auth(),
        contentType: "application/json",
        data: JSON.stringify({ updated_by: sessionStorage.getItem("USERNAME") || "system" }),
        success: function () {
          showSuccessDialog("Record deactivated.");
          resetForm();
          loadList();
        },
        error: function (x) {
          showSystemError((x.responseJSON && x.responseJSON.error) || "Deactivation failed.");
        }
      });
    });
  }

  function collect() {
    var d = {};
    $.each(cfg.formFields || [], function (_, f) {
      var val = $("#" + f.key).val();
      if (f.type === "number") d[f.key] = val === "" ? null : Number(val);
      else d[f.key] = val === "" ? null : val;
    });
    if (!currentId) d.created_by = sessionStorage.getItem("USERNAME") || "system";
    d.updated_by = sessionStorage.getItem("USERNAME") || "system";
    return d;
  }

  function validate(p) {
    var fields = cfg.formFields || [];
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (f.required && (p[f.key] === null || p[f.key] === "" || p[f.key] === undefined)) return f.label + " is required.";
      if (f.type === "email" && p[f.key] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p[f.key])) return "Invalid email.";
      if (f.type === "number" && p[f.key] !== null && isNaN(p[f.key])) return f.label + " must be numeric.";
    }
    return "";
  }

  function checkDup(payload) {
    var keys = cfg.uniqueKeys || [];
    if (!keys.length) return Promise.resolve("");
    return $.ajax({
      type: "GET",
      url: request_url + "/api/v1/" + cfg.table + "?is_active=Y&limit=500&page=1",
      headers: auth()
    }).then(function (r) {
      var rows = r.data || [];
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = payload[k];
        if (!v) continue;
        var exists = $.grep(rows, function (row) {
          return (!currentId || String(row[cfg.pk]) !== String(currentId)) &&
            String(row[k] || "").toLowerCase() === String(v).toLowerCase();
        }).length > 0;
        if (exists) return labelize(k) + " already exists.";
      }
      return "";
    }).catch(function () { return ""; });
  }

  function loadRefs() {
    var refs = $.grep(cfg.formFields || [], function (f) { return f.type === "ref" && f.ref && f.ref.entity; });
    if (!refs.length) return Promise.resolve();
    return Promise.all($.map(refs, function (f) {
      var refCfg = window.MASTERDATA_CONFIG[f.ref.entity];
      return $.ajax({
        type: "GET",
        url: request_url + "/api/v1/" + refCfg.table + "?is_active=Y&limit=300&page=1",
        headers: auth()
      }).then(function (r) {
        var opt = '<option value="">Select</option>';
        $.each(r.data || [], function (_, row) {
          var parts = [];
          $.each(f.ref.labelKeys || [], function (__, lk) { if (row[lk]) parts.push(row[lk]); });
          opt += '<option value="' + row[f.ref.key] + '">' + parts.join(" - ") + "</option>";
        });
        $("#" + f.key).html(opt);
      });
    }));
  }

  function resetForm() {
    currentId = null;
    $("#spForm")[0].reset();
    $.each(cfg.formFields || [], function (_, f) {
      if (f.type === "select" && f.options) {
        $("#" + f.key).val("");
      }
    });
    $("#spFormTitle").text("Add / Edit " + cfg.label);
    $("#spSaveBtn").text("Save " + cfg.label);
    loadRefs();
  }

  function hasRole(allowed) {
    var role = (sessionStorage.getItem("ROLE_NAME") || "").toLowerCase();
    return $.inArray(role, $.map(allowed, function (v) { return String(v || "").toLowerCase(); })) > -1;
  }

  function auth() {
    var t = sessionStorage.getItem("TOKEN");
    return t ? { Authorization: "Bearer " + t } : {};
  }

  function labelize(s) {
    return String(s).replace(/_/g, " ").replace(/\b\w/g, function (m) { return m.toUpperCase(); });
  }

  function safe(v) {
    return (v === null || v === undefined || v === "") ? "-" : String(v);
  }
})();
