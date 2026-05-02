var editQuotationId;
var customers = [];
var currencies = [];
var uoms = [];
var quotationItems = [];
var quotationItemsTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  quotationItemsTemplate = $("#quotationItemsTmpl").html();

  var params = new URLSearchParams(window.location.search);
  editQuotationId = params.get("id");

  $("#quotationItemsContainer").on("input change", ".quotation-line-input, .quotation-line-select", function () {
    syncQuotationItemRows();
    calculateTotals();
  });

  loadLookups()
    .done(function () {
      renderCustomerOptions();
      renderCurrencyOptions();
      renderQuotationItems();

      if (editQuotationId) {
        $("#pageTitle").text("Edit Quotation Information:");
        loadQuotationDetails(editQuotationId);
      } else {
        $("#pageTitle").text("Add Quotation Information:");
        $("#quotation_date").val(todayString());
        $("#status").val("Draft");
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
    getMasterList("mst_uom")
  ).done(function (customerRows, currencyRows, uomRows) {
    customers = customerRows || [];
    currencies = currencyRows || [];
    uoms = uomRows || [];
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

function renderCurrencyOptions(selectedCurrency) {
  var html = '<option value="">Select</option>';
  _.each(currencies, function (currency) {
    var currencyCode = currency.currency_code || currency.currency_name || "";
    var selected = String(selectedCurrency || "") === String(currencyCode) ? " selected" : "";
    html += '<option value="' + currencyCode + '"' + selected + ">" + currencyCode + "</option>";
  });
  $("#currency").html(html);
}

function onCustomerChange() {
  var customer = findCustomer($("#customer_id").val());
  if (!customer) {
    $("#customer_contact").val("");
    return;
  }

  $("#customer_contact").val(customer.contact_person || customer.phone || customer.email || "");
}

function findCustomer(customerId) {
  return _.find(customers, function (item) {
    return String(item.customer_id) === String(customerId);
  });
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
    item_name: "",
    item_description: "",
    qty: 1,
    unit: "",
    rate: 0,
    discount_percent: 0,
    tax_percent: 0,
    line_total: 0,
    is_active: "Y"
  });

  renderQuotationItems();
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

    quotationItems[index].item_name = $.trim($(this).find(".lineItemName").val());
    quotationItems[index].item_description = $.trim($(this).find(".lineDescription").val());
    quotationItems[index].qty = cleanDecimal($(this).find(".lineQty").val(), 0);
    quotationItems[index].unit = $.trim($(this).find(".lineUnit").val());
    quotationItems[index].rate = cleanDecimal($(this).find(".lineRate").val(), 0);
    quotationItems[index].discount_percent = cleanDecimal($(this).find(".lineDiscount").val(), 0);
    quotationItems[index].tax_percent = cleanDecimal($(this).find(".lineTax").val(), 0);
    quotationItems[index].line_total = calculateLineTotal(quotationItems[index]);
  });
}

function renderQuotationItems() {
  syncLineNumbers();
  calculateTotals();

  $("#quotationItemsContainer").html(_.template(quotationItemsTemplate, {
    items: quotationItems || [],
    uoms: uoms || [],
    formatAmount: formatAmount
  }));
  $("#quotationItemsContainer").trigger("create");
}

function syncLineNumbers() {
  _.each(quotationItems, function (item, index) {
    item.line_no = index + 1;
    item.line_total = calculateLineTotal(item);
  });
}

function calculateLineTotal(item) {
  var qty = Number(item.qty || 0);
  var rate = Number(item.rate || 0);
  var discountPercent = Number(item.discount_percent || 0);
  var taxPercent = Number(item.tax_percent || 0);
  var gross = qty * rate;
  var discountAmount = gross * discountPercent / 100;
  var taxableAmount = gross - discountAmount;
  var taxAmount = taxableAmount * taxPercent / 100;
  return roundMoney(taxableAmount + taxAmount);
}

function calculateTotals() {
  var subtotal = 0;
  var discountTotal = 0;
  var taxTotal = 0;
  var grandTotal = 0;

  _.each(quotationItems, function (item) {
    var qty = Number(item.qty || 0);
    var rate = Number(item.rate || 0);
    var discountPercent = Number(item.discount_percent || 0);
    var taxPercent = Number(item.tax_percent || 0);
    var gross = qty * rate;
    var discountAmount = gross * discountPercent / 100;
    var taxableAmount = gross - discountAmount;
    var taxAmount = taxableAmount * taxPercent / 100;

    subtotal += gross;
    discountTotal += discountAmount;
    taxTotal += taxAmount;
    grandTotal += taxableAmount + taxAmount;
    item.line_total = roundMoney(taxableAmount + taxAmount);
  });

  $("#subtotalLabel").text(formatAmount(subtotal));
  $("#discountTotalLabel").text(formatAmount(discountTotal));
  $("#taxTotalLabel").text(formatAmount(taxTotal));
  $("#grandTotalLabel").text(formatAmount(grandTotal));

  $("#quotationItemsContainer tr[data-index]").each(function () {
    var index = parseInt($(this).attr("data-index"), 10);
    if (quotationItems[index]) {
      $(this).find(".lineTotalLabel").text(formatAmount(quotationItems[index].line_total));
    }
  });

  return {
    subtotal: roundMoney(subtotal),
    discount_total: roundMoney(discountTotal),
    tax_total: roundMoney(taxTotal),
    grand_total: roundMoney(grandTotal)
  };
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
      valid_till: $("#valid_till").val() || null,
      reference_no: $.trim($("#reference_no").val()),
      subject: $.trim($("#subject").val()),
      currency: $("#currency").val(),
      notes: $.trim($("#notes").val()),
      terms_conditions: $.trim($("#terms_conditions").val()),
      status: $("#status").val() || "Draft",
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      tax_total: totals.tax_total,
      grand_total: totals.grand_total,
      created_by: userId,
      updated_by: userId
    },
    items: _.map(quotationItems, function (item, index) {
      return {
        line_no: index + 1,
        item_name: item.item_name,
        item_description: item.item_description,
        qty: cleanDecimal(item.qty, 0),
        unit: item.unit,
        rate: cleanDecimal(item.rate, 0),
        discount_percent: cleanDecimal(item.discount_percent, 0),
        tax_percent: cleanDecimal(item.tax_percent, 0),
        line_total: calculateLineTotal(item)
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
      $("#valid_till").val(formatDate(header.valid_till));
      $("#reference_no").val(header.reference_no || "");
      $("#subject").val(header.subject || "");
      if (header.currency && !_.find(currencies, function (item) {
        return String(item.currency_code || item.currency_name || "") === String(header.currency);
      })) {
        currencies.push({
          currency_code: header.currency,
          currency_name: header.currency
        });
      }
      renderCurrencyOptions(header.currency || "");
      $("#currency").val(header.currency || "");
      $("#status").val(header.status || "Draft");
      $("#notes").val(header.notes || "");
      $("#terms_conditions").val(header.terms_conditions || "");

      quotationItems = _.map(items, function (item, index) {
        return {
          line_no: item.line_no || (index + 1),
          item_name: item.item_name || "",
          item_description: item.item_description || "",
          qty: item.qty || 1,
          unit: item.unit || "",
          rate: item.rate || 0,
          discount_percent: item.discount_percent || 0,
          tax_percent: item.tax_percent || 0,
          line_total: item.line_total || 0,
          is_active: item.is_active || "Y"
        };
      });

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
