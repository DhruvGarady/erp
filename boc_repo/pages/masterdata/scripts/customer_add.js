$(function () {
  if (!initErpShell({
    loginPath: '../../index.html',
    logoutPath: '../../index.html',
    sidebarStateKey: 'ERP_SIDEBAR'
  })) {
    return;
  }

  if (!hasCustomerManageAccess()) {
    showWarningDialog('You have view access only.');
    $('#customerAddForm :input').prop('disabled', true);
    $('#btnCancel').prop('disabled', false);
    return;
  }

  bindEvents();
  loadReferenceData();
});

function bindEvents() {
  $('#btnCancel').on('click', function () {
    location.href = 'customer_inq.html';
  });

  $('#customerAddForm').on('submit', async function (e) {
    e.preventDefault();
    await saveCustomer();
  });
}

async function loadReferenceData() {
  try {
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
  } catch (err) {
    showSystemError('Unable to load dropdown references.');
  }
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

async function saveCustomer() {
  var payload = collectPayload();
  var validationError = validatePayload(payload);
  if (validationError) {
    showWarningDialog(validationError);
    return;
  }

  $('#btnSave').prop('disabled', true).text('Saving...');

  try {
    var duplicateErr = await duplicateValidation(payload);
    if (duplicateErr) {
      showWarningDialog(duplicateErr);
      return;
    }

    await $.ajax({
      type: 'POST',
      url: request_url + '/api/v1/mst_customer',
      headers: getAuthHeaders(),
      contentType: 'application/json',
      data: JSON.stringify(payload)
    });

    showSuccessDialog('Customer created successfully.', function () {
      location.href = 'customer_inq.html';
    });
  } catch (xhr) {
    var message = (xhr.responseJSON && xhr.responseJSON.error) ? xhr.responseJSON.error : 'Failed to save customer.';
    showSystemError(message);
  } finally {
    $('#btnSave').prop('disabled', false).text('Save Customer');
  }
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
    created_by: actor,
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

async function duplicateValidation(payload) {
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
      return (r.customer_code || '').toLowerCase() === codeLower;
    }).length > 0;

    if (codeExists) return 'Customer code already exists.';

    var nameExists = $.grep(rows, function (r) {
      return (r.customer_name || '').toLowerCase() === nameLower;
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

function getAuthHeaders() {
  var token = sessionStorage.getItem('TOKEN');
  if (!token) return {};
  return { Authorization: 'Bearer ' + token };
}

function hasCustomerManageAccess() {
  var role = (sessionStorage.getItem('ROLE_NAME') || '').toLowerCase();
  return role === 'admin' || role === 'manager';
}
