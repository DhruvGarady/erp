var roleFeatures;
var roleFeatureTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  roleFeatureTemplate = $("#listTmpl").html();
  roleFeatures = [];
  $("#roleFeatureTableSearch").on("input", filterRoleFeatureTable);
  renderList();
  search();
});

function search() {
  var roleSearch = $.trim($("#roleSearch").val() || "");
  var featureSearch = $.trim($("#featureSearchText").val() || "");
  var status = $("#statusSearch").val();
  var searchText = $.trim((roleSearch + " " + featureSearch).replace(/\s+/g, " "));
  var params = {
    limit: 500
  };

  if (searchText) {
    params.search = searchText;
  }

  if (status) {
    params.is_active = status;
  }

  $.ajax({
    type: "GET",
    url: request_url + "/rolefeatures/list?" + $.param(params),
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: onSearchSuccess,
    error: onSearchErr
  });
}

function onSearchSuccess(res) {
  roleFeatures = Array.isArray(res) ? res : [];
  renderList();
}

function onSearchErr(xhr) {
  roleFeatures = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  if (xhr && xhr.status === 403) {
    showWarningDialog("You do not have permission to manage role feature permissions.");
    return;
  }

  showErrorDialog("Unable to fetch role feature permission records.");
}

function renderList() {
  $("#listContainer2").html(_.template(roleFeatureTemplate, {
    roleFeatures: roleFeatures || []
  }));
  filterRoleFeatureTable();
  $("#listContainer2").trigger("create");
}

function filterRoleFeatureTable() {
  var searchText = $.trim($("#roleFeatureTableSearch").val() || "").toLowerCase();
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

function addRoleFeature() {
  location.href = "role_features_add.html";
}

function editRoleFeature(id) {
  if (!id) return;
  location.href = "role_features_add.html?id=" + id;
}

function deleteRoleFeature(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this role feature permission?", function () {
    $.ajax({
      url: request_url + "/rolefeatures/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Role feature permission deactivated successfully.", function () {
          search();
        });
      },
      error: function (xhr) {
        var message = "There was a problem deactivating this role feature permission.";

        if (xhr && xhr.status === 403) {
          showWarningDialog("You do not have permission to deactivate role feature permissions.");
          return;
        }

        if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
          message = xhr.responseJSON.error;
        }

        showErrorDialog(message);
      }
    });
  });
}
