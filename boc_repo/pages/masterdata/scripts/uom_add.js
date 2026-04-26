var editUomId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editUomId = params.get("id");

  if (editUomId) {
    $("#pageTitle").text("Edit UOM Information:");
    loadUomDetails(editUomId);
  } else {
    $("#pageTitle").text("Add UOM Information:");
  }
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

function buildPayload() {
  var userName = sessionStorage.getItem("USERNAME") || "system";

  return {
    uom_code: $.trim($("#uom_code").val()),
    uom_name: $.trim($("#uom_name").val()),
    description: $.trim($("#description").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.uom_code) {
    showWarningDialog("UOM code is required.");
    return false;
  }

  if (!payload.uom_name) {
    showWarningDialog("UOM name is required.");
    return false;
  }

  return true;
}

function saveUom() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editUomId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_uom" + (isEdit ? "/" + editUomId : "");

  if (isEdit) {
    delete payload.created_by;
  }

  $.ajax({
    type: method,
    url: url,
    headers: getAuthHeaders(),
    data: JSON.stringify(payload),
    contentType: "application/json",
    success: function () {
      showSuccessDialog(isEdit ? "UOM updated successfully." : "UOM added successfully.", function () {
        location.href = "uominq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the UOM.";
        if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
          message = xhr.responseJSON.error;
        }
        showErrorDialog(message);
      }
    },
    complete: function () {
      $(".searchButton").prop("disabled", false);
    }
  });
}

function loadUomDetails(uomId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_uom/" + uomId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#uom_code").val(data.uom_code || "");
      $("#uom_name").val(data.uom_name || "");
      $("#description").val(data.description || "");
      $("#is_active").val(data.is_active || "Y");
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        showErrorDialog("Unable to load UOM details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "uominq.html";
}
