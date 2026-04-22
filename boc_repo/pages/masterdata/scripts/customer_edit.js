var customerId = null;
var canManageCustomer = false;

$(function () {
  if (!initErpShell({
    loginPath: '../../index.html',
    logoutPath: '../../index.html',
    sidebarStateKey: 'ERP_SIDEBAR'
  })) {
    return;
  }

  customerId = getQueryParam('id');
  if (!customerId) {
    showWarningDialog('Customer id is missing.');
    setTimeout(function () { location.href = 'customer_inq.html'; }, 600);
    return;
  }

  canManageCustomer = hasCustomerManageAccess();
  bindEvents();

  if (!canManageCustomer) {
    showWarningDialog('You have view access only.');
    $('#customerEditForm :input').prop('disabled', true);
    $('#btnCancel').prop('disabled', false);
    $('#btnDeactivate').hide();
  }

  loadReferenceData().then(loadCustomer).catch(function () {
    showSystemError('Unable to load customer details.');
  });
});

function bindEvents() {
  $('#btnCancel').on('click', function () {
    location.href = 'customer_inq.html';
  });

  $('#customerEditForm').on('submit', async function (e) {
    e.preventDefault();
    if (!canManageCustomer) return;
    await updateCustomer();
  });

  $('#btnDeactivate').on('click', function () {
    if (!canManageCustomer) return;
    deactivateCustomer();
  });
}

async function loadReferenceData() {
  const [termsResp, currencyResp] = await Promise.all([
    $.ajax({
      type: 'GET',
      url: request_url + '/api/v1/mst_payment_terms?is_active=Y&limit=200&page=1',
      headers: getAuthHeaders()
    }),
    $.ajax({
      type: 'GET',
      url: request_url + '/api/v1/mst_currency?is_active=Y&limit=200&page=1',
      headers: getAuthHeaders()
    })
  ]);

  bindDropdown($('#payment_term_id'), termsResp.data || [], 'payment_term_id', ['payment_term_code', 'payment_term_name']);
  bindDropdown($('#currency_id'), currencyResp.data || [], 'currency_id', ['currency_code', 'currency_name']);
}

async function loadCustomer() {
  var row = await $.ajax({
    type: 'GET',
    url: request_url + '/api/v1/mst_customer/' + encodeURIComponent(customerId),
    headers: getAuthHeaders()
  });

  $('#customer_code').val(row.customer_code || '');
  $('#customer_name').val(row.customer_name || '');
  $('#contact_person').val(row.contact_person || '');
  $('#phone').val(row.phone || '');
  $('#email').val(row.email || '');
  $('#gst_no').val(row.gst_no || '');
  $('#billing_address').val(row.billing_address || '');
  $('#shipping_address').val(row.shipping_address || '');
  $('#credit_days').val(row.credit_days);
  $('#credit_limit').val(row.credit_limit);
  $('#payment_term_id').val(row.payment_term_id ? String(row.payment_term_id) : '');
  $('#currency_id').val(row.currency_id ? String(row.currency_id) : '');
  $('#is_active').val(row.is_active || 'Y');
}

function bindDropdown($select, rows, valueKey, labelKeys) {
  $select.empty();
  $select.append('<option value="">Select</option>');
  $.each(rows, function (_, row) {
    var label = $.map(labelKeys, function (key) {
      return row[key] || '';
    }).join(' - ').replace(/^ - | - $/g, '');
    $select.append('<option value="' + row[valueKey] + '">' + label + '</option>');
  });
}

async function updateCustomer() {
  var payload = collectPayload();
  var validationError = validatePayload(payload);
  if (validationError) {
    showWarningDialog(validationError);
    return;
  }

  $('#btnUpdate').prop('disabled', true).text('Updating...');

  try {
    var duplicateErr = await duplicateValidation(payload, customerId);
    if (duplicateErr) {
      showWarningDialog(duplicateErr);
      return;
    }

    await $.ajax({
      type: 'PUT',
      url: request_url + '/api/v1/mst_customer/' + encodeURIComponent(customerId),
      headers: getAuthHeaders(),
      contentType: 'application/json',
      data: JSON.stringify(payload)
    });

    showSuccessDialog('Customer updated successfully.', function () {
      location.href = 'customer_inq.html';
    });
  } catch (xhr) {
    var message = (xhr.responseJSON && xhr.responseJSON.error) ? xhr.responseJSON.error : 'Failed to update customer.';
    showSystemError(message);
  } finally {
    $('#btnUpdate').prop('disabled', false).text('Update Customer');
  }
}

function deactivateCustomer() {
  showConfirmDialog('Deactivate this customer? This may affect downstream processes.', async function () {
    try {
      var actor = sessionStorage.getItem('USERNAME') || 'system';
      await $.ajax({
        type: 'DELETE',
        url: request_url + '/api/v1/mst_customer/' + encodeURIComponent(customerId),
        headers: getAuthHeaders(),
        contentType: 'application/json',
        data: JSON.stringify({ updated_by: actor })
      });

      showSuccessDialog('Customer deactivated successfully.', function () {
        location.href = 'customer_inq.html';
      });
    } catch (xhr) {
      var message = (xhr.responseJSON && xhr.responseJSON.error) ? xhr.responseJSON.error : 'Failed to deactivate customer.';
      showSystemError(message);
    }
  });
}

function collectPayload() {
  var actor = sessionStorage.getItem('USERNAME') || 'system';

  return {
    customer_code: $.trim($('#customer_code').val()),
    customer_name: $.trim($('#customer_name').val()),
    contact_person: $.trim($('#contact_person').val()),
    phone: $.trim($('#phone').val()),
    email: $.trim($('#email').val()),
    gst_no: $.trim($('#gst_no').val()),
    billing_address: $.trim($('#billing_address').val()),
    shipping_address: $.trim($('#shipping_address').val()),
    credit_days: normalizeNumber($('#credit_days').val(), true),
    credit_limit: normalizeNumber($('#credit_limit').val(), false),
    payment_term_id: $('#payment_term_id').val() || null,
    currency_id: $('#currency_id').val() || null,
    is_active: $('#is_active').val() || 'Y',
    updated_by: actor
  };
}

function validatePayload(payload) {
  if (!payload.customer_code) return 'Customer code is required.';
  if (!payload.customer_name) return 'Customer name is required.';
  if (!payload.payment_term_id) return 'Payment terms is required.';
  if (!payload.currency_id) return 'Currency is required.';

  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    return 'Invalid email format.';
  }

  if (payload.credit_days !== null && payload.credit_days < 0) {
    return 'Credit days cannot be negative.';
  }

  if (payload.credit_limit !== null && payload.credit_limit < 0) {
    return 'Credit limit cannot be negative.';
  }

  return '';
}

async function duplicateValidation(payload, excludeId) {
  try {
    var response = await $.ajax({
      type: 'GET',
      url: request_url + '/api/v1/mst_customer?is_active=Y&limit=500&page=1',
      headers: getAuthHeaders()
    });

    var rows = response.data || [];
    var codeLower = payload.customer_code.toLowerCase();
    var nameLower = payload.customer_name.toLowerCase();

    var codeExists = $.grep(rows, function (r) {
      return String(r.customer_id) !== String(excludeId) && (r.customer_code || '').toLowerCase() === codeLower;
    }).length > 0;

    if (codeExists) return 'Customer code already exists.';

    var nameExists = $.grep(rows, function (r) {
      return String(r.customer_id) !== String(excludeId) && (r.customer_name || '').toLowerCase() === nameLower;
    }).length > 0;

    if (nameExists) return 'An active customer with the same name already exists.';
    return '';
  } catch (_) {
    return '';
  }
}

function normalizeNumber(value, integerOnly) {
  if (value === null || value === undefined || value === '') return null;
  var num = integerOnly ? parseInt(value, 10) : parseFloat(value);
  return isNaN(num) ? null : num;
}

function getQueryParam(name) {
  var query = new URLSearchParams(window.location.search);
  return query.get(name);
}

function getAuthHeaders() {
  var token = sessionStorage.getItem('TOKEN');
  if (!token) return {};
  return { Authorization: 'Bearer ' + token };
}

function hasCustomerManageAccess() {
  var role = (sessionStorage.getItem('ROLE_NAME') || '').toLowerCase();
  return role === 'admin' || role === 'manager';
}
