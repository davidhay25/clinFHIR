angular.module("sampleApp").service('taskViewerSvc', function($localStorage) {

    //var history = $localStorage || []

    let humanNameDisplay = function(hn) {
        let disp = ""
        if (hn.given) {
            hn.given.forEach(function (s){
                disp += s + " "
            })
        }
        disp += hn.family
        return disp
    }

    return {
        getPatientDisplay : function(patient){
            let display = ""
            if (patient) {
                display += patient.id
                if (patient.name && patient.name.length > 0) {
                    display += " " + humanNameDisplay(patient.name[0]) ;
                }
                if (patient.gender) {
                    display += " " + patient.gender
                }

            }
            return display

        }

    }

});