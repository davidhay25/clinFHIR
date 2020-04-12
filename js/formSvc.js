angular.module("sampleApp")
    .service('formSvc', function($http,$q) {

        let extItemDescription = 'http://clinfhir.com/fhir/StructureDefinition/qItemDescription';

        function makeStringExtension(obj,value,extDef) {
            obj.extension = obj.extension || []
            let ext = {url:extDef,valueString:value}
            obj.extension.push(ext)
        }

        return {

            makeFhirQ : function(Q) {
                let fhirQ = Q
                //generate a FHIR questionnaire from the internal Q (convert to extensions as required


                let arItems = this.makeFlatModel(fhirQ);    //a simple list of all the items...
                arItems.forEach(function(item){
                    if (item.description) {
                        makeStringExtension(item,item.description,extItemDescription)
                    }

                });

                return fhirQ
            },
            makeInternalQ : function(fhirQ) {
                //generate an internal Q from a FHIR one (convert from extenaions)

                let arItems = this.makeFlatModel(fhirQ);    //a simple list of all the items...
                arItems.forEach(function(item){
                    if (item.extension) {       //assume simple string extensions only (for now)
                        item.extension.forEach(function(ext){
                            //todo - is there a better structure than this?

                            switch (ext.url) {
                                case extItemDescription :
                                    item.description = ext.valueString;
                                    break;
                                default :
                                    console.log('unknown extension url: '+ext.url)
                                    break;

                            }
                            /*
                            if (ext.url == extItemDescription) {
                                item.description = ext.valueString;
                            } else {
                                console.log('unknown extension url: '+ext.url)
                            }
                            */

                        })
                        //makeStringExtension(item,item.description,extItemDescription)
                    }

                });

                return fhirQ;
            },

            makeFlatModel : function(item){
                let ar = [];

                if (!item) {
                    return ar;
                }

                //this item has no children - ie it isn't a group
                if (!item.item) {
                    return [item]
                }

                processGroup(item)

                console.log(ar)
                return ar;

                //take an item object. If it's
                function processGroup(item) {
                    ar.push(item)
                    //ar.push({text:item.text,type:'group'})
                    item.item.forEach(function(child){
                        if (child.type == 'group') {
                            processGroup(child)
                        } else {
                            ar.push(child)
                        }
                    })



                }
            },


            makeQR : function(Q) {
                //generate a QR from a Q
                let QR = {resourceType : "QuestionnaireResponse", item:[]}

                processGroup(QR.item,Q.item);
                return QR;


                function processGroup(parentItem,items) {
                    items.forEach(function (item) {
                        let qrItem = {};
                        qrItem.text = item.text;
                        qrItem.linkId = item.linkId;

                        switch (item.type) {
                            case 'string' :
                                qrItem.valueString = 'Test string'
                            case 'boolean' :
                                qrItem.valueBoolean = true;
                                break;
                            case 'decimal' :
                                qrItem.valueDecimal = 1.23;
                                break;
                        }

                        parentItem.push(qrItem)

                        if (item.item) {
                            //let newParent = [];
                            qrItem.item = []
                            processGroup(qrItem.item,item.item)
                        }


                    })

                }

            }
        }

    }
);