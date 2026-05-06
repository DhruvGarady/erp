var paymentTerms;
var paymentTermsTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  paymentTermsTemplate = $("#listTmpl").html();
  paymentTerms = [];
  $("#paymentTermsTableSearch").on("input", filterPaymentTermsTable);
  setupPaymentTermsInquiryAutocomplete();
  renderList();
  search();
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) {
    return {};
  }
  return { Authorization: "Bearer " + token };
}

function setupPaymentTermsInquiryAutocomplete() {
  setupApiAutocompleteList(request_url + "/api/v1/mst_payment_terms?page=1&limit=5000", [
    { selector: "#termCodeSearch", hiddenSelector: "#termCodeSearchId", valueField: "payment_term_code", idField: "payment_term_id" },
    { selector: "#termNameSearch", hiddenSelector: "#termNameSearchId", valueField: "payment_term_name", idField: "payment_term_id" }
  ]);
}

function search() {
  var code = $.trim($("#termCodeSearch").val() || "");
  var name = $.trim($("#termNameSearch").val() || "");
  var status = $("#statusSearch").val();
  var searchText = $.trim((code + " " + name).replace(/\s+/g, " "));

  var params = {
    page: 1,
    limit: 300
  };

  if (searchText) {
    params.search = searchText;
  }

  if (status) {
    params.is_active = status;
  }

  var strURL = request_url + "/api/v1/mst_payment_terms?" + $.param(params);

  $.ajax({
    type: "GET",
    url: strURL,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: onSearchSuccess,
    error: onSearchErr
  });
}

function onSearchSuccess(res) {
  paymentTerms = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  paymentTerms = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch payment terms records.");
}

function renderList() {
  $("#listContainer2").html(_.template(paymentTermsTemplate, { paymentTerms: paymentTerms || [] }));
  filterPaymentTermsTable();
  $("#listContainer2").trigger("create");
}

function filterPaymentTermsTable() {
  var searchText = $.trim($("#paymentTermsTableSearch").val() || "").toLowerCase();
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

function addPaymentTerms() {
  location.href = "payment_terms_add.html";
}

function editPaymentTerms(id) {
  if (!id) return;
  location.href = "payment_terms_add.html?id=" + id;
}

function deletePaymentTerms(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate these payment terms?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_payment_terms/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Payment terms deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating these payment terms.");
      }
    });
  });
}
