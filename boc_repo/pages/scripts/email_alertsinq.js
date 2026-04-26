
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

var userList = [];

var alertTypeCode = '2002';
var alertStatusCode = '2003';


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
        alert_type: $("#alertType").val() || undefined,
        status: $("#alertStatus").val() || undefined,
        user_id: $("#userId").val() || undefined 
    });

    const url = request_url + "/alerts/filter?"+query;
	
	usrData = getAPIdata(url);
	$("#listContainer2").html(_.template(userTemplate, usrData));
	$('#listContainer2').trigger("create");	
}




function addAlert(){
	location.href = 'add_alert.html';
}





// -----------------------delete-----------------------------


function deleteAlert(id){

  showConfirmDialog("Are you sure you want to delete this alert?", function() {

		dataString ={
			updated_by: sessionStorage.getItem("USERNAME"),
		}


		$.ajax({
		    url: request_url + '/alerts/deleteById/'+ id,
		    type: 'POST',
			data: JSON.stringify(dataString),
			contentType: "application/json",
		    success: onUsrDelSuccuess,
		    error: function(xhr, status, error) {
				showErrorDialog("There was a problem.");
		        console.error('Error deleting record:', error);
		    }
		});

  });	

}

function onUsrDelSuccuess(){
	showSuccessDialog("Alert deleted.")
	search();
}
