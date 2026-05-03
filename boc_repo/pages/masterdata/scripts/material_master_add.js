var editMaterialId;
var materialGroups = [];
var uoms = [];
var currencies = [];
var taxes = [];
var vendors = [];
var warehouses = [];

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  var params = new URLSearchParams(window.location.search);
  editMaterialId = params.get("id");

  loadLookups()
    .done(function () {
      renderSelectOptions();

      if (editMaterialId) {
        $("#pageTitle").text("Edit Material Information:");
        loadMaterialDetails(editMaterialId);
      } else {
        $("#pageTitle").text("Add Material Information:");
      }
    })
    .fail(function () {
      showErrorDialog("Unable to load material master lookup values.");
    });
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

function getMasterList(tableName, params) {
  var query = $.param($.extend({ page: 1, limit: 5000, is_active: "Y" }, params || {}));
  return $.ajax({
    type: "GET",
    url: request_url + "/api/v1/" + tableName + "?" + query,
    headers: getAuthHeaders(),
    contentType: "application/json"
  }).then(function (res) {
    return res && res.data ? res.data : [];
  });
}

function loadLookups() {
  return $.when(
    getMasterList("mst_material_group"),
    getMasterList("mst_uom"),
    getMasterList("mst_currency"),
    getMasterList("mst_tax"),
    getMasterList("mst_vendor"),
    getMasterList("mst_warehouse")
  ).done(function (groupRows, uomRows, currencyRows, taxRows, vendorRows, warehouseRows) {
    materialGroups = groupRows || [];
    uoms = uomRows || [];
    currencies = currencyRows || [];
    taxes = taxRows || [];
    vendors = vendorRows || [];
    warehouses = warehouseRows || [];
  });
}

function renderSelectOptions() {
  renderMaterialGroupOptions();
  renderUomOptions("#base_uom_id");
  renderUomOptions("#purchase_uom_id");
  renderUomOptions("#sales_uom_id");
  renderCurrencyOptions();
  renderTaxOptions();
  renderVendorOptions();
  renderWarehouseOptions();
}

function renderMaterialGroupOptions() {
  var html = '<option value="">Select</option>';
  _.each(materialGroups, function (group) {
    html += '<option value="' + group.material_group_id + '">' + (group.material_group_name || "") + "</option>";
  });
  $("#material_group_id").html(html);
}

function renderUomOptions(selector) {
  var html = '<option value="">Select</option>';
  _.each(uoms, function (uom) {
    html += '<option value="' + uom.uom_id + '">' + (uom.uom_code || uom.uom_name || "") + "</option>";
  });
  $(selector).html(html);
}

function renderCurrencyOptions() {
  var html = '<option value="">Select</option>';
  _.each(currencies, function (currency) {
    html += '<option value="' + currency.currency_id + '">' + (currency.currency_code || currency.currency_name || "") + "</option>";
  });
  $("#currency_id").html(html);
}

function renderTaxOptions() {
  var html = '<option value="">Select</option>';
  _.each(taxes, function (tax) {
    html += '<option value="' + tax.tax_id + '">' + (tax.tax_code || tax.tax_name || "") + "</option>";
  });
  $("#tax_id").html(html);
}

function renderVendorOptions() {
  var html = '<option value="">Select</option>';
  _.each(vendors, function (vendor) {
    var vendorText = (vendor.vendor_code ? vendor.vendor_code + " - " : "") + (vendor.vendor_name || "");
    html += '<option value="' + vendor.vendor_id + '">' + vendorText + "</option>";
  });
  $("#preferred_vendor_id").html(html);
}

function renderWarehouseOptions() {
  var html = '<option value="">Select</option>';
  _.each(warehouses, function (warehouse) {
    var warehouseText = (warehouse.warehouse_code ? warehouse.warehouse_code + " - " : "") + (warehouse.warehouse_name || "");
    html += '<option value="' + warehouse.warehouse_id + '">' + warehouseText + "</option>";
  });
  $("#default_warehouse_id").html(html);
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
    material_code: $.trim($("#material_code").val()),
    material_name: $.trim($("#material_name").val()),
    material_type: $.trim($("#material_type").val()),
    material_group_id: cleanInt($("#material_group_id").val()),
    base_uom_id: cleanInt($("#base_uom_id").val()),
    purchase_uom_id: cleanInt($("#purchase_uom_id").val()),
    sales_uom_id: cleanInt($("#sales_uom_id").val()),
    currency_id: cleanInt($("#currency_id").val()),
    tax_id: cleanInt($("#tax_id").val()),
    hsn_sac_code: $.trim($("#hsn_sac_code").val()),
    standard_rate: cleanDecimal($("#standard_rate").val()),
    sales_rate: cleanDecimal($("#sales_rate").val()),
    min_sale_qty: cleanDecimal($("#min_sale_qty").val()),
    max_sale_qty: cleanDecimal($("#max_sale_qty").val()),
    discount_allowed: $("#discount_allowed").val(),
    default_discount_percent: cleanDecimal($("#default_discount_percent").val()),
    tax_classification: $("#tax_classification").val(),
    gst_applicable: $("#gst_applicable").val(),
    is_tax_inclusive: $("#is_tax_inclusive").val(),
    cess_percent: cleanDecimal($("#cess_percent").val()),
    preferred_vendor_id: cleanInt($("#preferred_vendor_id").val()),
    lead_time_days: cleanInt($("#lead_time_days").val()),
    moq: cleanDecimal($("#moq").val()),
    procurement_type: $("#procurement_type").val(),
    reorder_level: cleanDecimal($("#reorder_level").val()),
    min_stock: cleanDecimal($("#min_stock").val()),
    max_stock: cleanDecimal($("#max_stock").val()),
    safety_stock: cleanDecimal($("#safety_stock").val()),
    storage_condition: $.trim($("#storage_condition").val()),
    shelf_life_days: cleanInt($("#shelf_life_days").val()),
    default_warehouse_id: cleanInt($("#default_warehouse_id").val()),
    costing_method: $("#costing_method").val(),
    weight: cleanDecimal($("#weight").val()),
    length: cleanDecimal($("#length").val()),
    width: cleanDecimal($("#width").val()),
    height: cleanDecimal($("#height").val()),
    dimension_uom: $("#dimension_uom").val(),
    brand: $.trim($("#brand").val()),
    model_no: $.trim($("#model_no").val()),
    material_description: $.trim($("#material_description").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateForm(payload) {
  if (!payload.material_code) {
    showWarningDialog("Material code is required.");
    return false;
  }

  if (!payload.material_name) {
    showWarningDialog("Material name is required.");
    return false;
  }

  if (!payload.material_group_id) {
    showWarningDialog("Material category is required.");
    return false;
  }

  if (!payload.base_uom_id) {
    showWarningDialog("Base UOM is required.");
    return false;
  }

  return true;
}

function saveMaterial() {
  $(".searchButton").prop("disabled", true);

  var payload = buildPayload();
  if (!validateForm(payload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editMaterialId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_material" + (isEdit ? "/" + editMaterialId : "");

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
      showSuccessDialog(isEdit ? "Material updated successfully." : "Material added successfully.", function () {
        location.href = "material_master_inq.html";
      });
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        var message = "There was a problem saving the material.";
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

function loadMaterialDetails(materialId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_material/" + materialId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#material_code").val(data.material_code || "");
      $("#material_name").val(data.material_name || "");
      $("#material_type").val(data.material_type || "");
      $("#material_group_id").val(data.material_group_id || "");
      $("#base_uom_id").val(data.base_uom_id || "");
      $("#purchase_uom_id").val(data.purchase_uom_id || "");
      $("#sales_uom_id").val(data.sales_uom_id || "");
      $("#currency_id").val(data.currency_id || "");
      $("#tax_id").val(data.tax_id || "");
      $("#hsn_sac_code").val(data.hsn_sac_code || "");
      $("#standard_rate").val(data.standard_rate || "");
      $("#sales_rate").val(data.sales_rate || "");
      $("#min_sale_qty").val(data.min_sale_qty || "");
      $("#max_sale_qty").val(data.max_sale_qty || "");
      $("#discount_allowed").val(data.discount_allowed || "");
      $("#default_discount_percent").val(data.default_discount_percent || "");
      $("#tax_classification").val(data.tax_classification || "");
      $("#gst_applicable").val(data.gst_applicable || "");
      $("#is_tax_inclusive").val(data.is_tax_inclusive || "");
      $("#cess_percent").val(data.cess_percent || "");
      $("#preferred_vendor_id").val(data.preferred_vendor_id || "");
      $("#lead_time_days").val(data.lead_time_days || "");
      $("#moq").val(data.moq || "");
      $("#procurement_type").val(data.procurement_type || "");
      $("#reorder_level").val(data.reorder_level || "");
      $("#min_stock").val(data.min_stock || "");
      $("#max_stock").val(data.max_stock || "");
      $("#safety_stock").val(data.safety_stock || "");
      $("#storage_condition").val(data.storage_condition || "");
      $("#shelf_life_days").val(data.shelf_life_days || "");
      $("#default_warehouse_id").val(data.default_warehouse_id || "");
      $("#costing_method").val(data.costing_method || "");
      $("#weight").val(data.weight || "");
      $("#length").val(data.length || "");
      $("#width").val(data.width || "");
      $("#height").val(data.height || "");
      $("#dimension_uom").val(data.dimension_uom || "");
      $("#brand").val(data.brand || "");
      $("#model_no").val(data.model_no || "");
      $("#material_description").val(data.material_description || "");
      $("#is_active").val(data.is_active || "Y");
    },
    error: function (xhr) {
      if (xhr && xhr.status === 401) {
        showWarningDialog("Session expired. Please login again.");
        setTimeout(function () {
          location.href = "../../index.html";
        }, 500);
      } else {
        showErrorDialog("Unable to load material details.");
      }
    }
  });
}

function backToInquiry() {
  location.href = "material_master_inq.html";
}
