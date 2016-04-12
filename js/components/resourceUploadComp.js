/* Resource uploader component*/

angular.module('sampleApp').component('resourceUpload',
    {
        bindings : {
            type : '<',
            onresourceuploaded : '&',
            
        },
        templateUrl : 'js/components/resourceUploadTemplate.html',
        controller: function (appConfigSvc,$http,modalService,$localStorage) {

            this.input = {};
            this.resourceType = "StructureDefinition";
            var that = this;

            //that.onresourceuploaded({uri:'s'});

            this.selected = function(s) {
                console.log(s)
            };
            
            this.showUrl = function(name) {
                //var name = this.input.name;
                //todo - this assumes a confrmance resource
                //this.url = $localStorage.config.servers.conformance + 'StructureDefinition/'+name;

                this.url = appConfigSvc.config().servers.conformance + 'StructureDefinition/'+name;
            };

            this.upload = function(){

                var fileToUpload =  document.getElementById('uploadFile').files[0];
                if (! fileToUpload) {
                    alert('Please select the file to upload')
                    return;
                }

                //first see if the file exists
                //var query
                that.waiting = true;
                $http.get(this.url).then(


                    function() {
                        //if it does exist then see if it should be replaced...
                        var modalOptions = {
                            closeButtonText: "No, I'll choose another",
                            actionButtonText: 'Yes, please update',
                            headerText: 'Resource already exists',
                            bodyText: 'Are you sure you want to replace this resource?'
                        };

                        modalService.showModal({}, modalOptions).then(function (result) {
                            //this is the 'yes'
                            uploadFile(fileToUpload,that.url,that);
                        },
                        function(){
                            that.waiting = false;
                        })

                    },
                    function(err) {
                        console.log(err);
                        //if the resource does not exist, then it can be created...
                        if (err.status==404) {
                            uploadFile(fileToUpload,that.url,that);
                        } else {
                            alert(angular.toJson(err));
                        }
                    }
                )


            };

            function uploadFile(fileToUpload,url,ctx){
                var reader = new FileReader();
                ctx.waiting = true;

                //console.log(url)



                reader.onloadend = function(e){
                    var data = e.target.result;

                    //console.log(data)
                    //return;
                    var config = {};
                    config.headers = {'Content-Type':'application/xml+fhir'}
                    $http.put(url,data,config).then(
                        function(response) {
                            alert('Resource has been updated.');
                            ctx.onresourceuploaded({url:url});
                        },
                        function(err) {
                            alert(angular.toJson(err));
                        }
                    ).finally(function(){
                        ctx.waiting = false;
                    });
                };
                reader.readAsText(fileToUpload);

            }
        }
    });