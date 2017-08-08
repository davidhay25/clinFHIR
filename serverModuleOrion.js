
var fs = require('fs');
var JSONPath = require('JSONPath');

function setup(app) {
    app.get('/orionTest/test',function(req,res){
        res.json({OK:"OK"})
    });

    app.get('/orionTest/performAnalysis',function(req,res){
        var result =  performAnalysis();
        res.json(result)
    })

}

//load the v2
var pathToFile = "/Users/davidha/clinfhir/FHIRSampleCreator/artifacts/ADT-sample.hl7"
var hl7Str = fs.readFileSync(pathToFile,{encoding:'utf8'})

//console.log(hl7)
var vo = convertV2ToObject(hl7Str);
var hl7Hash = vo.hash;
var hl7Msg = vo.msg;

//load the FHIR resource
pathToFile = "/Users/davidha/clinfhir/FHIRSampleCreator/artifacts/encounter-fhir.json"
var FHIR = JSON.parse(fs.readFileSync(pathToFile,{encoding:'utf8'}));


//load the mapfile
pathToFile = "/Users/davidha/clinfhir/FHIRSampleCreator/artifacts/encounterV2Mappings.json"
var Map = JSON.parse(fs.readFileSync(pathToFile,{encoding:'utf8'}));


//console.log(JSONPath({path:'class',json:FHIR}))

function performAnalysis() {
    var response = {line:[]};
    response.v2Message = hl7Msg;
    response.map = Map;

    var arResult = [];
    Map.forEach(function (item) {
        var result = {description: item.description};
        result.v2 = {key: item.v2, value: getFieldValue(hl7Hash,item.v2)};

        //we need to remove the first segment in the path as it isn't present in the actual resource...
        var fhirKey = item.fhir;
        var ar = fhirKey.split('.');
        ar.splice(0,1);

        result.fhir = {key: item.fhir, value:JSONPath({path:ar.join('.'),json:FHIR})}
        response.line.push(result)
    });
    return response;
}







//console.log(hl7Hash);
//var val = getFieldValue(hl7Hash,'PID-5');
//console.log('HL7 val -  ' + val)

//var fVal = JSONPath({path:'patient',json:FHIR})

//var fVal = getFHIRValue('patient.reference',FHIR)

//console.log('fhir val -  ' , fVal)



//not used - but left it in there to remind me how it should work...
function getFHIRValue(path,resource) {


    var getLeafValue = function(path,resource) {
        var ar = path.split('.')
        console.log('path: ' +path)
        if (ar.length == 1) {
            //this is the node on which the target is a direct child so return it
            console.log('==>',resource[path])

             return resource[path];
        } else {
            //need to drop down a level
            var nextLevelElement = resource[ar[0]];
            console.log('nl:',nextLevelElement);
            ar.splice(0,1);     //remove the current parent
            var newPath = ar.join('.')
            return getLeafValue(newPath,nextLevelElement)
        }
    };

    var v=""
    v = getLeafValue(path,resource)

  //console.log('----===' ,resource['patient']['reference'])

    console.log('--> ',v)
    //return getLeafValue(path,resource);
}



//return the value of this field. - field name is like PV1-7.9.2
function getFieldValue(hl7Hash,fieldName) {

    var response = {values:[]}

    var ar = fieldName.split('-');
    var segmentCode = ar[0];                //eg PV1
    var fieldNumberAsString = ar[1];         //eg 7.9.2
    var fieldNumber = parseInt(ar[1],10);   //eg 7

    var segments = hl7Hash[segmentCode]     //each segment is a full seg,ent - eg a PV1...
    if (! segments) {
        return
    }
    //var arValues = [];      //there can be more than one...
    segments.forEach(function(seg){
        //seg is a single segment...
        var fieldValue = seg[fieldNumber];       //the field value as a string
        response.fullValue = fieldValue;
        var ar1 = fieldNumberAsString.split('.');
        switch (ar1.length) {
            case 1 :                        //full field
                response.values.push(fieldValue)
                break;
            case 2 :                        //sub value - eg 7.9
                if (fieldValue) {
                    var arSubvalue = fieldValue.split('^');
                    if (arSubvalue.length >= ar1[1]) {

                        response.values.push(arSubvalue[ar1[1]])
                    }
                }
                break;
            case 3 :                        //sub-sub value - eg 7.9.2
                if (fieldValue) {
                    var arSubvalue = fieldValue.split('^');
                    if (arSubvalue.length >= ar1[1]) {
                        var subSubValue = ar1[1];
                        var arSS = subSubValue.split('&');
                        if (arSS.length >= ar1[2]) {
                            response.values.push(arSS[ar1[2]])
                        }



                    }
                }


                break;
        }



    })
    return response;
}

//convert an hl7 message  hash[segmentCode] = array of segments with that code
function convertV2ToObject(hl7) {
    var hash = {}
    var arMessage = [];
    //first, convert into an array
    var ar = hl7.split('\n')        //the splitting is a bit wierd - but this works for now...
    ar.forEach(function(line){
        var arLine = line.split('|');
        var segmentName = arLine[0];
        hash[segmentName] = hash[segmentName] || []
        hash[segmentName].push(arLine);


        arMessage.push(arLine)
        //console.log(arLine)
    })

    //console.log(hash);
    return {hash:hash,msg:arMessage};


}

module.exports= {
    setup : setup
}