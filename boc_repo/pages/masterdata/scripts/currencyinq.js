var currencies;
var currencyTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  currencyTemplate = $("#listTmpl").html();
  currencies = [];
  $("#currencyTableSearch").on("input", filterCurrencyTable);
  setupCurrencyInquiryAutocomplete();
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

function setupCurrencyInquiryAutocomplete() {
  setupApiAutocompleteList(request_url + "/api/v1/mst_currency?page=1&limit=5000", [
    { selector: "#currencyCodeSearch", hiddenSelector: "#currencyCodeSearchId", valueField: "currency_code", idField: "currency_id" },
    { selector: "#currencyNameSearch", hiddenSelector: "#currencyNameSearchId", valueField: "currency_name", idField: "currency_id" }
  ]);
}

function search() {
  var code = $.trim($("#currencyCodeSearch").val() || "");
  var name = $.trim($("#currencyNameSearch").val() || "");
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

  var strURL = request_url + "/api/v1/mst_currency?" + $.param(params);

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
  currencies = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  currencies = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch currency records.");
}

function renderList() {
  $("#listContainer2").html(_.template(currencyTemplate, { currencies: currencies || [] }));
  filterCurrencyTable();
  $("#listContainer2").trigger("create");
}

function filterCurrencyTable() {
  var searchText = $.trim($("#currencyTableSearch").val() || "").toLowerCase();
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

function addCurrency() {
  location.href = "currency_add.html";
}

function editCurrency(id) {
  if (!id) return;
  location.href = "currency_add.html?id=" + id;
}

function deleteCurrency(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this currency?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_currency/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Currency deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this currency.");
      }
    });
  });
}
