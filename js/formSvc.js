angular.module("sampleApp")
    .service('formSvc', function($http,$q) {

        return {
            //generate a QR from a Q
            makeQR : function(Q) {
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