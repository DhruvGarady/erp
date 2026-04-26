
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
var alertTypeCode = '2002';
var alertStatusCode = '2003';
var userList = [];


$(document).ready(function() {

	$("#date_of_birth").datepicker({
		dateFormat:'dd-mm-yy',
		changeMonth: true,
		changeYear: true
	}).datepicker("setDate", new Date());
	

	$("#ExpiryDt").datepicker({
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

genricData = JSON.parse(sessionStorage.getItem("ENUM_VALUES"))

// -------------------------------- ALERT STATUS------------------------------------
section = genricData.find( item => item.master_code == alertStatusCode)
if(section == null || section == undefined || section == ""){
	section = {
		details:[]
	}	
}
$("#alertStatus").html(_.template(classSectionTemplate, section.details));
$('#alertStatus').trigger("create");


// --------------------------------ALERT TYPE------------------------------------
userType = genricData.find( item => item.master_code ==  alertTypeCode)
if(userType == null || userType == undefined || userType == ""){
	userType = {
		details:[]
	}	
}
$("#alertType").html(_.template(userTypeTemplate, userType.details));
$('#alertType').trigger("create");



// --------------------------------USER AUTOCOMPLETE------------------------------------

const url = request_url + "/user/getUsers";
usrList = getAPIdata(url);

_.each(usrList, function(item, index ) {

	const fullName = item.first_name + ' ' + item.last_name;

	userList.push({ 
		value: fullName, 
		id: item.id 
	});
	})


$("#searchBox").autocomplete({
    source: userList,
    select: function(event, ui) {
        $("#searchBox").val(ui.item.value);
		$("#userId").val(ui.item.id);
       // search();
       // return false;
    },
    change: function(event, ui) {
        if (ui.item == null || ui.item == undefined) {
            $("#searchBox").val('');
		  $("#userId").val('');
           //  search();
		}
    }
}); 




});


function save(){
	
	var vald = $("#alertForm").validate({
	    rules: {
	        user_name: { 
				required: true,
				},
	        alrtmsg: { 
				required: true,
			},
			userType: {
				required: true,
			},
			classSection: {
				required: true,
			}
	    },

	});
	vald.form();

	if($("#alertForm").valid()){	
	
	var formData ={
		"created_by": sessionStorage.getItem("USERNAME"),
		"updated_by":  sessionStorage.getItem("USERNAME"),
		"is_active": "Y",
		"user_name": $("#searchBox").val(),
		"user_id": $("#userId").val(),
		"alert_type": $("#alertType").val(),
		"status": $("#alertStatus").val(),
		"alert_message": $("#alert_message").val(),
		"alert_level": $("#alert_level").val(),
		"expiry_at": $("#ExpiryDt").val(),
		"source": $("#source").val()
};
	
	console.log(JSON.stringify(formData))
	
	strURL = request_url + "/alerts/add";

	  $.ajax({
	      type: "POST",
	      url: strURL,
	      data: JSON.stringify(formData),
	      contentType: "application/json",
		beforeSend: function() {
		  $(".wrapper").removeClass("hide");
		  $(".loader").removeClass("hide");
		},
	      success: onUserAddSuccess,
	      error: onUserAddErr,
		
		complete: function() {
			$(".loader").addClass("hide");
			$(".wrapper").addClass("hide");
		}
	  });

	}
}


function onUserAddSuccess(){
	showSuccessDialog("Alert successfully updated.", function() {
		location.href = "email_alertsinq.html";
	});
}


function onUserAddErr(){
	showErrorDialog("There was a problem.")
	//sessionStorage.removeItem("USER_ID")
	//$(".loader").addClass("hide");
	//$(".wrapper").addClass("hide");
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

function deleteUsr(id){
	
	var bool= window.confirm("Are you sure you want to delete this user?");

	if(bool == true){
		$.ajax({
		    url: request_url + '/user/deleteUserById/'+ id,
		    type: 'PUT',
		    success: onUsrDelSuccuess,
		    error: function(xhr, status, error) {
				alert("There was a problem");
		        console.error('Error deleting record:', error);
		    }
		});

	}	

}

function onUsrDelSuccuess(){
	alert("User deleted.")
	search();
}

function saveInlineIncome(id){

	 
		var dataString ={
			month_of_receipt: $("#tmplMonth-" + id).val(),
			income_type: $("#tmplIncomeType-" + id).val(),
			//date_received: $("#dateReceivedTmpl" + id).val(),
			amount: $("#tmplIncomeAmt-"+id).val(),
	    }
		
		//console.log(".........//final........."+JSON.stringify(dataString))
		
	  strURL = request_url + "/update/incomeid/"+id;
		
	    $.ajax({
	        type: "PUT",
	        url: strURL,
	        data: JSON.stringify(dataString),
	        contentType: "application/json",
	        success: onIncomeUpdateSuccess,
	        error: onIncomeUpdateErr,
	    });
	  

}

function onIncomeUpdateSuccess(){
	refresh();
}

function onIncomeUpdateErr(){
	alert("Oops, there was a problem with your request");	
}

function createIncomeChart(){
	if(Data.length < 1){
		alert("Please Enter atleast one record.")
	}else{
		dasboard();		
	}
}
