var userRoles;
var userRoleTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  userRoleTemplate = $("#listTmpl").html();
  userRoles = [];
  $("#userRoleTableSearch").on("input", filterUserRoleTable);
  renderList();
  search();
});

function search() {
  var userSearch = $.trim($("#userSearch").val() || "");
  var roleSearch = $.trim($("#roleSearch").val() || "");
  var status = $("#statusSearch").val();
  var searchText = $.trim((userSearch + " " + roleSearch).replace(/\s+/g, " "));
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
    url: request_url + "/userroles/list?" + $.param(params),
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: onSearchSuccess,
    error: onSearchErr
  });
}

function onSearchSuccess(res) {
  userRoles = Array.isArray(res) ? res : [];
  renderList();
}

function onSearchErr(xhr) {
  userRoles = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  if (xhr && xhr.status === 403) {
    showWarningDialog("You do not have permission to manage user roles.");
    return;
  }

  showErrorDialog("Unable to fetch user role records.");
}

function renderList() {
  $("#listContainer2").html(_.template(userRoleTemplate, {
    userRoles: userRoles || [],
    formatDateTime: formatDateTime
  }));
  filterUserRoleTable();
  $("#listContainer2").trigger("create");
}

function filterUserRoleTable() {
  var searchText = $.trim($("#userRoleTableSearch").val() || "").toLowerCase();
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

function addUserRole() {
  location.href = "user_roles_add.html";
}

function editUserRole(id) {
  if (!id) return;
  location.href = "user_roles_add.html?id=" + id;
}

function deleteUserRole(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this user role assignment?", function () {
    $.ajax({
      url: request_url + "/userroles/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("User role assignment deactivated successfully.", function () {
          search();
        });
      },
      error: function (xhr) {
        var message = "There was a problem deactivating this user role assignment.";

        if (xhr && xhr.status === 403) {
          showWarningDialog("You do not have permission to deactivate user role assignments.");
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
