var goodsReceiptData = [];
var goodsReceiptTemplate;
var warehouses = [];

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  goodsReceiptTemplate = $("#listTmpl").html();
  $("#stockEntryTableSearch").on("input", filterStockEntryTable);

  loadWarehouseLookup()
    .always(function () {
      setupStockEntryInquiryAutocomplete();
      renderList([]);
      search();
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

function loadWarehouseLookup() {
  return getMasterList("mst_warehouse")
    .done(function (rows) {
      warehouses = rows || [];
      renderWarehouseSearchOptions();
    })
    .fail(function () {
      warehouses = [];
      renderWarehouseSearchOptions();
    });
}

function renderWarehouseSearchOptions() {
  var html = '<option value="">ALL</option>';
  _.each(warehouses, function (warehouse) {
    var text = (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "");
    html += '<option value="' + warehouse.warehouse_id + '">' + text + "</option>";
  });
  $("#warehouseSearch").html(html);
}

function setupStockEntryInquiryAutocomplete() {
  setupApiAutocompleteList(request_url + "/goodsreceipt/list", [
    { selector: "#grnNoSearch", hiddenSelector: "#grnNoSearchId", valueField: "goods_receipt_no", idField: "goods_receipt_id" },
    { selector: "#vendorSearch", hiddenSelector: "#vendorSearchId", valueField: "vendor_name", idField: "vendor_id" }
  ]);
}

function search() {
  var fromDate = $("#fromDateSearch").val();
  var toDate = $("#toDateSearch").val();

  if (fromDate && toDate && fromDate > toDate) {
    showWarningDialog("From Date cannot be greater than To Date.");
    return;
  }

  $.ajax({
    type: "GET",
    url: request_url + "/goodsreceipt/list",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (rows) {
      goodsReceiptData = rows || [];
      renderList(filterGoodsReceipts(goodsReceiptData));
    },
    error: onSearchErr
  });
}

function filterGoodsReceipts(rows) {
  var grnNo = $.trim($("#grnNoSearch").val() || "").toLowerCase();
  var vendor = $.trim($("#vendorSearch").val() || "").toLowerCase();
  var warehouseId = $("#warehouseSearch").val();
  var fromDate = $("#fromDateSearch").val();
  var toDate = $("#toDateSearch").val();
  var status = $("#statusSearch").val();

  return _.filter(rows || [], function (item) {
    var grnDate = normalizeDate(item.goods_receipt_date);
    var grnNoText = String(item.goods_receipt_no || "").toLowerCase();
    var refText = String(item.reference_no || "").toLowerCase();
    var vendorText = String(item.vendor_name || "").toLowerCase();
    var statusText = String(item.status || "");

    if (grnNo && grnNoText.indexOf(grnNo) === -1 && refText.indexOf(grnNo) === -1) return false;
    if (vendor && vendorText.indexOf(vendor) === -1) return false;
    if (warehouseId && String(item.warehouse_id || "") !== String(warehouseId)) return false;
    if (status && statusText !== status) return false;
    if (fromDate && (!grnDate || grnDate < fromDate)) return false;
    if (toDate && (!grnDate || grnDate > toDate)) return false;

    return true;
  });
}

function onSearchErr(xhr) {
  goodsReceiptData = [];
  renderList([]);

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch stock entry records.");
}

function renderList(rows) {
  var template = _.template(goodsReceiptTemplate);

  $("#listContainer2").html(template({
    goodsReceipts: rows || [],
    formatDate: formatDate,
    warehouseName: warehouseName
  }));
  filterStockEntryTable();
  $("#listContainer2").trigger("create");
}

function filterStockEntryTable() {
  var searchText = $.trim($("#stockEntryTableSearch").val() || "").toLowerCase();
  var rows = $("#listContainer2 table.dataTbl tr").not(":first");

  if (!searchText) {
    rows.show();
    return;
  }

  rows.each(function () {
    var rowText = $(this).text().toLowerCase();
    $(this).toggle(rowText.indexOf(searchText) !== -1);
  });
}

function normalizeDate(value) {
  return value ? String(value).substring(0, 10) : "";
}

function formatDate(value) {
  return normalizeDate(value);
}

function warehouseName(warehouseId) {
  var warehouse = _.find(warehouses || [], function (item) {
    return String(item.warehouse_id) === String(warehouseId);
  });

  if (!warehouse) return "";
  return (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "");
}

function addStockEntry() {
  location.href = "stock_entry_by_warehouse_add.html";
}

function viewStockEntry(id) {
  if (!id) return;
  location.href = "stock_entry_by_warehouse_add.html?id=" + id + "&mode=view";
}
