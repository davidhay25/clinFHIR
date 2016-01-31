/* These are all the services called by renderProfile */

angular.module("sampleApp").service('SaveDataToServer', function($http,$q) {
    return {
        saveResource : function(resource) {

        },
        sendActivityObject : function(activity) {

        }
    }

}).service('GetDataFromServer', function($http,$q) {
    return {
        getValueSet : function(ref,cb) {

        },
        getProfile : function(profileName) {

        },
        getExpandedValueSet : function(vsName) {

        },
        findResourceByUrl : function(type,profile,cb) {

        },
        getFilteredValueSet : function(vs,text){

        }
    }


}).service('Utilities', function($http,$q) {
    return {
        validate : function(resource,cb) {

        },
        profileQualityReport :function (profile) {

        },
        getUCUMUnits : function(unit) {

        },
        getValueSetIdFromRegistry : function(reference, waitingCb, cb) {

        },
        validateResourceAgainstProfile : function(resource,profile) {

        }
    }
}).service('RenderProfileSvc', function($http,$q) {
    return {
        getValueSetsForProfile : function(profile) {

        },
        getProfileStructure : function(profile,cb) {

        },
        parseProfile : function (profile) {

        },
        makeResource :function(profile,patient,resourceId){

        },
        buildTree : function (profile) {

        },
        isUrlaBaseResource : function(profile) {

        },
        getResourcesSelectListOfType :function(allResources, type, url) {

        },
        getUniqueResources : function(allResources) {

        },
        populateTimingList :function (){

        }

    }
}).service('ResourceUtilsSvc', function($http,$q) {
    return {
        getOneLineSummaryOfResource : function(element) {

        }
    }
})


