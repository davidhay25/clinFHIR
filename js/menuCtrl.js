angular.module("sampleApp").controller('menuCtrl', function ( $scope,$rootScope,$localStorage,appConfigSvc,modalService){



    $scope.clearProfileCache = function(){
        console.log('x')
        appConfigSvc.clearProfileCache();
        $rootScope.$broadcast('clearProfileCache');
    };

    $scope.clearPatientCache = function(){
        
        appConfigSvc.clearPatientCache();
        $rootScope.$broadcast('clearPatientCache');
    };
    
    
    $scope.resetConfig = function() {
        delete $localStorage.config;
        appConfigSvc.config();      //set the value to the default
        
        var modalOptions = {
            closeButtonText: 'Ok',
           // actionButtonText: 'Yes, select another',
            headerText: 'Clear cached config',
            bodyText: 'Config has been reset to the default',
            showAction : false
        };

       modalService.showModal({}, modalOptions);

        $rootScope.$broadcast('resetConfigObject');
        //alert('Config has been reset to the default');



    }
});