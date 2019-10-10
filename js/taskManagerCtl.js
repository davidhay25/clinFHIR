angular.module("sampleApp").controller('taskManagerCtrl',
    function ($scope,$http,appConfigSvc,Utilities,$firebaseObject,$firebaseArray,$uibModal,modalService,taskSvc,logicalModelSvc,
              $location,commonSvc) {

        $scope.firebase = firebase;
        $scope.appConfigSvc = appConfigSvc;
        //let clinFhirDevice = 'Device/cfDevice';
        //note that if yeh task manager is launched from one of the projects, then it will set the correct server
        $scope.conformanceServer = appConfigSvc.getCurrentConformanceServer();


        $scope.input = {};
        $scope.input.period = 'all';

        $scope.tasks = [];

        let fhirVersion = $scope.conformanceServer.version;
        console.log(fhirVersion)

        let taskCode =  {system:"http://loinc.org",code:"48767-8"};

        let wsUrl = 'ws://'+ window.location.host;
        let ws = new WebSocket(wsUrl);


        //the url of the Implementation Guide
        let IgUrl =  $scope.conformanceServer.url + 'ImplementationGuide/cf-artifacts-au3';

        var hash = $location.hash();
        if (hash) {
            //if there's a hash starting with $$$ then this has been started from the project, with an authenticted user...

            if (hash.substr(0,3) == '$$$') {
                IgUrl =  $scope.conformanceServer.url + 'ImplementationGuide/' + hash.substr(3);
                console.log(IgUrl)
            }
        }



        ws.onmessage = function(event) {
            console.log('socket event:', event.data)

            let obj;
            try {
                obj = angular.fromJson(event.data)
            } catch (ex) {
                console.log('Ignoring non Json message')
                $scope.$digest();
            }

            console.log(obj)
            //just disable the autorefresh for now... (Maybe just activate the refresh button
            if (1==2 && obj) {
                if (obj.modelId) {
                    //this will be a note to a task...
                    if ($scope.currentModelId && (obj.modelId === $scope.currentModelId)) {
                        //this is an update to a task for this model...
                        loadTasksForModel($scope.currentModelId)
                        /*
                        $timeout(function(){
                            $scope.$digest()
                            console.log('digest...')
                        },5000)
*/
                    }

                } else if (obj.resourceType == 'Task' && $scope.currentModelId) {
                    //this is a new task. Is it for the model that is currently open?
                    let focus = obj.focus.reference;
                    let ar = focus.split('/');
                    //assume that the model id and url are related (as when created in the Logical Modeller)
                    if (ar[ar.length-1] == $scope.currentModelId) {
                        loadTasksForModel($scope.currentModelId)
                        $scope.$digest()
                    }

                }
            }


        };

        $scope.instanceAuthor = appConfigSvc.config().standardExtensionUrl.instanceAuthor;  //the extension for recording the model path for a comment
        if (!$scope.instanceAuthor) {
            alert("Task warning: You must restart clinFHIR then the Task Manager to reset updated config. Note that this will reset the configured servers.")
        }

        $scope.displayServers = function(){
            let servers = "";
            servers += '<div>Data: ' + appConfigSvc.getCurrentDataServer().name + "</div>";
            servers += '<div>Conf: ' + appConfigSvc.getCurrentConformanceServer().name + "</div>";
            servers += '<div>Term: ' + appConfigSvc.getCurrentTerminologyServer().name + "</div>";
            return servers;
        };

        let hashED = {};    //will have a hash of element definitions by path
        //-----------  login stuff....

        $scope.login=function(){
            $uibModal.open({
                backdrop: 'static',      //means can't close by clicking on the backdrop.
                keyboard: false,       //same as above.
                templateUrl: 'modalTemplates/login.html',
                controller: 'loginCtrl'
            })
        };

        $scope.showVSBrowserDialog = {};
        $scope.showVSBrowserDEP = function(vs) {
            $scope.showVSBrowserDialog.open(vs);        //the open method defined in the directive...
        };


        $scope.viewVS = function(uri) {
            //var url = appConfigSvc
            $scope.showVSBrowserDialog.open(null, uri);
        };

        $scope.logout=function(){
            firebase.auth().signOut().then(function() {
                delete $scope.user;
                //delete $rootScope.userProfile;
                modalService.showModal({}, {bodyText: 'You have been logged out of clinFHIR'})

            }, function(error) {
                modalService.showModal({}, {bodyText: 'Sorry, there was an error logging out - please try again'})
            });

        };
        //called whenever the auth state changes - eg login/out, initial load, create user etc.
        firebase.auth().onAuthStateChanged(function(user) {
            //if there's a hash starting with $$$ then this has been started from the project, with an authenticted user...
            console.log('onauth',user)
            delete $scope.user;

            if (user) {
                $scope.user = user;
                //$scope.userProfile = $firebaseObject(firebase.database().ref().child("users").child(user.uid));
                console.log($scope.user)

            }

        });


        $scope.makeReport = function() {
            console.log( $scope.hashComments)
            console.log($scope.treeData)


            let report = taskSvc.makeHTMLFile($scope.treeData,$scope.hashComments,$scope.model,$scope.stateHash);
            //$scope.htmlReport = report;

            $('#htmlReport').contents().find('html').html(report)

            $scope.downloadReport = window.URL.createObjectURL(new Blob([report],
                {type: "text/html"}));

            //$scope.downloadLinkJsonName = "downloaded"
            var now = moment().format();
            $scope.downloadReportName = "commentReport" + '-' + now + '.html';



/*

            logicalModelSvc.generateHTML($scope.treeData).then(
                function(doc) {
                    $scope.mdDoc = doc;
                    $('#htmlDoc').contents().find('html').html(doc)



                    $scope.downloadLinkDoc = window.URL.createObjectURL(new Blob([doc],
                        {type: "text/html"}));

                    //$scope.downloadLinkJsonName = "downloaded"
                    var now = moment().format();
                    $scope.downloadLinkDocName = $scope.treeData[0].data.header.name + '-' + now + '.html';




                }
            )

            */



        }



        $http.get(IgUrl).then(
            function(data) {
                if (data.data && data.data) {
                    $scope.allModels = []
                    let IG = data.data;
                    let igEntryType = appConfigSvc.config().standardExtensionUrl.igEntryType;

                    if (fhirVersion == 4) {

                        IG.definition.resource.forEach(function (res) {
                            let arExt = commonSvc.getExtension(res,igEntryType)
                            if (arExt.length > 0) {
                                let ext = arExt[0]
                                if (ext.valueCode == 'logical') {
                                    let ar = res.reference.reference.split('/')
                                    $scope.allModels.push({id:ar[ar.length-1]})
                                }
                            }

                        })

                    } else {
                        IG.package.forEach(function (package) {
                            package.resource.forEach(function (res) {
                                if (res.acronym == 'logical') {
                                    if (res.sourceReference && res.sourceReference.reference) {
                                        let ar = res.sourceReference.reference.split('/')
                                        $scope.allModels.push({id:ar[ar.length-1]})
                                    }
                                }
                            })
                        })
                    }






                }
                if ($scope.allModels.length > 0) {
                    $scope.input.selectedModel = $scope.allModels[0]
                    $scope.selectModel($scope.input.selectedModel)
                }


                console.log($scope.allModels);
            }, function(err) {
                console.log(err)
            }
        );

        $scope.selectModel = function(entry) {
            console.log(entry)
            delete $scope.statusHistory;
/*
            $scope.elements = []
            let url =  $scope.conformanceServer.url + 'StructureDefinition/'+ entry.id;
            $http.get(url).then(
                function(data) {
                    console.log(data.data)
                    data.data.snapshot.element.forEach(function (ed) {
                        $scope.elements.push(ed.path)
                    });

                    console.log($scope.elements)

                },
                function(err) {
                    console.log(err)
                }
            );
*/

            loadTasksForModel(entry.id)

        };

        $scope.refresh = function() {
            loadTasksForModel($scope.currentModelId)

        }


        //allow the display for a state to be different to the actual code...
        $scope.stateHash = {};
        $scope.stateHash.requested = 'new';
        $scope.stateHash.received = 'reviewed';
        $scope.stateHash.accepted = 'accepted';
        $scope.stateHash.rejected = 'rejected';
        $scope.stateHash.cancelled = 'cancelled';
        $scope.stateHash.completed = 'completed';

        $scope.states = [{display:'-- All statuses --',code:''}]
        angular.forEach($scope.stateHash,function(v,k){
            $scope.states.push({display:v,code:k});
        });

        $scope.input.filterStatus = $scope.states[0];
       // $scope.model = {id:"StructureDefinition/ADRAllergyIntolerance"};    //load from a selector


        //for the task list filter...
        $scope.canShowTask = function(task,filterStatus, filterEmail) {
            let canShow = false

            //check the status
            if (filterStatus.code === "") {
                canShow = true
            } else if (task.status == filterStatus.code) {
                canShow = true
            }

            if (canShow) {
                //so it passed the status check = what about the author check
                if (filterEmail !== "Anyone") {
                    if (task.requesterDisplay == filterEmail) {
                        canShow = true
                    } else {
                        canShow = false
                    }
                }
                return canShow;

            } else {
                return false;
            }


        };


        //add a note to a comment from the tree view display...
        $scope.addNoteFromTreeView = function(iTask) {


                $uibModal.open({
                    backdrop: 'static',      //means can't close by clicking on the backdrop.
                    keyboard: false,       //same as above.
                    templateUrl: 'modalTemplates/addNote.html',
                    controller: function($scope){
                        $scope.input={}

                        $scope.save = function() {
                            $scope.$close($scope.input.note)
                        }

                    }
                }).result.then(
                    function(note) {
                        console.log(note)
                        if (note && iTask) {

                            var annot = {text:note,time: new Date().toISOString()};
                            annot.authorString = $scope.user.email;

                            //This is an 'update' object
                            let obj = {}
                            obj.note = annot;
                            obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
                            obj.modelId =  $scope.currentModelId;

                            //this will add the note to the task from the server...
                            let url = "/myTask/addNote/" + iTask.id;
                            $scope.showWaiting = true;
                            $http.post(url, obj).then(
                                function (data) {
                                    //for the local display
                                    iTask.notes = iTask.notes || [];
                                    iTask.notes.push(annot);

                                }, function (err) {
                                    alert('Error saving note: ' + angular.toJson(err))
                                }
                            ).finally(function(){
                                $scope.showWaiting = false;
                            })
                        }

                    }
                )
/*

            return;

            note = prompt('Enter note');



            if (note && iTask) {

                var annot = {text:note,time: new Date().toISOString()};
                annot.authorString = $scope.user.email;

                //This is an 'update' object
                let obj = {}
                obj.note = annot;
                obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
                obj.modelId =  $scope.currentModelId;

                //this will add the note to the task from the server...
                let url = "/myTask/addNote/" + iTask.id;
                $scope.showWaiting = true;
                $http.post(url, obj).then(
                    function (data) {
                        //for the local display
                        iTask.notes = iTask.notes || [];
                        iTask.notes.push(annot);

                    }, function (err) {
                        alert('Error saving note: ' + angular.toJson(err))
                    }
                ).finally(function(){
                    $scope.showWaiting = false;
                })
            }
            */
        };



        //add a new note as an annotation
        $scope.addNote = function(note) {



            $scope.localTask.notes = $scope.localTask.notes || [];

            var annot = {text:note,time: new Date().toISOString()};
            annot.authorString = $scope.user.email;
            $scope.localTask.notes.push(annot);
            delete $scope.input.note;


            //This is an 'update' object
            let obj = {}
            obj.note = annot;
            obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
            obj.modelId =  $scope.currentModelId;
            let fhirTask =  $scope.selectedTask.resource;

            if (fhirTask) {
                //this will add the note to the task from the server...
                let url = "/myTask/addNote/" + fhirTask.id
                $http.post(url, obj).then(
                    function (data) {
                        //for the local display
                        fhirTask.note = fhirTask.note || []
                        fhirTask.note.push(annot);
                    }, function (err) {
                        alert('Error saving note: ' + angular.toJson(err))
                    }
                )
            }
        };

        $scope.addNoteFromTreeViewDEP = function(note) {

            $scope.localTask.notes = $scope.localTask.notes || [];

            var annot = {text:note,time: new Date().toISOString()};
            annot.authorString = $scope.user.email;
            $scope.localTask.notes.push(annot);
            delete $scope.input.note;


            //This is an 'update' object
            let obj = {}
            obj.note = annot;
            obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
            obj.modelId =  $scope.currentModelId;
            let fhirTask =  $scope.selectedTask.resource;

            if (fhirTask) {
                //this will add the note to the task from the server...
                let url = "/myTask/addNote/" + fhirTask.id
                $http.post(url, obj).then(
                    function (data) {
                        //for the local display
                        fhirTask.note = fhirTask.note || []
                        fhirTask.note.push(annot);
                    }, function (err) {
                        alert('Error saving note: ' + angular.toJson(err))
                    }
                )
            }
        };

        $scope.selectTask = function(task) {
            $scope.selectedTask = task;
            $scope.fhirTask = task.resource
            $scope.localTask = angular.copy(task)
            delete $scope.localTask.resource;
            delete $scope.statusHistory;
            delete $scope.selectedEd;



            if (hashED[task.path]) {
                $scope.selectedEd = hashED[task.path].ed;
            }

           // console.log( $scope.selectedEd)
        };

        $scope.showStateChange = function(newState,currentState) {
            //requested == new, received = reviewed
            switch (newState) {
                case 'received' :
                    if (currentState == 'requested' || currentState == 'accepted' || currentState == 'rejected') {return true}
                    break;
                case 'accepted' :
                    if (currentState == 'requested' || currentState == 'received') {return true}
                    break;
                case 'rejected' :
                    if (currentState == 'requested' || currentState == 'received') {return true}
                    break;
                case 'cancelled' :
                    if (currentState == 'cancelled' || currentState == 'completed') {return false} else {return true}
                    break;
                case 'completed' :
                    if (currentState == 'accepted') {return true}
                    break;
            }
        };

        $scope.changeState = function(newState) {

            delete $scope.fhirTask.statusReason;

            let note = window.prompt('Enter mandatory note about change');
            if (! note) {
                return;
            }

            var annot = {text:note,time: new Date().toISOString()};
            annot.authorString = $scope.user.email;
            $scope.fhirTask.note = $scope.fhirTask.note || []
            $scope.fhirTask.note.push(annot)

            $scope.fhirTask.statusReason = {text:note}
            //for display
            $scope.localTask.notes = $scope.localTask.notes || []
            $scope.localTask.notes.push(annot)


            $scope.selectedTask.status = newState;
            $scope.localTask.status = newState;
            $scope.fhirTask.status = newState;

            //{note:, fhirServer:, status:}
            let obj = {}
            obj.note = annot;
            obj.fhirServer = appConfigSvc.getCurrentConformanceServer().url;
            obj.status = newState;
            if ($scope.user) {      //should always be present for a state change
                obj.who = {
                    url:  $scope.instanceAuthor,
                    valueReference : {display: $scope.user.email}
                }
            }

            if ($scope.user) {
                obj.email = $scope.user.email;
            }

            let url = "/myTask/changeStatus/" +  $scope.fhirTask.id
            $http.post(url, obj).then(
                function (data) {
                    //for the local display
                    $scope.fhirTask.note = $scope.fhirTask.note || []
                    $scope.fhirTask.note.push(annot);
                }, function (err) {
                    alert('Error saving note: ' + angular.toJson(err))
                }
            )
        };

        $scope.refreshHistory = function(){
            //create a status history for the current task
            let fhirTask =  $scope.selectedTask.resource;

            if (fhirTask) {
                //this will add the note to teh task from the server...
                let url = $scope.conformanceServer.url + "Task/"+$scope.localTask.id + '/_history';    //from parent controller
                $http.get(url).then(
                    function (data) {
                        let hxBundle = data.data;
                        $scope.statusHistory = [];
                        let lastStatus="xx"
                        if (hxBundle && hxBundle.entry) {
                            hxBundle.entry.forEach(function (entry) {
                                let task = entry.resource;
                                if (task.status !== lastStatus) {
                                    //only add the state changes...
                                    //$scope.statusHistory.push(task)
                                    //the last note in the notes is the reason for the change - and hence teh user

                                    let iTask = taskSvc.getInternalTaskFromResource(task)

                                    $scope.statusHistory.splice(0,0,iTask)      //time order
                                    lastStatus = task.status;
                                }

                            })
                        }
                        console.log($scope.statusHistory)
                    }, function (err) {
                        alert('Error saving note: ' + angular.toJson(err))
                    }
                )
            }
        };

        $scope.canShowReportLine = function(task,filterEmail) {
            if (filterEmail == "Anyone") {
                return true
            } else if (task.requesterDisplay == filterEmail) {
                return true
            }
        };

        //load all the tasks for a given model
        function loadTasksForModel(id) {
            console.log('load')
            $scope.currentModelId = id;
            delete $scope.editorEmail;
            let hashEmail = {};      //all the emails of users with comments
            let hashED = {};       //hash of element definitions by path - used to display details
            //let hashNumberOfComments = {}

            $scope.canRefresh = false;

            $scope.tasks.length = 0;
            let url = $scope.conformanceServer.url + "Task";    //from parent controller
            url += "?code="+taskCode.system +"|"+taskCode.code;
            url += "&focus=StructureDefinition/"+ id;

            Utilities.perfromQueryFollowingPaging(url).then(
                function(bundle) {
                    console.log(bundle)
                    if (bundle && bundle.entry) {
                        $scope.allTasksBundle = bundle;

                        bundle.entry.forEach(function (entry) {

                            let resource = entry.resource;      //the fhir Task

                            let iTask = taskSvc.getInternalTaskFromResource(resource,fhirVersion)
                            hashEmail[iTask.requesterDisplay] = iTask.requesterDisplay
                            $scope.tasks.push(iTask)
                        });


                        //for filtering by task creator...
                        $scope.allEmail = ['Anyone'];
                        for (var n in hashEmail) {
                            $scope.allEmail.push(n)
                        }

                        $scope.input.filterEmail = $scope.allEmail[0]
                    }
                    $scope.canRefresh = true;
                    //load the model also. Assume it is on the same server as tasks (both on conformance)
                    let urlModel = $scope.conformanceServer.url + "StructureDefinition/"+id;
                    let hashNumberOfComments = countComments($scope.tasks)
                    loadModel(urlModel,hashNumberOfComments);


                },function(err) {
                    console.log(err)
                }
            );

            //sort by position in the tree
            //$scope.elements
//console.log($scope.treeData)

        }

        function getTasksForPeriod(period,email,status) {



            let filterEmail;
            if (email && email.indexOf('@') > -1) {
                filterEmail = email;
            }
            let hashEmail = {};
            period = period || 'all';
            let newTasks = [];
            $scope.allTasksBundle.entry.forEach(function (entry) {

                let resource = entry.resource;      //the fhir Task

                let iTask = taskSvc.getInternalTaskFromResource(resource,fhirVersion)

                // hashNumberOfComments[iTask.path] = hashNumberOfComments[iTask.path] || 0
                //hashNumberOfComments[iTask.path] ++

                //find the most recent age - whether the task creatoin or a note...
                let age = iTask.age;        //when the task was created
                if (iTask.notes) {
                    iTask.notes.forEach(function (note) {
                        if (note.age < age) {
                            age = note.age;
                        }
                    })
                }



                switch (period) {
                    case 'all' :
                        addTask(iTask,filterEmail,status);
                       // newTasks.push(iTask);
                       // hashEmail[iTask.requesterDisplay] = iTask.requesterDisplay
                        break;
                    case 'day' :
                        if (age < 25) {
                            addTask(iTask,filterEmail,status)
                            //newTasks.push(iTask);
                            //hashEmail[iTask.requesterDisplay] = iTask.requesterDisplay
                        }
                        break;
                    case 'week' :
                        if (age < 168) {
                            addTask(iTask,filterEmail,status)
                            //newTasks.push(iTask);
                            //hashEmail[iTask.requesterDisplay] = iTask.requesterDisplay
                        }
                        break;

                }
            });

            //for filtering by task creator...
            if (!filterEmail) {
                $scope.allEmail = ['Anyone'];
                for (var n in hashEmail) {
                    $scope.allEmail.push(n)
                }

                $scope.input.filterEmail = $scope.allEmail[0]
            }


            return newTasks;

            function addTask(iTask,email,status) {
                if (email) {

                    if (iTask.requesterDisplay !== email) {
                        return;
                    }
                }

                if (status && status.code) {
                    if (iTask.status !== status.code) {
                        return;
                    }
                }


                newTasks.push(iTask);
                hashEmail[iTask.requesterDisplay] = iTask.requesterDisplay
            }

        }

        //count the numbers of tasks by path for the given period
        function countComments(tasks) {
            //period = period || 'all';
            let hashNumberOfComments = {};      //just a count of comments
            $scope.hashComments = {};              //a hash of the actual comment
            tasks.forEach(function (iTask) {
                hashNumberOfComments[iTask.path] = hashNumberOfComments[iTask.path] || 0
                hashNumberOfComments[iTask.path] ++
              //  hashEmail[iTask.requesterDisplay] = iTask.requesterDisplay

                $scope.hashComments[iTask.path] = $scope.hashComments[iTask.path] || []
                $scope.hashComments[iTask.path].push(iTask)
            });
            return hashNumberOfComments
        }

        //load the model and set the treeData...
        function loadModel(urlModel,hash) {
            //let urlModel = $scope.conformanceServer.url + "StructureDefinition/"+id;
            $http.get(urlModel).then(
                function(data) {
                    $scope.model = data.data;


                    $scope.treeData = logicalModelSvc.createTreeArrayFromSD( $scope.model);
                    $scope.originalTreeData = angular.copy($scope.treeData);        //besaue the tree will be decorated later...

                    decorateTree( $scope.treeData,hash);
                  //  $scope


                    /*
                    $scope.treeData.forEach(function (item) {
                        let id = item.data.idFromSD;
                        if (hash[id]) {
                            item.text += " <span class='badge'>"+hash[id]+"</span>"
                        }

                    });
*/
                    console.log($scope.treeData[1])
                    
                    

                    //$scope.treeData[1].text += "<span class='badge'>test</span>"
                    drawTree()


                    //let editorExtUrl = appConfigSvc.config().standardExtensionUrl.editor;
                    $scope.editorEmail = taskSvc.getModelEditor( $scope.model);

                    if ( $scope.model.snapshot &&  $scope.model.snapshot.element) {
                        $scope.model.snapshot.element.forEach(function (ed) {
                            hashED[ed.path] = {ed:ed};
                            //the id property is the original path when the element was created and is unchanged if the element is moved.
                            //the comment path is actualluy that element...
                            if (ed.id) {
                                hashED[ed.id] = {ed:ed};
                            }
                        })
                    }
                },
                function(err) {
                    alert(angular.toJson(err))
                }
            )
        }

        //add the count of comments to the treee
        function decorateTree(arTree,hashNumberOfComments) {
            arTree.forEach(function (item) {
                let id = item.data.idFromSD;
                if (hashNumberOfComments[id]) {
                    item.text += " <span class='badge'>"+hashNumberOfComments[id]+"</span>"
                }

            });
        }

        function drawTree() {

            //not sure about this...  logicalModelSvc.resetTreeState($scope.treeData);    //reset the opened/closed status to the most recent saved...




            $('#lmTreeView').jstree('destroy');
            $('#lmTreeView').jstree(
                {'core': {'multiple': false, 'data': $scope.treeData, 'themes': {name: 'proton', responsive: true}}}
            ).on('changed.jstree', function (e, data) {
                //seems to be the node selection event...

                if (data.node) {
                    console.log(data.node)
                    $scope.selectedNode = data.node;
                    $scope.selectedED = logicalModelSvc.getEDForPath($scope.model,data.node)
console.log($scope.selectedED)
                   // $scope.


                }

                $scope.$digest();       //as the event occurred outside of angular...

            }).on('redraw.jstree', function (e, data) {
/*
                //ensure the selected node remains so after a redraw...
                if ($scope.treeIdToSelect) {
                    $("#lmTreeView").jstree("select_node", "#"+$scope.treeIdToSelect);
                    delete $scope.treeIdToSelect
                }
*/
            }).on('open_node.jstree',function(e,data){
/*
                //set the opened status of the scope property to the same as the tree node so we can remember the state...
                $scope.treeData.forEach(function(node){
                    if (node.id == data.node.id){
                        node.state.opened = data.node.state.opened;
                    }
                });
                $scope.$digest();
                */
            }).on('close_node.jstree',function(e,data){
/*
                //set the opened status of the scope propert to the same as the tree node so we can remember the state...
                $scope.treeData.forEach(function(node){
                    if (node.id == data.node.id){
                        node.state.opened = data.node.state.opened;
                    }
                })
                $scope.$digest();
                */
            });


        }


        //
        $scope.setPeriod = function(period) {
            $scope.tasks = getTasksForPeriod(period,$scope.input.filterEmail,$scope.input.filterStatus);   //get the tasks for this period (including notes)

            let hashNumberOfComments = countComments($scope.tasks);     //get the count of tasks by path
            $scope.treeData = angular.copy($scope.originalTreeData);    //reset the tree to the original

            decorateTree($scope.treeData,hashNumberOfComments)          //set the count of tasks in the tree...
            drawTree();
            //let tree = angular.copy()
        };

        $scope.setAuthor = function(email) {


        }


    });