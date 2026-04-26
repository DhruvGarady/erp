var editVendorId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editVendorId = params.get("id");

  if (editVendorId) {
    $("#pageTitle").text("Edit Vendor Information:");
    loadVendorDetails(editVendorId);
  } else {
    $("#pageTitle").text("Add Vendor Information:");
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
    vendor_code: $.trim($("#vendor_code").val()),
    vendor_name: $.trim($("#vendor_name").val()),
    vendor_type: $.trim($("#vendor_type").val()),
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
    payment_term: $.trim($("#payment_term").val()),
    remarks: $.trim($("#remarks").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.vendor_code) {
    showWarningDialog("Vendor code is required.");
    return false;
  }

  if (!payload.vendor_name) {
    showWarningDialog("Vendor name is required.");
    return false;
  }

  return true;
}

function saveVendor() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editVendorId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_vendor" + (isEdit ? "/" + editVendorId : "");

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
      showSuccessDialog(isEdit ? "Vendor updated successfully." : "Vendor added successfully.", function () {
        location.href = "vendorinq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the vendor.";
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

function loadVendorDetails(vendorId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_vendor/" + vendorId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#vendor_code").val(data.vendor_code || "");
      $("#vendor_name").val(data.vendor_name || "");
      $("#vendor_type").val(data.vendor_type || "");
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
      $("#payment_term").val(data.payment_term || "");
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
        showErrorDialog("Unable to load vendor details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "vendorinq.html";
}
