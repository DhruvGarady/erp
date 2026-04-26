
var usrData
var userTemplate;
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


function search(){
	strURL = request_url + "/user/filter/"+ $("#userType").val() +"/"+ $("#Section").val();
	usrData = getAPIdata(strURL);

	$("#listContainer2").html(_.template(userTemplate, usrData));
	$('#listContainer2').trigger("create");		

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
