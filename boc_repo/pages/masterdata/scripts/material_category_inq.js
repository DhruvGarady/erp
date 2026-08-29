var categories;
var categoryTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  categoryTemplate = $("#listTmpl").html();
  categories = [];
  $("#categoryTableSearch").on("input", filterCategoryTable);
  setupCategoryInquiryAutocomplete();
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

function setupCategoryInquiryAutocomplete() {
  setupApiAutocompleteList(request_url + "/api/v1/mst_material_group?page=1&limit=5000", [
    { selector: "#categoryCodeSearch", hiddenSelector: "#categoryCodeSearchId", valueField: "material_group_code", idField: "material_group_id" },
    { selector: "#categoryNameSearch", hiddenSelector: "#categoryNameSearchId", valueField: "material_group_name", idField: "material_group_id" }
  ]);
}

function search() {
  var code = $.trim($("#categoryCodeSearch").val() || "");
  var name = $.trim($("#categoryNameSearch").val() || "");
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

  var strURL = request_url + "/api/v1/mst_material_group?" + $.param(params);

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
  categories = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  categories = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch material category records.");
}

function renderList() {
  $("#listContainer2").html(_.template(categoryTemplate, { categories: categories || [] }));
  filterCategoryTable();
  $("#listContainer2").trigger("create");
}

function filterCategoryTable() {
  var searchText = $.trim($("#categoryTableSearch").val() || "").toLowerCase();
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

function addCategory() {
  location.href = "material_category_add.html";
}

function editCategory(id) {
  if (!id) return;
  location.href = "material_category_add.html?id=" + id;
}

function deleteCategory(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this material category?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_material_group/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Material category deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this material category.");
      }
    });
  });
}
