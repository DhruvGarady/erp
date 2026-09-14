var editRoleId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editRoleId = params.get("id");

  if (editRoleId) {
    $("#pageTitle").text("Edit Role Information:");
    loadRoleDetails(editRoleId);
  } else {
    $("#pageTitle").text("Add Role Information:");
  }
});

function buildPayload() {
  return {
    role_name: $.trim($("#role_name").val() || ""),
    role_description: $.trim($("#role_description").val() || ""),
    is_active: $("#is_active").val() || "Y"
  };
}

function validateForm(payload) {
  if (!payload.role_name) {
    showWarningDialog("Role name is required.");
    return false;
  }

  return true;
}

function saveRole() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();

  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editRoleId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + (isEdit ? "/roles/update/" + editRoleId : "/roles/create");

  $.ajax({
    type: method,
    url: url,
    headers: getAuthHeaders(),
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: function () {
      showSuccessDialog(isEdit ? "Role updated successfully." : "Role added successfully.", function () {
        location.href = "role_inq.html";
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
        showWarningDialog("You do not have permission to save roles.");
        return;
      }

      var message = "There was a problem saving the role.";
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

function loadRoleDetails(roleId) {
  $.ajax({
    type: "GET",
    url: request_url + "/roles/" + roleId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#role_name").val(data.role_name || "");
      $("#role_description").val(data.role_description || "");
      $("#is_active").val(data.is_active || "Y");
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
        showWarningDialog("You do not have permission to edit roles.");
        return;
      }

      showErrorDialog("Unable to load role details.");
    }
  });
}

function backToInquiry() {
  location.href = "role_inq.html";
}
