/**
 * Created by davidhay on 27/10/14.
 */


angular.module("sampleApp")
    .filter('getLogicalID',function(){
    return function(id) {
        //console.log(id);
        if (id) {
            var ar = id.split('/');
            var lid = ar[ar.length-1];
            return lid;
        } else {
            return [];
        }

    }

}).filter('getAge',function(){
    return function(dob,inBrackets){
        if (dob) {
            var diff = moment().diff(moment(dob),'days');
            var disp = "";
            if (diff < 14) {
                disp = diff + " days";
            } else if (diff < 32) {
                disp = Math.floor( diff/7) + " weeks";
            } else {
                disp = Math.floor( diff/365) + " years";
                //todo logic for better age
            }
            if (inBrackets) {
                return "(" + disp+")";
            } else {
                return disp;
            }

        } else {
            return '';
        }

    }
    })
    .filter('getAgeSeconds',function(){
        return function(da,inBrackets){
            if (da) {
                var diff = moment().diff(moment(da),'seconds');
                var disp = "";
                if (diff < 60) {
                    disp = diff + " secs";
                } else if (diff < 60*60) {
                    var m = Math.floor( diff/60);
                    if (m == 1) {
                        disp =  " 1 minute";
                    } else {
                        disp = m + " minutes";
                    }


                } else if (diff < 60*60*24){
                    var d = Math.floor( diff/(60*60));
                    if (d ==1 ) {
                        disp =  "1 hour";
                    } else {
                        disp = d + " hours";
                    }


                    //todo logic for better age
                } else if (diff < 60*60*24*30){
                    var d = Math.floor( diff/(60*60*24));
                    if (d == 1){
                        disp = '1 day';
                    } else {
                        disp = d + " days";
                    }

                    //todo logic for better age

                } else {
                    var w = Math.floor( diff/(60*60*24*7));
                    if (w == 1) {
                        disp = "1 week";
                    } else {
                        disp = w + " weeks";
                    }


                    //todo logic for better age
                }


                if (inBrackets) {
                    return "(" + disp+")";
                } else {
                    return disp;
                }

            } else {
                return '';
            }

        }})
    .filter('referenceType',function(){
            return function(ref) {
                //console.log(ref)
                //attach a reference to the real resource for all resource references
                if (ref) {
                    //DSTU-2 - this is an array ?? why ??do I need to iterate through
                    var ar = ref[0].split('/');
                    //console.log(ar)
                    return(ar[ar.length-1]);
                } else {
                    return ref;
                }



            }
        }



).directive('autoFocus', function($timeout) {
    return {
        restrict: 'AC',
        link: function(_scope, _element) {
            $timeout(function(){
                _element[0].focus();
            }, 0);
        }
    };
}).filter('resourcesOfType',function(){
        return function(ar,filt) {
            console.log(ar,filt);
            return ar;
        }
    });