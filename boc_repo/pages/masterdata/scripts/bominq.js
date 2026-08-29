var boms;
var bomTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  bomTemplate = $("#listTmpl").html();
  boms = [];
  $("#bomTableSearch").on("input", filterBomTable);
  setupBomInquiryAutocomplete();
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

function setupBomInquiryAutocomplete() {
  setupApiAutocompleteList(request_url + "/api/v1/mst_bom?page=1&limit=5000", [
    { selector: "#bomCodeSearch", hiddenSelector: "#bomCodeSearchId", valueField: "bom_code", idField: "bom_id" },
    { selector: "#bomNameSearch", hiddenSelector: "#bomNameSearchId", valueField: "bom_name", idField: "bom_id" }
  ]);
}

function search() {
  var code = $.trim($("#bomCodeSearch").val() || "");
  var name = $.trim($("#bomNameSearch").val() || "");
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

  var strURL = request_url + "/api/v1/mst_bom?" + $.param(params);

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
  boms = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  boms = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch BOM records.");
}

function renderList() {
  $("#listContainer2").html(_.template(bomTemplate, { boms: boms || [] }));
  filterBomTable();
  $("#listContainer2").trigger("create");
}

function filterBomTable() {
  var searchText = $.trim($("#bomTableSearch").val() || "").toLowerCase();
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

function addBom() {
  location.href = "bom_add.html";
}

function editBom(id) {
  if (!id) return;
  location.href = "bom_add.html?id=" + id;
}

function deleteBom(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this BOM?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_bom/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("BOM deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this BOM.");
      }
    });
  });
}
