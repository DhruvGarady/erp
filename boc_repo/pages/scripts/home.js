
var Data;
var incomeTypes;

var userTypeCount = [];
var userType = [];

var userCountPerSemCount = [];
var semCount = [];

var usrData = [];


var section = {
	details:[]
}

var alertStatusCode = '2003';
var genricData;
$(document).ready(function() {

/*	$("#dateReceived").datepicker({
		//beforeShowDay: $.datepicker.noWeekends,
		dateFormat:'yy-mm-dd',
		changeMonth: true,
		changeYear: true
	});	*/

 	
isUserLoggedIn()
buildMenu();

//serverRefresh()

setUsrName()

//  showSystemError("A system error occurred. Please contact support.");

//  showErrorDialog("Failed to update user!");

//  showWarningDialog("Are you sure you want to delete this user?");

//  showSuccessDialog("User added successfully!");


if(sessionStorage.getItem("ENUM_VALUES") == null || sessionStorage.getItem("ENUM_VALUES") == "" || sessionStorage.getItem("ENUM_VALUES") == undefined){ 
strURL = request_url +"/enum/getEnumValues";
genericData = getAPIdata(strURL);

genericData = _.groupBy(genericData, function(item){
	return item.master_code;	
});
genericData = _.map(genericData, function(item){
	return{
		master_code: item[0].master_code,
		master_name: item[0].master_name,
		details: item
	}
})
sessionStorage.setItem("ENUM_VALUES",JSON.stringify(genericData))
}	

strURL = request_url + "/user/getUsersCount";
userCount = getAPIdata(strURL);
if(userCount != null && userCount != "" && userCount != undefined){
	$("#totUsers").text(userCount[0].totalUsers);
}


strURL2 = request_url + "/user/getStudentsCount";
studentCount = getAPIdata(strURL2);
if(studentCount != null && studentCount != "" && studentCount != undefined){
	$("#totStudents").text(studentCount[0].numberOfStudents);
}


strURL3 = request_url + "/user/getFacultyCount";
facultyCount = getAPIdata(strURL3);
if(facultyCount != null && facultyCount != "" && facultyCount != undefined){
	$("#totfaculty").text(facultyCount[0].numberOfFaculty);
}


strURL4 = request_url + "/user/getStaffCount";
staffCount = getAPIdata(strURL4);
if(staffCount != null && staffCount != "" && staffCount != undefined){
	$("#totStaff").text(staffCount[0].numberOfStaff);
}	
	

	
createUserChart();
createStudentEnrolledBySem();


//---------------------Alerts----------------------------
genricData = JSON.parse(sessionStorage.getItem("ENUM_VALUES"))

section = genricData.find( item => item.master_code == alertStatusCode)
if(section == null || section == undefined || section == ""){
	section = {
		details:[]
	}	
}



const url = request_url + "/alerts/getAlertsById"+"/"+ sessionStorage.getItem("USER_ID");
usrData = getAPIdata(url);

userTemplate = $("#listTmpl").html();

$("#listContainer2").html(_.template(userTemplate, usrData));
$('#listContainer2').trigger("create");	

_.each(usrData, function(item, index ) {
	$("#status-" + item.id).val(item.status);
});


});

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

function incomeDel(id){
	
	var bool= window.confirm("Are you sure you want to delete this record?");

	if(bool == true){
		$.ajax({
		    url: request_url + '/incomeid/delete/'+ id,
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


function createUserChart(){
	strURL = request_url + "/user/getUserTypeCount";
	userTypesCount = getAPIdata(strURL);
	
	if(userTypesCount != null && userTypesCount != "" && userTypesCount != undefined){
		
		_.each(userTypesCount, function(item){
			userTypeCount.push(item.COUNT);
			userType.push(item.user_type);
		});
			
		//Charts

		const doughnutLabelsLine = {
			    		  id: "doughnutLabelsLine",
			    		  
			    		  beforeDraw(chart, args, options) {
			    		    const {
			    		      ctx,
			    		      chartArea: { width, height, top, bottom, left, right} } = chart;

							const sum = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
							
			    		    chart.data.datasets.forEach((dataset, i) => {
			    		    	chart.getDatasetMeta(i).data.forEach((datapoint,index) => {
			    		    		
			    		    		//console.log(chart.data.labels)
			    		    		const {x,y} = datapoint.tooltipPosition();
			    		    		
			    		/*     		ctx.fillStyle = dataset.borderColor[index];
			    		    		ctx.fill();*/
			    		    		
			    					//console.log(x);    		
									
			    					const halfwidth = width / 2;
			    					const halfheight = height / 2;
			    					
			    					
			    					const xLine = x >= halfwidth ? x + 30: x -30;
			    					const yLine = y >= halfheight ? y + 30: y -30;
			    					const extraLine = x >= halfwidth ? 15 : -15
			    					
			    					
			    					
			    					ctx.beginPath();
			    					ctx.moveTo(x,y);
			    					ctx.lineTo(xLine, yLine);
			    					ctx.lineTo(xLine + extraLine ,yLine);
			    					ctx.strokeStyle = dataset.borderColor[index];
			    					ctx.stroke();
			    		    		
			    					const textWidth = ctx.measureText(chart.data.labels[index]).width;
			    					
			    					
			    					const textXPosition = x >= halfwidth ? 'left' : 'right';
			    					const plusFivePx = x >= halfwidth ? 5 : -5;
			    					ctx.textBaseline ='middle';
			    					ctx.textAlign = textXPosition;
			    					//ctx.fillStyle = dataset.borderColor[index];
			    					ctx.fillStyle = "black";
			    					ctx.font='12px Arial';
		/*	    					ctx.fillText(
			                		((chart.data.datasets[0].data[index] * 100) / sum).toFixed(2) +
					                  "%",
					                xLine + extraLine + plusFivePx,
					                yLine
					              );*/
								  ctx.fillText(
								      chart.data.labels[index], // Display the label text
								      xLine + extraLine + plusFivePx,
								      yLine
								  );
			    								
			    		    	})
			    		    })
			    		  },
			    		};
			    		

			
						const pieLabelsLine = {
						        id: "pieLabelsLine",
						        beforeDraw(chart) {
						          const {
						            ctx,
						            chartArea: { width, height },
						          } = chart;

						          const cx = chart._metasets[0].data[0].x;
						          const cy = chart._metasets[0].data[0].y;

						          const sum = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

						          chart.data.datasets.forEach((dataset, i) => {
						            chart.getDatasetMeta(i).data.forEach((datapoint, index) => {
						              const { x: a, y: b } = datapoint.tooltipPosition();

						              const x = 2 * a - cx;
						              const y = 2 * b - cy;

						              // draw line
						              const halfwidth = width / 2;
						              const halfheight = height / 2;
						              const xLine = x >= halfwidth ? x + 20 : x - 20;
						              const yLine = y >= halfheight ? y + 20 : y - 20;

						              const extraLine = x >= halfwidth ? 10 : -10;

						              ctx.beginPath();
						              ctx.moveTo(x, y);
						              ctx.arc(x, y, 0, 0, 2 * Math.PI, true);
						              ctx.fill();
						              ctx.moveTo(x, y);
						              ctx.lineTo(xLine, yLine);
						              ctx.lineTo(xLine + extraLine, yLine);
						              ctx.strokeStyle = dataset.backgroundColor[index];
						              //ctx.strokeStyle = "black";
						              ctx.stroke();

						              // text
						              const textWidth = ctx.measureText(chart.data.labels[index]).width;
						              ctx.font = "12px Arial";
						              // control the position
						              const textXPosition = x >= halfwidth ? "left" : "right";
						              const plusFivePx = x >= halfwidth ? 5 : -5;
						              ctx.textAlign = textXPosition;
						              ctx.textBaseline = "middle";
						              //ctx.fillStyle = dataset.backgroundColor[index];
						              //ctx.fillStyle = dataset.borderColor[index];
						              ctx.fillStyle = "black";

									  ctx.fillText(
									      chart.data.labels[index], // Display the label text
									      xLine + extraLine + plusFivePx,
									      yLine
									  );
						            });
						          });
						        },
						      };  	
				
						
	// 	const ProductionMachineData = {
	// 	    labels: userType,
	// 	    datasets: [{
	// 	      label: 'Production Machine By Volume',
	// 	      data: userTypeCount,
	// 	      borderWidth: 0.8,
	// 	      backgroundColor: 			  [
	// 			'#1f77b4', // Students
	// 			'#ff7f0e', // Teachers
	// 			'#2ca02c', // Staff
	// 			'#d62728', // Admin
	// 			'#9467bd', // Support
	// 			'#8c564b'  // Guests
	// 		  ],
	// 	      borderColor:[
	// 			'#1f77b4', // Students
	// 			'#ff7f0e', // Teachers
	// 			'#2ca02c', // Staff
	// 			'#d62728', // Admin
	// 			'#9467bd', // Support
	// 			'#8c564b'  // Guests
	// 		],
	// 	    }]
	// 	  };
		  


	// 	  // Options for the chart
	// 	  const ProductionMachineOptions = {
	// 		responsive: true,
	// 	    maintainAspectRatio: false,
	// 	    cutout: '40%',
	// 	    plugins: {
	// 	      tooltip: {
	// 	        backgroundColor: 'white',
	// 	        bodyColor: 'black',
	// 	        titleColor: 'black',
	// 	        footerColor: 'black',
	// 	        borderColor: '#ddd',
	// 	        borderWidth: 1,
	// 	        callbacks: {
	// 	          label: function(tooltipItem) {
	// 	            const dataset = tooltipItem.dataset;
	// 	            const index = tooltipItem.dataIndex;
	// 	            const machineName = tooltipItem.chart.data.labels[index];
	// 	            const value = dataset.data[index];
	// 	            const productionVolume = value * 1.5;

	// 	            return [
	// 	              `User: ${machineName}`,
	// 	              `Count: ${value}`,
	// 	            ];
	// 	          }
	// 	        },
	// 	        displayColors: false
	// 	      },
	// 	      legend: {
	// 	        display: false,
	// 	      },
	// 	      datalabels: {
	// 			display:false,
	// 	        color: 'white',
	// 	        anchor: 'center',
	// 	        align: 'center',
	// 	        formatter: function(value) {
	// 	          return value.toLocaleString() + '%';
	// 	        },
	// 	      },
	// 	      doughnutLabelsLine: {} // Ensure this plugin is added
	// 	    },
	// 	    layout: {
	// 	      padding: {
	// 	        top: 50,
	// 	        bottom: 130 // Adjusted bottom padding
	// 	      }
	// 	    },
	// 	            scales: {
	// 	          y: {
	// 	            display: false,
	// 	            beginAtZero: true,
	// 	            ticks: {
	// 	              display: false,
	// 	            },
	// 	            grid: {
	// 	              display: false,
	// 	            },
	// 	          },
	// 	          x: {
	// 	            display: false,
	// 	            ticks: {
	// 	              display: false,
	// 	            },
	// 	            grid: {
	// 	              display: false,
	// 	            },
	// 	          },
	// 	        },
	// 	  };

	// 	  // Create the chart
	// 	  const ct9 = document.getElementById('ProductionMachineChart').getContext('2d');
	// 	  const chart2 = new Chart(ct9, {
	// 	    type: 'doughnut',
	// 	    data: ProductionMachineData,
	// 	    options: ProductionMachineOptions,
	// 	    plugins: [{
	// 	      beforeInit: function(chart) {
	// 	        if (chart.canvas.id === "ProductionMachineChart") {
	// 	          const ul = document.createElement('ul');
	// 	          chart.data.datasets[0].data.forEach((data, i) => {
	// 	            const color = chart.data.datasets[0].backgroundColor[i];
	// 	            const label = chart.data.labels[i];

	// 	            ul.innerHTML += `
	// 	              <li>
	// 	                <span class="material-icons" style="color: ${color};">donut_large</span>
	// 	                ${label}
	// 	              </li>
	// 	            `;
	// 	          });

	// 	          document.getElementById("js-legend2").appendChild(ul);
	// 	        }
	// 	      }
	// 	    }, doughnutLabelsLine] // Ensure the plugin is added here
	// 	  });		
		
		



const ProductionMachineData = {
  labels: userType,
  datasets: [{
    label: 'Production Machine By Volume',
    data: userTypeCount,
    borderWidth: 1,
    backgroundColor: [
      '#1f77b4', // Students
      '#ff7f0e', // Teachers
      '#2ca02c', // Staff
      '#d62728', // Admin
      '#9467bd', // Support
      '#8c564b'  // Guests
    ],
    borderColor: [
      '#1f77b4',
      '#ff7f0e',
      '#2ca02c',
      '#d62728',
      '#9467bd',
      '#8c564b'
    ]
  }]
};

// Options for the chart
const ProductionMachineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      backgroundColor: 'white',
      bodyColor: 'black',
      titleColor: 'black',
      footerColor: 'black',
      borderColor: '#ddd',
      borderWidth: 1,
      callbacks: {
        label: function(tooltipItem) {
          const dataset = tooltipItem.dataset;
          const index = tooltipItem.dataIndex;
          const machineName = tooltipItem.chart.data.labels[index];
          const value = dataset.data[index];
          return [
            `User: ${machineName}`,
            `Count: ${value}`
          ];
        }
      },
      displayColors: true
    },
    legend: {
      display: false
    }
  },
  layout: {
    padding: {
      top: 20,
      bottom: 50
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        stepSize: 1
      },
      grid: {
        display: true
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
};

// Create the chart
const ct9 = document.getElementById('ProductionMachineChart').getContext('2d');
const chart2 = new Chart(ct9, {
  type: 'bar', // ✅ changed to bar
  data: ProductionMachineData,
  options: ProductionMachineOptions
});

	}
}


function createStudentEnrolledBySem(){

const pieLabelsLine = {
						        id: "pieLabelsLine",
						        beforeDraw(chart) {
						          const {
						            ctx,
						            chartArea: { width, height },
						          } = chart;

						          const cx = chart._metasets[0].data[0].x;
						          const cy = chart._metasets[0].data[0].y;

						          const sum = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);

						          chart.data.datasets.forEach((dataset, i) => {
						            chart.getDatasetMeta(i).data.forEach((datapoint, index) => {
						              const { x: a, y: b } = datapoint.tooltipPosition();

						              const x = 2 * a - cx;
						              const y = 2 * b - cy;

						              // draw line
						              const halfwidth = width / 2;
						              const halfheight = height / 2;
						              const xLine = x >= halfwidth ? x + 30 : x - 30;
						              const yLine = y >= halfheight ? y + 30 : y - 30;

						              const extraLine = x >= halfwidth ? 10 : -10;

						              ctx.beginPath();
						              ctx.moveTo(x, y);
						              ctx.arc(x, y, 0, 0, 2 * Math.PI, true);
						              ctx.fill();
						              ctx.moveTo(x, y);
						              ctx.lineTo(xLine, yLine);
						              ctx.lineTo(xLine + extraLine, yLine);
						              ctx.strokeStyle = dataset.backgroundColor[index];
						              //ctx.strokeStyle = "black";
						              ctx.stroke();

						              // text
						              const textWidth = ctx.measureText(chart.data.labels[index]).width;
						              ctx.font = "12px Arial";
						              // control the position
						              const textXPosition = x >= halfwidth ? "left" : "right";
						              const plusFivePx = x >= halfwidth ? 5 : -5;
						              ctx.textAlign = textXPosition;
						              ctx.textBaseline = "middle";
						              //ctx.fillStyle = dataset.backgroundColor[index];
						              //ctx.fillStyle = dataset.borderColor[index];
						              ctx.fillStyle = "black";

									  ctx.fillText(
									      chart.data.labels[index], // Display the label text
									      xLine + extraLine + plusFivePx,
									      yLine
									  );
						            });
						          });
						        },
						      };  	



	strURL = request_url + "/user/getStudentsPerSemCount";
	userCountPerSem = getAPIdata(strURL);

	if(userCountPerSem != null && userCountPerSem != "" && userCountPerSem != undefined){
		
		_.each(userCountPerSem, function(item){
			userCountPerSemCount.push(item.count);
			semCount.push("SEM " + item.semester);
		});	
		
	//  const ct3 = document.getElementById('ProductionEffiChart').getContext('2d'); // Corrected to get the 2D context

	// const prodEffiData = {
	//     labels: semCount,
	//     datasets: [
	//         {
	//             label: 'Student Count',
	//             data: userCountPerSemCount,
	//             backgroundColor: 'rgb(205, 16, 76)',
	//             maxBarThickness: 25,
	//         },
	//         /*{
	//             label: 'Downtime Hours',
	//             data: [7.74,7.60,7.32,7.3,7.27,7.23],
	//             backgroundColor: '#ffc107ff',
	//             maxBarThickness: 25,
	//         }*/
	//     ]
	// };

	// const prodEffiOptions = {
	//     plugins: {
	//         legend: {
	//             display: false
	//         },
	//        /* tooltip: {
	//             backgroundColor: 'white',
	//             bodyColor: 'black',
	//             titleColor: 'black',
	//             footerColor: 'black',
	//             borderColor: '#ddd',
	//             borderWidth: 1,
	//             callbacks: {
	//                 label: function (tooltipItem) {
	//                     const datasetLabel = tooltipItem.dataset.label;
	//                     const value = tooltipItem.raw;
	//                     return [`${datasetLabel}: ${value.toLocaleString()}`];
	//                 }
	//             },
	//             displayColors: false
	//         },*/
	//         datalabels: {
	// 			display:true ,
	//             anchor: 'end',
	//             align: 'end',
	//             color: 'black',
	//             padding: -2,
	//             formatter: function (value) {
	//                 return value;
	//             },
	//         }
	//     },
	//     indexAxis: 'y',
	//     scales: {
	//         x: {
	//             stacked: true,
	// 			title: {
	// 			    display: true,
	// 			    text: 'Number Of Students',
	// 				font: {
	// 				 weight: 'bold', // Makes the X-axis label bold
	// 				 size: 14        // Optional: change font size
	// 				}						
	// 			}
	//         },
	//         y: {
	//             stacked: true,
	//             grid:{
	// 				display:false,
	// 			},
	// 			title: {
	// 				display: true,
	// 				text: 'Semister',
	// 				font: {
	// 				 weight: 'bold', // Makes the X-axis label bold
	// 				 size: 14        // Optional: change font size
	// 				}					
	// 			}				
	//         }
	//     },
	//     layout: {
	//         padding: {
	//             top: 25,
	//             bottom: 30,
	//             right: 15,
	//             left: 10
	//         }
	//     }
	// };

	// const chart1 = new Chart(ct3, {
	//     type: 'bar',
	//     data: prodEffiData,
	//     options: prodEffiOptions,
	//     plugins: [{
	//         beforeInit: function (chart) {
	//             // Ensure we're applying the legend to the right chart
	//             if (chart.canvas.id === "ProductionEffiChart") {
	//                 const ul = document.createElement('ul');
	//                 chart.data.datasets.forEach((dataset) => {
	//                     let icon = 'bar_chart';
	//                     let color = 'black';

	//                     if (dataset.label === "Student Count") {
	//                         color = 'rgb(205, 16, 76)';
	//                     } else if (dataset.label === "Downtime Hours") {
	//                         color = '#ffc107ff';
	//                     }

	//                     ul.innerHTML += `
	//                         <li>
	//                             <span class="material-icons" style="color: ${color};">${icon}</span>
	//                             ${dataset.label}
	//                         </li>
	//                     `;
	//                 });

	//                 // Append the generated HTML to the legend container
	//                 document.getElementById("legend3").appendChild(ul);
	//             }
	//         }
	//     }]
	// });

	// }	



const backgroundColor = semCount.map(() => getRandomColor());



const ct3 = document.getElementById('ProductionEffiChart').getContext('2d'); // Get the 2D context

// Pie chart data
const prodEffiData = {
    labels: semCount,   // e.g. ["Sem 1", "Sem 2", "Sem 3"]
    datasets: [{
        label: 'Student Count',
        data: userCountPerSemCount, // e.g. [30, 40, 50]
        backgroundColor: backgroundColor,
        borderWidth: 1
    }]
};

const prodEffiOptions = {
    plugins: {
        legend: { display: false }, // we’ll make our own legend
   
	 tooltip: {
	            backgroundColor: 'white',
	            bodyColor: 'black',
	            titleColor: 'black',
	            footerColor: 'black',
	            borderColor: '#ddd',
	            borderWidth: 1,
	            callbacks: {
	                label: function (tooltipItem) {
	                    const datasetLabel = tooltipItem.dataset.label;
	                    const value = tooltipItem.raw;
	                    return [`${datasetLabel}: ${value.toLocaleString()}`];
	                }
	            },
	            displayColors: false
	        },
		 },	
	     layout: {
	         padding: {
	             top: 1,
	             bottom: 1,
	             right: 80,
	             left: 70
	         }
	     }
};

// Init pie chart
const chart1 = new Chart(ct3, {
    type: 'pie',
    data: prodEffiData,
    options: prodEffiOptions,
    plugins: [pieLabelsLine, {
        beforeInit: function (chart) {
            // if (chart.canvas.id === "ProductionEffiChart") {
            //     const ul = document.createElement('ul');
            //     chart.data.datasets[0].data.forEach((value, index) => {
            //         let icon = 'circle';
            //         let color = chart.data.datasets[0].backgroundColor[index];
            //         ul.innerHTML += `
            //             <li>
            //                 <span class="material-icons" style="color: ${color}; font-size:14px">${icon}</span>
            //                 ${chart.data.labels[index]}
            //             </li>
            //         `;
            //     });
            //     document.getElementById("legend3").appendChild(ul);
            // }
        }
    }]
});
	}


}

function getRandomColor() {
  const r = Math.floor(Math.random() * 220 + 30);
  const g = Math.floor(Math.random() * 230 + 30);
  const b = Math.floor(Math.random() * 240 + 30);
  return `rgb(${r}, ${g}, ${b})`;
}

function changeAlertStatus(id){
	var dataString ={
		status: $("#status-" + id).val(),
		updated_by: sessionStorage.getItem("USERNAME")
	}

	strURL = request_url + "/alerts/updateStatusById/"+id;
	
	$.ajax({
		type: "POST",
		url: strURL,
		data: JSON.stringify(dataString),
		contentType: "application/json",
		success: onAlertupdateSuccess,
		error: onAlertupdateErr,
	});


}

function onAlertupdateSuccess(){
	showSuccessDialog("Status Updated.");
}

function onAlertupdateErr(){
	showErrorDialog("Oops, there was a problem with your request.");
}	

// showErrorDialog("Failed to update user!");

// showWarningDialog("Are you sure you want to delete this user?");

// showSuccessDialog("User added successfully!");