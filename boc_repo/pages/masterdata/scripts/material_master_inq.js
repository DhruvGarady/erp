var materials;
var materialTemplate;
var materialGroups = [];
var uoms = [];

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  materialTemplate = $("#listTmpl").html();
  materials = [];
  $("#materialTableSearch").on("input", filterMaterialTable);
  renderList();

  loadLookups()
    .done(function () {
      renderCategorySearch();
      search();
    })
    .fail(function () {
      showErrorDialog("Unable to load material category or UOM data.");
    });
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) {
    return {};
  }
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
    getMasterList("mst_uom")
  ).done(function (groupRows, uomRows) {
    materialGroups = groupRows || [];
    uoms = uomRows || [];
  });
}

function renderCategorySearch() {
  var html = '<option value="">ALL</option>';
  _.each(materialGroups, function (group) {
    html += '<option value="' + group.material_group_id + '">' + (group.material_group_name || "") + "</option>";
  });
  $("#categorySearch").html(html);
}

function groupName(groupId) {
  var group = _.find(materialGroups, function (item) {
    return String(item.material_group_id) === String(groupId);
  });
  return group ? group.material_group_name : "";
}

function uomName(uomId) {
  var uom = _.find(uoms, function (item) {
    return String(item.uom_id) === String(uomId);
  });
  return uom ? (uom.uom_code || uom.uom_name || "") : "";
}

function search() {
  var code = $.trim($("#materialCodeSearch").val() || "");
  var name = $.trim($("#materialNameSearch").val() || "");
  var status = $("#statusSearch").val();
  var selectedGroup = $("#categorySearch").val();
  var searchText = $.trim((code + " " + name).replace(/\s+/g, " "));

  var params = {
    page: 1,
    limit: 500
  };

  if (searchText) {
    params.search = searchText;
  }

  if (status) {
    params.is_active = status;
  }

  var strURL = request_url + "/api/v1/mst_material?" + $.param(params);

  $.ajax({
    type: "GET",
    url: strURL,
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: function (res) {
      materials = res && res.data ? res.data : [];

      if (selectedGroup) {
        materials = _.filter(materials, function (item) {
          return String(item.material_group_id) === String(selectedGroup);
        });
      }

      renderList();
    },
    error: onSearchErr
  });
}

function onSearchErr(xhr) {
  materials = [];
  renderList();

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch material records.");
}

function renderList() {
  $("#listContainer2").html(_.template(materialTemplate, {
    materials: materials || [],
    groupName: groupName,
    uomName: uomName
  }));
  filterMaterialTable();
  $("#listContainer2").trigger("create");
}

function filterMaterialTable() {
  var searchText = $.trim($("#materialTableSearch").val() || "").toLowerCase();
  var rows = $("#listContainer2 table.dataTbl tr").not(":first");

  if (!searchText) {
    rows.show();
    return;
  }

  rows.each(function () {
    var rowText = $(this).text().toLowerCase();
    $(this).toggle(rowText.indexOf(searchText) !== -1);
  });
}

function addMaterial() {
  location.href = "material_master_add.html";
}

function editMaterial(id) {
  if (!id) return;
  location.href = "material_master_add.html?id=" + id;
}

function deleteMaterial(id) {
  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this material?", function () {
    $.ajax({
      url: request_url + "/api/v1/mst_material/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USERNAME")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Material deactivated successfully.", function () {
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
        showErrorDialog("There was a problem deactivating this material.");
      }
    });
  });
}
