var editCategoryId;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editCategoryId = params.get("id");

  if (editCategoryId) {
    $("#pageTitle").text("Edit Material Category Information:");
    loadCategoryDetails(editCategoryId);
  } else {
    $("#pageTitle").text("Add Material Category Information:");
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
    material_group_code: $.trim($("#material_group_code").val()),
    material_group_name: $.trim($("#material_group_name").val()),
    description: $.trim($("#description").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.material_group_code) {
    showWarningDialog("Category code is required.");
    return false;
  }

  if (!payload.material_group_name) {
    showWarningDialog("Category name is required.");
    return false;
  }

  return true;
}

function saveCategory() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editCategoryId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_material_group" + (isEdit ? "/" + editCategoryId : "");

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
      showSuccessDialog(isEdit ? "Material category updated successfully." : "Material category added successfully.", function () {
        location.href = "material_category_inq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the material category.";
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

function loadCategoryDetails(categoryId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_material_group/" + categoryId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#material_group_code").val(data.material_group_code || "");
      $("#material_group_name").val(data.material_group_name || "");
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
        showErrorDialog("Unable to load material category details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "material_category_inq.html";
}
