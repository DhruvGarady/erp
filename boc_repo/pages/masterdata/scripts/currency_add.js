var editCurrencyId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editCurrencyId = params.get("id");

  if (editCurrencyId) {
    $("#pageTitle").text("Edit Currency Information:");
    loadCurrencyDetails(editCurrencyId);
  } else {
    $("#pageTitle").text("Add Currency Information:");
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
    currency_code: $.trim($("#currency_code").val()),
    currency_name: $.trim($("#currency_name").val()),
    currency_symbol: $.trim($("#currency_symbol").val()),
    description: $.trim($("#description").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.currency_code) {
    showWarningDialog("Currency code is required.");
    return false;
  }

  if (!payload.currency_name) {
    showWarningDialog("Currency name is required.");
    return false;
  }

  return true;
}

function saveCurrency() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editCurrencyId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_currency" + (isEdit ? "/" + editCurrencyId : "");

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
      showSuccessDialog(isEdit ? "Currency updated successfully." : "Currency added successfully.", function () {
        location.href = "currencyinq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the currency.";
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

function loadCurrencyDetails(currencyId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_currency/" + currencyId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#currency_code").val(data.currency_code || "");
      $("#currency_name").val(data.currency_name || "");
      $("#currency_symbol").val(data.currency_symbol || "");
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
        showErrorDialog("Unable to load currency details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "currencyinq.html";
}
