var quotationData;
var quotationTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  quotationTemplate = $("#listTmpl").html();
  quotationData = [];
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
  $("#listContainer2").html(_.template(quotationTemplate, {
    quotations: rows || [],
    formatDate: formatDate,
    formatAmount: formatAmount
  }));
  $("#listContainer2").trigger("create");
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
