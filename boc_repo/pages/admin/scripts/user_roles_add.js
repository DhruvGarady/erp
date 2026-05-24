var editUserRoleId;
var usersLoaded = false;
var rolesLoaded = false;
var pendingUserRoleData = null;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editUserRoleId = params.get("id");

  loadUsers();
  loadRoles();

  if (editUserRoleId) {
    $("#pageTitle").text("Edit User Role Information:");
    loadUserRoleDetails(editUserRoleId);
  } else {
    $("#pageTitle").text("Add User Role Information:");
  }
});

function loadUsers() {
  $.ajax({
    type: "GET",
    url: request_url + "/users/list?is_active=Y&limit=5000",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      populateUserDropdown(Array.isArray(data) ? data : []);
      usersLoaded = true;
      applyPendingUserRoleData();
    },
    error: function (xhr) {
      if (xhr && xhr.status === 403) {
        showWarningDialog("You do not have permission to load users.");
        return;
      }
      showErrorDialog("Unable to load users.");
    }
  });
}

function loadRoles() {
  $.ajax({
    type: "GET",
    url: request_url + "/roles/list?is_active=Y&limit=5000",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      populateRoleDropdown(Array.isArray(data) ? data : []);
      rolesLoaded = true;
      applyPendingUserRoleData();
    },
    error: function (xhr) {
      if (xhr && xhr.status === 403) {
        showWarningDialog("You do not have permission to load roles.");
        return;
      }
      showErrorDialog("Unable to load roles.");
    }
  });
}

function populateUserDropdown(users) {
  var options = ['<option value="">Select</option>'];

  _.each(users, function (item) {
    var label = [
      item.full_name || item.username || "",
      item.username ? "(" + item.username + ")" : ""
    ].join(" ").trim();

    options.push('<option value="' + _.escape(item.user_id) + '">' + _.escape(label) + '</option>');
  });

  $("#user_id").html(options.join(""));
}

function populateRoleDropdown(roles) {
  var options = ['<option value="">Select</option>'];

  _.each(roles, function (item) {
    options.push('<option value="' + _.escape(item.role_id) + '">' + _.escape(item.role_name || "") + '</option>');
  });

  $("#role_id").html(options.join(""));
}

function loadUserRoleDetails(userRoleId) {
  $.ajax({
    type: "GET",
    url: request_url + "/userroles/" + userRoleId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      pendingUserRoleData = data || {};
      applyPendingUserRoleData();
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
        return;
      }

      if (xhr && xhr.status === 403) {
        showWarningDialog("You do not have permission to edit user role assignments.");
        return;
      }

      showErrorDialog("Unable to load user role assignment details.");
    }
  });
}

function applyPendingUserRoleData() {
  if (!pendingUserRoleData || !usersLoaded || !rolesLoaded) {
    return;
  }

  ensureSelectedUserOption(pendingUserRoleData);
  ensureSelectedRoleOption(pendingUserRoleData);

  $("#user_id").val(pendingUserRoleData.user_id || "");
  $("#role_id").val(pendingUserRoleData.role_id || "");
  $("#is_active").val(pendingUserRoleData.is_active || "Y");
}

function ensureSelectedUserOption(data) {
  if (!data || !data.user_id || $("#user_id option[value='" + data.user_id + "']").length > 0) {
    return;
  }

  var label = [
    data.full_name || data.username || "",
    data.username ? "(" + data.username + ")" : ""
  ].join(" ").trim();

  $("#user_id").append('<option value="' + _.escape(data.user_id) + '">' + _.escape(label) + '</option>');
}

function ensureSelectedRoleOption(data) {
  if (!data || !data.role_id || $("#role_id option[value='" + data.role_id + "']").length > 0) {
    return;
  }

  $("#role_id").append('<option value="' + _.escape(data.role_id) + '">' + _.escape(data.role_name || "") + '</option>');
}

function buildPayload() {
  return {
    user_id: cleanInt($("#user_id").val()),
    role_id: cleanInt($("#role_id").val()),
    is_active: $("#is_active").val() || "Y"
  };
}

function validateForm(payload) {
  if (!payload.user_id) {
    showWarningDialog("User is required.");
    return false;
  }

  if (!payload.role_id) {
    showWarningDialog("Role is required.");
    return false;
  }

  return true;
}

function saveUserRole() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();

  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editUserRoleId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + (isEdit ? "/userroles/update/" + editUserRoleId : "/userroles/create");

  $.ajax({
    type: method,
    url: url,
    headers: getAuthHeaders(),
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: function () {
      showSuccessDialog(isEdit ? "User role assignment updated successfully." : "User role assignment added successfully.", function () {
        location.href = "user_roles_inq.html";
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

      if (xhr && xhr.status === 403) {
        showWarningDialog("You do not have permission to save user role assignments.");
        return;
      }

      var message = "There was a problem saving the user role assignment.";
      if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
        message = xhr.responseJSON.error;
      }
      showErrorDialog(message);
    },
    complete: function () {
      $(".searchButton").prop("disabled", false);
    }
  });
}

function cleanInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  var parsed = parseInt(value, 10);
  return isNaN(parsed) ? null : parsed;
}

function backToInquiry() {
  location.href = "user_roles_inq.html";
}
