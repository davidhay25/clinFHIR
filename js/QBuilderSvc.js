angular.module("sampleApp")

    .service('QBuilderSvc', function($q,$http,$filter,moment) {


        let Qlung = `
    {
  "resourceType": "Questionnaire",
  "id": "QLungCancer",
  "url": "http://clinfhir.com/Questionnaire/lungcancer",
  "status": "draft",
  "name": "LungCancerHistologyRequest",
  "title": "A form to capture data to accompany a histology request for lung cancer",
  "item": [
    {
      "linkId": "patinfo",
      "text": "Patient Information",
      "type": "group",
      "item": [
        {
          "linkId": "nhi",
          "text": "NHI",
          "type": "string"
        },
        {
          "linkId": "fname",
          "text": "First Name",
          "type": "string"
        },
        {
          "linkId": "lname",
          "text": "Last Name",
          "type": "string"
        }
      ]
    },
    {
      "linkId": "clinicianinfo",
      "text": "Clinician Information",
      "type": "group",
      "item": [
        {
          "linkId": "cpn",
          "text": "CPN",
          "type": "string"
        }
      ]
    },
    {
      "linkId": "clinicalinfo",
      "text": "Clinical Information",
      "type": "group",
      "item": [
        {
          "linkId": "ss",
          "text": "Smoking Status",
          "type": "choice",
          "answerOption": [
            {
              "valueCoding": {
                "code": "current",
                "system": "http://clinfhir.com/CodeSystem/ss",
                "display": "current"
              }
            },
            {
              "valueCoding": {
                "code": "current",
                "system": "http://clinfhir.com/CodeSystem/ss",
                "display": "ex"
              }
            },
            {
              "valueCoding": {
                "code": "current",
                "system": "http://clinfhir.com/CodeSystem/ss",
                "display": "never"
              }
            }
          ]
        },
        {
          "linkId": "absestos",
          "text": "Asbestos exposure",
          "type": "boolean"
        },
        {
          "linkId": "previousCx",
          "text": "Details of previous cytology or biopsies for this tumour",
          "type": "text"
        },
        {
          "linkId": "previousTx",
          "text": "Details of previous treatment for this tumour",
          "type": "text"
        },
        {
          "linkId": "previousCancer",
          "text": "Details of previous cancer diagnosis",
          "type": "text"
        },
        {
          "linkId": "site",
          "text": "Site and laterality",
          "type": "choice",
          "answerOption": [
            {
              "valueCoding": {
                "code": "rul",
                "system": "http://clinfhir.com/CodeSystem/site",
                "display": "Right Upper Lobe"
              }
            },
            {
              "valueCoding": {
                "code": "rml",
                "system": "http://clinfhir.com/CodeSystem/site",
                "display": "Right Middle Lobe"
              }
            },
            {
              "valueCoding": {
                "code": "rll",
                "system": "http://clinfhir.com/CodeSystem/site",
                "display": "Right Lower Lobe"
              }
            },
            {
              "valueCoding": {
                "code": "lul",
                "system": "http://clinfhir.com/CodeSystem/site",
                "display": "Left Upper Lobe"
              }
            },
            {
              "valueCoding": {
                "code": "lll",
                "system": "http://clinfhir.com/CodeSystem/site",
                "display": "Left Lower Lobe"
              }
            },
            {
              "valueCoding": {
                "code": "mb",
                "system": "http://clinfhir.com/CodeSystem/site",
                "display": "Main Bronchus"
              }
            }
          ]
        },
        {
          "linkId": "resection",
          "text": "Nature of the resection",
          "type": "choice",
          "answerOption": [
            {
              "valueCoding": {
                "code": "wedge",
                "system": "http://clinfhir.com/CodeSystem/resection",
                "display": "wedge"
              }
            },
            {
              "valueCoding": {
                "code": "segmentectomy",
                "system": "http://clinfhir.com/CodeSystem/resection",
                "display": "segmentectomy"
              }
            },
            {
              "valueCoding": {
                "code": "bilobectomy",
                "system": "http://clinfhir.com/CodeSystem/resection",
                "display": "bilobectomy"
              }
            },
            {
              "valueCoding": {
                "code": "lobectomy",
                "system": "http://clinfhir.com/CodeSystem/resection",
                "display": "lobectomy"
              }
            },
            {
              "valueCoding": {
                "code": "pneumonectomy",
                "system": "http://clinfhir.com/CodeSystem/resection",
                "display": "pneumonectomy"
              }
            },
            {
              "valueCoding": {
                "code": "other",
                "system": "http://clinfhir.com/CodeSystem/resection",
                "display": "Other"
              }
            }
          ]
        }
      ]
    },
    {
      "linkId": "specimen",
      "text": "Specimen Information",
      "type": "group",
      "item": [
        {
          "linkId": "specLabel",
          "text": "Specimen Label",
          "type": "string"
        },
        {
          "linkId": "specReturn",
          "text": "Patient requests specimen return",
          "type": "boolean"
        }
      ]
    }
  ]
}


`



        return {

            setItemDescriptionDEP : function(item) {
                let extUrl = "http://clinfhir.com/structureDefinition/q-item-description"
                if (item.extension) {
                    item.extension.forEach(function (ext) {
                        if (ext.url == extUrl ) {
                            item.data = item.data || {}
                            item.data.description = ext.valueString
                        }
                    })
                }

            },

            getQFromServer : function(){
                let deferred = $q.defer()
                let qry = "http://home.clinfhir.com:8054/baseR4/Questionnaire?context=http://clinfhir.com|structuredPath&_sort=name"
                $http.get(qry).then(
                    function (data) {
                        deferred.resolve(data.data)
                    },
                    function (err) {
                        deferred.reject(err.data)
                    }
                )
                return deferred.promise

            },

            makeQR : function(form,hash) {
                //make the QuestionnaireResponse from the form data
                console.log(form,hash)
                let QR = {resourceType:'QuestionnaireResponse',status:'in-progress',answer : []}

                Object.keys(form).forEach(function (key) {
                    let value = form[key]
                    let item = hash[key]  //the definition of the question
                    let answer = {linkId : key}
                    switch (item.type) {

                        case "choice":
                            answer = value      //will be a coding
                            break;
                        default :
                            answer.valueString = value
                    }
                    QR.answer.push(answer)
                })

                return QR

            },

            importQ : function(Q_text) {
                let extUrl = "http://clinfhir.com/structureDefinition/q-item-description"
                let treeData = []
                let hash = {}
                let root = {id:'root',text:'Root',parent:'#',state:{},data:{}}
                treeData.push(root)

                Q = Q_text || Qlung
                let json = angular.fromJson(Q)

                json.item.forEach(function(parentItem){

                    let item = {id: parentItem.linkId,state:{},data:{}}
                    item.text = parentItem.text;
                    item.parent = "root";
                    item.data = {type:parentItem.type,text:parentItem.text};
                    item.data.mult = makeMult(parentItem) //mult
                    item.answerValueSet = parentItem.answerValueSet
                    item.data.description = getDescription(parentItem)


                    hash[item.id] = item.data;
                    treeData.push(item)

                    if (parentItem.item) {
                        parentItem.item.forEach(function (child) {
                            let item = {id: child.linkId,state:{},data:{}}
                            item.text = child.text;
                            item.parent = parentItem.linkId;
                            item.data = {type:child.type,text:child.text};
                            item.data.answerOption = child.answerOption
                            item.data.mult = makeMult(child) //mult
                            item.data.description = getDescription(child)
                            hash[item.id] = item.data;
                            treeData.push(item)


                        })

                    }

                })



                return {treeData : treeData,hash:hash}

                function getDescription(item) {
                    let extUrl = "http://clinfhir.com/structureDefinition/q-item-description"
                    let v = ""
                    if (item.extension) {
                        item.extension.forEach(function (ext) {
                            if (ext.url == extUrl ) {

                                v = ext.valueString
                            }
                        })
                    }
                    return v
                }

                function makeMult(item) {
                    let mult = ""
                    if (item.required) {
                        mult = "1.."
                    } else {
                        mult = "0.."
                    }

                    if (item.repeats) {
                        mult += "*"
                    } else {
                        mult += "1"
                    }
                    return mult
                }


            },

            makeLM :function (treeData) {
                let ar = []
//http://build.fhir.org/ig/HL7/fhir-shorthand/reference.html
                treeData.forEach(function (row,inx) {
                    if (inx > 0) {      //ignore the root
                        if (row.data.type == 'group') {

                        }
                        let lne = "* " + row.text

                        ar.push(lne)
                    }
                })

                return ar.join("\n")

            },
            makeQ: function (treeData) {
               // return {}
                let Q = {resourceType:'Questionnaire',status:'draft',item:[]}


                let lastGroupItem;      //this is the 'latest' item of type root
                treeData.forEach(function (row,inx) {
                    if (inx > 0) {      //ignore the root
                        let item = {linkId: row.id,type:row.data.type,text:row.text}

                        //ValueSet
                        if (row.data.vsName) {
                            // todo - should be url
                            item.answerValueSet = row.data.vsName
                        }
                        //multiplicity
                        if (row.data.mult) {
                            let ar = row.data.mult.split('..')
                            if (ar[0] == '1') {
                                item.required = true
                            }
                            if (ar[1] == '*') {
                                item.repeats = true
                            }
                        }



                        if (row.parent == "root") {
                            //this is off the root, so add it directly to the Q.item[]
                            Q.item.push(item)
                        } else {
                            //this has another parent - we assume it is the last one that is a group type
                            if (lastGroupItem) {
                                lastGroupItem.item = lastGroupItem.item || []
                                lastGroupItem.item.push(item)
                            } else {
                                console.log('lastGroupItem not found')
                            }

                        }
                        if (item.type == 'group') {
                            lastGroupItem = item
                        }

                    }

                })
                return Q
            }
        }
    })