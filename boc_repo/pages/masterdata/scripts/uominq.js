var uoms;
var uomTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  uomTemplate = $("#listTmpl").html();
  uoms = [];
  $("#uomTableSearch").on("input", filterUomTable);
  setupUomInquiryAutocomplete();
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

function setupUomInquiryAutocomplete() {
  setupApiAutocompleteList(request_url + "/api/v1/mst_uom?page=1&limit=5000", [
    { selector: "#uomCodeSearch", hiddenSelector: "#uomCodeSearchId", valueField: "uom_code", idField: "uom_id" },
    { selector: "#uomNameSearch", hiddenSelector: "#uomNameSearchId", valueField: "uom_name", idField: "uom_id" }
  ]);
}

function search() {
  var code = $.trim($("#uomCodeSearch").val() || "");
  var name = $.trim($("#uomNameSearch").val() || "");
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

  var strURL = request_url + "/api/v1/mst_uom?" + $.param(params);

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
  uoms = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  uoms = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch UOM records.");
}

function renderList() {
  $("#listContainer2").html(_.template(uomTemplate, { uoms: uoms || [] }));
  filterUomTable();
  $("#listContainer2").trigger("create");
}

function filterUomTable() {
  var searchText = $.trim($("#uomTableSearch").val() || "").toLowerCase();
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

function addUom() {
  location.href = "uom_add.html";
}

function editUom(id) {
  if (!id) return;
  location.href = "uom_add.html?id=" + id;
}

function deleteUom(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this UOM?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_uom/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("UOM deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this UOM.");
      }
    });
  });
}
