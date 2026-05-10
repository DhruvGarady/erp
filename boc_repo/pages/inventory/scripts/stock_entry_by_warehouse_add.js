var viewGoodsReceiptId;
var isViewMode = false;
var vendors = [];
var warehouses = [];
var materials = [];
var uoms = [];
var stockEntryItems = [];
var stockEntryItemsTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  stockEntryItemsTemplate = $("#stockEntryItemsTmpl").html();

  var params = new URLSearchParams(window.location.search);
  viewGoodsReceiptId = params.get("id");
  isViewMode = (params.get("mode") || "").toLowerCase() === "view";

  $("#stockEntryItemsContainer").on("change", ".lineMaterial", function () {
    onLineMaterialChange($(this).closest("tr"));
  });

  $("#stockEntryItemsContainer").on("input change", ".stock-entry-line-input", function () {
    syncStockEntryRows();
    calculateLineAmounts();
  });

  loadLookups()
    .done(function () {
      renderVendorOptions();
      renderWarehouseOptions();
      renderStockEntryItems();

      if (viewGoodsReceiptId) {
        $("#pageTitle").text("View Stock Entry:");
        loadGoodsReceiptDetails(viewGoodsReceiptId);
      } else {
        $("#pageTitle").text("Add Stock Entry:");
        $("#goods_receipt_date").val(todayString());
        $("#status").val("Posted");
        loadNextGoodsReceiptNo();
        addStockEntryItem();
      }
    })
    .fail(function () {
      showErrorDialog("Unable to load vendor, warehouse, material, or UOM lookup values.");
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
    getMasterList("mst_vendor"),
    getMasterList("mst_warehouse"),
    getMasterList("mst_material"),
    getMasterList("mst_uom")
  ).done(function (vendorRows, warehouseRows, materialRows, uomRows) {
    vendors = vendorRows || [];
    warehouses = warehouseRows || [];
    materials = materialRows || [];
    uoms = uomRows || [];
  });
}

function renderVendorOptions() {
  var html = '<option value="">Select</option>';
  _.each(vendors, function (vendor) {
    var text = (vendor.vendor_code ? vendor.vendor_code + " - " : "") + (vendor.vendor_name || "");
    html += '<option value="' + vendor.vendor_id + '">' + escapeHtml(text) + "</option>";
  });
  $("#vendor_id").html(html);
}

function renderWarehouseOptions() {
  var html = '<option value="">Select</option>';
  _.each(warehouses, function (warehouse) {
    var text = (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "");
    html += '<option value="' + warehouse.warehouse_id + '">' + escapeHtml(text) + "</option>";
  });
  $("#warehouse_id").html(html);
}

function loadNextGoodsReceiptNo() {
  $.ajax({
    type: "GET",
    url: request_url + "/goodsreceipt/nextno",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      $("#goods_receipt_no").val(res && res.goods_receipt_no ? res.goods_receipt_no : "");
    },
    error: function () {
      showErrorDialog("Unable to generate GRN number.");
    }
  });
}

function addStockEntryItem(item) {
  if (isViewMode) return;

  stockEntryItems.push($.extend({
    material_id: "",
    material_code: "",
    item_name: "",
    uom_id: "",
    received_qty: 1,
    rate: 0,
    line_amount: 0,
    remarks: ""
  }, item || {}));

  renderStockEntryItems();
}

function deleteStockEntryItem(index) {
  if (isViewMode) return;
  stockEntryItems.splice(index, 1);
  renderStockEntryItems();
}

function renderStockEntryItems() {
  var template = _.template(stockEntryItemsTemplate);

  $("#stockEntryItemsContainer").html(template({
    items: stockEntryItems || [],
    materials: materials || [],
    uoms: uoms || [],
    readonly: isViewMode
  }));
  $("#stockEntryItemsContainer").trigger("create");
}

function onLineMaterialChange(row) {
  var index = cleanInt(row.attr("data-index"), null);
  var materialId = row.find(".lineMaterial").val();
  var material = findMaterial(materialId);

  if (index === null || !material) {
    return;
  }

  stockEntryItems[index].material_id = cleanInt(material.material_id, null);
  stockEntryItems[index].material_code = material.material_code || "";
  stockEntryItems[index].item_name = material.material_name || "";
  stockEntryItems[index].uom_id = cleanInt(material.purchase_uom_id || material.base_uom_id || material.uom_id, null);
  stockEntryItems[index].rate = cleanDecimal(material.purchase_rate, cleanDecimal(material.standard_rate, stockEntryItems[index].rate || 0));
  stockEntryItems[index].line_amount = cleanDecimal(stockEntryItems[index].received_qty, 0) * cleanDecimal(stockEntryItems[index].rate, 0);

  renderStockEntryItems();
}

function syncStockEntryRows() {
  $("#stockEntryItemsContainer table.dataTbl tr").not(":first").each(function () {
    var row = $(this);
    var index = cleanInt(row.attr("data-index"), null);
    var material = findMaterial(row.find(".lineMaterial").val());

    if (index === null || !stockEntryItems[index]) {
      return;
    }

    stockEntryItems[index].material_id = cleanInt(row.find(".lineMaterial").val(), null);
    stockEntryItems[index].material_code = material ? material.material_code || "" : row.find(".lineMaterialCode").val();
    stockEntryItems[index].item_name = material ? material.material_name || "" : "";
    stockEntryItems[index].uom_id = cleanInt(row.find(".lineUom").val(), null);
    stockEntryItems[index].received_qty = cleanDecimal(row.find(".lineQty").val(), 0);
    stockEntryItems[index].rate = cleanDecimal(row.find(".lineRate").val(), 0);
    stockEntryItems[index].line_amount = stockEntryItems[index].received_qty * stockEntryItems[index].rate;
    stockEntryItems[index].remarks = $.trim(row.find(".lineRemarks").val() || "");
  });
}

function calculateLineAmounts() {
  $("#stockEntryItemsContainer table.dataTbl tr").not(":first").each(function () {
    var qty = cleanDecimal($(this).find(".lineQty").val(), 0);
    var rate = cleanDecimal($(this).find(".lineRate").val(), 0);
    $(this).find(".lineAmount").val(formatAmount(qty * rate));
  });
}

function buildPayload() {
  syncStockEntryRows();

  var warehouseId = cleanInt($("#warehouse_id").val(), null);
  var vendor = findVendor($("#vendor_id").val());
  var userId = cleanInt(sessionStorage.getItem("USER_ID"), null);

  return {
    header: {
      goods_receipt_no: $.trim($("#goods_receipt_no").val() || ""),
      goods_receipt_date: $("#goods_receipt_date").val(),
      reference_type: $("#reference_type").val(),
      reference_id: cleanInt($("#reference_id").val(), null),
      reference_no: $.trim($("#reference_no").val() || ""),
      vendor_id: cleanInt($("#vendor_id").val(), null),
      vendor_name: vendor ? vendor.vendor_name || "" : "",
      warehouse_id: warehouseId,
      remarks: $.trim($("#remarks").val() || ""),
      status: $("#status").val() || "Posted",
      created_by: userId,
      updated_by: userId,
      is_active: "Y"
    },
    items: _.map(stockEntryItems, function (item) {
      return {
        material_id: cleanInt(item.material_id, null),
        material_code: item.material_code || "",
        item_name: item.item_name || "",
        uom_id: cleanInt(item.uom_id, null),
        received_qty: cleanDecimal(item.received_qty, 0),
        rate: cleanDecimal(item.rate, 0),
        line_amount: cleanDecimal(item.line_amount, cleanDecimal(item.received_qty, 0) * cleanDecimal(item.rate, 0)),
        remarks: item.remarks || "",
        is_active: "Y"
      };
    })
  };
}

function validatePayload(payload) {
  if (!payload.header.goods_receipt_no) {
    showWarningDialog("GRN number is required.");
    return false;
  }

  if (!payload.header.goods_receipt_date) {
    showWarningDialog("GRN date is required.");
    return false;
  }

  if (!payload.header.warehouse_id) {
    showWarningDialog("Warehouse is required.");
    return false;
  }

  if (!payload.items.length) {
    showWarningDialog("At least one material row is required.");
    return false;
  }

  var validItems = _.filter(payload.items, function (item) {
    return item.material_id && cleanDecimal(item.received_qty, 0) > 0;
  });

  if (validItems.length !== payload.items.length) {
    showWarningDialog("Each item must have material and received quantity greater than zero.");
    return false;
  }

  return true;
}

function saveStockEntry() {
  if (isViewMode) return;

  var payload = buildPayload();

  if (!validatePayload(payload)) {
    return;
  }

  $.ajax({
    type: "POST",
    url: request_url + "/goodsreceipt/create",
    headers: getAuthHeaders(),
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: function () {
      showSuccessDialog("Stock entry posted successfully.", function () {
        backToInquiry();
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
        return;
      }

      var message = "There was a problem posting the stock entry.";
      if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
        message = xhr.responseJSON.error;
      }
      showErrorDialog(message);
    }
  });
}

function loadGoodsReceiptDetails(goodsReceiptId) {
  $.ajax({
    type: "GET",
    url: request_url + "/goodsreceipt/" + goodsReceiptId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      var header = res && res.header ? res.header : {};
      var items = res && res.items ? res.items : [];

      $("#goods_receipt_no").val(header.goods_receipt_no || "");
      $("#goods_receipt_date").val(normalizeDate(header.goods_receipt_date));
      $("#reference_type").val(header.reference_type || "");
      $("#reference_id").val(header.reference_id || "");
      $("#reference_no").val(header.reference_no || "");
      $("#vendor_id").val(header.vendor_id || "");
      $("#warehouse_id").val(header.warehouse_id || "");
      $("#remarks").val(header.remarks || "");
      $("#status").val(header.status || "Posted");

      stockEntryItems = _.map(items, function (item) {
        return {
          material_id: item.material_id || "",
          material_code: item.material_code || "",
          item_name: item.item_name || "",
          uom_id: item.uom_id || "",
          received_qty: cleanDecimal(item.received_qty, 0),
          rate: cleanDecimal(item.rate, 0),
          line_amount: cleanDecimal(item.line_amount, 0),
          remarks: item.remarks || ""
        };
      });

      applyViewMode();
      renderStockEntryItems();
    },
    error: function () {
      showErrorDialog("Unable to load stock entry details.");
    }
  });
}

function applyViewMode() {
  if (!isViewMode) return;

  $("#saveStockEntryBtn").hide();
  $("#addStockEntryRowBtn").hide();
  $("#goods_receipt_date, #warehouse_id, #vendor_id, #status, #reference_type, #reference_id, #reference_no, #remarks").prop("disabled", true);
}

function findMaterial(materialId) {
  return _.find(materials || [], function (item) {
    return String(item.material_id) === String(materialId);
  });
}

function findVendor(vendorId) {
  return _.find(vendors || [], function (item) {
    return String(item.vendor_id) === String(vendorId);
  });
}

function todayString() {
  var date = new Date();
  var month = String(date.getMonth() + 1).padStart(2, "0");
  var day = String(date.getDate()).padStart(2, "0");
  return date.getFullYear() + "-" + month + "-" + day;
}

function normalizeDate(value) {
  return value ? String(value).substring(0, 10) : "";
}

function cleanInt(value, fallback) {
  var num = parseInt(value, 10);
  return isNaN(num) ? fallback : num;
}

function cleanDecimal(value, fallback) {
  var num = parseFloat(value);
  return isNaN(num) ? fallback : num;
}

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function backToInquiry() {
  location.href = "stock_entry_by_warehouseinq.html";
}
