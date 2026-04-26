
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

var userTypeCode = '1000';
var semesterCode = '2000';
var sectionCode = '2001';


$(document).ready(function() {

/*	$("#dateReceived").datepicker({
		//beforeShowDay: $.datepicker.noWeekends,
		dateFormat:'yy-mm-dd',
		changeMonth: true,
		changeYear: true
	});	*/

 	
isUserLoggedIn()
buildMenu();
setUsrName()


userTemplate = $("#listTmpl").html();



var userTypeTemplate = $("#userTypeTmpl").html();
var semesterTemplate = $("#semesterTmpl").html();
var classSectionTemplate = $("#classSectionTmpl").html();

genricData = JSON.parse(sessionStorage.getItem("ENUM_VALUES"))

// -------------------------------- SECTION ------------------------------------
section = genricData.find( item => item.master_code == sectionCode)
if(section == null || section == undefined || section == ""){
	section = {
		details:[]
	}	
}
$("#classSection").html(_.template(classSectionTemplate, section.details));
$('#classSection').trigger("create");


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








	
usrData = [];
$("#listContainer2").html(_.template(userTemplate, usrData));
$('#listContainer2').trigger("create");	

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
	
search()
	
});


/*function search(){
	strURL = request_url + "/user/filter/"+ $("#userType").val() +"/"+ $("#classSection").val() +"/"+ $("#semester").val();
	usrData = getAPIdata(strURL);

	$("#listContainer2").html(_.template(userTemplate, usrData));
	$('#listContainer2').trigger("create");		

}*/
function search() {
    const query = $.param({
        user_type: $("#userType").val() || undefined,
        class_section: $("#classSection").val() || undefined,
        semester: $("#semester").val() || undefined,
    });

    const url = request_url + "/user/filter?"+query;
	
	usrData = getAPIdata(url);
	$("#listContainer2").html(_.template(userTemplate, usrData));
	$('#listContainer2').trigger("create");	
}


function addUser(){
	location.href = 'add_user.html';
}

function editUsr(id){
	sessionStorage.setItem("EDIT_USER_ID",id)
	location.href = 'edit_user.html';
}















function saveIncomeInfo(event) {
 event.preventDefault(); 

 if($("#incomeForm").valid()){	
	
	var dataString =	{    
	    usr_id: sessionStorage.getItem("USER_ID"),
		month_of_receipt: $("#month").val(),
	    income_type: $("#incomeType").val(),
	    amount: $("#amount").val(),
	    /*date_received: $("#dateReceived").val(),*/
	    notes:$("#notes").val(),
	}
	
	//console.log(JSON.stringify(dataString))
	
  strURL = request_url + "/income/add";
	
    $.ajax({
        type: "POST",
        url: strURL,
        data: JSON.stringify(dataString),
        contentType: "application/json",
		beforeSend: function() {
		  $(".wrapper").removeClass("hide");
		  $(".loader").removeClass("hide");
		},
        success: onIncomeAddSuccess,
        error: onIncomeAddErr,
		
		complete: function() {
			$(".loader").addClass("hide");
			$(".wrapper").addClass("hide");
		}
    });
  }
}


function onIncomeAddSuccess(){
	alert("Successfully Added Income.")
	//sessionStorage.setItem("USER_ID",data)	
	$(".loader").addClass("hide");
	$(".wrapper").addClass("hide");
	refresh();	
}

function onIncomeAddErr(){
	alert("There was a problem.")
	//sessionStorage.removeItem("USER_ID")
	$(".loader").addClass("hide");
	$(".wrapper").addClass("hide");
}



// -----------------------delete-----------------------------

function deleteAll(){

	var bool= window.confirm("Are you sure you want to delete all the record?");

	if(bool == true){
		$.ajax({
		    url: request_url + '/income/delete/'+ sessionStorage.getItem("USER_ID"),
		    type: 'DELETE',
		    success: function(response) {
		        console.log('Record deleted successfully:', response);
				refresh()
			},
		    error: function(xhr, status, error) {
				alert("There was a problem");
		        console.error('Error deleting record:', error);
		    }
		});

	}	

}

/*function tmpldate(id){
	
	$("#dateReceivedTmpl-"+id).datepicker({
		dateFormat:'yy-mm-dd',
		changeMonth: true,
		changeYear: true
	});	
}*/

function deleteUsr(id) {
  showConfirmDialog("Are you sure you want to delete this user?", function() {
    $.ajax({
      url: request_url + '/user/deleteUserById/' + id,
      type: 'PUT',
      success: onUsrDelSuccuess,
      error: function(xhr, status, error) {
        showErrorDialog("There was a problem");
        console.error('Error deleting record:', error);
      }
    });
  });
}


function onUsrDelSuccuess(){
	showSuccessDialog("User deleted.");
	search();
}
