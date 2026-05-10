var userProfileDialogReady = false;

$(document).ready(function () {
  setupUserProfilePopup();
});

function setupUserProfilePopup() {
  $(document).off("click.userProfile", "#profilePicture").on("click.userProfile", "#profilePicture", function (event) {
    event.preventDefault();
    openUserProfileDialog();
  });

  $(document).off("click.userProfileMenu", ".dropdown-menu .dropdown-item").on("click.userProfileMenu", ".dropdown-menu .dropdown-item", function (event) {
    var itemText = $.trim($(this).text()).toLowerCase();
    var isProfileSettingsItem = $(this).hasClass("profile-settings-menu-item") || itemText.indexOf("profile") !== -1;

    if (isProfileSettingsItem) {
      event.preventDefault();
      openUserProfileDialog();
    }
  });

  $("#profilePicture").css("cursor", "pointer");
}

function openUserProfileDialog() {
  buildUserProfileDialog();
  fillProfileFromSession();
  loadUserProfileDetails();

  $("#userProfileDialog").dialog({
    modal: true,
    width: 640,
    resizable: false,
    draggable: false,
    dialogClass: "user-profile-dialog",
    open: function () {
      $(this).parent().find(".ui-dialog-titlebar").hide();
    },
    close: function () {
      clearUserProfilePasswordFields();
    }
  });
}

function buildUserProfileDialog() {
  if ($("#userProfileDialog").length > 0) {
    return;
  }

  var dialogHtml = `
    <div id="userProfileDialog" class="user-profile-dialog-content" style="display:none;">
      <div class="profile-settings-header">
        <div class="profile-settings-heading">
          <div class="profile-settings-avatar" id="profileSettingsAvatar">U</div>
          <div>
            <div class="profile-settings-title">Profile Settings</div>
            <div class="profile-settings-subtitle">Manage your account details and password.</div>
          </div>
        </div>
        <button type="button" class="profile-settings-close" onclick="closeUserProfileDialog()" aria-label="Close profile settings">
          <span class="material-icons">close</span>
        </button>
      </div>

      <ul class="nav nav-tabs profile-settings-tabs" role="tablist">
        <li class="nav-item">
          <a class="nav-link active show" id="profileBasicTabLink" data-toggle="tab" href="#profileBasicTab" role="tab">Basic Details</a>
        </li>
        <li class="nav-item">
          <a class="nav-link" id="profilePasswordTabLink" data-toggle="tab" href="#profilePasswordTab" role="tab">Password</a>
        </li>
      </ul>

      <div class="tab-content profile-settings-body">
        <div class="tab-pane fade active show" id="profileBasicTab" role="tabpanel">
          <div class="form-group">
            <label for="profile_full_name">Full Name</label>
            <input type="text" id="profile_full_name" name="profile_full_name">
          </div>

          <div class="form-group">
            <label for="profile_email">Email</label>
            <input type="email" id="profile_email" name="profile_email">
          </div>

          <div class="form-group">
            <label for="profile_username">User Name</label>
            <input type="text" id="profile_username" name="profile_username" disabled>
          </div>

          <div class="profile-settings-actions">
            <button type="button" class="searchButton bg-primary" onclick="saveUserProfileDetails()">
              <span class="material-icons">save</span>
              <span>Save</span>
            </button>
          </div>
        </div>

        <div class="tab-pane fade" id="profilePasswordTab" role="tabpanel">
          <div class="form-group">
            <label for="profile_password">Password</label>
            <input type="password" id="profile_password" name="profile_password">
          </div>

          <div class="form-group">
            <label for="profile_confirm_password">Re-enter Password</label>
            <input type="password" id="profile_confirm_password" name="profile_confirm_password">
          </div>

          <div class="profile-settings-actions profile-settings-actions-split">
            <button type="button" class="searchButton bg-primary" onclick="saveUserProfilePassword()">
              <span class="material-icons">save</span>
              <span>Save</span>
            </button>

            <div class="profile-reset-actions">
              <span class="profile-forgot-label">Forgot password?</span>
              <button type="button" class="searchButton" onclick="sendUserPasswordResetEmail()">
                <span class="material-icons">mail</span>
                <span>Reset Email</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  $("body").append(dialogHtml);
  userProfileDialogReady = true;
}

function closeUserProfileDialog() {
  if ($("#userProfileDialog").length > 0) {
    $("#userProfileDialog").dialog("close");
  }
}

function fillProfileFromSession() {
  var fullName = sessionStorage.getItem("FULL_NAME") || "";
  var email = sessionStorage.getItem("EMAIL") || "";
  var username = sessionStorage.getItem("USERNAME") || "";

  $("#profile_full_name").val(fullName);
  $("#profile_email").val(email);
  $("#profile_username").val(username);
  $("#profileSettingsAvatar").text(getUserProfileInitials(fullName || username));
}

function loadUserProfileDetails() {
  $.ajax({
    type: "GET",
    url: getUserProfileRequestUrl() + "/user/profile",
    headers: getUserProfileAuthHeaders(),
    contentType: "application/json",
    success: function (user) {
      $("#profile_full_name").val(user.full_name || "");
      $("#profile_email").val(user.email || "");
      $("#profile_username").val(user.username || "");
      $("#profileSettingsAvatar").text(getUserProfileInitials(user.full_name || user.username));

      sessionStorage.setItem("FULL_NAME", user.full_name || "");
      sessionStorage.setItem("EMAIL", user.email || "");
    },
    error: function (xhr) {
      showErrorDialog(getUserProfileErrorMessage(xhr, "Unable to load profile details."));
    }
  });
}

function saveUserProfileDetails() {
  var fullName = $.trim($("#profile_full_name").val() || "");
  var email = $.trim($("#profile_email").val() || "");

  if (!fullName || !email) {
    showWarningDialog("Full name and email are required.");
    return;
  }

  $.ajax({
    type: "PUT",
    url: getUserProfileRequestUrl() + "/user/profile",
    headers: getUserProfileAuthHeaders(),
    data: JSON.stringify({
      full_name: fullName,
      email: email
    }),
    contentType: "application/json",
    success: function (res) {
      var user = res && res.user ? res.user : {};
      sessionStorage.setItem("FULL_NAME", user.full_name || fullName);
      sessionStorage.setItem("EMAIL", user.email || email);
      $("#profileSettingsAvatar").text(getUserProfileInitials(fullName));
      showSuccessDialog("Profile details updated successfully.");
    },
    error: function (xhr) {
      showErrorDialog(getUserProfileErrorMessage(xhr, "Unable to update profile details."));
    }
  });
}

function saveUserProfilePassword() {
  var password = $("#profile_password").val() || "";
  var confirmPassword = $("#profile_confirm_password").val() || "";

  if (!password || !confirmPassword) {
    showWarningDialog("Password and re-enter password are required.");
    return;
  }

  if (password !== confirmPassword) {
    showWarningDialog("Passwords do not match.");
    return;
  }

  $.ajax({
    type: "PUT",
    url: getUserProfileRequestUrl() + "/user/profile/password",
    headers: getUserProfileAuthHeaders(),
    data: JSON.stringify({
      password: password,
      confirm_password: confirmPassword
    }),
    contentType: "application/json",
    success: function () {
      clearUserProfilePasswordFields();
      showSuccessDialog("Password updated successfully.");
    },
    error: function (xhr) {
      showErrorDialog(getUserProfileErrorMessage(xhr, "Unable to update password."));
    }
  });
}

function sendUserPasswordResetEmail() {
  $.ajax({
    type: "POST",
    url: getUserProfileRequestUrl() + "/user/password-reset/request",
    headers: getUserProfileAuthHeaders(),
    contentType: "application/json",
    success: function () {
      showSuccessDialog("A password reset link has been sent to your email.");
    },
    error: function (xhr) {
      showErrorDialog(getUserProfileErrorMessage(xhr, "Unable to send password reset email."));
    }
  });
}

function clearUserProfilePasswordFields() {
  $("#profile_password").val("");
  $("#profile_confirm_password").val("");
}

function getUserProfileRequestUrl() {
  if (typeof request_url !== "undefined" && request_url) {
    return request_url;
  }

  return "http://localhost:3000";
}

function getUserProfileAuthHeaders() {
  if (typeof getAuthHeaders === "function") {
    return getAuthHeaders();
  }

  var token = sessionStorage.getItem("TOKEN");
  return token ? { Authorization: "Bearer " + token } : {};
}

function getUserProfileErrorMessage(xhr, fallbackMessage) {
  if (xhr && xhr.responseJSON && xhr.responseJSON.error) {
    return xhr.responseJSON.error;
  }

  return fallbackMessage;
}

function getUserProfileInitials(value) {
  var parts = $.trim(String(value || "U")).split(/\s+/);
  var initials = "";

  if (parts.length > 0 && parts[0]) {
    initials += parts[0].charAt(0);
  }

  if (parts.length > 1 && parts[parts.length - 1]) {
    initials += parts[parts.length - 1].charAt(0);
  }

  return (initials || "U").toUpperCase();
}
