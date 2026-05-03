var editQuotationId;
var customers = [];
var currencies = [];
var uoms = [];
var materials = [];
var taxes = [];
var paymentTerms = [];
var warehouses = [];
var quotationItems = [];
var quotationItemsTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  quotationItemsTemplate = $("#quotationItemsTmpl").html();

  var params = new URLSearchParams(window.location.search);
  editQuotationId = params.get("id");

  $("#quotationItemsContainer").on("change", ".lineMaterial", function () {
    onLineMaterialChange($(this).closest("tr"));
  });

  $("#quotationItemsContainer").on("change", ".lineTax", function () {
    splitLineTax($(this).closest("tr"));
  });

  $("#quotationItemsContainer").on("input change", ".quotation-line-input, .quotation-line-select", function () {
    syncQuotationItemRows();
    calculateTotals();
  });

  $("#discount_type, #discount_value, #other_charges, #freight_amount, #packing_amount, #round_off").on("input change", function () {
    calculateTotals();
  });

  $("#currency_id").on("change", onCurrencyChange);

  loadLookups()
    .done(function () {
      renderCustomerOptions();
      renderCurrencyOptions();
      renderPaymentTermOptions();
      renderWarehouseOptions();
      renderQuotationItems();

      if (editQuotationId) {
        $("#pageTitle").text("Edit Quotation Information:");
        loadQuotationDetails(editQuotationId);
      } else {
        $("#pageTitle").text("Add Quotation Information:");
        $("#quotation_date").val(todayString());
        $("#status").val("Draft");
        $("#approval_status").val("Pending");
        $("#revision_no").val(0);
        $("#exchange_rate").val(1);
        loadNextQuotationNo();
        addQuotationItem();
      }
    })
    .fail(function () {
      showErrorDialog("Unable to load customer, currency, or UOM data.");
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
    getMasterList("mst_warehouse")
  ).done(function (customerRows, currencyRows, uomRows, materialRows, taxRows, paymentTermRows, warehouseRows) {
    customers = customerRows || [];
    currencies = currencyRows || [];
    uoms = uomRows || [];
    materials = materialRows || [];
    taxes = taxRows || [];
    paymentTerms = paymentTermRows || [];
    warehouses = warehouseRows || [];
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

function findMaterialByName(materialName) {
  return _.find(materials, function (item) {
    return String(item.material_name || "").toLowerCase() === String(materialName || "").toLowerCase();
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

function getUomValue(uomId) {
  var uom = _.find(uoms, function (item) {
    return String(item.uom_id) === String(uomId);
  });
  return uom ? (uom.uom_code || uom.uom_name || "") : "";
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

function getUomText(uomId) {
  var uom = findUom(uomId);
  return uom ? (uom.uom_code || uom.uom_name || "") : "";
}

function loadNextQuotationNo() {
  $.ajax({
    type: "GET",
    url: request_url + "/quotation/nextno",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      $("#quotation_no").val(res && res.quotation_no ? res.quotation_no : "");
    }
  });
}

function addQuotationItem() {
  syncQuotationItemRows();

  quotationItems.push({
    line_no: quotationItems.length + 1,
    material_id: null,
    material_code: "",
    material_type: "",
    item_name: "",
    hsn_sac_code: "",
    item_description: "",
    qty: 1,
    unit: "",
    uom_id: null,
    rate: 0,
    discount_type: "",
    discount_value: 0,
    discount_amount: 0,
    gross_amount: 0,
    taxable_amount: 0,
    discount_percent: 0,
    tax_percent: 0,
    tax_id: null,
    cgst_percent: 0,
    cgst_amount: 0,
    sgst_percent: 0,
    sgst_amount: 0,
    igst_percent: 0,
    igst_amount: 0,
    warehouse_id: cleanInt($("#warehouse_id").val(), null),
    delivery_date: "",
    item_status: "Open",
    line_total: 0,
    is_active: "Y"
  });

  renderQuotationItems();
}

function onLineMaterialChange(row) {
  syncQuotationItemRows();

  var index = parseInt(row.attr("data-index"), 10);
  if (!quotationItems[index]) return;

  var material = findMaterial(row.find(".lineMaterial").val());
  if (!material) {
    quotationItems[index].material_id = null;
    quotationItems[index].item_name = "";
    quotationItems[index].material_code = "";
    quotationItems[index].material_type = "";
    quotationItems[index].hsn_sac_code = "";
    renderQuotationItems();
    return;
  }

  applyMaterialDefaults(quotationItems[index], material);
  renderQuotationItems();
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
  item.discount_percent = item.discount_type === "PERCENT" ? item.discount_value : 0;
  item.warehouse_id = cleanInt(material.default_warehouse_id, cleanInt($("#warehouse_id").val(), null));
  calculateLineAmounts(item);
}

function deleteQuotationItem(index) {
  syncQuotationItemRows();
  quotationItems.splice(index, 1);
  renderQuotationItems();
}

function syncQuotationItemRows() {
  $("#quotationItemsContainer tr[data-index]").each(function () {
    var index = parseInt($(this).attr("data-index"), 10);
    if (!quotationItems[index]) return;

    var materialId = cleanInt($(this).find(".lineMaterial").val(), null);
    var material = findMaterial(materialId);
    var uomId = cleanInt($(this).find(".lineUnit").val(), null);
    quotationItems[index].material_id = materialId;
    quotationItems[index].item_name = material ? material.material_name : quotationItems[index].item_name;
    quotationItems[index].material_code = material ? (material.material_code || "") : $.trim($(this).find(".lineMaterialCode").val());
    quotationItems[index].material_type = material ? (material.material_type || "") : $.trim($(this).find(".lineMaterialType").val());
    quotationItems[index].hsn_sac_code = material ? (material.hsn_sac_code || "") : quotationItems[index].hsn_sac_code;
    quotationItems[index].item_description = $.trim($(this).find(".lineDescription").val());
    quotationItems[index].qty = cleanDecimal($(this).find(".lineQty").val(), 0);
    quotationItems[index].uom_id = uomId;
    quotationItems[index].unit = getUomText(uomId);
    quotationItems[index].rate = cleanDecimal($(this).find(".lineRate").val(), 0);
    quotationItems[index].discount_type = $(this).find(".lineDiscountType").val();
    quotationItems[index].discount_value = cleanDecimal($(this).find(".lineDiscountValue").val(), 0);
    quotationItems[index].tax_percent = cleanDecimal($(this).find(".lineTax").val(), 0);
    quotationItems[index].cgst_percent = cleanDecimal($(this).find(".lineCgstPercent").val(), 0);
    quotationItems[index].sgst_percent = cleanDecimal($(this).find(".lineSgstPercent").val(), 0);
    quotationItems[index].igst_percent = cleanDecimal($(this).find(".lineIgstPercent").val(), 0);
    quotationItems[index].warehouse_id = cleanInt($(this).find(".lineWarehouse").val(), null);
    quotationItems[index].delivery_date = $(this).find(".lineDeliveryDate").val() || null;
    quotationItems[index].item_status = $(this).find(".lineItemStatus").val() || "Open";
    quotationItems[index].tax_id = material ? cleanInt(material.tax_id, null) : quotationItems[index].tax_id;
    calculateLineAmounts(quotationItems[index]);
  });
}

function renderQuotationItems() {
  syncLineNumbers();
  calculateTotals();

  var template = _.template(quotationItemsTemplate);
  $("#quotationItemsContainer").html(template({
    items: quotationItems || [],
    materials: materials || [],
    uoms: uoms || [],
    warehouses: warehouses || [],
    formatAmount: formatAmount
  }));
  $("#quotationItemsContainer").trigger("create");
}

function syncLineNumbers() {
  _.each(quotationItems, function (item, index) {
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
    item.discount_percent = discountValue;
  } else if (discountType === "AMOUNT") {
    discountAmount = discountValue;
    item.discount_percent = gross ? roundMoney(discountAmount / gross * 100) : 0;
  } else {
    item.discount_percent = 0;
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
  item.tax_percent = roundMoney(Number(item.cgst_percent || 0) + Number(item.sgst_percent || 0) + Number(item.igst_percent || 0));
  item.line_total = roundMoney(taxableAmount + taxAmount);

  return item;
}

function calculateLineTotal(item) {
  return calculateLineAmounts(item).line_total;
}

function calculateTotals() {
  var subtotal = 0;
  var lineDiscountTotal = 0;
  var taxableBeforeHeaderDiscount = 0;
  var taxTotal = 0;

  _.each(quotationItems, function (item) {
    calculateLineAmounts(item);
    subtotal += Number(item.gross_amount || 0);
    lineDiscountTotal += Number(item.discount_amount || 0);
    taxableBeforeHeaderDiscount += Number(item.taxable_amount || 0);
    taxTotal += Number(item.cgst_amount || 0) + Number(item.sgst_amount || 0) + Number(item.igst_amount || 0);
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
  var otherCharges = cleanDecimal($("#other_charges").val(), 0);
  var freightAmount = cleanDecimal($("#freight_amount").val(), 0);
  var packingAmount = cleanDecimal($("#packing_amount").val(), 0);
  var roundOff = cleanDecimal($("#round_off").val(), 0);
  var grandTotal = taxableTotal + taxTotal + otherCharges + freightAmount + packingAmount + roundOff;

  $("#subtotalLabel").text(formatAmount(subtotal));
  $("#lineDiscountTotalLabel").text(formatAmount(lineDiscountTotal));
  $("#discountTotalLabel").text(formatAmount(discountTotal));
  $("#taxableTotalLabel").text(formatAmount(taxableTotal));
  $("#taxTotalLabel").text(formatAmount(taxTotal));
  $("#grandTotalLabel").text(formatAmount(grandTotal));

  $("#quotationItemsContainer tr[data-index]").each(function () {
    var index = parseInt($(this).attr("data-index"), 10);
    if (quotationItems[index]) {
      $(this).find(".lineDiscountAmountLabel").text(formatAmount(quotationItems[index].discount_amount));
      $(this).find(".lineGrossAmountLabel").text(formatAmount(quotationItems[index].gross_amount));
      $(this).find(".lineTaxableAmountLabel").text(formatAmount(quotationItems[index].taxable_amount));
      $(this).find(".lineCgstAmountLabel").text(formatAmount(quotationItems[index].cgst_amount));
      $(this).find(".lineSgstAmountLabel").text(formatAmount(quotationItems[index].sgst_amount));
      $(this).find(".lineIgstAmountLabel").text(formatAmount(quotationItems[index].igst_amount));
      $(this).find(".lineTotalLabel").text(formatAmount(quotationItems[index].line_total));
    }
  });

  return {
    subtotal: roundMoney(subtotal),
    discount_type: $("#discount_type").val(),
    discount_value: cleanDecimal($("#discount_value").val(), 0),
    discount_total: roundMoney(discountTotal),
    taxable_total: roundMoney(taxableTotal),
    other_charges: roundMoney(otherCharges),
    freight_amount: roundMoney(freightAmount),
    packing_amount: roundMoney(packingAmount),
    tax_total: roundMoney(taxTotal),
    grand_total: roundMoney(grandTotal),
    round_off: roundMoney(roundOff)
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
  syncQuotationItemRows();
  var totals = calculateTotals();
  var customer = findCustomer($("#customer_id").val());
  var userId = cleanInt(sessionStorage.getItem("USER_ID"), null);

  return {
    header: {
      quotation_no: $.trim($("#quotation_no").val()),
      quotation_date: $("#quotation_date").val(),
      customer_id: cleanInt($("#customer_id").val(), null),
      customer_name: customer ? customer.customer_name : "",
      customer_contact: $.trim($("#customer_contact").val()),
      billing_address: $.trim($("#billing_address").val()),
      shipping_address: $.trim($("#shipping_address").val()),
      valid_till: $("#valid_till").val() || null,
      reference_no: $.trim($("#reference_no").val()),
      subject: $.trim($("#subject").val()),
      currency: $.trim($("#currency").val()),
      payment_term_id: cleanInt($("#payment_term_id").val(), null),
      salesperson_id: cleanInt($("#salesperson_id").val(), null),
      warehouse_id: cleanInt($("#warehouse_id").val(), null),
      currency_id: cleanInt($("#currency_id").val(), null),
      exchange_rate: cleanDecimal($("#exchange_rate").val(), 1),
      notes: $.trim($("#notes").val()),
      terms_conditions: $.trim($("#terms_conditions").val()),
      status: $("#status").val() || "Draft",
      revision_no: cleanInt($("#revision_no").val(), 0),
      approval_status: $("#approval_status").val() || "Pending",
      reason: $.trim($("#reason").val()),
      subtotal: totals.subtotal,
      discount_type: totals.discount_type,
      discount_value: totals.discount_value,
      discount_total: totals.discount_total,
      taxable_total: totals.taxable_total,
      other_charges: totals.other_charges,
      freight_amount: totals.freight_amount,
      packing_amount: totals.packing_amount,
      tax_total: totals.tax_total,
      grand_total: totals.grand_total,
      round_off: totals.round_off,
      created_by: userId,
      updated_by: userId
    },
    items: _.map(quotationItems, function (item, index) {
      calculateLineAmounts(item);
      return {
        line_no: index + 1,
        material_id: item.material_id,
        material_code: item.material_code,
        item_name: item.item_name,
        material_type: item.material_type,
        hsn_sac_code: item.hsn_sac_code,
        item_description: item.item_description,
        qty: cleanDecimal(item.qty, 0),
        unit: item.unit,
        uom_id: cleanInt(item.uom_id, null),
        rate: cleanDecimal(item.rate, 0),
        discount_type: item.discount_type,
        discount_value: cleanDecimal(item.discount_value, 0),
        discount_amount: cleanDecimal(item.discount_amount, 0),
        gross_amount: cleanDecimal(item.gross_amount, 0),
        taxable_amount: cleanDecimal(item.taxable_amount, 0),
        discount_percent: cleanDecimal(item.discount_percent, 0),
        tax_percent: cleanDecimal(item.tax_percent, 0),
        tax_id: cleanInt(item.tax_id, null),
        cgst_percent: cleanDecimal(item.cgst_percent, 0),
        cgst_amount: cleanDecimal(item.cgst_amount, 0),
        sgst_percent: cleanDecimal(item.sgst_percent, 0),
        sgst_amount: cleanDecimal(item.sgst_amount, 0),
        igst_percent: cleanDecimal(item.igst_percent, 0),
        igst_amount: cleanDecimal(item.igst_amount, 0),
        warehouse_id: cleanInt(item.warehouse_id, null),
        delivery_date: item.delivery_date || null,
        item_status: item.item_status || "Open",
        line_total: cleanDecimal(item.line_total, 0)
      };
    })
  };
}

function validateQuotation(payload) {
  if (!payload.header.quotation_no) {
    showWarningDialog("Quotation number is required.");
    return false;
  }

  if (!payload.header.quotation_date) {
    showWarningDialog("Quotation date is required.");
    return false;
  }

  if (!payload.header.customer_id) {
    showWarningDialog("Customer is required.");
    return false;
  }

  if (!payload.items.length) {
    showWarningDialog("At least one quotation item is required.");
    return false;
  }

  for (var i = 0; i < payload.items.length; i++) {
    if (!quotationItems[i].material_id) {
      showWarningDialog("Material is required for every quotation item.");
      return false;
    }

    if (!payload.items[i].item_name) {
      showWarningDialog("Item name is required for every quotation item.");
      return false;
    }

    if (!payload.items[i].qty || Number(payload.items[i].qty) <= 0) {
      showWarningDialog("Quantity must be greater than zero for every quotation item.");
      return false;
    }
  }

  return true;
}

function saveQuotation() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateQuotation(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editQuotationId;
  var url = request_url + (isEdit ? "/quotation/update/" + editQuotationId : "/quotation/create");
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
      showSuccessDialog(isEdit ? "Quotation updated successfully." : "Quotation added successfully.", function () {
        location.href = "quotationinq.html";
      });
    },
    error: function (xhr) {
      handleSaveError(xhr, "There was a problem saving the quotation.");
    },
    complete: function () {
      $(".searchButton").prop("disabled", false);
    }
  });
}

function loadQuotationDetails(quotationId) {
  $.ajax({
    type: "GET",
    url: request_url + "/quotation/" + quotationId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      var header = res && res.header ? res.header : {};
      var items = res && res.items ? res.items : [];

      $("#quotation_no").val(header.quotation_no || "");
      $("#quotation_date").val(formatDate(header.quotation_date));
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
      $("#valid_till").val(formatDate(header.valid_till));
      $("#reference_no").val(header.reference_no || "");
      $("#subject").val(header.subject || "");
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
      $("#revision_no").val(header.revision_no || 0);
      $("#approval_status").val(header.approval_status || "Pending");
      $("#reason").val(header.reason || "");
      $("#discount_type").val(header.discount_type || "");
      $("#discount_value").val(header.discount_value || 0);
      $("#other_charges").val(header.other_charges || 0);
      $("#freight_amount").val(header.freight_amount || 0);
      $("#packing_amount").val(header.packing_amount || 0);
      $("#round_off").val(header.round_off || 0);
      $("#notes").val(header.notes || "");
      $("#terms_conditions").val(header.terms_conditions || "");

      quotationItems = _.map(items, function (item, index) {
        var material = findMaterialByName(item.item_name);
        var materialId = item.material_id || (material ? material.material_id : null);
        var uomId = item.uom_id || (findUomByValue(item.unit) || {}).uom_id || null;
        return {
          line_no: item.line_no || (index + 1),
          material_id: materialId,
          material_code: item.material_code || (material ? (material.material_code || "") : ""),
          item_name: item.item_name || "",
          material_type: item.material_type || (material ? (material.material_type || "") : ""),
          hsn_sac_code: item.hsn_sac_code || (material ? (material.hsn_sac_code || "") : ""),
          item_description: item.item_description || "",
          qty: item.qty || 1,
          unit: item.unit || "",
          uom_id: uomId,
          rate: item.rate || 0,
          discount_type: item.discount_type || (cleanDecimal(item.discount_percent, 0) > 0 ? "PERCENT" : ""),
          discount_value: item.discount_value || item.discount_percent || 0,
          discount_amount: item.discount_amount || 0,
          gross_amount: item.gross_amount || 0,
          taxable_amount: item.taxable_amount || 0,
          discount_percent: item.discount_percent || 0,
          tax_percent: item.tax_percent || 0,
          tax_id: item.tax_id || (material ? material.tax_id : null),
          cgst_percent: item.cgst_percent || 0,
          cgst_amount: item.cgst_amount || 0,
          sgst_percent: item.sgst_percent || 0,
          sgst_amount: item.sgst_amount || 0,
          igst_percent: item.igst_percent || 0,
          igst_amount: item.igst_amount || 0,
          warehouse_id: item.warehouse_id || header.warehouse_id || "",
          delivery_date: formatDate(item.delivery_date),
          item_status: item.item_status || "Open",
          line_total: item.line_total || 0,
          is_active: item.is_active || "Y"
        };
      });

      if (!header.discount_type && cleanDecimal(header.discount_total, 0) > 0) {
        var savedDiscountTotal = cleanDecimal(header.discount_total, 0);
        var quoteDiscount = savedDiscountTotal - calculateLineDiscountTotal(quotationItems);
        $("#discount_type").val(quoteDiscount > 0 ? "AMOUNT" : "");
        $("#discount_value").val(roundMoney(Math.max(quoteDiscount, 0)));
      }

      if (!quotationItems.length) {
        addQuotationItem();
      } else {
        renderQuotationItems();
      }
    },
    error: function (xhr) {
      handleSaveError(xhr, "Unable to load quotation details.");
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
  location.href = "quotationinq.html";
}
