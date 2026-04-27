var masterStats = [];
var dashboardCharts = {};

var MASTER_TABLES = [
  { table: "mst_customer", label: "Customers", area: "Commercial", page: "customerinq.html", color: "#1a73e8" },
  { table: "mst_vendor", label: "Vendors", area: "Procurement", page: "vendorinq.html", color: "#00a88f" },
  { table: "mst_material", label: "Materials", area: "Materials", page: "material_master_inq.html", color: "#7c4dff" },
  { table: "mst_material_group", label: "Material Categories", area: "Materials", page: "material_category_inq.html", color: "#ff8a00" },
  { table: "mst_bom", label: "BOM Headers", area: "Production", page: "bominq.html", color: "#d93072" },
  { table: "mst_bom_items", label: "BOM Items", area: "Production", page: "bominq.html", color: "#9c27b0" },
  { table: "mst_warehouse", label: "Warehouses", area: "Inventory", page: "warehouseinq.html", color: "#2e7d32" },
  { table: "mst_uom", label: "UOM", area: "Controls", page: "uominq.html", color: "#546e7a" },
  { table: "mst_currency", label: "Currencies", area: "Finance", page: "currencyinq.html", color: "#fbbc04" },
  { table: "mst_tax", label: "Taxes", area: "Finance", page: "taxinq.html", color: "#e53935" },
  { table: "mst_payment_terms", label: "Payment Terms", area: "Finance", page: "payment_terms_inq.html", color: "#5e35b1" },
  { table: "mst_gl_account", label: "GL Accounts", area: "Finance", page: "", color: "#3949ab" }
];

$(document).ready(function () {
  isUserLoggedIn();
  buildMenu();
  setUsrName();
  refreshDashboard();
});

function getAuthHeaders() {
  var token = sessionStorage.getItem("TOKEN");
  if (!token) {
    return {};
  }
  return { Authorization: "Bearer " + token };
}

function refreshDashboard() {
  $("#lastUpdated").text(" Loading...");
  $("#masterCards").html("");
  $("#readinessList").html("");

  var requests = _.map(MASTER_TABLES, function (item) {
    return fetchMasterStats(item);
  });

  Promise.all(requests)
    .then(function (stats) {
      masterStats = stats;
      renderDashboard();
    })
    .catch(function () {
      showErrorDialog("Unable to load master data dashboard statistics.");
    });
}

function fetchMasterStats(master) {
  return Promise.all([
    getMasterCount(master.table, ""),
    getMasterCount(master.table, "Y"),
    getMasterCount(master.table, "N")
  ]).then(function (counts) {
    return $.extend({}, master, {
      total: counts[0],
      active: counts[1],
      inactive: counts[2],
      failed: false
    });
  }).catch(function () {
    return $.extend({}, master, {
      total: 0,
      active: 0,
      inactive: 0,
      failed: true
    });
  });
}

function getMasterCount(tableName, activeFlag) {
  var params = {
    page: 1,
    limit: 1
  };

  if (activeFlag) {
    params.is_active = activeFlag;
  }

  return $.ajax({
    type: "GET",
    url: request_url + "/api/v1/" + tableName + "?" + $.param(params),
    headers: getAuthHeaders(),
    contentType: "application/json"
  }).then(function (res) {
    return Number(res && res.total ? res.total : 0);
  }, function (xhr) {
    if (xhr && xhr.status === 401) {
      showWarningDialog("Session expired. Please login again.");
      setTimeout(function () {
        location.href = "../../index.html";
      }, 500);
    }
    return 0;
  });
}

function renderDashboard() {
  var totals = getDashboardTotals(masterStats);

  $("#totalRecords").text(formatNumber(totals.total));
  $("#activeRecords").text(formatNumber(totals.active));
  $("#inactiveRecords").text(formatNumber(totals.inactive));
  $("#mastersCovered").text(masterStats.length);
  $("#lastUpdated").text(" Updated " + new Date().toLocaleString());

  renderMasterCards(masterStats);
  renderReadiness(masterStats);
  renderCharts(masterStats, totals);
}

function getDashboardTotals(stats) {
  return {
    total: sumBy(stats, "total"),
    active: sumBy(stats, "active"),
    inactive: sumBy(stats, "inactive")
  };
}

function sumBy(rows, key) {
  return _.reduce(rows || [], function (memo, item) {
    return memo + Number(item[key] || 0);
  }, 0);
}

function renderMasterCards(stats) {
  var html = "";

  _.each(stats, function (item) {
    var activePercent = item.total > 0 ? Math.round((item.active / item.total) * 100) : 0;
    var clickAttr = item.page ? ' onclick="openMasterPage(\'' + item.page + '\')"' : "";

    html += '<div class="md-card md-master-card"' + clickAttr + '>';
    html += '  <div class="md-master-top">';
    html += '    <div>';
    html += '      <div class="md-master-name">' + item.label + '</div>';
    html += '      <div class="md-master-meta">' + item.area + '</div>';
    html += '    </div>';
    html += '    <div class="md-master-count">' + formatNumber(item.total) + '</div>';
    html += '  </div>';
    html += '  <div class="md-master-meta"><span class="md-status-dot md-dot-green"></span>' + formatNumber(item.active) + ' active&nbsp;&nbsp;<span class="md-status-dot md-dot-red"></span>' + formatNumber(item.inactive) + ' inactive</div>';
    html += '  <div class="md-progress"><div class="md-progress-bar" style="width:' + activePercent + '%; background:' + item.color + ';"></div></div>';
    html += '  <div class="md-master-meta">' + activePercent + '% active readiness</div>';
    html += '</div>';
  });

  $("#masterCards").html(html);
}

function renderReadiness(stats) {
  var sorted = _.sortBy(stats, function (item) {
    return item.total > 0 ? -(item.active / item.total) : 0;
  });
  var html = '<table style="width:100%;" class="dataTbl">';
  html += '<tr><th width="42%">Master</th><th width="18%">Total</th><th width="20%">Active</th><th width="20%">Inactive</th></tr>';

  _.each(sorted, function (item) {
    html += '<tr>';
    html += '<td><b>' + item.label + '</b><br><span style="color:#6c7a89;font-size:11px;">' + item.area + '</span></td>';
    html += '<td>' + formatNumber(item.total) + '</td>';
    html += '<td>' + formatNumber(item.active) + '</td>';
    html += '<td>' + formatNumber(item.inactive) + '</td>';
    html += '</tr>';
  });

  html += '</table>';
  $("#readinessList").html(html);
}

function renderCharts(stats, totals) {
  destroyCharts();
  renderRecordsByMasterChart(stats);
  renderStatusSplitChart(totals);
  renderAreaSplitChart(stats);
}

function renderRecordsByMasterChart(stats) {
  var ctx = document.getElementById("recordsByMasterChart").getContext("2d");

  dashboardCharts.recordsByMaster = new Chart(ctx, {
    type: "bar",
    data: {
      labels: _.pluck(stats, "label"),
      datasets: [
        {
          label: "Active",
          data: _.pluck(stats, "active"),
          backgroundColor: "#1a73e8"
        },
        {
          label: "Inactive",
          data: _.pluck(stats, "inactive"),
          backgroundColor: "#e53935"
        }
      ]
    },
    options: getBarOptions(true)
  });
}

function renderStatusSplitChart(totals) {
  var ctx = document.getElementById("statusSplitChart").getContext("2d");

  dashboardCharts.statusSplit = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Active", "Inactive"],
      datasets: [{
        data: [totals.active, totals.inactive],
        backgroundColor: ["#03a106", "#e53935"],
        borderWidth: 0
      }]
    },
    options: getDoughnutOptions()
  });
}

function renderAreaSplitChart(stats) {
  var grouped = _.groupBy(stats, "area");
  var labels = _.keys(grouped);
  var values = _.map(labels, function (label) {
    return sumBy(grouped[label], "total");
  });

  var ctx = document.getElementById("areaSplitChart").getContext("2d");

  dashboardCharts.areaSplit = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Records",
        data: values,
        backgroundColor: ["#1a73e8", "#00a88f", "#7c4dff", "#ff8a00", "#2e7d32", "#5e35b1", "#3949ab"]
      }]
    },
    options: getBarOptions(false)
  });
}

function getBarOptions(stacked) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "bottom"
      }
    },
    scales: {
      x: {
        stacked: !!stacked,
        ticks: {
          autoSkip: false,
          maxRotation: 45,
          minRotation: 0
        }
      },
      y: {
        stacked: !!stacked,
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };
}

function getDoughnutOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: {
      legend: {
        display: true,
        position: "bottom"
      }
    }
  };
}

function destroyCharts() {
  _.each(dashboardCharts, function (chart) {
    if (chart && chart.destroy) {
      chart.destroy();
    }
  });
  dashboardCharts = {};
}

function openMasterPage(pageName) {
  if (!pageName) return;
  location.href = pageName;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}
