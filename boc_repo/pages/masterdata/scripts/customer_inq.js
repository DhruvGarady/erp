var customerList = [];
var filteredCustomerList = [];

$(function () {
  if (!initErpShell({
    loginPath: '../../index.html',
    logoutPath: '../../index.html',
    sidebarStateKey: 'ERP_SIDEBAR'
  })) {
    return;
  }

  bindCustomerInquiryEvents();
  getCustomerList();
});

function bindCustomerInquiryEvents() {
  $('#txtSearch').on('keyup', function () {
    filterCustomerList($(this).val());
  });

  $('#btnAddCustomer').on('click', function () {
    location.href = 'customer_form.html';
  });

  $(document).on('click', '.btnEditCustomer', function () {
    var customerId = $(this).data('id');
    location.href = 'customer_form.html?id=' + customerId;
  });
}

function getCustomerList() {
  var searchText = $.trim($('#txtSearch').val() || '');
  var postURL = request_url + '/api/v1/mst_customer?search=' + encodeURIComponent(searchText) + '&is_active=Y';

  $.ajax({
    type: 'GET',
    url: postURL,
    contentType: 'application/json',
    headers: getAuthHeaders(),
    success: function (response) {
      customerList = normalizeCustomerResponse(response);
      filteredCustomerList = customerList;
      renderCustomerTable(filteredCustomerList);
    },
    error: function (xhr) {
      customerList = [];
      filteredCustomerList = [];
      renderCustomerTable([]);
      if (xhr.status === 401) {
        showWarningDialog('Your session has expired. Please login again.');
        setTimeout(function () {
          functionLogout();
        }, 800);
      } else {
        showSystemError('Unable to load customer records.');
      }
    }
  });
}

function normalizeCustomerResponse(response) {
  if ($.isArray(response)) return response;
  if (response && $.isArray(response.data)) return response.data;
  if (response && $.isArray(response.rows)) return response.rows;
  return [];
}

function renderCustomerTable(customers) {
  var tmpl = $('#customerRowTmpl').html();
  $('#customerTableBody').html(_.template(tmpl)({ customers: customers }));
}

function filterCustomerList(searchText) {
  searchText = $.trim(searchText).toLowerCase();

  if (!searchText) {
    filteredCustomerList = customerList;
    renderCustomerTable(filteredCustomerList);
    return;
  }

  filteredCustomerList = $.grep(customerList, function (customer) {
    return (
      (customer.customer_code || '').toLowerCase().indexOf(searchText) > -1 ||
      (customer.customer_name || '').toLowerCase().indexOf(searchText) > -1 ||
      (customer.contact_person || '').toLowerCase().indexOf(searchText) > -1 ||
      (customer.email || '').toLowerCase().indexOf(searchText) > -1 ||
      (customer.phone || '').toLowerCase().indexOf(searchText) > -1
    );
  });

  renderCustomerTable(filteredCustomerList);
}

function getAuthHeaders() {
  var token = sessionStorage.getItem('TOKEN');
  if (!token) return {};
  return {
    Authorization: 'Bearer ' + token
  };
}
