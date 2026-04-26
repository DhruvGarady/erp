
var usrData
var userTemplate;



var genricData;

var userType = {
	details:[]
}
var semester = {
	details:[]
}
var section = {
	details:[]
}
var state = {
	details:[]
}
var userTypeCode = '1000';
var semesterCode = '2000';
var sectionCode = '2001';
var stateCode = '1001';


$(document).ready(function() {

	$("#date_of_birth").datepicker({
		dateFormat:'dd-mm-yy',
		changeMonth: true,
		changeYear: true
	}).datepicker("setDate", new Date());
	

	$("#admission_date").datepicker({
		dateFormat:'dd-mm-yy',
		changeMonth: true,
		changeYear: true
	}).datepicker("setDate", new Date());

	
	
 	
isUserLoggedIn()
buildMenu();
setUsrName()



userTemplate = $("#listTmpl").html();



var userTypeTemplate = $("#userTypeTmpl").html();
var semesterTemplate = $("#semesterTmpl").html();
var classSectionTemplate = $("#classSectionTmpl").html();
var stateTemplate = $("#stateTmpl").html();



genricData = JSON.parse(sessionStorage.getItem("ENUM_VALUES"))


// --------------------------------USER TYPE ------------------------------------
userType = genricData.find( item => item.master_code == userTypeCode)
if(userType == null || userType == undefined || userType == ""){
	userType = {
		details:[]
	}	
}
$("#userType").html(_.template(userTypeTemplate, userType.details));
$('#userType').trigger("create");



// --------------------------------SEMESTER------------------------------------
semester = genricData.find( item => item.master_code == semesterCode)
if(semester == null || semester == undefined || semester == ""){
	semester = {
		details:[]
	}	
}
$("#semester").html(_.template(semesterTemplate, semester.details));
$('#semester').trigger("create");



// -------------------------------- SECTION ------------------------------------
section = genricData.find( item => item.master_code == sectionCode)
if(section == null || section == undefined || section == ""){
	section = {
		details:[]
	}	
}
$("#classSection").html(_.template(classSectionTemplate, section.details));
$('#classSection').trigger("create");



// -------------------------------- STATE ------------------------------------
state = genricData.find( item => item.master_code == stateCode)
if(state == null || state == undefined || state == ""){
	state = {
		details:[]
	}	
}
$("#state").html(_.template(stateTemplate, state.details));
$('#state').trigger("create");



	strURL = request_url + "/user/getById/" + sessionStorage.getItem("EDIT_USER_ID");
	usrData = getAPIdata(strURL);

	_.each(usrData, function(user, index ) {
			// Prefill form fields with user data	
			$("#first_name").val(user.first_name || "");
			$("#last_name").val(user.last_name || "");
			$("#email").val(user.email || "");
			$("#username").val(user.username || "");
			$("#password_hash").val(""); // usually you don't prefill password
			$("#phone").val(user.phone || "");
			$("#date_of_birth").val(user.date_of_birth || "");
			$("#gender").val(user.gender || "");
			$("#user_type").val(user.user_type || "");
			$("#address").val(user.address || "");
			$("#nationality").val(user.nationality || "");
			$("#grade_level").val(user.grade_level || "");
			$("#admission_date").val(user.admission_date || "");
			$("#class_section").val(user.class_section || "");
			$("#course").val(user.course || "");
			$("#GPA").val(user.GPA || "");
			$("#attendance_percentage").val(user.attendance_percentage || "");
			$("#academic_status").val(user.academic_status || "");
			$("#guardian_name").val(user.guardian_name || "");
			$("#guardian_phone").val(user.guardian_phone || "");
			$("#guardian_email").val(user.guardian_email || "");
			$("#relationship").val(user.relationship || "");
			$("#courses_enrolled").val(user.courses_enrolled || "");
			$("#credits_earned").val(user.credits_earned || "");
			$("#semester").val(user.semester || "");
			$("#tuition_status").val(user.tuition_status || "");
			$("#blood_type").val(user.blood_type || "");
			$("#medical_conditions").val(user.medical_conditions || "");
			$("#emergency_contact_name").val(user.emergency_contact_name || "");
			$("#emergency_contact_phone").val(user.emergency_contact_phone || "");
			$("#disciplinary_record").val(user.disciplinary_record || "");
			$("#clubs_and_activities").val(user.clubs_and_activities || "");
			$("#sports_participation").val(user.sports_participation || "");
			$("#volunteer_hours").val(user.volunteer_hours || "");
			$("#last_login").val(user.last_login || "");
			$("#account_status").val(user.account_status || "");
			$("#roll_num").val(user.roll_num || "");
			$("#country").val(user.country || "");
			$("#state").val(user.state || "");
			$("#pincode").val(user.pincode || "");

			// If you want to preview profile picture
			if (user.profile_picture) {
				$("#profile_picture_preview").attr("src", user.profile_picture);
			}
	});	






/*	
	$("#incomeForm").validate({
	    rules: {
	        month: { 
				required: true,
				},
	        incomeType: { 
				required: true,
			},
			amount: {
				required: true,
			},
			dateReceived: {
				required: true,
			}
	    },

	});

*/
});


function save() {

	$(".searchButton").prop("disabled", true);

    var formData = new FormData();

    // Append all text fields
    formData.append("created_by", sessionStorage.getItem("USERNAME"));
    formData.append("updated_by", sessionStorage.getItem("USERNAME"));
    formData.append("is_active", "Y");
    formData.append("first_name", $("#first_name").val());
    formData.append("last_name", $("#last_name").val());
    formData.append("email", $("#email").val());
    formData.append("username", $("#username").val());
    formData.append("password_hash", $("#password_hash").val()); 
    formData.append("phone", $("#phone").val());
    formData.append("date_of_birth", $("#date_of_birth").val());
    formData.append("gender", $("#gender").val());
    formData.append("user_type", $("#userType").val());
    formData.append("address", $("#address").val());
    formData.append("nationality", $("#nationality").val());
    formData.append("grade_level", $("#grade_level").val());
    formData.append("admission_date", $("#admission_date").val());
    formData.append("class_section", $("#classSection").val());
    formData.append("course", $("#course").val());
    formData.append("GPA", $("#GPA").val());
    formData.append("attendance_percentage", $("#attendance_percentage").val());
    formData.append("academic_status", $("#academic_status").val());
    formData.append("guardian_name", $("#guardian_name").val());
    formData.append("guardian_phone", $("#guardian_phone").val());
    formData.append("guardian_email", $("#guardian_email").val());
    formData.append("relationship", $("#relationship").val());
    formData.append("courses_enrolled", $("#courses_enrolled").val());
    formData.append("credits_earned", $("#credits_earned").val());
    formData.append("semester", $("#semester").val());
    formData.append("tuition_status", $("#tuition_status").val());
    formData.append("blood_type", $("#blood_type").val());
    formData.append("medical_conditions", $("#medical_conditions").val());
    formData.append("emergency_contact_name", $("#emergency_contact_name").val());
    formData.append("emergency_contact_phone", $("#emergency_contact_phone").val());
    formData.append("disciplinary_record", $("#disciplinary_record").val());
    formData.append("clubs_and_activities", $("#clubs_and_activities").val());
    formData.append("sports_participation", $("#sports_participation").val());
    formData.append("volunteer_hours", $("#volunteer_hours").val());
    formData.append("last_login", $("#last_login").val());
    formData.append("account_status", $("#account_status").val());
    formData.append("roll_num", $("#roll_num").val());
    formData.append("country", $("#country").val());
    formData.append("state", $("#state").val());
    formData.append("pincode", $("#pincode").val());

    // ✅ Append file (actual binary, not just filename)
    var file = $("#profile_picture")[0].files[0];
    if (file) {
        formData.append("profile_picture", file);
    }

    var strURL = request_url + "/user/addDOCuser";

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
        success: onUserAddSuccess,
        error: onUserAddErr,
        complete: function () {
            $(".loader").addClass("hide");
            $(".wrapper").addClass("hide");
        }
    });
}

function onUserAddSuccess(res) {
    showSuccessDialog("User updated successfully!", function() {
        console.log("Response:", res);
        location.href = "usermanagementinq.html";
    });
}

function onUserAddErr(err) {
    showErrorDialog("There was a problem updating the user.");
    console.error("Error:", err);
}





