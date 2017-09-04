angular.module('sampleApp').component('fhirExtension',{
    templateUrl: '/js/components/extensionDirectiveTempl.html',
    bindings: {analyse:'<',showvs:'&'},
    controller : function(){



        this.$onChanges = function(obj) {
            //console.log(obj)


        }
    }
})

