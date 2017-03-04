angular.module('sampleApp').component('coding',{
    template: ' <span title="{{$ctrl.coding[0].code}} {{$ctrl.coding[0].system}}"> \
         {{$ctrl.coding[0].display}}<span ng-hide="$ctrl.coding[0].display" title="{{$ctrl.coding[0].system}}">\
         {{$ctrl.coding[0].code}} </span>         </span>',
    bindings: {coding:'<'},
    controller : function(){
        this.$onChanges = function(obj) {
            //console.log(obj)
        }
    }
})

.component('codeableConcept',{
    //template:"{{$ctrl.display}} <coding coding='$ctrl.cc.coding'></coding>",
    template:"{{$ctrl.cc.text}}   <span ng-hide='$ctrl.cc.text'> <coding coding='$ctrl.cc.coding'></coding></span>",
    bindings: {cc:'<'}
})

.component('reference',{
    bindings: {reference:'<'},
    template:" <span title='{{$ctrl.reference.reference}}'>{{$ctrl.reference.display}}</span>"
})

//will display either a date or a period...
.component('dateorperiod',{
    bindings: {dateorperiod:'<'},
    template:"{{$ctrl.dateorperiod}}"
})

//period only
.component('period',{
    bindings: {period:'<'},
    template:"{{$ctrl.period.start | date:long }} -> {{$ctrl.period.end | date:long }}"
})

//displays a polymorphic value -todo - currently hard coded to quandity...
.component('value',{
    bindings: {value:'<'},
    template:"<codeable-concept cc='$ctrl.value'></codeable-concept>  <quantity quantity='$ctrl.value'></quantity>"
})

.component('quantity',{
    bindings: {quantity:'<'},
    template:"{{$ctrl.quantity.value}} {{$ctrl.quantity.unit}}"
})

;