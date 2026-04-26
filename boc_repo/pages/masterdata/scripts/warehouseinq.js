var warehouses;
var warehouseTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  warehouseTemplate = $("#listTmpl").html();
  warehouses = [];
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
  var code = $.trim($("#warehouseCodeSearch").val() || "");
  var name = $.trim($("#warehouseNameSearch").val() || "");
  var city = $.trim($("#citySearch").val() || "");
  var status = $("#statusSearch").val();
  var searchText = $.trim((code + " " + name + " " + city).replace(/\s+/g, " "));

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

  var strURL = request_url + "/api/v1/mst_warehouse?" + $.param(params);

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
  warehouses = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  warehouses = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch warehouse records.");
}

function renderList() {
  $("#listContainer2").html(_.template(warehouseTemplate, { warehouses: warehouses || [] }));
  $("#listContainer2").trigger("create");
}

function addWarehouse() {
  location.href = "warehouse_add.html";
}

function editWarehouse(id) {
  if (!id) return;
  location.href = "warehouse_add.html?id=" + id;
}

function deleteWarehouse(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this warehouse?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_warehouse/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Warehouse deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this warehouse.");
      }
    });
  });
}
