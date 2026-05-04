var quotationData;
var quotationTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  quotationTemplate = $("#listTmpl").html();
  quotationData = [];
  $("#quotationTableSearch").on("input", filterQuotationTable);
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

function search() {
  var fromDate = $("#fromDateSearch").val();
  var toDate = $("#toDateSearch").val();

  if (fromDate && toDate && fromDate > toDate) {
    showWarningDialog("From Date cannot be greater than To Date.");
    return;
  }

  $.ajax({
    type: "GET",
    url: request_url + "/quotation/list",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (rows) {
      quotationData = rows || [];
      renderList(filterQuotations(quotationData));
    },
    error: onSearchErr
  });
}

function filterQuotations(rows) {
  var quotationNo = $.trim($("#quotationNoSearch").val() || "").toLowerCase();
  var customer = $.trim($("#customerSearch").val() || "").toLowerCase();
  var fromDate = $("#fromDateSearch").val();
  var toDate = $("#toDateSearch").val();
  var status = $("#statusSearch").val();

  return _.filter(rows || [], function (item) {
    var quoteDate = normalizeDate(item.quotation_date);
    var quoteNoText = String(item.quotation_no || "").toLowerCase();
    var customerText = String(item.customer_name || "").toLowerCase();
    var contactText = String(item.customer_contact || "").toLowerCase();
    var statusText = String(item.status || "");

    if (quotationNo && quoteNoText.indexOf(quotationNo) === -1) {
      return false;
    }

    if (customer && customerText.indexOf(customer) === -1 && contactText.indexOf(customer) === -1) {
      return false;
    }

    if (status && statusText !== status) {
      return false;
    }

    if (fromDate && (!quoteDate || quoteDate < fromDate)) {
      return false;
    }

    if (toDate && (!quoteDate || quoteDate > toDate)) {
      return false;
    }

    return true;
  });
}

function onSearchErr(xhr) {
  quotationData = [];
  renderList([]);

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch quotation records.");
}

function renderList(rows) {
  var template = _.template(quotationTemplate);
  $("#listContainer2").html(template({
    quotations: rows || [],
    formatDate: formatDate,
    formatAmount: formatAmount,
    canApproveQuotation: canApproveQuotation,
    canConvertQuotation: canConvertQuotation
  }));
  filterQuotationTable();
  $("#listContainer2").trigger("create");
}

function filterQuotationTable() {
  var searchText = $.trim($("#quotationTableSearch").val() || "").toLowerCase();
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

function isAdminRole() {
  var roleName = String(sessionStorage.getItem("ROLE_NAME") || "").toUpperCase();
  return roleName.indexOf("ADMIN") !== -1;
}

function isQuotationApproved(item) {
  var status = String(item && item.status ? item.status : "").toUpperCase();
  var approvalStatus = String(item && item.approval_status ? item.approval_status : "").toUpperCase();
  return status === "APPROVED" || approvalStatus === "APPROVED";
}

function canApproveQuotation(item) {
  return isAdminRole() && !isQuotationApproved(item);
}

function canConvertQuotation(item) {
  return isQuotationApproved(item);
}

function addQuotation() {
  location.href = "quotation_add.html";
}

function editQuotation(id) {
  if (!id) return;
  location.href = "quotation_add.html?id=" + id;
}

function deleteQuotation(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this quotation?", function () {
    $.ajax({
      url: request_url + "/quotation/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USER_ID")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Quotation deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this quotation.");
      }
    });
  });
}

function printQuotation(id) {
  if (!id) return;

  $.ajax({
    type: "GET",
    url: request_url + "/quotation/" + id,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      var header = res && res.header ? res.header : {};
      var items = res && res.items ? res.items : [];
      openQuotationPrintWindow(header, items);
    },
    error: function (xhr) {
      handleActionError(xhr, "Unable to load quotation for printing.");
    }
  });
}

function openQuotationPrintWindow(header, items) {
  var printWindow = window.open("", "_blank", "width=1000,height=900");

  if (!printWindow) {
    showWarningDialog("Please allow popups to print the quotation.");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildQuotationPrintHtml(header, items));
  printWindow.document.close();
  printWindow.focus();

  setTimeout(function () {
    printWindow.print();
  }, 500);
}

function buildQuotationPrintHtml(header, items) {
  var totals = calculateQuotationPrintTotals(header, items);
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
      '<title>Quotation ' + escapeHtml(header.quotation_no || "") + '</title>' +
      '<style>' +
        '@page{size:A4;margin:8mm;}' +
        'body{margin:0;background:#fff;color:#16172b;font-family:Arial,Helvetica,sans-serif;font-size:10px;}' +
        '.quote-page{width:100%;max-width:790px;margin:0 auto;border:1px solid #26264d;}' +
        '.top-title{display:grid;grid-template-columns:1fr 120px;border-bottom:1px solid #26264d;min-height:98px;}' +
        '.company-block{padding:6px 8px 3px 8px;}' +
        '.company-name{font-size:26px;line-height:30px;font-weight:900;letter-spacing:1px;color:#2b2b68;text-transform:uppercase;}' +
        '.tagline{background:#07958f;color:#fff;font-size:13px;font-weight:700;padding:4px 6px;margin-top:2px;}' +
        '.company-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:5px;font-size:10px;line-height:14px;}' +
        '.logo-block{display:flex;align-items:center;justify-content:center;border-left:1px solid #26264d;padding:8px;}' +
        '.logo-block img{max-width:100px;max-height:78px;object-fit:contain;}' +
        '.doc-heading{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #26264d;align-items:center;}' +
        '.gst{font-size:13px;font-weight:800;padding:4px 6px;}' +
        '.quotation-title{text-align:center;font-size:18px;font-weight:900;color:#393168;}' +
        '.status{text-align:right;padding:4px 6px;font-weight:700;}' +
        '.details{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #26264d;}' +
        '.box{min-height:112px;}' +
        '.box + .box{border-left:1px solid #26264d;}' +
        '.box-title{text-align:center;font-weight:900;border-bottom:1px solid #26264d;padding:3px;background:#f7f8fb;}' +
        '.field-grid{display:grid;grid-template-columns:78px 1fr;row-gap:4px;column-gap:5px;padding:6px;line-height:13px;}' +
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
        '@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}.quote-page{max-width:none;width:100%;}.no-print{display:none;}}' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<div class="quote-page">' +
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
          '<div class="quotation-title">Quotation</div>' +
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
              '<div class="label">Quotation No.</div><div><b>' + escapeHtml(header.quotation_no || "") + '</b></div>' +
              '<div class="label">Quotation Date</div><div>' + formatPrintDate(header.quotation_date) + '</div>' +
              '<div class="label">Valid Till</div><div>' + formatPrintDate(header.valid_till) + '</div>' +
              '<div class="label">Reference No.</div><div>' + escapeHtml(header.reference_no || "") + '</div>' +
              '<div class="label">Subject</div><div>' + escapeHtml(header.subject || "") + '</div>' +
              '<div class="label">Currency</div><div>' + escapeHtml(header.currency || "") + '</div>' +
              '<div class="label">Payment Term</div><div>' + escapeHtml(header.payment_term_id || "") + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        buildQuotationPrintItems(items, totals) +

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
        '<div class="print-footer">This is a computer generated quotation.</div>' +
      '</div>' +
    '</body>' +
    '</html>';
}

function buildQuotationPrintItems(items, totals) {
  var rows = "";

  _.each(items || [], function (item, index) {
    var qty = cleanDecimal(item.qty, 0);
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
      '<td class="num">' + formatAmount(rate) + '</td>' +
      '<td class="num">' + formatAmount(taxableAmount) + '</td>' +
      '<td class="num">' + formatAmount(taxPercent) + '</td>' +
      '<td class="num">' + formatAmount(taxAmount) + '</td>' +
      '<td class="num">' + formatAmount(lineTotal) + '</td>' +
    '</tr>';
  });

  if (!rows) {
    rows = '<tr><td colspan="9" class="center">No items available.</td></tr>';
  }

  return '<table class="items">' +
    '<tr>' +
      '<th width="5%">Sr.<br>No.</th>' +
      '<th width="30%">Name of Product / Service</th>' +
      '<th width="11%">HSN / SAC</th>' +
      '<th width="10%">Qty</th>' +
      '<th width="11%">Rate</th>' +
      '<th width="13%">Taxable Value</th>' +
      '<th width="7%">GST %</th>' +
      '<th width="9%">Amount</th>' +
      '<th width="12%">Total</th>' +
    '</tr>' +
    rows +
    '<tr class="total-row">' +
      '<td colspan="3" class="num">Total</td>' +
      '<td class="num">' + formatAmount(totals.totalQty) + '</td>' +
      '<td></td>' +
      '<td class="num">' + formatAmount(totals.taxableTotal) + '</td>' +
      '<td></td>' +
      '<td class="num">' + formatAmount(totals.taxTotal) + '</td>' +
      '<td class="num">' + formatAmount(totals.itemTotal) + '</td>' +
    '</tr>' +
  '</table>';
}

function calculateQuotationPrintTotals(header, items) {
  var totalQty = 0;
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

function approveQuotation(id) {
  if (!id) return;

  showConfirmDialog("Approve this quotation?", function () {
    $.ajax({
      url: request_url + "/quotation/status/" + id,
      type: "PATCH",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        status: "Approved",
        approval_status: "Approved",
        updated_by: sessionStorage.getItem("USER_ID")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Quotation approved successfully.", function () {
          search();
        });
      },
      error: function (xhr) {
        handleActionError(xhr, "There was a problem approving this quotation.");
      }
    });
  });
}

function convertQuotationToSalesOrder(id) {
  if (!id) return;

  var summary = _.find(quotationData || [], function (item) {
    return String(item.quotation_id) === String(id);
  });

  if (!isQuotationApproved(summary)) {
    showWarningDialog("Only approved quotations can be converted to sales orders.");
    return;
  }

  showConfirmDialog("Open this approved quotation in Sales Order creation?", function () {
    checkExistingSalesOrderForQuotation(id)
      .done(function (existingSalesOrder) {
        if (existingSalesOrder) {
          showWarningDialog("This quotation is already converted to Sales Order " + (existingSalesOrder.sales_order_no || "") + ".");
          return;
        }

        openSalesOrderDraftFromQuotation(id);
      })
      .fail(function (xhr) {
        handleActionError(xhr, "Unable to validate existing sales orders.");
      });
  });
}

function openSalesOrderDraftFromQuotation(quotationId) {
  location.href = "salesorder_add.html?quotation_id=" + encodeURIComponent(quotationId);
}

function checkExistingSalesOrderForQuotation(quotationId) {
  return $.ajax({
    type: "GET",
    url: request_url + "/salesorder/list",
    headers: getAuthHeaders(),
    contentType: "application/json"
  }).then(function (rows) {
    return _.find(rows || [], function (item) {
      return String(item.quotation_id || "") === String(quotationId);
    });
  });
}

function createSalesOrderFromQuotation(quotationId) {
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

    if (!isQuotationApproved(header)) {
      showWarningDialog("Only approved quotations can be converted to sales orders.");
      return;
    }

    if (!items.length) {
      showWarningDialog("This quotation has no items to convert.");
      return;
    }

    var payload = buildSalesOrderPayloadFromQuotation(header, items, nextNo);

    $.ajax({
      type: "POST",
      url: request_url + "/salesorder/create",
      headers: getAuthHeaders(),
      data: JSON.stringify(payload),
      contentType: "application/json",
      success: function (res) {
        showSuccessDialog("Sales order created successfully.", function () {
          if (res && res.sales_order_id) {
            location.href = "salesorder_add.html?id=" + res.sales_order_id;
          } else {
            location.href = "sales_order_inq.html";
          }
        });
      },
      error: function (xhr) {
        handleActionError(xhr, "There was a problem creating the sales order.");
      }
    });
  }).fail(function (xhr) {
    handleActionError(xhr, "Unable to load quotation details for conversion.");
  });
}

function buildSalesOrderPayloadFromQuotation(header, items, salesOrderNo) {
  var userId = cleanInt(sessionStorage.getItem("USER_ID"), null);

  return {
    header: {
      sales_order_no: salesOrderNo,
      sales_order_date: todayString(),
      quotation_id: cleanInt(header.quotation_id, null),
      quotation_no: header.quotation_no || "",
      customer_id: cleanInt(header.customer_id, null),
      customer_name: header.customer_name || "",
      customer_contact: header.customer_contact || "",
      billing_address: header.billing_address || "",
      shipping_address: header.shipping_address || "",
      reference_no: header.reference_no || "",
      subject: header.subject || "",
      currency: header.currency || "",
      currency_id: cleanInt(header.currency_id, null),
      exchange_rate: cleanDecimal(header.exchange_rate, 1),
      payment_term_id: cleanInt(header.payment_term_id, null),
      salesperson_id: cleanInt(header.salesperson_id, null),
      warehouse_id: cleanInt(header.warehouse_id, null),
      delivery_date: null,
      status: "Open",
      approval_status: "Pending",
      notes: header.notes || "",
      terms_conditions: header.terms_conditions || "",
      subtotal: cleanDecimal(header.subtotal, 0),
      discount_type: header.discount_type || "",
      discount_value: cleanDecimal(header.discount_value, 0),
      discount_total: cleanDecimal(header.discount_total, 0),
      taxable_total: cleanDecimal(header.taxable_total, 0),
      tax_total: cleanDecimal(header.tax_total, 0),
      freight_amount: cleanDecimal(header.freight_amount, 0),
      packing_amount: cleanDecimal(header.packing_amount, 0),
      other_charges: cleanDecimal(header.other_charges, 0),
      round_off: cleanDecimal(header.round_off, 0),
      grand_total: cleanDecimal(header.grand_total, 0),
      created_by: userId,
      updated_by: userId
    },
    items: _.map(items || [], function (item, index) {
      return buildSalesOrderItemFromQuotationItem(item, index, header);
    })
  };
}

function buildSalesOrderItemFromQuotationItem(item, index, header) {
  var qty = cleanDecimal(item.qty, 0);
  var rate = cleanDecimal(item.rate, 0);
  var grossAmount = cleanDecimal(item.gross_amount, qty * rate);
  var discountAmount = cleanDecimal(item.discount_amount, 0);
  var taxableAmount = cleanDecimal(item.taxable_amount, grossAmount - discountAmount);
  var cgstAmount = cleanDecimal(item.cgst_amount, 0);
  var sgstAmount = cleanDecimal(item.sgst_amount, 0);
  var igstAmount = cleanDecimal(item.igst_amount, 0);
  var taxAmount = cleanDecimal(item.tax_amount, cgstAmount + sgstAmount + igstAmount);
  var lineTotal = cleanDecimal(item.line_total, taxableAmount + taxAmount);
  var discountType = item.discount_type || (cleanDecimal(item.discount_percent, 0) > 0 ? "PERCENT" : "");
  var discountValue = cleanDecimal(item.discount_value, cleanDecimal(item.discount_percent, 0));

  return {
    quotation_item_id: cleanInt(item.quotation_item_id, null),
    line_no: cleanInt(item.line_no, index + 1),
    material_id: cleanInt(item.material_id, null),
    material_code: item.material_code || "",
    item_name: item.item_name || "",
    material_type: item.material_type || "",
    item_description: item.item_description || "",
    hsn_sac_code: item.hsn_sac_code || "",
    qty: qty,
    delivered_qty: 0,
    invoiced_qty: 0,
    unit: item.unit || "",
    uom_id: cleanInt(item.uom_id, null),
    rate: rate,
    gross_amount: roundMoney(grossAmount),
    discount_type: discountType,
    discount_value: discountValue,
    discount_amount: roundMoney(discountAmount),
    taxable_amount: roundMoney(taxableAmount),
    tax_id: cleanInt(item.tax_id, null),
    tax_percent: cleanDecimal(item.tax_percent, 0),
    cgst_percent: cleanDecimal(item.cgst_percent, 0),
    cgst_amount: roundMoney(cgstAmount),
    sgst_percent: cleanDecimal(item.sgst_percent, 0),
    sgst_amount: roundMoney(sgstAmount),
    igst_percent: cleanDecimal(item.igst_percent, 0),
    igst_amount: roundMoney(igstAmount),
    tax_amount: roundMoney(taxAmount),
    line_total: roundMoney(lineTotal),
    warehouse_id: cleanInt(item.warehouse_id, cleanInt(header.warehouse_id, null)),
    delivery_date: item.delivery_date || null,
    item_status: "Open"
  };
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

function todayString() {
  return new Date().toISOString().substring(0, 10);
}
