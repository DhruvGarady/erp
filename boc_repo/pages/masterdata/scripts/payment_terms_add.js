var editPaymentTermId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editPaymentTermId = params.get("id");

  if (editPaymentTermId) {
    $("#pageTitle").text("Edit Payment Terms Information:");
    loadPaymentTermsDetails(editPaymentTermId);
  } else {
    $("#pageTitle").text("Add Payment Terms Information:");
  }
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

function cleanInt(val) {
  if (val === null || val === undefined || val === "") return null;
  var parsed = parseInt(val, 10);
  return isNaN(parsed) ? null : parsed;
}

function buildPayload() {
  var userName = sessionStorage.getItem("USERNAME") || "system";

  return {
    payment_term_code: $.trim($("#payment_term_code").val()),
    payment_term_name: $.trim($("#payment_term_name").val()),
    no_of_days: cleanInt($("#no_of_days").val()),
    description: $.trim($("#description").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.payment_term_code) {
    showWarningDialog("Payment terms code is required.");
    return false;
  }

  if (!payload.payment_term_name) {
    showWarningDialog("Payment terms name is required.");
    return false;
  }

  if (payload.no_of_days === null || payload.no_of_days < 0) {
    showWarningDialog("No. of days must be zero or greater.");
    return false;
  }

  return true;
}

function savePaymentTerms() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editPaymentTermId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_payment_terms" + (isEdit ? "/" + editPaymentTermId : "");

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
      showSuccessDialog(isEdit ? "Payment terms updated successfully." : "Payment terms added successfully.", function () {
        location.href = "payment_terms_inq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the payment terms.";
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

function loadPaymentTermsDetails(paymentTermId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_payment_terms/" + paymentTermId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#payment_term_code").val(data.payment_term_code || "");
      $("#payment_term_name").val(data.payment_term_name || "");
      $("#no_of_days").val(data.no_of_days || 0);
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
        showErrorDialog("Unable to load payment terms details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "payment_terms_inq.html";
}
