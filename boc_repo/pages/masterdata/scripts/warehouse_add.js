var editWarehouseId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editWarehouseId = params.get("id");

  if (editWarehouseId) {
    $("#pageTitle").text("Edit Warehouse Information:");
    loadWarehouseDetails(editWarehouseId);
  } else {
    $("#pageTitle").text("Add Warehouse Information:");
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
    warehouse_code: $.trim($("#warehouse_code").val()),
    warehouse_name: $.trim($("#warehouse_name").val()),
    warehouse_type: $.trim($("#warehouse_type").val()),
    contact_person: $.trim($("#contact_person").val()),
    phone: $.trim($("#phone").val()),
    email: $.trim($("#email").val()),
    address_line1: $.trim($("#address_line1").val()),
    address_line2: $.trim($("#address_line2").val()),
    city: $.trim($("#city").val()),
    state: $.trim($("#state").val()),
    country: $.trim($("#country").val()),
    pincode: $.trim($("#pincode").val()),
    remarks: $.trim($("#remarks").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.warehouse_code) {
    showWarningDialog("Warehouse code is required.");
    return false;
  }

  if (!payload.warehouse_name) {
    showWarningDialog("Warehouse name is required.");
    return false;
  }

  return true;
}

function saveWarehouse() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editWarehouseId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_warehouse" + (isEdit ? "/" + editWarehouseId : "");

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
      showSuccessDialog(isEdit ? "Warehouse updated successfully." : "Warehouse added successfully.", function () {
        location.href = "warehouseinq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the warehouse.";
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

function loadWarehouseDetails(warehouseId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_warehouse/" + warehouseId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#warehouse_code").val(data.warehouse_code || "");
      $("#warehouse_name").val(data.warehouse_name || "");
      $("#warehouse_type").val(data.warehouse_type || "");
      $("#contact_person").val(data.contact_person || "");
      $("#phone").val(data.phone || "");
      $("#email").val(data.email || "");
      $("#address_line1").val(data.address_line1 || "");
      $("#address_line2").val(data.address_line2 || "");
      $("#city").val(data.city || "");
      $("#state").val(data.state || "");
      $("#country").val(data.country || "");
      $("#pincode").val(data.pincode || "");
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
        showErrorDialog("Unable to load warehouse details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "warehouseinq.html";
}
