var editIndentId;
var materials = [];
var uoms = [];
var warehouses = [];
var indentItems = [];
var indentItemsTemplate;
var indentStatus = "Draft";

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  setPageFeature("PUR_INDENT");
  applyRecordPermissions();

  indentItemsTemplate = $("#indentItemsTmpl").html();

  var params = new URLSearchParams(window.location.search);
  editIndentId = params.get("id");

  $("#indentItemsContainer").on("change", ".lineMaterial", function () {
    onLineMaterialChange($(this).closest("tr"));
  });

  // Update the computed labels in place. Re-rendering here would
  // replace the input being typed into and drop focus after every
  // keystroke -- the grid is only rebuilt on a structural change.
  $("#indentItemsContainer").on("input change", ".indent-line-input, .indent-line-select", function () {
    syncIndentItemRows();
    updateLineTotals();
  });

  loadLookups()
    .done(function () {
      renderWarehouseOptions();

      if (editIndentId) {
        $("#pageTitle").text("Edit Purchase Indent:");
        loadIndentDetails(editIndentId);
      } else {
        $("#pageTitle").text("Add Purchase Indent:");
        $("#indent_date").val(todayString());
        $("#requested_by_name").val(sessionStorage.getItem("FULL_NAME") || sessionStorage.getItem("USERNAME") || "");
        loadNextIndentNo();
        addIndentItem();
      }
    })
    .fail(function () {
      showErrorDialog("Unable to load material, UOM or warehouse data.");
    });
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

function getMasterList(tableName, params) {
  var query = $.param($.extend({ page: 1, limit: 5000, is_active: "Y" }, params || {}));
  return $.ajax({
    type: "GET",
    url: request_url + "/api/v1/" + tableName + "?" + query,
    headers: getAuthHeaders(),
    contentType: "application/json"
  }).then(function (res) {
    return res && res.data ? res.data : [];
  });
}

function loadLookups() {
  return $.when(
    getMasterList("mst_material"),
    getMasterList("mst_uom"),
    getMasterList("mst_warehouse")
  ).done(function (materialRows, uomRows, warehouseRows) {
    materials = materialRows || [];
    uoms = uomRows || [];
    warehouses = warehouseRows || [];
  });
}

function renderWarehouseOptions(selectedWarehouseId) {
  var html = '<option value="">Select</option>';
  _.each(warehouses, function (warehouse) {
    var selected = String(selectedWarehouseId || "") === String(warehouse.warehouse_id) ? " selected" : "";
    html += '<option value="' + warehouse.warehouse_id + '"' + selected + ">" + (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "") + "</option>";
  });
  $("#warehouse_id").html(html);
}

function loadNextIndentNo() {
  $.ajax({
    type: "GET",
    url: request_url + "/purchaseindent/nextno",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      $("#indent_no").val((res && res.indent_no) || "");
    },
    error: function () {
      $("#indent_no").val("");
    }
  });
}

function findMaterial(materialId) {
  return _.find(materials, function (material) {
    return String(material.material_id) === String(materialId);
  });
}

function addIndentItem() {
  if (isReadOnly()) return;

  syncIndentItemRows();
  indentItems.push({
    line_no: indentItems.length + 1,
    material_id: "",
    material_code: "",
    item_name: "",
    item_description: "",
    uom_id: "",
    unit: "",
    qty: 1,
    required_by_date: $("#required_by_date").val() || "",
    estimated_rate: 0,
    estimated_value: 0
  });
  renderIndentItems();
}

function deleteIndentItem(index) {
  if (isReadOnly()) return;

  syncIndentItemRows();
  indentItems.splice(index, 1);
  renderIndentItems();
}

function onLineMaterialChange(row) {
  var index = Number(row.data("index"));
  var materialId = row.find(".lineMaterial").val();
  var material = findMaterial(materialId);

  syncIndentItemRows();

  if (!indentItems[index]) return;

  indentItems[index].material_id = materialId;
  indentItems[index].material_code = material ? (material.material_code || "") : "";
  indentItems[index].item_name = material ? (material.material_name || "") : "";

  if (material && material.base_uom_id) {
    indentItems[index].uom_id = material.base_uom_id;
    row.find(".lineUom").val(material.base_uom_id);
    indentItems[index].unit = getUomText(material.base_uom_id);
  }

  row.find(".lineMaterialCode").val(indentItems[index].material_code);
  updateLineTotals();
}

// The module-level array is the source of truth; the DOM is re-rendered
// wholesale. Read the edits back before any structural change or they
// are lost with the old markup.
function syncIndentItemRows() {
  $("#indentItemsContainer tr[data-index]").each(function () {
    var row = $(this);
    var index = Number(row.data("index"));
    if (!indentItems[index]) return;

    var materialId = row.find(".lineMaterial").val();
    var material = findMaterial(materialId);

    indentItems[index].material_id = materialId;
    indentItems[index].material_code = material ? (material.material_code || "") : indentItems[index].material_code;
    indentItems[index].item_name = material ? (material.material_name || "") : indentItems[index].item_name;
    indentItems[index].item_description = row.find(".lineDescription").val();
    indentItems[index].qty = cleanDecimal(row.find(".lineQty").val(), 0);
    indentItems[index].uom_id = row.find(".lineUom").val();
    indentItems[index].unit = getUomText(row.find(".lineUom").val());
    indentItems[index].required_by_date = row.find(".lineRequiredBy").val();
    indentItems[index].estimated_rate = cleanDecimal(row.find(".lineRate").val(), 0);
    indentItems[index].estimated_value = calculateLineValue(indentItems[index]);
  });
}

function getUomText(uomId) {
  var uom = _.find(uoms, function (row) {
    return String(row.uom_id) === String(uomId);
  });
  return uom ? (uom.uom_code || uom.uom_name || "") : "";
}

// Mirrors estimated_value in purchase_api.js. The server recomputes it
// on save, so this is a preview, not the stored figure.
function calculateLineValue(item) {
  var qty = Number((item && item.qty) || 0);
  var rate = Number((item && item.estimated_rate) || 0);
  return Math.round(qty * rate * 100) / 100;
}

function estimatedTotal() {
  return _.reduce(indentItems, function (sum, item) {
    return sum + calculateLineValue(item);
  }, 0);
}

// Writes the derived figures back into the existing markup. Everything
// here is a <span>, never an input, so nothing the user is editing is
// touched.
function updateLineTotals() {
  $("#indentItemsContainer tr[data-index]").each(function () {
    var row = $(this);
    var item = indentItems[Number(row.data("index"))];
    if (!item) return;

    row.find(".lineValueLabel").text(formatAmount(calculateLineValue(item)));
  });

  $("#estimatedTotalLabel").text(formatAmount(estimatedTotal()));
}

function renderIndentItems() {
  var template = _.template(indentItemsTemplate);
  $("#indentItemsContainer").html(template({
    items: indentItems,
    materials: materials,
    uoms: uoms,
    estimatedTotal: estimatedTotal(),
    formatAmount: formatAmount,
    normalizeDate: normalizeDate
  }));
  updateLineTotals();
}

function loadIndentDetails(indentId) {
  $.ajax({
    type: "GET",
    url: request_url + "/purchaseindent/" + indentId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      var header = (res && res.header) || {};
      indentItems = (res && res.items) || [];
      indentStatus = header.status || "Draft";

      $("#indent_no").val(header.indent_no || "");
      $("#indent_date").val(normalizeDate(header.indent_date));
      $("#required_by_date").val(normalizeDate(header.required_by_date));
      $("#department").val(header.department || "");
      $("#requested_by_name").val(header.requested_by_name || "");
      $("#priority").val(header.priority || "Normal");
      $("#reference_no").val(header.reference_no || "");
      $("#purpose").val(header.purpose || "");
      $("#remarks").val(header.remarks || "");
      renderWarehouseOptions(header.warehouse_id);

      $("#statusDisplay").val(header.status || "");
      $("#approvalStatusDisplay").val(header.approval_status || "");
      $("#approvedByDisplay").val(header.approved_by_name || "");
      $("#approvalRemarksDisplay").val(header.approval_remarks || "");
      $("#workflowPanel").show();

      applyStatusLock();
      renderIndentItems();
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
        return;
      }
      showErrorDialog("Unable to load this purchase indent.");
    }
  });
}

// Two separate reasons a screen can be read-only, and they compose:
// the grant (applyRecordPermissions, a body class) and the workflow
// state. Anything past Draft is locked for everyone, approver included,
// because the API refuses the write regardless of who is asking.
function applyStatusLock() {
  if (indentStatus === "Draft") return;

  $("body").addClass("perm-readonly");
  $("#addRowButton").hide();
  $("#pageTitle").text("View Purchase Indent (" + indentStatus + "):");
}

function isReadOnly() {
  return $("body").hasClass("perm-readonly");
}

function buildPayload() {
  syncIndentItemRows();

  var header = {
    indent_date: $("#indent_date").val() || null,
    required_by_date: $("#required_by_date").val() || null,
    department: $.trim($("#department").val() || ""),
    requested_by_id: cleanInt(sessionStorage.getItem("USER_ID"), null),
    requested_by_name: $.trim($("#requested_by_name").val() || ""),
    warehouse_id: cleanInt($("#warehouse_id").val(), null),
    warehouse_name: $("#warehouse_id option:selected").text() === "Select" ? null : $.trim($("#warehouse_id option:selected").text()),
    priority: $("#priority").val() || "Normal",
    purpose: $.trim($("#purpose").val() || ""),
    reference_no: $.trim($("#reference_no").val() || ""),
    remarks: $.trim($("#remarks").val() || ""),
    created_by: sessionStorage.getItem("USER_ID"),
    updated_by: sessionStorage.getItem("USER_ID")
  };

  var items = _.map(indentItems, function (item, index) {
    return {
      line_no: index + 1,
      material_id: cleanInt(item.material_id, null),
      material_code: item.material_code || "",
      item_name: item.item_name || "",
      item_description: item.item_description || "",
      uom_id: cleanInt(item.uom_id, null),
      unit: item.unit || "",
      qty: cleanDecimal(item.qty, 0),
      required_by_date: item.required_by_date || null,
      estimated_rate: cleanDecimal(item.estimated_rate, 0),
      remarks: item.remarks || ""
    };
  });

  return { header: header, items: items };
}

function validateForm(payload) {
  if (!payload.header.indent_date) {
    showWarningDialog("Indent date is required.");
    return false;
  }

  if (!payload.header.required_by_date) {
    showWarningDialog("Required-by date is required.");
    return false;
  }

  if (payload.header.required_by_date < payload.header.indent_date) {
    showWarningDialog("Required-by date cannot be earlier than the indent date.");
    return false;
  }

  if (!payload.header.department) {
    showWarningDialog("Department is required.");
    return false;
  }

  if (!payload.items.length) {
    showWarningDialog("At least one indent item is required.");
    return false;
  }

  for (var i = 0; i < payload.items.length; i++) {
    if (!payload.items[i].material_id) {
      showWarningDialog("Material is required for every indent item.");
      return false;
    }

    if (!payload.items[i].qty || Number(payload.items[i].qty) <= 0) {
      showWarningDialog("Quantity must be greater than zero for every indent item.");
      return false;
    }
  }

  return true;
}

function saveIndent() {
  if (!ensurePermission(editIndentId ? "edit" : "create", "You do not have permission to save records here.")) return;

  if (isReadOnly()) {
    showWarningDialog("This indent is " + indentStatus.toLowerCase() + " and can no longer be edited.");
    return;
  }

  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editIndentId;
  var url = request_url + (isEdit ? "/purchaseindent/update/" + editIndentId : "/purchaseindent/create");
  var method = isEdit ? "PUT" : "POST";

  if (isEdit) {
    delete payload.header.created_by;
  }

  $.ajax({
    type: method,
    url: url,
    headers: getAuthHeaders(),
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: function () {
      showSuccessDialog(isEdit ? "Purchase indent updated successfully." : "Purchase indent created successfully.", function () {
        location.href = "purchase_indent_inq.html";
      });
    },
    error: function (xhr) {
      handleSaveError(xhr, "There was a problem saving the purchase indent.");
    },
    complete: function () {
      $(".searchButton").prop("disabled", false);
    }
  });
}

function handleSaveError(xhr, fallbackMessage) {
  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  var message = xhr && xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : fallbackMessage;
  showErrorDialog(message);
}

function backToInquiry() {
  location.href = "purchase_indent_inq.html";
}

function cleanInt(value, fallback) {
  var parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function cleanDecimal(value, fallback) {
  var parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

function formatAmount(value) {
  var amount = Number(value || 0);
  if (isNaN(amount)) return "0.00";
  return amount.toFixed(2);
}

// mysql2 hands back a DATE column as a JS Date at local midnight, which
// JSON-serializes to the day before in UTC -- "2026-09-15" arrives as
// "2026-09-14T18:30:00.000Z" here. Slicing that string, which is what
// the sales pages do, displays and re-saves the wrong day, and the date
// walks backwards once per edit. Reading the local components back
// recovers the day the user actually picked. A plain "YYYY-MM-DD"
// string is passed through untouched.
function normalizeDate(value) {
  if (!value) return "";

  var text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  var parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    return text.slice(0, 10);
  }

  return parsed.getFullYear() + "-" + pad2(parsed.getMonth() + 1) + "-" + pad2(parsed.getDate());
}

function pad2(value) {
  return (value < 10 ? "0" : "") + value;
}

// Local date, not toISOString(). The sales pages use the UTC form, which
// rolls over at 18:30 here -- an indent raised at 7pm defaults to
// yesterday. padStart is ES2017; these page scripts are ES5.
function todayString() {
  var today = new Date();
  return today.getFullYear() + "-" + pad2(today.getMonth() + 1) + "-" + pad2(today.getDate());
}
