var editTaxId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editTaxId = params.get("id");

  if (editTaxId) {
    $("#pageTitle").text("Edit Tax Information:");
    loadTaxDetails(editTaxId);
  } else {
    $("#pageTitle").text("Add Tax Information:");
  }
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

function cleanDecimal(val) {
  if (val === null || val === undefined || val === "") return null;
  var parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
}

function buildPayload() {
  var userName = sessionStorage.getItem("USERNAME") || "system";

  return {
    tax_code: $.trim($("#tax_code").val()),
    tax_name: $.trim($("#tax_name").val()),
    tax_percent: cleanDecimal($("#tax_percent").val()),
    tax_type: $.trim($("#tax_type").val()),
    description: $.trim($("#description").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.tax_code) {
    showWarningDialog("Tax code is required.");
    return false;
  }

  if (!payload.tax_name) {
    showWarningDialog("Tax name is required.");
    return false;
  }

  if (payload.tax_percent === null || payload.tax_percent < 0 || payload.tax_percent > 100) {
    showWarningDialog("Tax percent must be between 0 and 100.");
    return false;
  }

  return true;
}

function saveTax() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editTaxId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_tax" + (isEdit ? "/" + editTaxId : "");

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
      showSuccessDialog(isEdit ? "Tax updated successfully." : "Tax added successfully.", function () {
        location.href = "taxinq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the tax.";
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

function loadTaxDetails(taxId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_tax/" + taxId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#tax_code").val(data.tax_code || "");
      $("#tax_name").val(data.tax_name || "");
      $("#tax_percent").val(data.tax_percent || 0);
      $("#tax_type").val(data.tax_type || "");
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
        showErrorDialog("Unable to load tax details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "taxinq.html";
}
