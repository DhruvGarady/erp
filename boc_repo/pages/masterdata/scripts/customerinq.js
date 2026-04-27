var customers;
var customerTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  customerTemplate = $("#listTmpl").html();
  customers = [];
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
  var code = $.trim($("#customerCodeSearch").val() || "");
  var name = $.trim($("#customerNameSearch").val() || "");
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

  var strURL = request_url + "/api/v1/mst_customer?" + $.param(params);

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
  customers = res && res.data ? res.data : [];
  renderList();
}

function onSearchErr(xhr) {
  customers = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch customer records.");
}

function renderList() {
  var filteredCustomers = getFilteredCustomers();
  $("#listContainer2").html(_.template(customerTemplate, { customers: filteredCustomers || [] }));
  $("#listContainer2").trigger("create");
}

function filterCustomerTable() {
  renderList();
}

function getFilteredCustomers() {
  var searchText = $.trim($("#customerTableSearch").val() || "").toLowerCase();

  if (!searchText) {
    return customers || [];
  }

  return _.filter(customers || [], function (item) {
    var rowText = [
      item.customer_code,
      item.customer_name,
      item.customer_type,
      item.contact_person,
      item.phone,
      item.email,
      item.gst_no,
      item.city,
      item.state,
      item.is_active === "N" ? "Inactive" : "Active"
    ].join(" ").toLowerCase();

    return rowText.indexOf(searchText) !== -1;
  });
}

function addCustomer() {
  location.href = "customer_add.html";
}

function editCustomer(id) {
  if (!id) return;
  location.href = "customer_add.html?id=" + id;
}

function deleteCustomer(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this customer?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_customer/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Customer deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this customer.");
      }
    });
  });
}
