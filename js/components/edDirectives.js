angular.module('sampleApp').component('edSummary',{
    templateUrl: '/js/components/edDirectiveSummaryTempl.html',
    bindings: {ed:'<'},
    controller : function(){



        this.$onChanges = function(obj) {
            //console.log(obj)


        }
    }
})

