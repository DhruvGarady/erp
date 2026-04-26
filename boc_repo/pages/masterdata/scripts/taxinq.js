var taxes;
var taxTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  taxTemplate = $("#listTmpl").html();
  taxes = [];
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

function search() {
  var code = $.trim($("#taxCodeSearch").val() || "");
  var name = $.trim($("#taxNameSearch").val() || "");
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

  var strURL = request_url + "/api/v1/mst_tax?" + $.param(params);

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
  taxes = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  taxes = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch tax records.");
}

function renderList() {
  $("#listContainer2").html(_.template(taxTemplate, { taxes: taxes || [] }));
  $("#listContainer2").trigger("create");
}

function addTax() {
  location.href = "tax_add.html";
}

function editTax(id) {
  if (!id) return;
  location.href = "tax_add.html?id=" + id;
}

function deleteTax(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this tax?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_tax/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Tax deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this tax.");
      }
    });
  });
}
