var editCustomerId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editCustomerId = params.get("id");

  if (editCustomerId) {
    $("#pageTitle").text("Edit Customer Information:");
    loadCustomerDetails(editCustomerId);
  } else {
    $("#pageTitle").text("Add Customer Information:");
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

function cleanDecimal(val) {
  if (val === null || val === undefined || val === "") return null;
  var parsed = parseFloat(val);
  return isNaN(parsed) ? null : parsed;
}

function buildPayload() {
  var userName = sessionStorage.getItem("USERNAME") || "system";

  return {
    customer_code: $.trim($("#customer_code").val()),
    customer_name: $.trim($("#customer_name").val()),
    customer_type: $.trim($("#customer_type").val()),
    contact_person: $.trim($("#contact_person").val()),
    email: $.trim($("#email").val()),
    phone: $.trim($("#phone").val()),
    alt_phone: $.trim($("#alt_phone").val()),
    gst_no: $.trim($("#gst_no").val()),
    pan_no: $.trim($("#pan_no").val()),
    billing_address: $.trim($("#billing_address").val()),
    shipping_address: $.trim($("#shipping_address").val()),
    city: $.trim($("#city").val()),
    state: $.trim($("#state").val()),
    country: $.trim($("#country").val()),
    pincode: $.trim($("#pincode").val()),
    credit_days: cleanInt($("#credit_days").val()),
    credit_limit: cleanDecimal($("#credit_limit").val()),
    remarks: $.trim($("#remarks").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.customer_code) {
    showWarningDialog("Customer code is required.");
    return false;
  }

  if (!payload.customer_name) {
    showWarningDialog("Customer name is required.");
    return false;
  }

  return true;
}

function saveCustomer() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editCustomerId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_customer" + (isEdit ? "/" + editCustomerId : "");

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
      showSuccessDialog(isEdit ? "Customer updated successfully." : "Customer added successfully.", function () {
        location.href = "customerinq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the customer.";
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

function loadCustomerDetails(customerId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_customer/" + customerId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#customer_code").val(data.customer_code || "");
      $("#customer_name").val(data.customer_name || "");
      $("#customer_type").val(data.customer_type || "");
      $("#contact_person").val(data.contact_person || "");
      $("#email").val(data.email || "");
      $("#phone").val(data.phone || "");
      $("#alt_phone").val(data.alt_phone || "");
      $("#gst_no").val(data.gst_no || "");
      $("#pan_no").val(data.pan_no || "");
      $("#billing_address").val(data.billing_address || "");
      $("#shipping_address").val(data.shipping_address || "");
      $("#city").val(data.city || "");
      $("#state").val(data.state || "");
      $("#country").val(data.country || "");
      $("#pincode").val(data.pincode || "");
      $("#credit_days").val(data.credit_days || "");
      $("#credit_limit").val(data.credit_limit || "");
      $("#remarks").val(data.remarks || "");
      $("#is_active").val(data.is_active || "Y");
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        showErrorDialog("Unable to load customer details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "customerinq.html";
}
