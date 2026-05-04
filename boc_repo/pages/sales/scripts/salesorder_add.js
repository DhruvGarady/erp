var editSalesOrderId;
var sourceQuotationId;
var customers = [];
var currencies = [];
var uoms = [];
var materials = [];
var taxes = [];
var paymentTerms = [];
var warehouses = [];
var inventorySummaries = [];
var salesOrderItems = [];
var salesOrderItemsTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  salesOrderItemsTemplate = $("#salesOrderItemsTmpl").html();

  var params = new URLSearchParams(window.location.search);
  editSalesOrderId = params.get("id");
  sourceQuotationId = params.get("quotation_id") || params.get("quotationId");

  $("#salesOrderItemsContainer").on("change", ".lineMaterial", function () {
    onLineMaterialChange($(this).closest("tr"));
  });

  $("#salesOrderItemsContainer").on("change", ".lineTax", function () {
    splitLineTax($(this).closest("tr"));
  });

  $("#salesOrderItemsContainer").on("input change", ".salesorder-line-input, .salesorder-line-select", function () {
    syncSalesOrderItemRows();
    calculateTotals();
  });

  $("#discount_type, #discount_value, #freight_amount, #packing_amount, #other_charges, #round_off").on("input change", function () {
    calculateTotals();
  });

  $("#currency_id").on("change", onCurrencyChange);

  loadLookups()
    .done(function () {
      renderCustomerOptions();
      renderCurrencyOptions();
      renderPaymentTermOptions();
      renderWarehouseOptions();
      renderSalesOrderItems();

      if (editSalesOrderId) {
        $("#pageTitle").text("Edit Sales Order Information:");
        loadSalesOrderDetails(editSalesOrderId);
      } else if (sourceQuotationId) {
        $("#pageTitle").text("Create Sales Order From Quotation:");
        loadSalesOrderFromQuotation(sourceQuotationId);
      } else {
        $("#pageTitle").text("Add Sales Order Information:");
        $("#sales_order_date").val(todayString());
        $("#status").val("Draft");
        $("#approval_status").val("Pending");
        $("#exchange_rate").val(1);
        loadNextSalesOrderNo();
        addSalesOrderItem();
      }
    })
    .fail(function () {
      showErrorDialog("Unable to load customer, currency, UOM, material, tax, payment terms, or warehouse data.");
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
    getMasterList("mst_customer"),
    getMasterList("mst_currency"),
    getMasterList("mst_uom"),
    getMasterList("mst_material"),
    getMasterList("mst_tax"),
    getMasterList("mst_payment_terms"),
    getMasterList("mst_warehouse"),
    getInventorySummaryList()
  ).done(function (customerRows, currencyRows, uomRows, materialRows, taxRows, paymentTermRows, warehouseRows, inventoryRows) {
    customers = customerRows || [];
    currencies = currencyRows || [];
    uoms = uomRows || [];
    materials = materialRows || [];
    taxes = taxRows || [];
    paymentTerms = paymentTermRows || [];
    warehouses = warehouseRows || [];
    inventorySummaries = inventoryRows || [];
  });
}

function getInventorySummaryList() {
  return $.ajax({
    type: "GET",
    url: request_url + "/inventorysummary/list",
    headers: getAuthHeaders(),
    contentType: "application/json"
  }).then(function (res) {
    return res || [];
  });
}

function renderCustomerOptions(selectedCustomerId) {
  var html = '<option value="">Select</option>';
  _.each(customers, function (customer) {
    var selected = String(selectedCustomerId || "") === String(customer.customer_id) ? " selected" : "";
    html += '<option value="' + customer.customer_id + '"' + selected + ">" + (customer.customer_name || "") + "</option>";
  });
  $("#customer_id").html(html);
}

function renderCurrencyOptions(selectedCurrencyId, selectedCurrencyCode) {
  var html = '<option value="">Select</option>';
  _.each(currencies, function (currency) {
    var currencyCode = currency.currency_code || currency.currency_name || "";
    var selected = String(selectedCurrencyId || "") === String(currency.currency_id) || String(selectedCurrencyCode || "") === String(currencyCode) ? " selected" : "";
    html += '<option value="' + currency.currency_id + '"' + selected + ">" + currencyCode + "</option>";
  });
  $("#currency_id").html(html);
  onCurrencyChange();
}

function renderPaymentTermOptions(selectedPaymentTermId) {
  var html = '<option value="">Select</option>';
  _.each(paymentTerms, function (term) {
    var termText = (term.payment_term_code || term.payment_terms_code || "") + (term.payment_term_name || term.payment_terms_name ? " - " : "") + (term.payment_term_name || term.payment_terms_name || "");
    var selected = String(selectedPaymentTermId || "") === String(term.payment_term_id || term.payment_terms_id) ? " selected" : "";
    html += '<option value="' + (term.payment_term_id || term.payment_terms_id) + '"' + selected + ">" + termText + "</option>";
  });
  $("#payment_term_id").html(html);
}

function renderWarehouseOptions(selectedWarehouseId) {
  var html = '<option value="">Select</option>';
  _.each(warehouses, function (warehouse) {
    var warehouseText = (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "");
    var selected = String(selectedWarehouseId || "") === String(warehouse.warehouse_id) ? " selected" : "";
    html += '<option value="' + warehouse.warehouse_id + '"' + selected + ">" + warehouseText + "</option>";
  });
  $("#warehouse_id").html(html);
  $("#warehouse_id").prop("disabled", true);
}

function onCustomerChange() {
  var customer = findCustomer($("#customer_id").val());
  if (!customer) {
    $("#customer_contact").val("");
    $("#billing_address").val("");
    $("#shipping_address").val("");
    return;
  }

  $("#customer_contact").val(customer.contact_person || customer.phone || customer.email || "");
  $("#billing_address").val(customer.billing_address || customer.address || "");
  $("#shipping_address").val(customer.shipping_address || customer.billing_address || customer.address || "");
  $("#payment_term_id").val(customer.payment_term_id || customer.payment_terms_id || "");
}

function onCurrencyChange() {
  var currency = findCurrency($("#currency_id").val());
  $("#currency").val(currency ? (currency.currency_code || currency.currency_name || "") : "");
  if (currency && !$("#exchange_rate").val()) {
    $("#exchange_rate").val(currency.exchange_rate || 1);
  }
}

function findCustomer(customerId) {
  return _.find(customers, function (item) {
    return String(item.customer_id) === String(customerId);
  });
}

function findMaterial(materialId) {
  return _.find(materials, function (item) {
    return String(item.material_id) === String(materialId);
  });
}

function findMaterialByName(materialName) {
  return _.find(materials, function (item) {
    return String(item.material_name || "").toLowerCase() === String(materialName || "").toLowerCase();
  });
}

function findCurrency(currencyId) {
  return _.find(currencies, function (item) {
    return String(item.currency_id) === String(currencyId);
  });
}

function findCurrencyByCode(currencyCode) {
  return _.find(currencies, function (item) {
    return String(item.currency_code || item.currency_name || "").toLowerCase() === String(currencyCode || "").toLowerCase();
  });
}

function findTax(taxId) {
  return _.find(taxes, function (item) {
    return String(item.tax_id) === String(taxId);
  });
}

function getTaxPercent(taxId) {
  var tax = findTax(taxId);
  return tax ? cleanDecimal(tax.tax_percent, 0) : 0;
}

function findUom(uomId) {
  return _.find(uoms, function (item) {
    return String(item.uom_id) === String(uomId);
  });
}

function findUomByValue(unitValue) {
  return _.find(uoms, function (item) {
    return String(item.uom_code || item.uom_name || "").toLowerCase() === String(unitValue || "").toLowerCase();
  });
}

function getUomValue(uomId) {
  var uom = findUom(uomId);
  return uom ? (uom.uom_code || uom.uom_name || "") : "";
}

function getUomText(uomId) {
  return getUomValue(uomId);
}

function loadNextSalesOrderNo() {
  $.ajax({
    type: "GET",
    url: request_url + "/salesorder/nextno",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      $("#sales_order_no").val(res && res.sales_order_no ? res.sales_order_no : "");
    }
  });
}

function addSalesOrderItem() {
  syncSalesOrderItemRows();

  salesOrderItems.push({
    quotation_item_id: null,
    line_no: salesOrderItems.length + 1,
    material_id: null,
    material_code: "",
    material_type: "",
    item_name: "",
    hsn_sac_code: "",
    item_description: "",
    qty: 1,
    delivered_qty: 0,
    invoiced_qty: 0,
    unit: "",
    uom_id: null,
    rate: 0,
    gross_amount: 0,
    discount_type: "",
    discount_value: 0,
    discount_amount: 0,
    taxable_amount: 0,
    tax_id: null,
    tax_percent: 0,
    cgst_percent: 0,
    cgst_amount: 0,
    sgst_percent: 0,
    sgst_amount: 0,
    igst_percent: 0,
    igst_amount: 0,
    tax_amount: 0,
    line_total: 0,
    warehouse_id: null,
    delivery_date: $("#delivery_date").val() || "",
    item_status: "Open",
    is_active: "Y"
  });

  renderSalesOrderItems();
}

function onLineMaterialChange(row) {
  syncSalesOrderItemRows();

  var index = parseInt(row.attr("data-index"), 10);
  if (!salesOrderItems[index]) return;

  var material = findMaterial(row.find(".lineMaterial").val());
  if (!material) {
    salesOrderItems[index].material_id = null;
    salesOrderItems[index].item_name = "";
    salesOrderItems[index].material_code = "";
    salesOrderItems[index].material_type = "";
    salesOrderItems[index].hsn_sac_code = "";
    renderSalesOrderItems();
    return;
  }

  applyMaterialDefaults(salesOrderItems[index], material);
  renderSalesOrderItems();
  showWarehouseStockDialog(index);
}

function applyMaterialDefaults(item, material) {
  item.material_id = cleanInt(material.material_id, null);
  item.item_name = material.material_name || "";
  item.material_code = material.material_code || "";
  item.material_type = material.material_type || "";
  item.hsn_sac_code = material.hsn_sac_code || "";
  item.item_description = material.material_description || "";
  item.uom_id = cleanInt(material.sales_uom_id || material.base_uom_id, null);
  item.unit = getUomValue(item.uom_id) || item.unit || "";
  item.rate = cleanDecimal(material.sales_rate, cleanDecimal(material.standard_rate, item.rate || 0));
  item.tax_id = cleanInt(material.tax_id, null);
  item.tax_percent = getTaxPercent(material.tax_id);
  item.cgst_percent = item.tax_percent ? roundMoney(item.tax_percent / 2) : 0;
  item.sgst_percent = item.tax_percent ? roundMoney(item.tax_percent / 2) : 0;
  item.igst_percent = 0;
  item.discount_type = material.discount_allowed === "Y" && cleanDecimal(material.default_discount_percent, 0) > 0 ? "PERCENT" : "";
  item.discount_value = item.discount_type === "PERCENT" ? cleanDecimal(material.default_discount_percent, 0) : 0;
  item.warehouse_id = null;
  item.item_status = "Open";
  item.delivery_date = item.delivery_date || $("#delivery_date").val() || "";
  calculateLineAmounts(item);
}

function showWarehouseStockDialog(index) {
  var item = salesOrderItems[index];

  if (!item || !item.material_id) {
    return;
  }

  getInventorySummaryList()
    .done(function (rows) {
      inventorySummaries = rows || [];
      openWarehouseStockDialog(index);
    })
    .fail(function () {
      inventorySummaries = inventorySummaries || [];
      openWarehouseStockDialog(index);
    });
}

function openLineWarehousePicker(index) {
  syncSalesOrderItemRows();

  if (!salesOrderItems[index] || !salesOrderItems[index].material_id) {
    showWarningDialog("Please select a material before selecting warehouse stock.");
    return;
  }

  showWarehouseStockDialog(index);
}

function openAllWarehousePicker() {
  syncSalesOrderItemRows();

  if (!salesOrderItems.length) {
    showWarningDialog("Please add at least one sales order item.");
    return;
  }

  var materialItems = _.filter(salesOrderItems, function (item) {
    return item && item.material_id;
  });

  if (!materialItems.length) {
    showWarningDialog("Please select material before applying warehouse to all items.");
    return;
  }

  getInventorySummaryList()
    .done(function (rows) {
      inventorySummaries = rows || [];
      openAllWarehouseDialog(materialItems.length);
    })
    .fail(function () {
      inventorySummaries = inventorySummaries || [];
      openAllWarehouseDialog(materialItems.length);
    });
}

function openWarehouseStockDialog(index) {
  var item = salesOrderItems[index];
  var material = findMaterial(item.material_id);
  var stockRows = buildWarehouseStockRows(item.material_id);

  $("#warehouseStockDialog").remove();

  var html = '<div id="warehouseStockDialog" title="Select Warehouse" style="display:none;">' +
    '<div style="margin-bottom:10px;"><b>' + escapeHtml(item.material_code || "") + '</b> ' + escapeHtml(item.item_name || (material ? material.material_name : "")) + '</div>' +
    '<div style="margin-bottom:10px;">Order Qty: <b>' + formatAmount(item.qty || 0) + '</b></div>';

  if (!hasAvailableStock(stockRows)) {
    html += '<div style="margin-bottom:10px;color:#a05a00;font-weight:600;">No available stock found. Select a warehouse to save this line as backorder.</div>';
  }

  html += '<div class="warehouse-stock-table-scroll"><table style="width:100%;" class="dataTbl">' +
    '<tr>' +
      '<th width="6%">Select</th>' +
      '<th width="30%">Warehouse</th>' +
      '<th width="16%">On Hand</th>' +
      '<th width="16%">Reserved</th>' +
      '<th width="16%">Available</th>' +
      '<th width="16%">Line Status</th>' +
    '</tr>';

  _.each(stockRows, function (row) {
    var projectedStatus = getProjectedItemStatus(item.qty, row.available_qty);
    html += '<tr>' +
      '<td style="text-align:center;"><input type="radio" name="stockWarehouse" value="' + row.warehouse_id + '" ' + (String(item.warehouse_id || "") === String(row.warehouse_id) ? "checked" : "") + '></td>' +
      '<td>' + escapeHtml(row.warehouse_text) + '</td>' +
      '<td style="text-align:right;">' + formatAmount(row.on_hand_qty) + '</td>' +
      '<td style="text-align:right;">' + formatAmount(row.reserved_qty) + '</td>' +
      '<td style="text-align:right;">' + formatAmount(row.available_qty) + '</td>' +
      '<td>' + escapeHtml(projectedStatus) + '</td>' +
    '</tr>';
  });

  html += '</table></div></div>';
  $("body").append(html);

  $("#warehouseStockDialog").dialog({
    modal: true,
    width: 760,
    maxHeight: 560,
    dialogClass: "warehouse-stock-dialog",
    open: function () {
      $(this).closest(".ui-dialog").find(".ui-dialog-titlebar-close").attr("title", "Close");
      styleWarehouseDialogButtons($(this));
    },
    buttons: {
      "Select": function () {
        var selectedWarehouseId = $("input[name='stockWarehouse']:checked").val();

        if (!selectedWarehouseId) {
          showWarningDialog("Please select a warehouse for this item.");
          return;
        }

        var selectedStock = _.find(stockRows, function (row) {
          return String(row.warehouse_id) === String(selectedWarehouseId);
        });

        salesOrderItems[index].warehouse_id = cleanInt(selectedWarehouseId, null);
        salesOrderItems[index].item_status = getProjectedItemStatus(salesOrderItems[index].qty, selectedStock ? selectedStock.available_qty : 0);
        renderSalesOrderItems();
        $(this).dialog("destroy").remove();
      },
      "Cancel": function () {
        $(this).dialog("destroy").remove();
      }
    }
  });
}

function openAllWarehouseDialog(materialLineCount) {
  $("#warehouseAllDialog").remove();

  var html = '<div id="warehouseAllDialog" title="Select Warehouse For All Items" style="display:none;">' +
    '<div style="margin-bottom:10px;">Apply one warehouse to <b>' + materialLineCount + '</b> material line(s).</div>' +
    '<div class="warehouse-stock-table-scroll"><table style="width:100%;" class="dataTbl">' +
      '<tr>' +
        '<th width="8%">Select</th>' +
        '<th width="42%">Warehouse</th>' +
        '<th width="25%">Available Lines</th>' +
        '<th width="25%">Backorder / Partial</th>' +
      '</tr>';

  _.each(buildAllWarehouseRows(), function (row) {
    html += '<tr>' +
      '<td style="text-align:center;"><input type="radio" name="allStockWarehouse" value="' + row.warehouse_id + '"></td>' +
      '<td>' + escapeHtml(row.warehouse_text) + '</td>' +
      '<td style="text-align:right;">' + row.available_lines + '</td>' +
      '<td style="text-align:right;">' + row.backorder_lines + '</td>' +
    '</tr>';
  });

  html += '</table></div></div>';
  $("body").append(html);

  $("#warehouseAllDialog").dialog({
    modal: true,
    width: 700,
    maxHeight: 520,
    dialogClass: "warehouse-stock-dialog",
    open: function () {
      $(this).closest(".ui-dialog").find(".ui-dialog-titlebar-close").attr("title", "Close");
      styleWarehouseDialogButtons($(this));
    },
    buttons: {
      "Select": function () {
        var selectedWarehouseId = $("input[name='allStockWarehouse']:checked").val();

        if (!selectedWarehouseId) {
          showWarningDialog("Please select a warehouse.");
          return;
        }

        applyWarehouseToAllItems(selectedWarehouseId);
        $(this).dialog("destroy").remove();
      },
      "Cancel": function () {
        $(this).dialog("destroy").remove();
      }
    }
  });
}

function buildAllWarehouseRows() {
  return _.map(warehouses || [], function (warehouse) {
    var availableLines = 0;
    var backorderLines = 0;

    _.each(salesOrderItems || [], function (item) {
      if (!item || !item.material_id) {
        return;
      }

      var summary = findInventorySummary(item.material_id, warehouse.warehouse_id);
      var availableQty = cleanDecimal(summary ? summary.available_qty : 0, 0);
      var projectedStatus = getProjectedItemStatus(item.qty, availableQty);

      if (projectedStatus === "Open") {
        availableLines += 1;
      } else {
        backorderLines += 1;
      }
    });

    return {
      warehouse_id: warehouse.warehouse_id,
      warehouse_text: (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || ""),
      available_lines: availableLines,
      backorder_lines: backorderLines
    };
  }).sort(function (a, b) {
    return b.available_lines - a.available_lines;
  });
}

function applyWarehouseToAllItems(warehouseId) {
  _.each(salesOrderItems || [], function (item) {
    if (!item || !item.material_id) {
      return;
    }

    var summary = findInventorySummary(item.material_id, warehouseId);
    item.warehouse_id = cleanInt(warehouseId, null);
    item.item_status = getProjectedItemStatus(item.qty, summary ? summary.available_qty : 0);
  });

  renderSalesOrderItems();
}

function styleWarehouseDialogButtons(dialogContent) {
  var buttons = dialogContent.closest(".ui-dialog").find(".ui-dialog-buttonpane button");

  buttons.each(function () {
    var button = $(this);
    var label = $.trim(button.text());

    button.removeClass("ui-button ui-corner-all ui-widget");
    button.addClass("search");

    if (label.toLowerCase() === "cancel") {
      button.addClass("warehouse-dialog-cancel");
    }
  });
}

function buildWarehouseStockRows(materialId) {
  return _.map(warehouses || [], function (warehouse) {
    var summary = findInventorySummary(materialId, warehouse.warehouse_id);
    var warehouseText = (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "");

    return {
      warehouse_id: warehouse.warehouse_id,
      warehouse_text: warehouseText,
      on_hand_qty: cleanDecimal(summary ? summary.on_hand_qty : 0, 0),
      reserved_qty: cleanDecimal(summary ? summary.reserved_qty : 0, 0),
      available_qty: cleanDecimal(summary ? summary.available_qty : 0, 0)
    };
  }).sort(function (a, b) {
    return cleanDecimal(b.available_qty, 0) - cleanDecimal(a.available_qty, 0);
  });
}

function getWarehouseDisplay(warehouseId, materialId) {
  if (!materialId) {
    return "Select Material";
  }

  if (!warehouseId) {
    return "Select Warehouse";
  }

  var warehouse = _.find(warehouses || [], function (item) {
    return String(item.warehouse_id) === String(warehouseId);
  });

  if (!warehouse) {
    return "Select Warehouse";
  }

  return (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "");
}

function findInventorySummary(materialId, warehouseId) {
  return _.find(inventorySummaries || [], function (summary) {
    return String(summary.material_id) === String(materialId) && String(summary.warehouse_id) === String(warehouseId);
  });
}

function hasAvailableStock(stockRows) {
  return _.some(stockRows || [], function (row) {
    return cleanDecimal(row.available_qty, 0) > 0;
  });
}

function getProjectedItemStatus(qty, availableQty) {
  var requiredQty = cleanDecimal(qty, 0);
  var available = cleanDecimal(availableQty, 0);

  if (available <= 0) {
    return "Backorder";
  }

  if (available < requiredQty) {
    return "Partially Reserved";
  }

  return "Open";
}

function deleteSalesOrderItem(index) {
  syncSalesOrderItemRows();
  salesOrderItems.splice(index, 1);
  renderSalesOrderItems();
}

function syncSalesOrderItemRows() {
  $("#salesOrderItemsContainer tr[data-index]").each(function () {
    var index = parseInt($(this).attr("data-index"), 10);
    if (!salesOrderItems[index]) return;

    var materialId = cleanInt($(this).find(".lineMaterial").val(), null);
    var material = findMaterial(materialId);
    var uomId = cleanInt($(this).find(".lineUnit").val(), null);

    salesOrderItems[index].material_id = materialId;
    salesOrderItems[index].item_name = material ? material.material_name : salesOrderItems[index].item_name;
    salesOrderItems[index].material_code = material ? (material.material_code || "") : $.trim($(this).find(".lineMaterialCode").val());
    salesOrderItems[index].material_type = material ? (material.material_type || "") : $.trim($(this).find(".lineMaterialType").val());
    salesOrderItems[index].hsn_sac_code = material ? (material.hsn_sac_code || "") : salesOrderItems[index].hsn_sac_code;
    salesOrderItems[index].item_description = $.trim($(this).find(".lineDescription").val());
    salesOrderItems[index].qty = cleanDecimal($(this).find(".lineQty").val(), 0);
    salesOrderItems[index].delivered_qty = cleanDecimal($(this).find(".lineDeliveredQty").val(), 0);
    salesOrderItems[index].invoiced_qty = cleanDecimal($(this).find(".lineInvoicedQty").val(), 0);
    salesOrderItems[index].uom_id = uomId;
    salesOrderItems[index].unit = getUomText(uomId);
    salesOrderItems[index].rate = cleanDecimal($(this).find(".lineRate").val(), 0);
    salesOrderItems[index].discount_type = $(this).find(".lineDiscountType").val();
    salesOrderItems[index].discount_value = cleanDecimal($(this).find(".lineDiscountValue").val(), 0);
    salesOrderItems[index].tax_percent = cleanDecimal($(this).find(".lineTax").val(), 0);
    salesOrderItems[index].cgst_percent = cleanDecimal($(this).find(".lineCgstPercent").val(), 0);
    salesOrderItems[index].sgst_percent = cleanDecimal($(this).find(".lineSgstPercent").val(), 0);
    salesOrderItems[index].igst_percent = cleanDecimal($(this).find(".lineIgstPercent").val(), 0);
    salesOrderItems[index].warehouse_id = cleanInt($(this).find(".lineWarehouse").val(), null);
    salesOrderItems[index].delivery_date = $(this).find(".lineDeliveryDate").val() || null;
    salesOrderItems[index].item_status = $(this).find(".lineItemStatus").val() || "Open";
    salesOrderItems[index].tax_id = material ? cleanInt(material.tax_id, null) : salesOrderItems[index].tax_id;
    calculateLineAmounts(salesOrderItems[index]);
  });
}

function renderSalesOrderItems() {
  syncLineNumbers();
  calculateTotals();

  var template = _.template(salesOrderItemsTemplate);
  $("#salesOrderItemsContainer").html(template({
    items: salesOrderItems || [],
    materials: materials || [],
    uoms: uoms || [],
    warehouses: warehouses || [],
    formatAmount: formatAmount,
    getWarehouseDisplay: getWarehouseDisplay
  }));
  $("#salesOrderItemsContainer").trigger("create");
}

function syncLineNumbers() {
  _.each(salesOrderItems, function (item, index) {
    item.line_no = index + 1;
    calculateLineAmounts(item);
  });
}

function splitLineTax(row) {
  var taxPercent = cleanDecimal(row.find(".lineTax").val(), 0);
  row.find(".lineCgstPercent").val(roundMoney(taxPercent / 2));
  row.find(".lineSgstPercent").val(roundMoney(taxPercent / 2));
  row.find(".lineIgstPercent").val(0);
}

function calculateLineAmounts(item) {
  var qty = Number(item.qty || 0);
  var rate = Number(item.rate || 0);
  var discountType = item.discount_type || "";
  var discountValue = Number(item.discount_value || 0);
  var gross = qty * rate;
  var discountAmount = 0;

  if (discountType === "PERCENT") {
    discountAmount = gross * discountValue / 100;
  } else if (discountType === "AMOUNT") {
    discountAmount = discountValue;
  }

  if (discountAmount > gross) {
    discountAmount = gross;
  }

  var taxableAmount = gross - discountAmount;
  var cgstAmount = taxableAmount * Number(item.cgst_percent || 0) / 100;
  var sgstAmount = taxableAmount * Number(item.sgst_percent || 0) / 100;
  var igstAmount = taxableAmount * Number(item.igst_percent || 0) / 100;
  var taxAmount = cgstAmount + sgstAmount + igstAmount;

  item.gross_amount = roundMoney(gross);
  item.discount_amount = roundMoney(discountAmount);
  item.taxable_amount = roundMoney(taxableAmount);
  item.cgst_amount = roundMoney(cgstAmount);
  item.sgst_amount = roundMoney(sgstAmount);
  item.igst_amount = roundMoney(igstAmount);
  item.tax_amount = roundMoney(taxAmount);
  item.tax_percent = roundMoney(Number(item.cgst_percent || 0) + Number(item.sgst_percent || 0) + Number(item.igst_percent || 0));
  item.line_total = roundMoney(taxableAmount + taxAmount);

  return item;
}

function calculateTotals() {
  var subtotal = 0;
  var lineDiscountTotal = 0;
  var taxableBeforeHeaderDiscount = 0;
  var taxTotal = 0;

  _.each(salesOrderItems, function (item) {
    calculateLineAmounts(item);
    subtotal += Number(item.gross_amount || 0);
    lineDiscountTotal += Number(item.discount_amount || 0);
    taxableBeforeHeaderDiscount += Number(item.taxable_amount || 0);
    taxTotal += Number(item.tax_amount || 0);
  });

  var headerDiscount = calculateHeaderDiscount(taxableBeforeHeaderDiscount);

  if (headerDiscount > taxableBeforeHeaderDiscount) {
    headerDiscount = taxableBeforeHeaderDiscount;
    if ($("#discount_type").val() === "AMOUNT") {
      $("#discount_value").val(roundMoney(headerDiscount));
    }
  }

  var discountTotal = lineDiscountTotal + headerDiscount;
  var taxableTotal = taxableBeforeHeaderDiscount - headerDiscount;
  var freightAmount = cleanDecimal($("#freight_amount").val(), 0);
  var packingAmount = cleanDecimal($("#packing_amount").val(), 0);
  var otherCharges = cleanDecimal($("#other_charges").val(), 0);
  var roundOff = cleanDecimal($("#round_off").val(), 0);
  var grandTotal = taxableTotal + taxTotal + freightAmount + packingAmount + otherCharges + roundOff;

  $("#subtotalLabel").text(formatAmount(subtotal));
  $("#lineDiscountTotalLabel").text(formatAmount(lineDiscountTotal));
  $("#discountTotalLabel").text(formatAmount(discountTotal));
  $("#taxableTotalLabel").text(formatAmount(taxableTotal));
  $("#taxTotalLabel").text(formatAmount(taxTotal));
  $("#grandTotalLabel").text(formatAmount(grandTotal));

  $("#salesOrderItemsContainer tr[data-index]").each(function () {
    var index = parseInt($(this).attr("data-index"), 10);
    if (salesOrderItems[index]) {
      $(this).find(".lineDiscountAmountLabel").text(formatAmount(salesOrderItems[index].discount_amount));
      $(this).find(".lineGrossAmountLabel").text(formatAmount(salesOrderItems[index].gross_amount));
      $(this).find(".lineTaxableAmountLabel").text(formatAmount(salesOrderItems[index].taxable_amount));
      $(this).find(".lineCgstAmountLabel").text(formatAmount(salesOrderItems[index].cgst_amount));
      $(this).find(".lineSgstAmountLabel").text(formatAmount(salesOrderItems[index].sgst_amount));
      $(this).find(".lineIgstAmountLabel").text(formatAmount(salesOrderItems[index].igst_amount));
      $(this).find(".lineTaxAmountLabel").text(formatAmount(salesOrderItems[index].tax_amount));
      $(this).find(".lineTotalLabel").text(formatAmount(salesOrderItems[index].line_total));
    }
  });

  return {
    subtotal: roundMoney(subtotal),
    discount_type: $("#discount_type").val(),
    discount_value: cleanDecimal($("#discount_value").val(), 0),
    discount_total: roundMoney(discountTotal),
    taxable_total: roundMoney(taxableTotal),
    tax_total: roundMoney(taxTotal),
    freight_amount: roundMoney(freightAmount),
    packing_amount: roundMoney(packingAmount),
    other_charges: roundMoney(otherCharges),
    round_off: roundMoney(roundOff),
    grand_total: roundMoney(grandTotal)
  };
}

function calculateHeaderDiscount(taxableBase) {
  var discountType = $("#discount_type").val();
  var discountValue = cleanDecimal($("#discount_value").val(), 0);

  if (discountType === "PERCENT") {
    return roundMoney(taxableBase * discountValue / 100);
  }

  if (discountType === "AMOUNT") {
    return roundMoney(discountValue);
  }

  return 0;
}

function calculateLineDiscountTotal(items) {
  var lineDiscountTotal = 0;

  _.each(items || [], function (item) {
    calculateLineAmounts(item);
    lineDiscountTotal += Number(item.discount_amount || 0);
  });

  return roundMoney(lineDiscountTotal);
}

function buildPayload() {
  syncSalesOrderItemRows();
  var totals = calculateTotals();
  var customer = findCustomer($("#customer_id").val());
  var userId = cleanInt(sessionStorage.getItem("USER_ID"), null);

  return {
    header: {
      sales_order_no: $.trim($("#sales_order_no").val()),
      sales_order_date: $("#sales_order_date").val(),
      quotation_id: cleanInt($("#quotation_id").val(), null),
      quotation_no: $.trim($("#quotation_no").val()),
      customer_id: cleanInt($("#customer_id").val(), null),
      customer_name: customer ? customer.customer_name : "",
      customer_contact: $.trim($("#customer_contact").val()),
      billing_address: $.trim($("#billing_address").val()),
      shipping_address: $.trim($("#shipping_address").val()),
      reference_no: $.trim($("#reference_no").val()),
      subject: $.trim($("#subject").val()),
      currency: $.trim($("#currency").val()),
      currency_id: cleanInt($("#currency_id").val(), null),
      exchange_rate: cleanDecimal($("#exchange_rate").val(), 1),
      payment_term_id: cleanInt($("#payment_term_id").val(), null),
      salesperson_id: cleanInt($("#salesperson_id").val(), null),
      warehouse_id: null,
      delivery_date: $("#delivery_date").val() || null,
      status: $("#status").val() || "Draft",
      approval_status: $("#approval_status").val() || "Pending",
      notes: $.trim($("#notes").val()),
      terms_conditions: $.trim($("#terms_conditions").val()),
      subtotal: totals.subtotal,
      discount_type: totals.discount_type,
      discount_value: totals.discount_value,
      discount_total: totals.discount_total,
      taxable_total: totals.taxable_total,
      tax_total: totals.tax_total,
      freight_amount: totals.freight_amount,
      packing_amount: totals.packing_amount,
      other_charges: totals.other_charges,
      round_off: totals.round_off,
      grand_total: totals.grand_total,
      created_by: userId,
      updated_by: userId
    },
    items: _.map(salesOrderItems, function (item, index) {
      calculateLineAmounts(item);
      return {
        quotation_item_id: cleanInt(item.quotation_item_id, null),
        line_no: index + 1,
        material_id: cleanInt(item.material_id, null),
        material_code: item.material_code,
        item_name: item.item_name,
        material_type: item.material_type,
        item_description: item.item_description,
        hsn_sac_code: item.hsn_sac_code,
        qty: cleanDecimal(item.qty, 0),
        delivered_qty: cleanDecimal(item.delivered_qty, 0),
        invoiced_qty: cleanDecimal(item.invoiced_qty, 0),
        unit: item.unit,
        uom_id: cleanInt(item.uom_id, null),
        rate: cleanDecimal(item.rate, 0),
        gross_amount: cleanDecimal(item.gross_amount, 0),
        discount_type: item.discount_type,
        discount_value: cleanDecimal(item.discount_value, 0),
        discount_amount: cleanDecimal(item.discount_amount, 0),
        taxable_amount: cleanDecimal(item.taxable_amount, 0),
        tax_id: cleanInt(item.tax_id, null),
        tax_percent: cleanDecimal(item.tax_percent, 0),
        cgst_percent: cleanDecimal(item.cgst_percent, 0),
        cgst_amount: cleanDecimal(item.cgst_amount, 0),
        sgst_percent: cleanDecimal(item.sgst_percent, 0),
        sgst_amount: cleanDecimal(item.sgst_amount, 0),
        igst_percent: cleanDecimal(item.igst_percent, 0),
        igst_amount: cleanDecimal(item.igst_amount, 0),
        tax_amount: cleanDecimal(item.tax_amount, 0),
        line_total: cleanDecimal(item.line_total, 0),
        warehouse_id: cleanInt(item.warehouse_id, null),
        delivery_date: item.delivery_date || null,
        item_status: item.item_status || "Open"
      };
    })
  };
}

function validateSalesOrder(payload) {
  if (!payload.header.sales_order_no) {
    showWarningDialog("Sales order number is required.");
    return false;
  }

  if (!payload.header.sales_order_date) {
    showWarningDialog("Sales order date is required.");
    return false;
  }

  if (!payload.header.customer_id) {
    showWarningDialog("Customer is required.");
    return false;
  }

  if (!payload.items.length) {
    showWarningDialog("At least one sales order item is required.");
    return false;
  }

  for (var i = 0; i < payload.items.length; i++) {
    if (!payload.items[i].material_id) {
      showWarningDialog("Material is required for every sales order item.");
      return false;
    }

    if (!payload.items[i].item_name) {
      showWarningDialog("Item name is required for every sales order item.");
      return false;
    }

    if (!payload.items[i].qty || Number(payload.items[i].qty) <= 0) {
      showWarningDialog("Quantity must be greater than zero for every sales order item.");
      return false;
    }
  }

  return true;
}

function saveSalesOrder() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateSalesOrder(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editSalesOrderId;
  var url = request_url + (isEdit ? "/salesorder/update/" + editSalesOrderId : "/salesorder/create");
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
      showSuccessDialog(isEdit ? "Sales order updated successfully." : "Sales order added successfully.", function () {
        location.href = "sales_order_inq.html";
      });
    },
    error: function (xhr) {
      handleSaveError(xhr, "There was a problem saving the sales order.");
    },
    complete: function () {
      $(".searchButton").prop("disabled", false);
    }
  });
}

function loadSalesOrderFromQuotation(quotationId) {
  $.when(
    $.ajax({
      type: "GET",
      url: request_url + "/quotation/" + quotationId,
      headers: getAuthHeaders(),
      contentType: "application/json"
    }),
    $.ajax({
      type: "GET",
      url: request_url + "/salesorder/nextno",
      headers: getAuthHeaders(),
      contentType: "application/json"
    })
  ).done(function (quotationResponse, nextNoResponse) {
    var quotation = quotationResponse && quotationResponse[0] ? quotationResponse[0] : {};
    var nextNo = nextNoResponse && nextNoResponse[0] ? nextNoResponse[0].sales_order_no : "";
    var header = quotation.header || {};
    var items = quotation.items || [];

    if (!isQuotationApprovedForSalesOrder(header)) {
      showWarningDialog("Only approved quotations can be converted to sales orders.");
      return;
    }

    if (!items.length) {
      showWarningDialog("This quotation has no items to convert.");
      return;
    }

    populateSalesOrderFromQuotation(header, items, nextNo);
  }).fail(function (xhr) {
    handleSaveError(xhr, "Unable to load quotation details for sales order creation.");
  });
}

function isQuotationApprovedForSalesOrder(header) {
  var status = String(header && header.status ? header.status : "").toUpperCase();
  var approvalStatus = String(header && header.approval_status ? header.approval_status : "").toUpperCase();
  return status === "APPROVED" || approvalStatus === "APPROVED";
}

function populateSalesOrderFromQuotation(header, items, salesOrderNo) {
  $("#sales_order_no").val(salesOrderNo || "");
  $("#sales_order_date").val(todayString());
  $("#quotation_id").val(header.quotation_id || "");
  $("#quotation_no").val(header.quotation_no || "");
  $("#delivery_date").val("");
  $("#reference_no").val(header.reference_no || "");
  $("#subject").val(header.subject || "");

  if (header.customer_id && !findCustomer(header.customer_id)) {
    customers.push({
      customer_id: header.customer_id,
      customer_name: header.customer_name || "",
      contact_person: header.customer_contact || ""
    });
  }

  renderCustomerOptions(header.customer_id || "");
  $("#customer_id").val(header.customer_id || "");
  $("#customer_contact").val(header.customer_contact || "");
  $("#billing_address").val(header.billing_address || "");
  $("#shipping_address").val(header.shipping_address || "");
  $("#payment_term_id").val(header.payment_term_id || "");
  $("#salesperson_id").val(header.salesperson_id || "");
  $("#warehouse_id").val("");
  $("#exchange_rate").val(header.exchange_rate || 1);

  if (header.currency && !_.find(currencies, function (item) {
    return String(item.currency_code || item.currency_name || "") === String(header.currency);
  })) {
    currencies.push({
      currency_id: header.currency_id || header.currency,
      currency_code: header.currency,
      currency_name: header.currency
    });
  }

  var currencyId = header.currency_id || (findCurrencyByCode(header.currency || "") || {}).currency_id || "";
  renderCurrencyOptions(currencyId, header.currency || "");
  $("#currency_id").val(currencyId);
  $("#currency").val(header.currency || $("#currency").val());
  $("#status").val("Open");
  $("#approval_status").val("Pending");
  $("#discount_type").val(header.discount_type || "");
  $("#discount_value").val(header.discount_value || 0);
  $("#freight_amount").val(header.freight_amount || 0);
  $("#packing_amount").val(header.packing_amount || 0);
  $("#other_charges").val(header.other_charges || 0);
  $("#round_off").val(header.round_off || 0);
  $("#notes").val(header.notes || "");
  $("#terms_conditions").val(header.terms_conditions || "");

  salesOrderItems = _.map(items, function (item, index) {
    return buildSalesOrderItemFromQuotation(item, index);
  });

  if (!header.discount_type && cleanDecimal(header.discount_total, 0) > 0) {
    var savedDiscountTotal = cleanDecimal(header.discount_total, 0);
    var orderDiscount = savedDiscountTotal - calculateLineDiscountTotal(salesOrderItems);
    $("#discount_type").val(orderDiscount > 0 ? "AMOUNT" : "");
    $("#discount_value").val(roundMoney(Math.max(orderDiscount, 0)));
  }

  renderSalesOrderItems();
}

function buildSalesOrderItemFromQuotation(item, index) {
  var material = item.material_id ? findMaterial(item.material_id) : findMaterialByName(item.item_name);
  var materialId = item.material_id || (material ? material.material_id : null);
  var uomId = item.uom_id || (findUomByValue(item.unit) || {}).uom_id || null;
  var qty = cleanDecimal(item.qty, 1);
  var rate = cleanDecimal(item.rate, 0);
  var grossAmount = cleanDecimal(item.gross_amount, qty * rate);
  var discountAmount = cleanDecimal(item.discount_amount, 0);
  var taxableAmount = cleanDecimal(item.taxable_amount, grossAmount - discountAmount);
  var cgstAmount = cleanDecimal(item.cgst_amount, 0);
  var sgstAmount = cleanDecimal(item.sgst_amount, 0);
  var igstAmount = cleanDecimal(item.igst_amount, 0);
  var taxAmount = cleanDecimal(item.tax_amount, cgstAmount + sgstAmount + igstAmount);
  var lineTotal = cleanDecimal(item.line_total, taxableAmount + taxAmount);

  return {
    quotation_item_id: item.quotation_item_id || null,
    line_no: item.line_no || (index + 1),
    material_id: materialId,
    material_code: item.material_code || (material ? (material.material_code || "") : ""),
    item_name: item.item_name || (material ? (material.material_name || "") : ""),
    material_type: item.material_type || (material ? (material.material_type || "") : ""),
    hsn_sac_code: item.hsn_sac_code || (material ? (material.hsn_sac_code || material.hsn_code || "") : ""),
    item_description: item.item_description || (material ? (material.material_description || "") : ""),
    qty: qty,
    delivered_qty: 0,
    invoiced_qty: 0,
    unit: item.unit || getUomValue(uomId),
    uom_id: uomId,
    rate: rate,
    gross_amount: roundMoney(grossAmount),
    discount_type: item.discount_type || (cleanDecimal(item.discount_percent, 0) > 0 ? "PERCENT" : ""),
    discount_value: cleanDecimal(item.discount_value, cleanDecimal(item.discount_percent, 0)),
    discount_amount: roundMoney(discountAmount),
    taxable_amount: roundMoney(taxableAmount),
    tax_id: item.tax_id || (material ? material.tax_id : null),
    tax_percent: cleanDecimal(item.tax_percent, 0),
    cgst_percent: cleanDecimal(item.cgst_percent, 0),
    cgst_amount: roundMoney(cgstAmount),
    sgst_percent: cleanDecimal(item.sgst_percent, 0),
    sgst_amount: roundMoney(sgstAmount),
    igst_percent: cleanDecimal(item.igst_percent, 0),
    igst_amount: roundMoney(igstAmount),
    tax_amount: roundMoney(taxAmount),
    line_total: roundMoney(lineTotal),
    warehouse_id: null,
    delivery_date: formatDate(item.delivery_date),
    item_status: "Open",
    is_active: "Y"
  };
}

function loadSalesOrderDetails(salesOrderId) {
  $.ajax({
    type: "GET",
    url: request_url + "/salesorder/" + salesOrderId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      var header = res && res.header ? res.header : {};
      var items = res && res.items ? res.items : [];

      $("#sales_order_no").val(header.sales_order_no || "");
      $("#sales_order_date").val(formatDate(header.sales_order_date));
      $("#quotation_id").val(header.quotation_id || "");
      $("#quotation_no").val(header.quotation_no || "");
      $("#delivery_date").val(formatDate(header.delivery_date));
      $("#reference_no").val(header.reference_no || "");
      $("#subject").val(header.subject || "");

      if (header.customer_id && !findCustomer(header.customer_id)) {
        customers.push({
          customer_id: header.customer_id,
          customer_name: header.customer_name || "",
          contact_person: header.customer_contact || ""
        });
      }
      renderCustomerOptions(header.customer_id || "");
      $("#customer_id").val(header.customer_id || "");
      $("#customer_contact").val(header.customer_contact || "");
      $("#billing_address").val(header.billing_address || "");
      $("#shipping_address").val(header.shipping_address || "");
      $("#payment_term_id").val(header.payment_term_id || "");
      $("#salesperson_id").val(header.salesperson_id || "");
      $("#warehouse_id").val(header.warehouse_id || "");
      $("#exchange_rate").val(header.exchange_rate || 1);

      if (header.currency && !_.find(currencies, function (item) {
        return String(item.currency_code || item.currency_name || "") === String(header.currency);
      })) {
        currencies.push({
          currency_id: header.currency_id || header.currency,
          currency_code: header.currency,
          currency_name: header.currency
        });
      }

      var currencyId = header.currency_id || (findCurrencyByCode(header.currency || "") || {}).currency_id || "";
      renderCurrencyOptions(currencyId, header.currency || "");
      $("#currency_id").val(currencyId);
      $("#currency").val(header.currency || $("#currency").val());
      $("#status").val(header.status || "Draft");
      $("#approval_status").val(header.approval_status || "Pending");
      $("#discount_type").val(header.discount_type || "");
      $("#discount_value").val(header.discount_value || 0);
      $("#freight_amount").val(header.freight_amount || 0);
      $("#packing_amount").val(header.packing_amount || 0);
      $("#other_charges").val(header.other_charges || 0);
      $("#round_off").val(header.round_off || 0);
      $("#notes").val(header.notes || "");
      $("#terms_conditions").val(header.terms_conditions || "");

      salesOrderItems = _.map(items, function (item, index) {
        var material = item.material_id ? findMaterial(item.material_id) : findMaterialByName(item.item_name);
        var materialId = item.material_id || (material ? material.material_id : null);
        var uomId = item.uom_id || (findUomByValue(item.unit) || {}).uom_id || null;

        return {
          quotation_item_id: item.quotation_item_id || null,
          line_no: item.line_no || (index + 1),
          material_id: materialId,
          material_code: item.material_code || (material ? (material.material_code || "") : ""),
          item_name: item.item_name || "",
          material_type: item.material_type || (material ? (material.material_type || "") : ""),
          hsn_sac_code: item.hsn_sac_code || (material ? (material.hsn_sac_code || "") : ""),
          item_description: item.item_description || "",
          qty: item.qty || 1,
          delivered_qty: item.delivered_qty || 0,
          invoiced_qty: item.invoiced_qty || 0,
          unit: item.unit || "",
          uom_id: uomId,
          rate: item.rate || 0,
          gross_amount: item.gross_amount || 0,
          discount_type: item.discount_type || "",
          discount_value: item.discount_value || 0,
          discount_amount: item.discount_amount || 0,
          taxable_amount: item.taxable_amount || 0,
          tax_id: item.tax_id || (material ? material.tax_id : null),
          tax_percent: item.tax_percent || 0,
          cgst_percent: item.cgst_percent || 0,
          cgst_amount: item.cgst_amount || 0,
          sgst_percent: item.sgst_percent || 0,
          sgst_amount: item.sgst_amount || 0,
          igst_percent: item.igst_percent || 0,
          igst_amount: item.igst_amount || 0,
          tax_amount: item.tax_amount || 0,
          line_total: item.line_total || 0,
          warehouse_id: item.warehouse_id || header.warehouse_id || "",
          delivery_date: formatDate(item.delivery_date),
          item_status: item.item_status || "Open",
          is_active: item.is_active || "Y"
        };
      });

      if (!header.discount_type && cleanDecimal(header.discount_total, 0) > 0) {
        var savedDiscountTotal = cleanDecimal(header.discount_total, 0);
        var orderDiscount = savedDiscountTotal - calculateLineDiscountTotal(salesOrderItems);
        $("#discount_type").val(orderDiscount > 0 ? "AMOUNT" : "");
        $("#discount_value").val(roundMoney(Math.max(orderDiscount, 0)));
      }

      if (!salesOrderItems.length) {
        addSalesOrderItem();
      } else {
        renderSalesOrderItems();
      }
    },
    error: function (xhr) {
      handleSaveError(xhr, "Unable to load sales order details.");
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

  var message = fallbackMessage;
  if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
    message = xhr.responseJSON.error;
  }
  showErrorDialog(message);
}

function cleanInt(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

function cleanDecimal(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function todayString() {
  return new Date().toISOString().substring(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  return String(value).substring(0, 10);
}

function backToInquiry() {
  location.href = "sales_order_inq.html";
}
