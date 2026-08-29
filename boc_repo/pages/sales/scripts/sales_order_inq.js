var salesOrderData;
var salesOrderTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  salesOrderTemplate = $("#listTmpl").html();
  salesOrderData = [];
  $("#salesOrderTableSearch").on("input", filterSalesOrderTable);
  setupSalesOrderInquiryAutocomplete();
  renderList([]);
  search();
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) {
    return {};
  }
  return { Authorization: "Bearer " + token };
}

function setupSalesOrderInquiryAutocomplete() {
  setupApiAutocompleteList(request_url + "/salesorder/list", [
    { selector: "#salesOrderNoSearch", hiddenSelector: "#salesOrderNoSearchId", valueField: "sales_order_no", idField: "sales_order_id" },
    { selector: "#customerSearch", hiddenSelector: "#customerSearchId", valueField: "customer_name", idField: "customer_id" }
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
    url: request_url + "/salesorder/list",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (rows) {
      salesOrderData = rows || [];
      renderList(filterSalesOrders(salesOrderData));
    },
    error: onSearchErr
  });
}

function filterSalesOrders(rows) {
  var salesOrderNo = $.trim($("#salesOrderNoSearch").val() || "").toLowerCase();
  var customer = $.trim($("#customerSearch").val() || "").toLowerCase();
  var fromDate = $("#fromDateSearch").val();
  var toDate = $("#toDateSearch").val();
  var status = $("#statusSearch").val();

  return _.filter(rows || [], function (item) {
    var orderDate = normalizeDate(item.sales_order_date);
    var orderNoText = String(item.sales_order_no || "").toLowerCase();
    var quoteNoText = String(item.quotation_no || "").toLowerCase();
    var customerText = String(item.customer_name || "").toLowerCase();
    var contactText = String(item.customer_contact || "").toLowerCase();
    var statusText = String(item.status || "");

    if (salesOrderNo && orderNoText.indexOf(salesOrderNo) === -1 && quoteNoText.indexOf(salesOrderNo) === -1) {
      return false;
    }

    if (customer && customerText.indexOf(customer) === -1 && contactText.indexOf(customer) === -1) {
      return false;
    }

    if (status && statusText !== status) {
      return false;
    }

    if (fromDate && (!orderDate || orderDate < fromDate)) {
      return false;
    }

    if (toDate && (!orderDate || orderDate > toDate)) {
      return false;
    }

    return true;
  });
}

function onSearchErr(xhr) {
  salesOrderData = [];
  renderList([]);

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch sales order records.");
}

function renderList(rows) {
  var template = _.template(salesOrderTemplate);
  $("#listContainer2").html(template({
    salesOrders: rows || [],
    formatDate: formatDate,
    formatAmount: formatAmount
  }));
  filterSalesOrderTable();
  $("#listContainer2").trigger("create");
}

function filterSalesOrderTable() {
  var searchText = $.trim($("#salesOrderTableSearch").val() || "").toLowerCase();
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
  if (!value) {
    return "";
  }
  return String(value).substring(0, 10);
}

function formatDate(value) {
  return normalizeDate(value);
}

function formatAmount(value) {
  var amount = Number(value || 0);
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function addSalesOrder() {
  location.href = "salesorder_add.html";
}

function editSalesOrder(id) {
  if (!id) return;
  location.href = "salesorder_add.html?id=" + id;
}

function deleteSalesOrder(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this sales order?", function () {
    $.ajax({
      url: request_url + "/salesorder/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USER_ID")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Sales order deactivated successfully.", function () {
          search();
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
        showErrorDialog("There was a problem deactivating this sales order.");
      }
    });
  });
}

function printSalesOrder(id) {
  if (!id) return;

  $.ajax({
    type: "GET",
    url: request_url + "/salesorder/" + id,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      var header = res && res.header ? res.header : {};
      var items = res && res.items ? res.items : [];
      openSalesOrderPrintWindow(header, items);
    },
    error: function (xhr) {
      handleActionError(xhr, "Unable to load sales order for printing.");
    }
  });
}

function openSalesOrderPrintWindow(header, items) {
  var printWindow = window.open("", "_blank", "width=1000,height=900");

  if (!printWindow) {
    showWarningDialog("Please allow popups to print the sales order.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildSalesOrderPrintHtml(header, items));
  printWindow.document.close();
  printWindow.focus();

  setTimeout(function () {
    printWindow.print();
  }, 500);
}

function buildSalesOrderPrintHtml(header, items) {
  var totals = calculateSalesOrderPrintTotals(header, items);
  var logoUrl = new URL("../../global/css/images/logo2.png", window.location.href).href;
  var companyName = "CoreFlow ERP";
  var companyTagline = "Manufacturing, Supply, Sales, Procurement & Inventory Operations";
  var companyAddress = "64, Business Industrial Estate<br>Near New Market<br>Ahmedabad - 380001";
  var companyContact = "Tel : 079-25820309<br>Web : www.coreflowerp.com<br>Email : info@coreflowerp.com";
  var gstNo = "GSTIN : ";
  var customerAddress = header.billing_address || header.shipping_address || "";
  var shippingAddress = header.shipping_address || header.billing_address || "";

  return '<!doctype html>' +
    '<html>' +
    '<head>' +
      '<meta charset="utf-8">' +
      '<title>Sales Order ' + escapeHtml(header.sales_order_no || "") + '</title>' +
      '<style>' +
        '@page{size:A4;margin:8mm;}' +
        'body{margin:0;background:#fff;color:#16172b;font-family:Arial,Helvetica,sans-serif;font-size:10px;}' +
        '.order-page{width:100%;max-width:790px;margin:0 auto;border:1px solid #26264d;}' +
        '.top-title{display:grid;grid-template-columns:1fr 120px;border-bottom:1px solid #26264d;min-height:98px;}' +
        '.company-block{padding:6px 8px 3px 8px;}' +
        '.company-name{font-size:26px;line-height:30px;font-weight:900;letter-spacing:1px;color:#2b2b68;text-transform:uppercase;}' +
        '.tagline{background:#07958f;color:#fff;font-size:13px;font-weight:700;padding:4px 6px;margin-top:2px;}' +
        '.company-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:5px;font-size:10px;line-height:14px;}' +
        '.logo-block{display:flex;align-items:center;justify-content:center;border-left:1px solid #26264d;padding:8px;}' +
        '.logo-block img{max-width:100px;max-height:78px;object-fit:contain;}' +
        '.doc-heading{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #26264d;align-items:center;}' +
        '.gst{font-size:13px;font-weight:800;padding:4px 6px;}' +
        '.document-title{text-align:center;font-size:18px;font-weight:900;color:#393168;}' +
        '.status{text-align:right;padding:4px 6px;font-weight:700;}' +
        '.details{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #26264d;}' +
        '.box{min-height:124px;}' +
        '.box + .box{border-left:1px solid #26264d;}' +
        '.box-title{text-align:center;font-weight:900;border-bottom:1px solid #26264d;padding:3px;background:#f7f8fb;}' +
        '.field-grid{display:grid;grid-template-columns:86px 1fr;row-gap:4px;column-gap:5px;padding:6px;line-height:13px;}' +
        '.label{font-weight:800;}' +
        '.items{width:100%;border-collapse:collapse;table-layout:fixed;}' +
        '.items th,.items td{border-right:1px solid #26264d;border-bottom:1px solid #26264d;padding:4px 3px;vertical-align:top;}' +
        '.items th:last-child,.items td:last-child{border-right:0;}' +
        '.items th{text-align:center;font-weight:900;background:#f7f8fb;}' +
        '.items .num{text-align:right;}' +
        '.items .center{text-align:center;}' +
        '.item-name{font-weight:800;}' +
        '.item-desc{font-size:9px;font-style:italic;line-height:12px;}' +
        '.total-row td{font-weight:900;background:#fafafa;}' +
        '.footer-grid{display:grid;grid-template-columns:3fr 2fr;border-bottom:1px solid #26264d;}' +
        '.footer-left{border-right:1px solid #26264d;}' +
        '.words-title,.bank-title,.terms-title{text-align:center;font-weight:900;border-bottom:1px solid #26264d;padding:4px;background:#f7f8fb;}' +
        '.words{min-height:38px;padding:7px;text-align:center;font-weight:700;}' +
        '.bank-row{display:grid;grid-template-columns:115px 1fr;border-bottom:1px solid #26264d;}' +
        '.bank-row div{padding:4px 6px;}' +
        '.bank-row div:first-child{font-weight:800;}' +
        '.terms{padding:6px;min-height:58px;line-height:13px;}' +
        '.summary-row{display:grid;grid-template-columns:1fr 110px;border-bottom:1px solid #26264d;}' +
        '.summary-row div{padding:4px 6px;}' +
        '.summary-row div:first-child{font-weight:800;}' +
        '.summary-row div:last-child{text-align:right;font-weight:800;}' +
        '.cert{text-align:center;font-size:9px;line-height:13px;padding:5px;border-bottom:1px solid #26264d;}' +
        '.signature{height:56px;display:flex;align-items:flex-end;justify-content:center;font-size:9px;font-weight:800;padding-bottom:4px;}' +
        '.print-footer{text-align:center;font-size:9px;padding:5px;}' +
        '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.order-page{max-width:none;width:100%;}}' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="order-page">' +
        '<div class="top-title">' +
          '<div class="company-block">' +
            '<div class="company-name">' + escapeHtml(companyName) + '</div>' +
            '<div class="tagline">' + escapeHtml(companyTagline) + '</div>' +
            '<div class="company-meta">' +
              '<div>' + companyAddress + '</div>' +
              '<div style="text-align:right;">' + companyContact + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="logo-block"><img src="' + logoUrl + '" alt="Company logo"></div>' +
        '</div>' +

        '<div class="doc-heading">' +
          '<div class="gst">' + escapeHtml(gstNo) + '</div>' +
          '<div class="document-title">Sales Order</div>' +
          '<div class="status">' + escapeHtml(header.approval_status || header.status || "") + '</div>' +
        '</div>' +

        '<div class="details">' +
          '<div class="box">' +
            '<div class="box-title">Customer Detail</div>' +
            '<div class="field-grid">' +
              '<div class="label">M/S</div><div>' + escapeHtml(header.customer_name || "") + '</div>' +
              '<div class="label">Address</div><div>' + formatMultiline(customerAddress) + '</div>' +
              '<div class="label">PHONE</div><div>' + escapeHtml(header.customer_contact || "") + '</div>' +
              '<div class="label">Ship To</div><div>' + formatMultiline(shippingAddress) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="box">' +
            '<div class="field-grid">' +
              '<div class="label">Order No.</div><div><b>' + escapeHtml(header.sales_order_no || "") + '</b></div>' +
              '<div class="label">Order Date</div><div>' + formatPrintDate(header.sales_order_date) + '</div>' +
              '<div class="label">Delivery Date</div><div>' + formatPrintDate(header.delivery_date) + '</div>' +
              '<div class="label">Quotation No.</div><div>' + escapeHtml(header.quotation_no || "") + '</div>' +
              '<div class="label">Reference No.</div><div>' + escapeHtml(header.reference_no || "") + '</div>' +
              '<div class="label">Subject</div><div>' + escapeHtml(header.subject || "") + '</div>' +
              '<div class="label">Currency</div><div>' + escapeHtml(header.currency || "") + '</div>' +
              '<div class="label">Payment Term</div><div>' + escapeHtml(header.payment_term_id || "") + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        buildSalesOrderPrintItems(items, totals) +

        '<div class="footer-grid">' +
          '<div class="footer-left">' +
            '<div class="words-title">Total in words</div>' +
            '<div class="words">' + escapeHtml(numberToWordsIndian(Math.round(totals.grandTotal)) + " ONLY") + '</div>' +
            '<div class="bank-title">Bank Details</div>' +
            '<div class="bank-row"><div>Bank Name</div><div>State Bank of India</div></div>' +
            '<div class="bank-row"><div>Branch Name</div><div>Main Branch</div></div>' +
            '<div class="bank-row"><div>Bank Account No</div><div>2000000004512</div></div>' +
            '<div class="bank-row"><div>Bank IFSC</div><div>SBIN0000488</div></div>' +
            '<div class="terms-title">Terms and Conditions</div>' +
            '<div class="terms">' + formatTerms(header.terms_conditions || header.notes || "") + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="summary-row"><div>Taxable Amount</div><div>' + formatAmount(totals.taxableTotal) + '</div></div>' +
            '<div class="summary-row"><div>Total Discount</div><div>' + formatAmount(totals.discountTotal) + '</div></div>' +
            '<div class="summary-row"><div>Total Tax</div><div>' + formatAmount(totals.taxTotal) + '</div></div>' +
            '<div class="summary-row"><div>Freight / Packing / Other</div><div>' + formatAmount(totals.chargesTotal) + '</div></div>' +
            '<div class="summary-row"><div>Round Off</div><div>' + formatAmount(totals.roundOff) + '</div></div>' +
            '<div class="summary-row"><div>Total Amount After Tax</div><div>' + escapeHtml(header.currency || "") + ' ' + formatAmount(totals.grandTotal) + '</div></div>' +
            '<div class="summary-row"><div>GST Payable on Reverse Charge</div><div>N.A.</div></div>' +
            '<div class="cert">Certified that the particulars given above are true and correct.<br><b>For ' + escapeHtml(companyName) + '</b></div>' +
            '<div class="signature">Authorised Signatory</div>' +
          '</div>' +
        '</div>' +
        '<div class="print-footer">This is a computer generated sales order.</div>' +
      '</div>' +
    '</body>' +
    '</html>';
}

function buildSalesOrderPrintItems(items, totals) {
  var rows = "";

  _.each(items || [], function (item, index) {
    var qty = cleanDecimal(item.qty, 0);
    var deliveredQty = cleanDecimal(item.delivered_qty, 0);
    var invoicedQty = cleanDecimal(item.invoiced_qty, 0);
    var rate = cleanDecimal(item.rate, 0);
    var taxableAmount = cleanDecimal(item.taxable_amount, cleanDecimal(item.gross_amount, qty * rate) - cleanDecimal(item.discount_amount, 0));
    var taxPercent = cleanDecimal(item.tax_percent, cleanDecimal(item.cgst_percent, 0) + cleanDecimal(item.sgst_percent, 0) + cleanDecimal(item.igst_percent, 0));
    var taxAmount = cleanDecimal(item.tax_amount, cleanDecimal(item.cgst_amount, 0) + cleanDecimal(item.sgst_amount, 0) + cleanDecimal(item.igst_amount, 0));
    var lineTotal = cleanDecimal(item.line_total, taxableAmount + taxAmount);

    rows += '<tr>' +
      '<td class="center">' + (index + 1) + '</td>' +
      '<td><div class="item-name">' + escapeHtml(item.item_name || "") + '</div><div class="item-desc">' + escapeHtml(item.item_description || "") + '</div></td>' +
      '<td class="center">' + escapeHtml(item.hsn_sac_code || "") + '</td>' +
      '<td class="num">' + formatAmount(qty) + ' ' + escapeHtml(item.unit || "") + '</td>' +
      '<td class="num">' + formatAmount(deliveredQty) + '</td>' +
      '<td class="num">' + formatAmount(invoicedQty) + '</td>' +
      '<td class="num">' + formatAmount(rate) + '</td>' +
      '<td class="num">' + formatAmount(taxableAmount) + '</td>' +
      '<td class="num">' + formatAmount(taxPercent) + '</td>' +
      '<td class="num">' + formatAmount(taxAmount) + '</td>' +
      '<td class="num">' + formatAmount(lineTotal) + '</td>' +
    '</tr>';
  });

  if (!rows) {
    rows = '<tr><td colspan="11" class="center">No items available.</td></tr>';
  }

  return '<table class="items">' +
    '<tr>' +
      '<th width="5%">Sr.<br>No.</th>' +
      '<th width="25%">Name of Product / Service</th>' +
      '<th width="9%">HSN / SAC</th>' +
      '<th width="9%">Qty</th>' +
      '<th width="8%">Delivered</th>' +
      '<th width="8%">Invoiced</th>' +
      '<th width="9%">Rate</th>' +
      '<th width="11%">Taxable</th>' +
      '<th width="7%">GST %</th>' +
      '<th width="8%">Tax</th>' +
      '<th width="11%">Total</th>' +
    '</tr>' +
    rows +
    '<tr class="total-row">' +
      '<td colspan="3" class="num">Total</td>' +
      '<td class="num">' + formatAmount(totals.totalQty) + '</td>' +
      '<td class="num">' + formatAmount(totals.totalDeliveredQty) + '</td>' +
      '<td class="num">' + formatAmount(totals.totalInvoicedQty) + '</td>' +
      '<td></td>' +
      '<td class="num">' + formatAmount(totals.taxableTotal) + '</td>' +
      '<td></td>' +
      '<td class="num">' + formatAmount(totals.taxTotal) + '</td>' +
      '<td class="num">' + formatAmount(totals.itemTotal) + '</td>' +
    '</tr>' +
  '</table>';
}

function calculateSalesOrderPrintTotals(header, items) {
  var totalQty = 0;
  var totalDeliveredQty = 0;
  var totalInvoicedQty = 0;
  var taxableTotal = 0;
  var taxTotal = 0;
  var itemTotal = 0;

  _.each(items || [], function (item) {
    var qty = cleanDecimal(item.qty, 0);
    var rate = cleanDecimal(item.rate, 0);
    var taxableAmount = cleanDecimal(item.taxable_amount, cleanDecimal(item.gross_amount, qty * rate) - cleanDecimal(item.discount_amount, 0));
    var taxAmount = cleanDecimal(item.tax_amount, cleanDecimal(item.cgst_amount, 0) + cleanDecimal(item.sgst_amount, 0) + cleanDecimal(item.igst_amount, 0));
    var lineTotal = cleanDecimal(item.line_total, taxableAmount + taxAmount);

    totalQty += qty;
    totalDeliveredQty += cleanDecimal(item.delivered_qty, 0);
    totalInvoicedQty += cleanDecimal(item.invoiced_qty, 0);
    taxableTotal += taxableAmount;
    taxTotal += taxAmount;
    itemTotal += lineTotal;
  });

  var headerTaxable = cleanDecimal(header.taxable_total, taxableTotal);
  var headerTax = cleanDecimal(header.tax_total, taxTotal);
  var chargesTotal = cleanDecimal(header.freight_amount, 0) + cleanDecimal(header.packing_amount, 0) + cleanDecimal(header.other_charges, 0);
  var roundOff = cleanDecimal(header.round_off, 0);
  var grandTotal = cleanDecimal(header.grand_total, headerTaxable + headerTax + chargesTotal + roundOff);

  return {
    totalQty: roundMoney(totalQty),
    totalDeliveredQty: roundMoney(totalDeliveredQty),
    totalInvoicedQty: roundMoney(totalInvoicedQty),
    taxableTotal: roundMoney(headerTaxable),
    discountTotal: roundMoney(cleanDecimal(header.discount_total, 0)),
    taxTotal: roundMoney(headerTax),
    chargesTotal: roundMoney(chargesTotal),
    roundOff: roundMoney(roundOff),
    itemTotal: roundMoney(itemTotal),
    grandTotal: roundMoney(grandTotal)
  };
}

function escapeHtml(value) {
  return String(value === null || value === undefined ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMultiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function formatTerms(value) {
  if (!value) {
    return "1. Subject to our home jurisdiction.<br>2. Goods once sold will not be taken back.<br>3. Delivery ex-premises.";
  }

  return formatMultiline(value);
}

function formatPrintDate(value) {
  var dateValue = normalizeDate(value);
  if (!dateValue) return "";

  var parts = dateValue.split("-");
  if (parts.length !== 3) return escapeHtml(dateValue);

  var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var monthIndex = parseInt(parts[1], 10) - 1;
  return parts[2] + "-" + monthNames[monthIndex] + "-" + parts[0];
}

function numberToWordsIndian(value) {
  var number = parseInt(value, 10);

  if (!number) {
    return "ZERO RUPEES";
  }

  var ones = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  var tens = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  function convertBelowHundred(num) {
    if (num < 20) return ones[num];
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
  }

  function convertBelowThousand(num) {
    var words = "";
    if (num >= 100) {
      words += ones[Math.floor(num / 100)] + " HUNDRED";
      num = num % 100;
      if (num) words += " ";
    }
    if (num) words += convertBelowHundred(num);
    return words;
  }

  var parts = [
    { value: 10000000, label: "CRORE" },
    { value: 100000, label: "LAKH" },
    { value: 1000, label: "THOUSAND" },
    { value: 1, label: "" }
  ];
  var words = [];

  _.each(parts, function (part) {
    var section = Math.floor(number / part.value);
    if (section) {
      words.push(convertBelowThousand(section) + (part.label ? " " + part.label : ""));
      number = number % part.value;
    }
  });

  return words.join(" ") + " RUPEES";
}

function handleActionError(xhr, fallbackMessage) {
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

function cleanDecimal(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  var parsed = parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
