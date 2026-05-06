var parentFeatures;

$(function() {
    sessionStorage.setItem("MENU_COLLAPSE", "FULL");
});

function openRegisterDialog() {
    $("#registerDialog").dialog({
        modal: true,
        width: 520,
        dialogClass: "coreflow-register-dialog",
        buttons: {
            "Create User": function() {
                registerUser();
            },
            "Cancel": function() {
                $(this).dialog("close");
            }
        },
        open: function() {
            $(this).parent().find(".ui-dialog-titlebar").hide();

            var buttons = $(this).parent().find(".ui-dialog-buttonpane button");

            buttons.css({
                "border": "none",
                "padding": "8px 16px",
                "border-radius": "8px",
                "outline": "none",
                "cursor": "pointer",
                "font-weight": "700"
            });

            buttons.eq(0).css({
                "background": "#2072f3",
                "color": "#fff"
            });

            buttons.eq(1).css({
                "background": "#e9eef7",
                "color": "#24324d"
            });
        }
    });
}

function registerUser() {
    var form = $("#registerForm")[0];

    if (form && !form.checkValidity()) {
        form.reportValidity();
        return;
    }

    var jsonData = {
        first_name: $.trim($("#first_name").val()),
        last_name: $.trim($("#last_name").val()),
        email: $.trim($("#email").val()),
        username: $.trim($("#reg_username").val()),
        password: $("#reg_password").val()
    };

    $.ajax({
        type: "POST",
        url: request_url + "/user/register",
        data: JSON.stringify(jsonData),
        contentType: "application/json",
        beforeSend: function() {
            $(".wrapper").removeClass("hide");
            $(".loader").removeClass("hide");
        },
        success: onRegisterSuccess,
        error: onRegisterErr,
        complete: function() {
            $(".loader").addClass("hide");
            $(".wrapper").addClass("hide");
        }
    });
}

function onRegisterSuccess(res) {
    $("#registerDialog").dialog("close");
    $("#registerForm")[0].reset();

    showSuccessDialog("Registration successful. Please check your email to activate your account.", function() {
        location.href = "index.html";
    });
}

function onRegisterErr(xhr) {
    var message = "There was a problem registering your account.";

    if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
        message = xhr.responseJSON.error;
    }

    showErrorDialog(message);
    console.error("Error:", xhr);
}
