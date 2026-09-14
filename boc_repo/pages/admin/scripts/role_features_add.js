var editRoleFeatureId;
var rolesLoaded = false;
var featuresLoaded = false;
var pendingRoleFeatureData = null;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editRoleFeatureId = params.get("id");

  loadRoles();
  loadFeatures();

  if (editRoleFeatureId) {
    $("#pageTitle").text("Edit Role Feature Permission:");
    loadRoleFeatureDetails(editRoleFeatureId);
  } else {
    $("#pageTitle").text("Add Role Feature Permission:");
  }
});

function loadRoles() {
  $.ajax({
    type: "GET",
    url: request_url + "/roles/list?is_active=Y&limit=5000",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      populateRoleDropdown(Array.isArray(data) ? data : []);
      rolesLoaded = true;
      applyPendingRoleFeatureData();
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

function loadFeatures() {
  $.ajax({
    type: "GET",
    url: request_url + "/features/list?is_active=Y&limit=5000",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      populateFeatureDropdown(Array.isArray(data) ? data : []);
      featuresLoaded = true;
      applyPendingRoleFeatureData();
    },
    error: function (xhr) {
      if (xhr && xhr.status === 403) {
        showWarningDialog("You do not have permission to load features.");
        return;
      }
      showErrorDialog("Unable to load features.");
    }
  });
}

function populateRoleDropdown(roles) {
  var options = ['<option value="">Select</option>'];

  _.each(roles, function (item) {
    options.push('<option value="' + _.escape(item.role_id) + '">' + _.escape(item.role_name || "") + '</option>');
  });

  $("#role_id").html(options.join(""));
}

function populateFeatureDropdown(features) {
  var options = ['<option value="">Select</option>'];

  _.each(features, function (item) {
    var label = [
      item.feature_name || item.id || "",
      item.feature_url ? "(" + item.feature_url + ")" : ""
    ].join(" ").trim();

    options.push('<option value="' + _.escape(item.id) + '">' + _.escape(label) + '</option>');
  });

  $("#feature_id").html(options.join(""));
}

function loadRoleFeatureDetails(roleFeatureId) {
  $.ajax({
    type: "GET",
    url: request_url + "/rolefeatures/" + roleFeatureId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      pendingRoleFeatureData = data || {};
      applyPendingRoleFeatureData();
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
        showWarningDialog("You do not have permission to edit role feature permissions.");
        return;
      }

      showErrorDialog("Unable to load role feature permission details.");
    }
  });
}

function applyPendingRoleFeatureData() {
  if (!pendingRoleFeatureData || !rolesLoaded || !featuresLoaded) {
    return;
  }

  ensureSelectedRoleOption(pendingRoleFeatureData);
  ensureSelectedFeatureOption(pendingRoleFeatureData);

  $("#role_id").val(pendingRoleFeatureData.role_id || "");
  $("#feature_id").val(pendingRoleFeatureData.feature_id || "");
  $("#can_view").val(pendingRoleFeatureData.can_view || "N");
  $("#can_create").val(pendingRoleFeatureData.can_create || "N");
  $("#can_edit").val(pendingRoleFeatureData.can_edit || "N");
  $("#can_delete").val(pendingRoleFeatureData.can_delete || "N");
  $("#can_approve").val(pendingRoleFeatureData.can_approve || "N");
  $("#can_print").val(pendingRoleFeatureData.can_print || "N");
  $("#is_active").val(pendingRoleFeatureData.is_active || "Y");
}

function ensureSelectedRoleOption(data) {
  if (!data || !data.role_id || $("#role_id option[value='" + data.role_id + "']").length > 0) {
    return;
  }

  $("#role_id").append('<option value="' + _.escape(data.role_id) + '">' + _.escape(data.role_name || "") + '</option>');
}

function ensureSelectedFeatureOption(data) {
  if (!data || !data.feature_id || $("#feature_id option[value='" + data.feature_id + "']").length > 0) {
    return;
  }

  var label = [
    data.feature_name || data.feature_id || "",
    data.feature_url ? "(" + data.feature_url + ")" : ""
  ].join(" ").trim();

  $("#feature_id").append('<option value="' + _.escape(data.feature_id) + '">' + _.escape(label) + '</option>');
}

function buildPayload() {
  return {
    role_id: cleanInt($("#role_id").val()),
    feature_id: $.trim($("#feature_id").val() || ""),
    can_view: $("#can_view").val() || "N",
    can_create: $("#can_create").val() || "N",
    can_edit: $("#can_edit").val() || "N",
    can_delete: $("#can_delete").val() || "N",
    can_approve: $("#can_approve").val() || "N",
    can_print: $("#can_print").val() || "N",
    is_active: $("#is_active").val() || "Y"
  };
}

function validateForm(payload) {
  if (!payload.role_id) {
    showWarningDialog("Role is required.");
    return false;
  }

  if (!payload.feature_id) {
    showWarningDialog("Feature is required.");
    return false;
  }

  if (payload.can_view !== "Y" && (
    payload.can_create === "Y" ||
    payload.can_edit === "Y" ||
    payload.can_delete === "Y" ||
    payload.can_approve === "Y" ||
    payload.can_print === "Y"
  )) {
    showWarningDialog("View permission is required when any action permission is enabled.");
    return false;
  }

  return true;
}

function saveRoleFeature() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();

  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editRoleFeatureId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + (isEdit ? "/rolefeatures/update/" + editRoleFeatureId : "/rolefeatures/create");

  $.ajax({
    type: method,
    url: url,
    headers: getAuthHeaders(),
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: function () {
      showSuccessDialog(isEdit ? "Role feature permission updated successfully." : "Role feature permission added successfully.", function () {
        location.href = "role_features_inq.html";
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
        showWarningDialog("You do not have permission to save role feature permissions.");
        return;
      }

      var message = "There was a problem saving the role feature permission.";
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
  location.href = "role_features_inq.html";
}
