angular.module("sampleApp")
    .controller('documentBuilderCtrl',
        function ($scope,$timeout) {

            $scope.input = {fshToEdit:""}

            $scope.document = {id:'newDocument',section:[]}
            let arPatient = createNewResource("Patient","patient1")
            arPatient.push("* name.text='John Doe'")

            $scope.document.patient = {fsh:arPatient.join('\n')}

            //sample
            let section1 = {code:"xxx",title:"Reason for admission",entry:[]}

            let arCondition = createNewResource("Condition","condition1")
            arCondition.push("* code.text='Appendicitis'")
            let entry1 = {fsh:arCondition}
            entry1.text = "Appendicitis"
            section1.entry.push({fsh:entry1,display:"Appendicitis"})
            $scope.document.section.push(section1)

            //section 2
            let section2 = {code:"yyy",title:"Medications on admission",entry:[]}

            let arDrug1 = createNewResource("MedicationStatement","med1")
            arDrug1.push("* subject = Reference(patient1)")
            arDrug1.push("* medicationCodeableConcept.text='Frusemide, 20 mg mane'")
            section2.entry.push({fsh:arDrug1,display:"Frusemide"})

            let arDrug2 = createNewResource("MedicationStatement","med2")
            arDrug2.push("* subject = Reference(patient1)")
            arDrug2.push("* medicationCodeableConcept.text='metoprolol 80mg nocte'")
            section2.entry.push({fsh:arDrug2,display:"Metoprolol"})

            $scope.document.section.push(section2)


            $timeout(function(){
                var elFSH = document.getElementById("entryFsh");
                let cmOptions = {lineNumbers:true,lineWrapping:true,matchBrackets:true,
                    foldGutter: true,
                    gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"]};

                $scope.editor = CodeMirror.fromTextArea(elFSH,cmOptions);
                $scope.editor.setSize(null,300)

            },1000)

            //let doc = $scope.fshEditor.getDoc();


            $scope.selectEntry = function(entry) {
                $scope.selectedEntry = entry

                //$scope.input.fshToEdit = entry.fsh

                let text = entry.fsh.join('\n')


                //let text = entry.display
                try {
                    var doc = $scope.editor.getDoc();
                    doc.setValue("")
                    var cursor = doc.getCursor();
                    doc.replaceRange(text, cursor);
                } catch (e) {
                    console.log(e)
                }



                }

            $scope.selectSection = function(section) {
                $scope.selectedSection = section
            }


            function createNewResource(type,id) {
                let ar = []

                ar.push("Instance: " + id)
                ar.push("InstanceOf: " + type)
                ar.push("Usage: #example")

                return ar //.join("\n")

            }

        }


    )