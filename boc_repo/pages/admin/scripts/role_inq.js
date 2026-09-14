var roles;
var roleTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  roleTemplate = $("#listTmpl").html();
  roles = [];
  $("#roleTableSearch").on("input", filterRoleTable);
  renderList();
  search();
});

function search() {
  var roleName = $.trim($("#roleNameSearch").val() || "");
  var status = $("#statusSearch").val();
  var params = {
    limit: 500
  };

  if (roleName) {
    params.search = roleName;
  }

  if (status) {
    params.is_active = status;
  }

  $.ajax({
    type: "GET",
    url: request_url + "/roles/list?" + $.param(params),
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: onSearchSuccess,
    error: onSearchErr
  });
}

function onSearchSuccess(res) {
  roles = Array.isArray(res) ? res : [];
  renderList();
}

function onSearchErr(xhr) {
  roles = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  if (xhr && xhr.status === 403) {
    showWarningDialog("You do not have permission to manage roles.");
    return;
  }

  showErrorDialog("Unable to fetch role records.");
}

function renderList() {
  $("#listContainer2").html(_.template(roleTemplate, {
    roles: roles || [],
    formatDateTime: formatDateTime
  }));
  filterRoleTable();
  $("#listContainer2").trigger("create");
}

function filterRoleTable() {
  var searchText = $.trim($("#roleTableSearch").val() || "").toLowerCase();
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

function addRole() {
  location.href = "role_add.html";
}

function editRole(id) {
  if (!id) return;
  location.href = "role_add.html?id=" + id;
}

function deleteRole(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this role?", function () {
    $.ajax({
      url: request_url + "/roles/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Role deactivated successfully.", function () {
          search();
        });
      },
      error: function (xhr) {
        var message = "There was a problem deactivating this role.";

        if (xhr && xhr.status === 403) {
          showWarningDialog("You do not have permission to deactivate roles.");
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

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  var date = new Date(value);

  if (isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}
