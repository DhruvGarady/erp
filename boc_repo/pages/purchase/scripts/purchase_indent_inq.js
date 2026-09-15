var indentData;
var indentTemplate;

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();

  setPageFeature("PUR_INDENT");
  indentTemplate = $("#listTmpl").html();
  indentData = [];
  $("#indentTableSearch").on("input", filterIndentTable);
  renderList([]);
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
  var fromDate = $("#fromDateSearch").val();
  var toDate = $("#toDateSearch").val();

  if (fromDate && toDate && fromDate > toDate) {
    showWarningDialog("From Date cannot be greater than To Date.");
    return;
  }

  $.ajax({
    type: "GET",
    url: request_url + "/purchaseindent/list",
    headers: getAuthHeaders(),
    contentType: "application/json",
    success: onSearchSuccess,
    error: onSearchErr
  });
}

function onSearchSuccess(rows) {
  indentData = rows || [];
  renderList(filterIndents(indentData));
}

function filterIndents(rows) {
  var indentNo = $.trim($("#indentNoSearch").val() || "").toLowerCase();
  var department = $.trim($("#departmentSearch").val() || "").toLowerCase();
  var fromDate = $("#fromDateSearch").val();
  var toDate = $("#toDateSearch").val();
  var status = $("#statusSearch").val();
  var priority = $("#prioritySearch").val();

  return _.filter(rows || [], function (item) {
    var indentDate = normalizeDate(item.indent_date);
    var indentNoText = String(item.indent_no || "").toLowerCase();
    var departmentText = String(item.department || "").toLowerCase();
    var requestedByText = String(item.requested_by_name || "").toLowerCase();

    if (indentNo && indentNoText.indexOf(indentNo) === -1) {
      return false;
    }

    if (department && departmentText.indexOf(department) === -1 && requestedByText.indexOf(department) === -1) {
      return false;
    }

    if (status && String(item.status || "") !== status) {
      return false;
    }

    if (priority && String(item.priority || "") !== priority) {
      return false;
    }

    if (fromDate && (!indentDate || indentDate < fromDate)) {
      return false;
    }

    if (toDate && (!indentDate || indentDate > toDate)) {
      return false;
    }

    return true;
  });
}

function onSearchErr(xhr) {
  indentData = [];
  renderList([]);

  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  showErrorDialog("Unable to fetch purchase indent records.");
}

function renderList(rows) {
  var template = _.template(indentTemplate);
  $("#listContainer2").html(template({
    indents: rows || [],
    formatDate: formatDate,
    formatAmount: formatAmount,
    canSubmitIndent: canSubmitIndent,
    canDecideIndent: canDecideIndent,
    canEditIndent: canEditIndent
  }));
  filterIndentTable();
  $("#listContainer2").trigger("create");
}

function filterIndentTable() {
  var searchText = $.trim($("#indentTableSearch").val() || "").toLowerCase();
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

// The server owns these rules; these copies only decide whether to draw
// the icon. A row whose state has moved on since the last search still
// gets a clear 400 from the API rather than a silent no-op.
function indentStatus(item) {
  return String((item && item.status) || "Draft");
}

function canSubmitIndent(item) {
  return canDo("edit") && indentStatus(item) === "Draft";
}

function canDecideIndent(item) {
  return canDo("approve") && indentStatus(item) === "Submitted";
}

function canEditIndent(item) {
  return indentStatus(item) === "Draft";
}

function addIndent() {
  if (!ensurePermission("create", "You do not have permission to add records here.")) return;

  location.href = "purchase_indent_add.html";
}

function editIndent(id) {
  if (!ensurePermission("edit", "You do not have permission to edit records here.")) return;

  if (!id) return;
  location.href = "purchase_indent_add.html?id=" + id;
}

// Once an indent leaves Draft it can still be read, just not changed.
function viewIndent(id) {
  if (!id) return;
  location.href = "purchase_indent_add.html?id=" + id;
}

function submitIndent(id) {
  if (!ensurePermission("edit", "You do not have permission to submit indents.")) return;

  if (!id) return;

  showConfirmDialog("Send this indent for approval? It cannot be edited afterwards.", function () {
    transitionIndent(id, "submit", {}, "Indent sent for approval.");
  });
}

function approveIndent(id) {
  if (!ensurePermission("approve", "You do not have permission to approve indents.")) return;

  if (!id) return;

  showConfirmDialog("Approve this purchase indent?", function () {
    transitionIndent(id, "approve", {}, "Indent approved successfully.");
  });
}

function rejectIndent(id) {
  if (!ensurePermission("approve", "You do not have permission to reject indents.")) return;

  if (!id) return;

  showConfirmDialog("Reject this purchase indent?", function () {
    transitionIndent(id, "reject", {}, "Indent rejected.");
  });
}

function transitionIndent(id, action, payload, successMessage) {
  $.ajax({
    type: "PATCH",
    url: request_url + "/purchaseindent/" + action + "/" + id,
    headers: getAuthHeaders(),
    data: JSON.stringify(payload || {}),
    contentType: "application/json",
    success: function () {
      showSuccessDialog(successMessage, function () {
        search();
      });
    },
    error: function (xhr) {
      handleActionError(xhr, "There was a problem updating this indent.");
    }
  });
}

function deleteIndent(id) {
  if (!ensurePermission("delete", "You do not have permission to delete records here.")) return;

  if (!id) return;

  showConfirmDialog("Are you sure you want to deactivate this purchase indent?", function () {
    $.ajax({
      url: request_url + "/purchaseindent/" + id,
      type: "DELETE",
      headers: getAuthHeaders(),
      data: JSON.stringify({
        updated_by: sessionStorage.getItem("USER_ID")
      }),
      contentType: "application/json",
      success: function () {
        showSuccessDialog("Purchase indent deactivated successfully.", function () {
          search();
        });
      },
      error: function (xhr) {
        handleActionError(xhr, "There was a problem deactivating this indent.");
      }
    });
  });
}

function handleActionError(xhr, fallbackMessage) {
  if (xhr && xhr.status === 401) {
    showWarningDialog("Session expired. Please login again.");
    setTimeout(function () {
      location.href = "../../index.html";
    }, 500);
    return;
  }

  var message = xhr && xhr.responseJSON && xhr.responseJSON.error ? xhr.responseJSON.error : fallbackMessage;
  showErrorDialog(message);
}

// mysql2 hands back a DATE column as a JS Date at local midnight, which
// JSON-serializes to the day before in UTC -- "2026-09-15" arrives as
// "2026-09-14T18:30:00.000Z" here. Slicing that string, which is what
// the sales pages do, displays and re-saves the wrong day, and the date
// walks backwards once per edit. Reading the local components back
// recovers the day the user actually picked. A plain "YYYY-MM-DD"
// string is passed through untouched.
function normalizeDate(value) {
  if (!value) return "";

  var text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  var parsed = new Date(text);
  if (isNaN(parsed.getTime())) {
    return text.slice(0, 10);
  }

  return parsed.getFullYear() + "-" + pad2(parsed.getMonth() + 1) + "-" + pad2(parsed.getDate());
}

function pad2(value) {
  return (value < 10 ? "0" : "") + value;
}

function formatDate(value) {
  var iso = normalizeDate(value);
  if (!iso) return "";

  var parts = iso.split("-");
  if (parts.length !== 3) return value;
  return parts[2] + "-" + parts[1] + "-" + parts[0];
}

function formatAmount(value) {
  var amount = Number(value || 0);
  if (isNaN(amount)) return "0.00";
  return amount.toFixed(2);
}
