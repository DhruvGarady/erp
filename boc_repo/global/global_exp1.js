var userName;
var menuOpen = false;
var myPage;
var parentFeatures;
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
			location.href = "_webpages/home.html"
		}else{
	
				var jsonData ={
			        username: $("#username").val(),
			        password_hash: $("#password").val()
			    }
	
				
			  postURL = request_url + "/user/login";
				
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
		//alert("Login Successful.")
	    sessionStorage.setItem("USER_ID", response.user_id);
		sessionStorage.setItem("USERNAME",response.username);
		sessionStorage.setItem("PROFILE_PICTURE", response.profile_picture || "https://lms-imgs.s3.ap-south-1.amazonaws.com/default-profilepic.jpg");

		location.href = "_webpages/home.html";
}

function onUserLoginErr(){
	showWarningDialog("Invalid username or password. Please try again.");
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


function getAPIdata(strURL){
	
return JSON.parse($.ajax({
		global:false,
		async:false,
	    type: "GET",
	    url: strURL,
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
	location.href = "../index.html"
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
	
	
	parentFeatures = JSON.parse(sessionStorage.getItem('FEATURES'));
	var menuTemplate = $("#menuTmpl").html();
	

	$("#menuContainer").html(_.template(menuTemplate, parentFeatures));
	$('#menuContainer').trigger("create");

	//console.log(JSON.stringify(parentFeatures)); 
	
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

