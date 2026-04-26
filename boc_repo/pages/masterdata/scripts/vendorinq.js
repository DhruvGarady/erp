var vendors;
var vendorTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  vendorTemplate = $("#listTmpl").html();
  vendors = [];
  renderList();
  search();
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) {
    return {};
  }
  return { Authorization: "Bearer " + token };
}

function search() {
  var code = $.trim($("#vendorCodeSearch").val() || "");
  var name = $.trim($("#vendorNameSearch").val() || "");
  var status = $("#statusSearch").val();
  var searchText = $.trim((code + " " + name).replace(/\s+/g, " "));

  var params = {
    page: 1,
    limit: 300
  };

  if (searchText) {
    params.search = searchText;
  }

  if (status) {
    params.is_active = status;
  }

  var strURL = request_url + "/api/v1/mst_vendor?" + $.param(params);

  $.ajax({
    type: "GET",
    url: strURL,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: onSearchSuccess,
    error: onSearchErr
  });
}

function onSearchSuccess(res) {
  vendors = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  vendors = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch vendor records.");
}

function renderList() {
  $("#listContainer2").html(_.template(vendorTemplate, { vendors: vendors || [] }));
  $("#listContainer2").trigger("create");
}

function addVendor() {
  location.href = "vendor_add.html";
}

function editVendor(id) {
  if (!id) return;
  location.href = "vendor_add.html?id=" + id;
}

function deleteVendor(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this vendor?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_vendor/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Vendor deactivated successfully.", function () {
          search();
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
        showErrorDialog("There was a problem deactivating this vendor.");
      }
    });
  });
}
