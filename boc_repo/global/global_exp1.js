var userName;
var menuOpen = false;
var myPage;
var parentFeatures;
var menuTemplateHtml;
$(function() {


});


function isUserLoggedIn(){
	var userId = sessionStorage.getItem("USER_ID");
	var userName = sessionStorage.getItem("USERNAME");
	
	if(userName == null || userName == "" || userName == undefined){
		location.href = "../index.html";		
	}
	if(userId == null || userId == "" || userId == undefined){
		location.href = "../index.html";
	}	
	
}

function collapseMenu() {
    var menu_scale = sessionStorage.getItem("MENU_COLLAPSE");

    if (!menu_scale) {
        menu_scale = "FULL";
        sessionStorage.setItem("MENU_COLLAPSE", "FULL");
    }

    if (menu_scale == "FULL") {
        $('.sideMenuDivCol').fadeOut(100, function() {
            $('.mainDiv').removeClass('col-md-10').addClass('col-md-12');
			$('.sectionDiv').css('margin-left', '10px');
			$('.sectionDivHead').css('margin-left', '10px');
        });
        sessionStorage.setItem("MENU_COLLAPSE", "COLLAPSED");

    } else if (menu_scale == "COLLAPSED") {
        // Expand sidebar
        $('.sideMenuDivCol').fadeIn(100, function() {
            $('.mainDiv').removeClass('col-md-12').addClass('col-md-10');
			$('.sectionDiv').css('margin-left', '0');
			$('.sectionDivHead').css('margin-left', '0');
        });
        sessionStorage.setItem("MENU_COLLAPSE", "FULL");
    }
}


function userLogin() {
	var id = sessionStorage.getItem("USER_ID")
	if(id != null && id != "" && id != undefined){
			alert("User already logged in!");
			location.href = "pages/home.html"
		}else{
	
				var jsonData ={
			        username: $("#username").val(),
			        password: $("#password").val()
			    }
	
				
			  postURL = request_url + "/auth/login";
				
			    $.ajax({
			        type: "POST",
			        url: postURL,
			        data: JSON.stringify(jsonData),
			        contentType: "application/json",
					/*beforeSend: function() {
					  $(".wrapper").removeClass("hide");
					  $(".loader").removeClass("hide");
					},*/
			        success: onUserLoginSuccess,
			        error: onUserLoginErr,
					
					/*complete: function() {
						$(".loader").addClass("hide");
						$(".wrapper").addClass("hide");
					}*/
			    });
		}

}

function onUserLoginSuccess(response) {
	var user = response && response.user ? response.user : response;
	sessionStorage.setItem("TOKEN", response && response.token ? response.token : "");
	sessionStorage.setItem("USER_ID", user && user.user_id ? user.user_id : "");
	sessionStorage.setItem("USERNAME", user && user.username ? user.username : "");
	sessionStorage.setItem("FULL_NAME", user && user.full_name ? user.full_name : (user && user.username ? user.username : ""));
	sessionStorage.setItem("ROLE_NAME", user && user.role_name ? user.role_name : "User");
	sessionStorage.setItem("PROFILE_PICTURE", response && response.profile_picture ? response.profile_picture : "https://lms-imgs.s3.ap-south-1.amazonaws.com/default-profilepic.jpg");

	loadLoginFeatures();
}

function loadLoginFeatures() {
	$.ajax({
		type: "GET",
		url: request_url + "/feature/getFeature",
		headers: getAuthHeaders(),
		contentType: "application/json",
		success: function(features) {
			if (!Array.isArray(features)) {
				showWarningDialog("Menu features were not returned correctly. Please login again.");
				return;
			}

			parentFeatures = buildFeatureTree(features);
			sessionStorage.setItem("FEATURES", JSON.stringify(parentFeatures));
			location.href = "pages/home.html";
		},
		error: function(xhr) {
			var message = "Unable to load menu features. Please login again.";
			if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
				message = xhr.responseJSON.error;
			}
			showWarningDialog(message);
		}
	});
}

function buildFeatureTree(features) {
	_.each(features, function(item){
		item.feature_name = (item.feature_name || "").toLowerCase();
		
		if(item.parent_feature_id != null && item.parent_feature_id != undefined && item.parent_feature_id != ""){
			item.isParentFeature = 'N';	
		}else{
			item.isParentFeature = 'Y';
			item.childFeatures = [];
		}
	});

	var childFeatures = _.reject(features, function(item){
		return item.isParentFeature == 'Y';
	});

	var parentFeatureList = _.reject(features, function(item){
		return item.isParentFeature == 'N';
	});

	_.each(parentFeatureList, function(pitem){
		_.each(childFeatures, function(citem){
			if(pitem.id == citem.parent_feature_id){
				pitem.childFeatures.push(citem);
			}
		});
	});

	var sortedData = _.sortBy(_.map(parentFeatureList, function(item) {
		item.childFeatures = _.sortBy(item.childFeatures || [], 'display_sequence');
		return item;
	}), 'display_sequence');

	//return parentFeatureList;
	return sortedData;
}

function onUserLoginErr(xhr){
	var message = "Invalid username or password. Please try again.";
	if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
		message = xhr.responseJSON.error;
	}
	showWarningDialog(message);
	$(".loader").addClass("hide");
	$(".wrapper").addClass("hide");
}
/*
function userLogout(){
	sessionStorage.removeItem("USER_ID");
	sessionStorage.setItem("USERNAME","Guest");
	location.reload();
} */

//-------------------------------LOGIN END----------------------------------------


function getAuthHeaders(){
	var token = sessionStorage.getItem("TOKEN");
	if (!token) {
		return {};
	}
	return { Authorization: "Bearer " + token };
}

function getAPIdata(strURL){
	
return JSON.parse($.ajax({
		global:false,
		async:false,
	    type: "GET",
	    url: strURL,
		headers: getAuthHeaders(),
	    contentType: "application/json",
		success: function(data) {
		   return data;
		},
		error: err
	 }).responseText)
}


function err(){
	showSystemError("A system error occurred. Please contact support.");
}


function getJSONData(strURL) {
  return $.ajax({
    type: "GET",
    url: strURL,
	headers: getAuthHeaders(),
    contentType: "application/json",
  })
  .then(function(data) {
    return data; // Resolve the Promise with the data
  })
  .fail(function(jqXHR, textStatus, errorThrown) {
    console.error("Error fetching data: ", textStatus, errorThrown);
    throw new Error("Request failed: " + textStatus + " - " + errorThrown); // Reject the Promise with an error
  });
}

/*getJSONData(strURL)
  .then(myData => {
    console.log('Data received:', myData);
	usrData = myData;
	
	$("#listContainer2").html(_.template(userTemplate, usrData));
	$('#listContainer2').trigger("create");			
	
  })
  .catch(error => {
    console.error('Error:', error.message);
  });*/
function setUsrName(){
	var userName = sessionStorage.getItem("USERNAME");
	var profile_picture = sessionStorage.getItem("PROFILE_PICTURE");

	if(userName != "" && userName != null && userName != undefined){
		$("#userName").html(userName);
	}

	if(profile_picture != "" && profile_picture != null && profile_picture != undefined){
		$("#profilePicture").attr("src", profile_picture);
	}else{
		$("#profilePicture").attr("src", "https://lms-imgs.s3.ap-south-1.amazonaws.com/default-profilepic.jpg");
	}
}

function functionLogout(){
	sessionStorage.clear();
	localStorage.clear();
	location.href = "/boc_repo/index.html"
}






function serverRefresh(){
	location.reload(true);
}


function buildMenu(){
	
	/*features = _.groupBy(features, "id")
	
	features = _.map(features, function(item) {
	    return {
	        id: item[0].id,
	        feature_name: item[0].feature_name,
			feature_description: item[0].feature_description,
			display_sequence: item[0].display_sequence,
			icon: item[0].icon,
			
	    };
	});*/
	
	
	parentFeatures = getStoredFeatureTree();
	renderFeatureMenu(parentFeatures);
	setupFeatureSearch();

	//console.log(JSON.stringify(parentFeatures));
	
}

function getStoredFeatureTree() {
	var features = [];
	var featuresText = sessionStorage.getItem('FEATURES');

	if (featuresText != null && featuresText != "" && featuresText != undefined) {
		try {
			features = JSON.parse(featuresText) || [];
		} catch (e) {
			features = [];
		}
	}

	return features;
}

function renderFeatureMenu(features) {
	if ($("#menuContainer").length == 0) {
		return;
	}

	if (!menuTemplateHtml) {
		menuTemplateHtml = $("#menuTmpl").html();
	}

	if (!menuTemplateHtml) {
		return;
	}

	parentFeatures = features || [];
	var template = _.template(menuTemplateHtml);
	$("#menuContainer").html(template({ parentFeatures: parentFeatures }));
	$('#menuContainer').trigger("create");
	applyActiveMenuState();
}

function applyActiveMenuState() {
	var currentPath = normalizeMenuPath(location.pathname);

	$("#menuContainer tr").removeClass("active-menu-row active-parent-menu-row");
	$("#menuContainer td").removeClass("active-menu-cell");

	$("#menuContainer tr").each(function() {
		var row = $(this);
		var rowUrl = getMenuRowUrl(row);

		if (rowUrl != "" && menuUrlMatchesCurrentPage(rowUrl, currentPath)) {
			row.addClass("active-menu-row");
			row.find("td").addClass("active-menu-cell");
			markNearestParentMenu(row);
			return false;
		}
	});
}

function getMenuRowUrl(row) {
	var rowUrl = "";

	row.find("td").each(function() {
		var clickText = $(this).attr("onclick") || "";
		var match = clickText.match(/linkPage\(['"]([^'"]+)['"]\)/);
		if (match && match[1]) {
			rowUrl = match[1];
			return false;
		}
	});

	return rowUrl;
}

function menuUrlMatchesCurrentPage(menuUrl, currentPath) {
	var menuPath = normalizeMenuPath(menuUrl);

	if (!menuPath || !currentPath) {
		return false;
	}

	if (currentPath === menuPath || currentPath.endsWith("/" + menuPath)) {
		return true;
	}

	return menuPageFamilyMatches(menuPath, currentPath);
}

function normalizeMenuPath(url) {
	var normalizedUrl = String(url || "").replace(/\\/g, "/").split("?")[0].split("#")[0].toLowerCase();
	var pagesIndex = normalizedUrl.indexOf("/pages/");

	if (pagesIndex !== -1) {
		normalizedUrl = normalizedUrl.substring(pagesIndex + 1);
	}

	normalizedUrl = normalizedUrl.replace(/^\/+/, "");

	while (normalizedUrl.indexOf("../") === 0) {
		normalizedUrl = normalizedUrl.substring(3);
	}

	return normalizedUrl;
}

function menuPageFamilyMatches(menuPath, currentPath) {
	var menuFamily = getMenuPageFamily(menuPath);
	var currentFamily = getMenuPageFamily(currentPath);

	if (!menuFamily || !currentFamily || menuFamily.name !== currentFamily.name) {
		return false;
	}

	if (menuFamily.directory && currentFamily.directory) {
		return menuFamily.directory === currentFamily.directory || currentFamily.directory.endsWith("/" + menuFamily.directory);
	}

	return true;
}

function getMenuPageFamily(path) {
	var cleanPath = normalizeMenuPath(path);
	var parts = cleanPath.split("/");
	var fileName = parts.pop() || "";
	var directory = parts.join("/");
	var pageName = fileName.replace(/\.html?$/i, "");

	if (!pageName) {
		return null;
	}

	pageName = pageName
		.replace(/_?(add|edit)$/i, "")
		.replace(/_?(inq|inquiry)$/i, "")
		.replace(/[^a-z0-9]/gi, "")
		.toLowerCase();

	if (!pageName) {
		return null;
	}

	return {
		directory: directory,
		name: pageName
	};
}

function markNearestParentMenu(activeRow) {
	var parentTable = activeRow.closest("table");
	var firstRow = parentTable.find("tr").first();

	if (firstRow.length && !firstRow.is(activeRow)) {
		firstRow.addClass("active-parent-menu-row");
	}
}

function setupFeatureSearch() {
	var featureSearch = $("#featureSearch");

	if (featureSearch.length == 0 || typeof featureSearch.autocomplete !== "function") {
		return;
	}

	if (featureSearch.data("ui-autocomplete")) {
		featureSearch.autocomplete("destroy");
	}

	featureSearch.off(".featureSearch");

	featureSearch.autocomplete({
		minLength: 0,
		delay: 100,
		source: function(request, response) {
			response(getMatchingFeatureSearchItems(request.term));
		},
		focus: function(event, ui) {
			featureSearch.val(ui.item.label);
			return false;
		},
		select: function(event, ui) {
			featureSearch.val(ui.item.label);
			filterFeatureMenu(ui.item.name || ui.item.label);
			if (ui.item.url) {
				linkPage(ui.item.url);
			}
			return false;
		}
	});

	featureSearch.on("focus.featureSearch", function() {
		$(this).autocomplete("search", $(this).val());
	});

	featureSearch.on("input.featureSearch", function() {
		filterFeatureMenu($(this).val());
	});

	featureSearch.on("keydown.featureSearch", function(event) {
		if (event.keyCode == 13) {
			var matches = getMatchingFeatureSearchItems($(this).val());
			if (matches.length > 0 && matches[0].url) {
				event.preventDefault();
				linkPage(matches[0].url);
			}
		}
	});
}

function getFeatureSearchItems() {
	var features = getStoredFeatureTree();
	var searchItems = [];

	_.each(features, function(item) {
		addFeatureSearchItem(searchItems, item, null);

		_.each(item.childFeatures || [], function(childItem) {
			addFeatureSearchItem(searchItems, childItem, item);
		});
	});

	return _.sortBy(searchItems, function(item) {
		return item.label;
	});
}

function addFeatureSearchItem(searchItems, item, parentItem) {
	if (!item || !item.feature_name) {
		return;
	}

	var label = parentItem && parentItem.feature_name ? parentItem.feature_name + " / " + item.feature_name : item.feature_name;

	searchItems.push({
		label: label,
		value: label,
		name: item.feature_name || "",
		description: item.feature_description || "",
		url: item.feature_url || ""
	});
}

function getMatchingFeatureSearchItems(searchText) {
	var searchTerm = normalizeFeatureSearchText(searchText);
	var searchItems = getFeatureSearchItems();

	if (!searchTerm) {
		return searchItems.slice(0, 12);
	}

	return _.filter(searchItems, function(item) {
		var searchableText = normalizeFeatureSearchText(item.label + " " + item.description + " " + item.url);
		return searchableText.indexOf(searchTerm) !== -1;
	}).slice(0, 12);
}

function filterFeatureMenu(searchText) {
	var features = getStoredFeatureTree();
	var searchTerm = normalizeFeatureSearchText(searchText);

	if (!searchTerm) {
		renderFeatureMenu(features);
		return;
	}

	renderFeatureMenu(getFilteredFeatureTree(features, searchTerm));
}

function getFilteredFeatureTree(features, searchTerm) {
	var filteredFeatures = [];

	_.each(features || [], function(item) {
		var parentMatches = featureMatchesSearch(item, searchTerm);
		var childFeatures = item.childFeatures || [];
		var matchingChildren = _.filter(childFeatures, function(childItem) {
			return featureMatchesSearch(childItem, searchTerm);
		});

		if (parentMatches || matchingChildren.length > 0) {
			var filteredItem = $.extend({}, item);
			filteredItem.childFeatures = parentMatches ? childFeatures : matchingChildren;
			filteredFeatures.push(filteredItem);
		}
	});

	return filteredFeatures;
}

function featureMatchesSearch(item, searchTerm) {
	var searchableText = normalizeFeatureSearchText(
		(item.feature_name || "") + " " +
		(item.feature_description || "") + " " +
		(item.feature_url || "")
	);

	return searchableText.indexOf(searchTerm) !== -1;
}

function normalizeFeatureSearchText(value) {
	return $.trim(String(value || "").toLowerCase());
}

function setupApiAutocompleteList(strURL, fieldConfigs) {
	if (!strURL || !fieldConfigs || typeof $.fn.autocomplete !== "function") {
		return;
	}

	var rows = [];

	try {
		rows = getAPIdata(strURL);
	} catch (e) {
		console.error("Autocomplete data load failed:", e);
		rows = [];
	}

	if (rows && rows.data) {
		rows = rows.data;
	}

	_.each(fieldConfigs, function(config) {
		var itemList = buildApiAutocompleteItems(rows || [], config.valueField || config.valueFields, config.idField);
		setupAutocompleteField(config.selector, config.hiddenSelector, itemList);
	});
}

function buildApiAutocompleteItems(rows, valueFields, idField) {
	var fields = $.isArray(valueFields) ? valueFields : [valueFields];
	var itemList = [];
	var seen = {};

	_.each(rows || [], function(row) {
		var value = getAutocompleteDisplayValue(row, fields);
		var key = normalizeFeatureSearchText(value);

		if (!value || seen[key]) {
			return;
		}

		seen[key] = true;
		itemList.push({
			label: value,
			value: value,
			id: row && idField ? row[idField] : null
		});
	});

	return itemList;
}

function getAutocompleteDisplayValue(row, fields) {
	var parts = [];

	_.each(fields || [], function(field) {
		var value = row && row[field] != null ? $.trim(String(row[field])) : "";
		if (value) {
			parts.push(value);
		}
	});

	return parts.join(" ");
}

function setupAutocompleteField(inputSelector, hiddenSelector, itemList) {
	var input = $(inputSelector);

	if (input.length == 0) {
		return;
	}

	var hiddenInput = getAutocompleteHiddenInput(input, hiddenSelector);

	if (input.data("ui-autocomplete")) {
		input.autocomplete("destroy");
	}

	input.attr("autocomplete", "off");
	input.autocomplete({
		source: itemList || [],
		minLength: 0,
		focus: function() {
			return false;
		},
		select: function(event, ui) {
			input.val(ui.item.value);
			hiddenInput.val(ui.item.id || "");
			return false;
		},
		change: function(event, ui) {
			if (ui.item == null || ui.item == undefined) {
				input.val("");
				hiddenInput.val("");
			}
		}
	});

	input.off("focus.apiAutocomplete").on("focus.apiAutocomplete", function() {
		$(this).autocomplete("search", $(this).val());
	});

	input.off("input.apiAutocomplete").on("input.apiAutocomplete", function() {
		hiddenInput.val("");
	});
}

function getAutocompleteHiddenInput(input, hiddenSelector) {
	if (hiddenSelector && $(hiddenSelector).length > 0) {
		return $(hiddenSelector);
	}

	var inputId = input.attr("id");
	var hiddenId = hiddenSelector ? hiddenSelector.replace(/^#/, "") : inputId + "Id";

	if ($("#" + hiddenId).length == 0) {
		input.after('<input type="hidden" id="' + hiddenId + '" name="' + hiddenId + '">');
	}

	return $("#" + hiddenId);
}

/*function capitalizeWords(str) {
    return str.replace(/\b\w/g, function(char) {
        return char.toUpperCase();
    });
}*/

function linkPage(url){
	if(url != "" && url != null && url != undefined){
		location.href = url;
	}
}

function showSuccessDialog(message, onOk) {
const dialogHtml = `
  <div id="successDialog" title="" style="display:none;">
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="
        width:50px;
        height:50px;
        border-radius:50%;
        background:#28a745;
        display:flex;
        align-items:center;
        justify-content:center;
        color:white;
        font-size:28px;
        flex-shrink:0;
      "><i class="material-icons " style="font-size:40px; color:white;">check</i></div>
      <div style="font-size:16px;color:#155724;">${message}</div>
    </div>
  </div>
`;


  $("body").append(dialogHtml);

  $("#successDialog").dialog({
    modal: true,
    buttons: {
      "OK": function () {
        $(this).dialog("close").remove();
        if (typeof onOk === "function") {
          onOk();
        }
      }
    },
    open: function () {
      $(this).parent().find(".ui-dialog-titlebar").hide(); // hide title

		      // Style the OK button
      $(".ui-dialog-buttonpane button")
        .css({
          "background-color": "#007bff",
          "color": "#fff",
          "border": "none",
          "padding": "8px 16px",
          "border-radius": "4px",
          "cursor": "pointer",
          "outline": "none"
        })
        .hover(function () {
          $(this).css("background-color", "#0056b3");
        }, function () {
          $(this).css("background-color", "#007bff");
        });

    },

    close: function() {
      $(this).remove();
    }
  });
}



function showErrorDialog(message) {
  // remove if already exists
  $("#errorDialog").remove();

  // create dialog HTML dynamically
let dialogHtml = `<div id="errorDialog" style="display:flex;align-items:center;padding:20px;"><div style="width:60px;height:60px;border-radius:50%;background-color:#dc3545;display:flex;align-items:center;justify-content:center;margin-right:15px;"><span style="color:white;font-size:32px;">&#10006;</span></div><div style="font-size:16px;color:#721c24;">${message}</div></div>`;


  $("body").append(dialogHtml);

  // initialize jQuery UI dialog without title
  $("#errorDialog").dialog({
    modal: true,
    resizable: false,
    draggable: false,
    width: 400,
    dialogClass: "no-titlebar",
    buttons: {
      OK: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      $(this).parent().find(".ui-dialog-titlebar").hide(); // hide title

		      // Style the OK button
      $(".ui-dialog-buttonpane button")
        .css({
          "background-color": "#007bff",
          "color": "#fff",
          "border": "none",
          "padding": "8px 16px",
          "border-radius": "4px",
          "cursor": "pointer",
          "outline": "none"
        })
        .hover(function () {
          $(this).css("background-color", "#0056b3");
        }, function () {
          $(this).css("background-color", "#007bff");
        });

    },
    close: function () {
      $(this).remove(); // clean up
    }
  });
}




function showWarningDialog(message) {
  // remove if already exists
  $("#warningDialog").remove();

  // create dialog HTML dynamically
let dialogHtml = `
  <div id="warningDialog" style="display:flex; align-items:center; background:#fff3cd; border:1px solid #ffeeba; padding:15px; border-radius:8px; font-size:16px; color:#856404;">
    <div style="width:0; height:0; border-left:15px solid transparent; border-right:15px solid transparent; border-bottom:25px solid #ffc107; position:relative; margin-right:12px;">
      <span style="position:absolute; top:6px; left:50%; transform:translateX(-50%); font-size:16px; font-weight:bold; color:#856404;">!</span>
    </div>
    <div>${message}</div>
  </div>
`;


  $("body").append(dialogHtml);

  // initialize jQuery UI dialog without title
  $("#warningDialog").dialog({
    modal: true,
    resizable: false,
    draggable: false,
    width: 400,
    dialogClass: "no-titlebar",
    buttons: {
      OK: function () {
        $(this).dialog("close");
      }
    },
    open: function () {
      $(this).parent().find(".ui-dialog-titlebar").hide(); // hide title

      // Style the OK button
      $(".ui-dialog-buttonpane button")
        .css({
          "background-color": "#007bff",
          "color": "#fff",
          "border": "none",
          "padding": "8px 16px",
          "border-radius": "4px",
          "cursor": "pointer",
          "outline": "none"
        })
        .hover(function () {
          $(this).css("background-color", "#0056b3");
        }, function () {
          $(this).css("background-color", "#007bff");
        });
    },
    close: function () {
      $(this).remove(); // clean up
    }
  });
}


function showSystemError(message) {
  // Remove existing dialog if open
  if ($("#systemErrorDialog").length) {
    $("#systemErrorDialog").remove();
  }

  // Create dialog HTML
  const dialogHtml = `
    <div id="systemErrorDialog" title="" style="display:none;">
      <div style="
        display:flex; 
        align-items:center; 
        color:#721c24; 
        padding:20px; 
        border-radius:10px;">

        <div style="font-size:40px; margin-right:15px;"><i class="material-icons mt-3" style="font-size:40px;">desktop_access_disabled</i></div>
        <div style="font-size:16px; font-weight:500;">${message}</div>
      </div>
    </div>
  `;

  $("body").append(dialogHtml);

  // Initialize jQuery UI dialog
  $("#systemErrorDialog").dialog({
    modal: true,
    width: 400,
    buttons: {
      "OK": function() {
        $(this).dialog("close");
      }
    },
    open: function() {
      // Style OK button
$(this).parent().find(".ui-dialog-titlebar").hide(); // hide title

      $(".ui-dialog-buttonpane button")
        .css({
          "background": "#007bff",
          "color": "#fff",
          "border": "none",
          "padding": "6px 12px",
          "border-radius": "5px",
          "outline": "none",
          "cursor": "pointer"
        })
        .hover(
          function() { $(this).css("background", "#0056b3"); },
          function() { $(this).css("background", "#007bff"); }
        );
    }
  });
}





function showConfirmDialog(message, onConfirm) {
  // Remove old dialog if exists
  if ($("#confirmDialog").length) {
    $("#confirmDialog").remove();
  }

  // Create dialog HTML
 const dialogHtml = `
  <div id="confirmDialog" title="" style="display:none;">
    <div style="
      display: flex;
      align-items: center;
      gap: 10px;
    ">
      <!-- Triangle with ! -->
      <div style="
        width: 0;
        height: 0;
        border-left: 20px solid transparent;
        border-right: 20px solid transparent;
        border-bottom: 35px solid #ffc107;
        position: relative;
      ">
        <span style="
          position: absolute;
          top: 8px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 18px;
          font-weight: bold;
          color:#721c24;
        ">!</span>
      </div>

      <!-- Message -->
      <div style="font-size: 16px; color:#721c24;">
        ${message}
      </div>
    </div>
  </div>
`;

  
  $("body").append(dialogHtml);

  // Initialize jQuery UI dialog
  $("#confirmDialog").dialog({
    modal: true,
    width: 350,
    buttons: {
      "Yes": function() {
        $(this).dialog("close");
        if (typeof onConfirm === "function") onConfirm();
      },
      "No": function() {
        $(this).dialog("close");
      }
    },
    open: function() {
      // Style buttons

	  $(this).parent().find(".ui-dialog-titlebar").hide(); // hide title

      $(".ui-dialog-buttonpane button")
        .css({
          "background": "#007bff",
          "color": "#fff",
          "border": "none",
          "padding": "6px 12px",
          "border-radius": "5px",
          "outline": "none",
          "cursor": "pointer"
        })
        .hover(
          function() { $(this).css("background", "#0056b3"); },
          function() { $(this).css("background", "#007bff"); }
        );
    }
  });
}

