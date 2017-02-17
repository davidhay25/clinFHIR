
angular.module("sampleApp")
    .controller('codeSystemCtrl',
        function ($scope,$http,appConfigSvc,$q) {

            $scope.cs = {concept:[]};     //the CodeSystem resource



            $scope.moveConcept = function(inx,dirn) {
                //console.log(dirn,inx);
                var ar = $scope.cs.concept;
                moveThing(ar,inx, dirn);

            }


            function moveThing(ar,inx,dirn) {

                if (dirn == 'up') {

                    var x = ar.splice(inx-1,1);  //remove the one above
                    ar.splice(inx,0,x[0]);       //and insert...


                } else {
                    var x = ar.splice(inx+1,1);  //remove the one below
                    ar.splice(inx,0,x[0]);       //and insert...
                }
            }


            function makeExample() {
                $scope.cs.name = 'Moon Phase';
                $scope.cs.concept.push({code:'new',display:'New Moon',definition:"Disc completely in Sun's shadow (lit by earthshine only)"})
                $scope.cs.concept.push({code:'wc',display:'Waxing Crescent',definition:'1 -> 49% lit disc'})
                $scope.cs.concept.push({code:'q1',display:'First Quarter',definition:'50% lit disc'})

                $scope.cs.concept.push({code:'waxg',display:'Waxing Gibbous',definition:'51 -> 99% lit disc'})
                $scope.cs.concept.push({code:'full',display:'Full Moon',definition:'Completely illuminated disc'})
                $scope.cs.concept.push({code:'waneg',display:'Waning Gibbous',definition:'99 -> 51 % lit disc'})
                $scope.cs.concept.push({code:'lq',display:'Last Quarter',definition:'50% lit disc'})
                $scope.cs.concept.push({code:'wanecres',display:'Waning Crescent',definition:'49 -> 1% lit disc'})



            }

            makeExample();



    })
