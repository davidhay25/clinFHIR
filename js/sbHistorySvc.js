angular.module("sampleApp").service('sbHistorySvc', function($localStorage) {

    var history = $localStorage || []

    return {
        addItem : function(type,id,succeed,details,container){
            //type is the kind of operation
            //id is the if of the object being acted on
            //succeed is true'false
            //details will vary according to type
           var item = {type:type,id:id,succeed:succeed,details:angular.copy(details)};
           container.tracker = container.tracker || []
            container.tracker.push(item)
           // console.log(history)
        },
        getHistoryDEP: function() {
            return history;
        }

    }

});