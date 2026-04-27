var parentFeatures;
$(function(){
	
	sessionStorage.setItem("MENU_COLLAPSE","FULL")


})

function openRegisterDialog() {
  $("#registerDialog").dialog({
    modal: true,
    width: 400,
    buttons: {
      "Register": function () {
        registerUser();
      },
      "Cancel": function () {
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




function registerUser() {

    //$(".searchButton").prop("disabled", true);

    var formData = new FormData();

    // Basic registration fields
    formData.append("first_name", $("#first_name").val());
    formData.append("last_name", $("#last_name").val());
    formData.append("email", $("#email").val());
    formData.append("username", $("#reg_username").val());
    formData.append("password", $("#reg_password").val());  // match backend (not password_hash)

    // Append profile picture if selected
    var file = $("#profile_picture")[0].files[0];
    if (file) {
        formData.append("profile_picture", file);
    }

    var strURL = request_url + "/user/register";

    $.ajax({
        type: "POST",
        url: strURL,
        data: formData,
        processData: false,  // prevent jQuery from processing data
        contentType: false,  // prevent jQuery from setting contentType
        beforeSend: function () {
            $(".wrapper").removeClass("hide");
            $(".loader").removeClass("hide");
        },
        success: onRegisterSuccess,
        error: onRegisterErr,
        complete: function () {
            $(".loader").addClass("hide");
            $(".wrapper").addClass("hide");
        }
    });
}

function onRegisterSuccess(res) {
    showSuccessDialog("Registration successful! Please check your email to activate your account.", function() {
        // after OK is pressed → maybe redirect to login page
        location.href = "index.html";
    });
}

function onRegisterErr(err) {
    showErrorDialog("There was a problem registering your account.");
    console.error("Error:", err);
}


