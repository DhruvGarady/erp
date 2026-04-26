var editBomId;
var materialGroups = [];
var materials = [];
var uoms = [];
var bomItems = [];
var deletedBomItemIds = [];
var bomItemsTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  bomItemsTemplate = $("#bomItemsTmpl").html();

  var params = new URLSearchParams(window.location.search);
  editBomId = params.get("id");

  loadLookups()
    .done(function () {
      renderCategoryOptions();
      renderMaterialOptions("#parent_material_id", "");
      renderMaterialOptions("#child_material_id", "");
      renderBomItems();

      if (editBomId) {
        $("#pageTitle").text("Edit BOM Information:");
        loadBomDetails(editBomId);
      } else {
        $("#pageTitle").text("Add BOM Information:");
      }
    })
    .fail(function () {
      showErrorDialog("Unable to load material, category, or UOM data.");
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
    getMasterList("mst_material"),
    getMasterList("mst_uom")
  ).done(function (groupRows, materialRows, uomRows) {
    materialGroups = groupRows || [];
    materials = materialRows || [];
    uoms = uomRows || [];
  });
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

function findMaterial(materialId) {
  return _.find(materials, function (item) {
    return String(item.material_id) === String(materialId);
  });
}

function findMaterialGroup(groupId) {
  return _.find(materialGroups, function (item) {
    return String(item.material_group_id) === String(groupId);
  });
}

function getGroupName(groupId) {
  var group = findMaterialGroup(groupId);
  return group ? group.material_group_name : "";
}

function renderCategoryOptions() {
  var html = '<option value="">Select</option>';
  _.each(materialGroups, function (group) {
    html += '<option value="' + group.material_group_id + '">' + (group.material_group_name || "") + "</option>";
  });
  $("#material_category_id").html(html);
  $("#item_material_category_id").html(html);
}

function renderMaterialOptions(selectId, materialGroupId, selectedMaterialId) {
  var html = '<option value="">Select</option>';
  var filtered = materialGroupId
    ? _.filter(materials, function (item) {
        return String(item.material_group_id) === String(materialGroupId);
      })
    : materials;

  _.each(filtered, function (material) {
    var selected = String(selectedMaterialId || "") === String(material.material_id) ? " selected" : "";
    html += '<option value="' + material.material_id + '"' + selected + ">" + (material.material_name || "") + "</option>";
  });

  $(selectId).html(html);
}

function onHeaderCategoryChange() {
  renderMaterialOptions("#parent_material_id", $("#material_category_id").val());
}

function onParentMaterialChange() {
  return true;
}

function onItemCategoryChange() {
  renderMaterialOptions("#child_material_id", $("#item_material_category_id").val());
}

function buildHeaderPayload() {
  var categoryId = cleanInt($("#material_category_id").val());
  var parentMaterialId = cleanInt($("#parent_material_id").val());
  var parentMaterial = findMaterial(parentMaterialId);
  var userName = sessionStorage.getItem("USERNAME") || "system";

  return {
    bom_code: $.trim($("#bom_code").val()),
    bom_name: $.trim($("#bom_name").val()),
    material_category_id: categoryId,
    material_category: getGroupName(categoryId),
    parent_material_id: parentMaterialId,
    parent_material_name: parentMaterial ? parentMaterial.material_name : "",
    version_no: $.trim($("#version_no").val()),
    remarks: $.trim($("#remarks").val()),
    is_active: $("#is_active").val() || "Y",
    created_by: userName,
    updated_by: userName
  };
}

function validateBom(headerPayload) {
  if (!headerPayload.bom_code) {
    showWarningDialog("BOM code is required.");
    return false;
  }

  if (!headerPayload.bom_name) {
    showWarningDialog("BOM name is required.");
    return false;
  }

  if (!headerPayload.material_category_id) {
    showWarningDialog("Material category is required.");
    return false;
  }

  if (!headerPayload.parent_material_id) {
    showWarningDialog("Parent material is required.");
    return false;
  }

  if (!bomItems.length) {
    showWarningDialog("At least one BOM item is required.");
    return false;
  }

  for (var i = 0; i < bomItems.length; i++) {
    if (!bomItems[i].quantity || Number(bomItems[i].quantity) <= 0) {
      showWarningDialog("Quantity must be greater than zero for every BOM item.");
      return false;
    }

    if (!bomItems[i].uom_id) {
      showWarningDialog("UOM is required for every BOM item.");
      return false;
    }
  }

  return true;
}

function addBomItem() {
  syncBomItemRows();

  var groupId = cleanInt($("#item_material_category_id").val());
  var materialId = cleanInt($("#child_material_id").val());
  var material = findMaterial(materialId);

  if (!groupId) {
    showWarningDialog("Select a material category.");
    return;
  }

  if (!material) {
    showWarningDialog("Select a material.");
    return;
  }

  var duplicate = _.find(bomItems, function (item) {
    return String(item.child_material_id) === String(materialId);
  });

  if (duplicate) {
    showWarningDialog("This material is already added to the BOM.");
    return;
  }

  bomItems.push({
    bom_item_id: null,
    material_category_id: groupId,
    material_category: getGroupName(groupId),
    child_material_id: materialId,
    child_material_name: material.material_name || "",
    part_code: material.material_code || "",
    quantity: 1,
    uom_id: material.base_uom_id || "",
    scrap_percent: 0,
    remarks: "",
    is_active: "Y"
  });

  renderBomItems();
}

function syncBomItemRows() {
  $("#bomItemsContainer tr[data-index]").each(function () {
    var index = parseInt($(this).attr("data-index"), 10);
    if (!bomItems[index]) return;

    bomItems[index].part_code = $.trim($(this).find(".linePartCode").val());
    bomItems[index].quantity = cleanDecimal($(this).find(".lineQty").val());
    bomItems[index].uom_id = cleanInt($(this).find(".lineUom").val());
  });
}

function renderBomItems() {
  $("#bomItemsContainer").html(_.template(bomItemsTemplate, { bomItems: bomItems || [], uoms: uoms || [] }));
  $("#bomItemsContainer").trigger("create");
}

function deleteBomItem(index) {
  syncBomItemRows();

  if (bomItems[index] && bomItems[index].bom_item_id) {
    deletedBomItemIds.push(bomItems[index].bom_item_id);
  }

  bomItems.splice(index, 1);
  renderBomItems();
}

function buildItemPayload(item, bomId, index, includeCreatedBy) {
  var userName = sessionStorage.getItem("USERNAME") || "system";
  var payload = {
    bom_id: bomId,
    line_no: index + 1,
    material_category_id: item.material_category_id,
    material_category: item.material_category,
    child_material_id: item.child_material_id,
    child_material_name: item.child_material_name,
    part_code: item.part_code,
    quantity: item.quantity,
    uom_id: item.uom_id,
    scrap_percent: item.scrap_percent || 0,
    remarks: item.remarks || "",
    is_active: "Y",
    updated_by: userName
  };

  if (includeCreatedBy) {
    payload.created_by = userName;
  }

  return payload;
}

function saveBom() {
  syncBomItemRows();

  $(".searchButton").prop("disabled", true);

  var headerPayload = buildHeaderPayload();
  if (!validateBom(headerPayload)) {
    $(".searchButton").prop("disabled", false);
    return;
  }

  var isEdit = !!editBomId;
  var method = isEdit ? "PUT" : "POST";
  var url = request_url + "/api/v1/mst_bom" + (isEdit ? "/" + editBomId : "");

  if (isEdit) {
    delete headerPayload.created_by;
  }

  $.ajax({
    type: method,
    url: url,
    headers: getAuthHeaders(),
    data: JSON.stringify(headerPayload),
    contentType: "application/json",
    success: function (res) {
      var bomId = isEdit ? editBomId : res.id;
      saveBomItems(bomId, isEdit);
    },
    error: function (xhr) {
      handleSaveError(xhr, "There was a problem saving the BOM.");
      $(".searchButton").prop("disabled", false);
    }
  });
}

function saveBomItems(bomId, isEdit) {
  var requests = [];

  _.each(deletedBomItemIds, function (itemId) {
    requests.push($.ajax({
      url: request_url + "/api/v1/mst_bom_items/" + itemId,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({ updated_by: sessionStorage.getItem("USERNAME") }),
      contentType: "application/json"
    }));
  });

  _.each(bomItems, function (item, index) {
    var isExisting = !!item.bom_item_id;
    var payload = buildItemPayload(item, bomId, index, !isExisting);
    requests.push($.ajax({
      type: isExisting ? "PUT" : "POST",
      url: request_url + "/api/v1/mst_bom_items" + (isExisting ? "/" + item.bom_item_id : ""),
      headers: getAuthHeaders(),
      data: JSON.stringify(payload),
      contentType: "application/json"
    }));
  });

  $.when.apply($, requests)
    .done(function () {
      showSuccessDialog(isEdit ? "BOM updated successfully." : "BOM added successfully.", function () {
        location.href = "bominq.html";
      });
    })
    .fail(function (xhr) {
      handleSaveError(xhr, "BOM header was saved, but there was a problem saving BOM items.");
    })
    .always(function () {
      $(".searchButton").prop("disabled", false);
    });
}

function handleSaveError(xhr, fallbackMessage) {
  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  var message = fallbackMessage;
  if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
    message = xhr.responseJSON.error;
  }
  showErrorDialog(message);
}

function loadBomDetails(bomId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_bom/" + bomId,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (data) {
      $("#bom_code").val(data.bom_code || "");
      $("#bom_name").val(data.bom_name || "");
      $("#material_category_id").val(data.material_category_id || "");
      renderMaterialOptions("#parent_material_id", data.material_category_id || "", data.parent_material_id || "");
      $("#parent_material_id").val(data.parent_material_id || "");
      $("#version_no").val(data.version_no || "");
      $("#remarks").val(data.remarks || "");
      $("#is_active").val(data.is_active || "Y");
      loadBomItems(bomId);
    },
    error: function (xhr) {
      handleSaveError(xhr, "Unable to load BOM details.");
    }
  });
}

function loadBomItems(bomId) {
  $.ajax({
    type: "GET",
    url: request_url + "/api/v1/mst_bom_items?page=1&limit=5000&is_active=Y",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      var rows = res && res.data ? res.data : [];
      bomItems = _.filter(rows, function (item) {
        return String(item.bom_id) === String(bomId);
      });

      bomItems = _.map(bomItems, function (item) {
        var material = findMaterial(item.child_material_id);
        var categoryId = item.material_category_id || (material ? material.material_group_id : null);
        return {
          bom_item_id: item.bom_item_id,
          material_category_id: cleanInt(categoryId),
          material_category: item.material_category || getGroupName(categoryId),
          child_material_id: cleanInt(item.child_material_id),
          child_material_name: item.child_material_name || (material ? material.material_name : ""),
          part_code: item.part_code || (material ? material.material_code : ""),
          quantity: item.quantity || 1,
          uom_id: item.uom_id || (material ? material.base_uom_id : ""),
          scrap_percent: item.scrap_percent || 0,
          remarks: item.remarks || "",
          is_active: item.is_active || "Y"
        };
      });

      renderBomItems();
    },
    error: function (xhr) {
      handleSaveError(xhr, "Unable to load BOM items.");
    }
  });
}

function backToInquiry() {
  location.href = "bominq.html";
}
