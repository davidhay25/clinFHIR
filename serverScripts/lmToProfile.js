#!/usr/bin/env node

let fs = require('fs');
let syncRequest = require('sync-request');

const baseTypeExt = "http://clinfhir.com/fhir/StructureDefinition/baseTypeForModel";
const extDefExt = "http://clinfhir.com/fhir/StructureDefinition/simpleExtensionUrl";
const extElementStatus = "http://clinfhir.com/fhir/StructureDefinition/edStatus";

let remoteFhirServer = "http://home.clinfhir.com:8040/baseDstu3/";
let arFixedElements=["id","meta","text","meta","language","implicitRules","contained","modifierExtension"];   //elements not in the model, but stil belong in the profile


let modelId = "NzNHIPatient";
//get the model

let options = {};
options.headers = {"accept": "application/json+fhir"}
options.timeout = 20000;        //20 seconds

let urlModel = remoteFhirServer + "StructureDefinition/"+modelId;
console.log("Load model: "+ urlModel)
let response = syncRequest('GET', urlModel, options);

//console.log(urlModel, response.body.toString())

let model = JSON.parse(response.body.toString());
let baseType = getSingleExtensionValue(model,baseTypeExt).valueString;


let err = [];
//let modelHashByMappedPath = {};          //a hash of all paths in the model keyed by mapped path (to detect those removed from the model
let modelPathHash = {};     //a hash of all the elements by mapped path
let rootExtensions = [];     //a list of extensions on the root
let baseExtensionsHash = {}; //hash of extensions for a base path
model.snapshot.element.forEach(function(ed,inx){
    let modelPath = ed.path;
    //modelHashByMappedPath[modelPath] = ed;

    let elementStatusExt = getSingleExtensionValue(ed,extElementStatus)
    let elementStatus = 'included'
    if (elementStatusExt) {
        elementStatus = elementStatusExt.valueString;
    }

    if (inx > 0 && elementStatus !== 'excluded') {      //not the first element or excluded elements...

        let mapPath = getMappedPath(ed);        //the path in the base resource that this element is mapped to...
       // modelHashByMappedPath[mapPath] = ed;

        if (! mapPath) {
            //there is no mapping path.

            //Is this a child of an extension? If so, we can ignore it...
            let ar = modelPath.split('.');
            ar.pop();
            let mp = ar.join('.');
         //   if (! rootExtensions[mp]) {
                console.log("The model path " + modelPath + " has no FHIR mapping")
          //  }


        } else {




            //is mapped to an extension?
            if ( mapPath.indexOf('xtension') > -1) {
                let extUrl = null;//'No extension specified';
                let ext = getSingleExtensionValue(ed,extDefExt);
                if (ext) {
                    extUrl = ext.valueString;
                }


                //is this extension off the root - or is it off an element?
                let ar = ed.path.split('.')
                if (ar.length == 2) {
                    //this is off the root
                    //rootExtensions[modelPath] = {ed:ed, url:extUrl};
                    rootExtensions.push( {ed:ed, url:extUrl});
                } else {
                    //this is off a child element. We assume that the preceeding element is the 'parent'
                    //what's the base path for the parent of this extension? It will be the element before it (assuming only a single extension) per element
                    let parentED = model.snapshot.element[inx-1];
                    let baseElementPath = getMappedPath(parentED);
                    baseExtensionsHash[baseElementPath] = baseExtensionsHash[baseElementPath] ||[]  //allow for multipe extensions eventially
                    baseExtensionsHash[baseElementPath].push({ed:ed,url:extUrl});   //the ed from the model descfibing this extension
                }
            } else {

                //needs to be an array as a multiple elements in the model can be mapped to the same element in the base type...
                //modelPathHash contains the ed from the model, keyed by the mapped path from the base type
                //don't bother with extensions as we know they are managed separately...
                modelPathHash[mapPath] = modelPathHash[mapPath] || []
                modelPathHash[mapPath].push({ed:ed});
            }

        }
    }
});


//console.log(JSON.stringify(rootExtensions))


//get the base type.
console.log('Loading base type...');
let baseUrl = remoteFhirServer + "StructureDefinition/" + baseType;
console.log("Load base type: "+baseUrl)

response = syncRequest('GET', baseUrl, options);

let baseModel = JSON.parse(response.body.toString())

let profile = {resourceType:'StructureDefinition'};
let rootName = "nhipatient"
profile.url = "http://hl7.org.nz/fhir/StructureDefinition/"+rootName;
profile.id=rootName;
profile.name = rootName;
profile.version = "0.1";
profile.status="draft";
profile.derivation ='constraint';
profile.type='Patient';     //todo get from extension
profile.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Patient";
profile.fhirVersion = "3.0.1";
profile.kind="resource";
profile.abstract=false;

profile.differential = {element:[]}

let top = {};
top.id = baseType;
top.path=baseType;
profile.differential.element.push(top);

//add the extensions that are off the root. This is actually slicing (on extension). All root extensions need tro be in a single group...

let discriminatorAdded = false;
let extensionCount = 0;
    rootExtensions.forEach(function(item) {
    //let item = rootExtensions[key]
    let extED = item.ed;
    let extUrl = item.url;

    if (extUrl) {
        let path = extED.path;

        //this is an extension off the root...
        if (!discriminatorAdded) {
            //add the discriminator element...
            let element = {}
            element.id = baseType + ":extensionDiscriminator";
            element.path = baseType + ".extension";
            element.slicing = {discriminator:[{type:'value',path:'url'}]};
            element.slicing.rules = 'open';
            profile.differential.element.push(element);
            discriminatorAdded = true
        }
        //now add the extension definition;
        if (extensionCount < 1000) { //just while testing
            addExtensionReference(profile.differential.element, extUrl, extED, baseType)
        }

        extensionCount++

    }

})


//iterate through the base model. The profile needs to be in this order
baseModel.snapshot.element.forEach(function(ed,inx){
    if (inx > 0) { //ignore the first
        let basePath = ed.path;

        if (!modelPathHash[basePath]) {
            //There is no element in the model mapped to this one - or it has been excluded...
            console.log('Warning: ' + basePath + " not found")

            //just make sure this isn't one of the elements in the profile, even if not in the model
            let ar = basePath.split('.');

            //arFixedElements are elements like text, contained that generally aren't in the model, but shoudl not be excluded from the profile
            if (arFixedElements.indexOf(ar[1]) == -1){
                //cleanED(newEd,baseType)

                //if the parent element is already in the diff, then don't add it
                let parentInDiff = false;
                /* temp
                profile.differential.element.forEach(function(elementDef){
                    if (basePath.startsWith(elementDef.path)) {
                        parentInDiff = true;
                    }
                });
*/
                if (!parentInDiff) {
                    ed.max = "0";
                    ed.min = 0;  //todo - is there a situation where the base min = 1??
                    profile.differential.element.push(ed);
                    console.log('Warning: ' + basePath + " not found, min & max set to 0 in the diff")
                } else {


                }

            }

        } else if (modelPathHash[ed.path].length >1) {
            //there is more than one model element mapped to this one - it must be sliced...
            console.log('sliced element:'+ed.path)

            addSlices(baseType,profile.differential.element,ed,modelPathHash[ed.path])
        }

        else {
            //this element has a mapping in the model. Is it different to the base...
            let isEDDifferent = isDifferent(ed)
            if (isEDDifferent) {

                if (isEDDifferent.type == 'minmax') {


                    let hash = modelPathHash[ed.path];  //the ed from the model that is mapped to this path from the base...
                    if (hash) {
                        if (hash.length == 1) {

                            let newEd = hash[0].ed

                            cleanED(newEd, baseType)
                            profile.differential.element.push(newEd);
                        } else {
                            //this is a sliced element - ie more than one element in the model is mapped to this base element...
                        }

                    }

                }

            }

            //are there any immediate children of this node that are mapped to an extension?
            if (baseExtensionsHash[basePath]) {
                baseExtensionsHash[basePath].forEach(function (item) {
                    addExtensionReference(profile.differential.element, item.url, item.ed, basePath)
                })
            }

        }


    }

});


fs.writeFileSync("/Users/davidhay/nhiIG/resources/structuredefinition-nhipatient.json",JSON.stringify(profile))

function addSlices(baseType,diff,baseED,mappings) {

    //get the data type from the first mapping
    let type = mappings[0].ed.type;
    let code = type[0].code

    switch (code) {
        case "Identifier" :
            //add the discriminator
            let element = {}
            element.id = baseED.path;
            element.path = baseED.path;// + ".extension";
            element.slicing = {discriminator:[{type:'value',path:'system'}]};
            element.slicing.rules = 'open';
            diff.push(element);

            //now the individual slices
            mappings.forEach(function(item){
                let iEd = item.ed;
                cleanED(iEd,baseType);
                iEd.path = baseED.path;
                iEd.sliceName = iEd.label;
                iEd.id = baseED.path + ':'+ iEd.label;
                diff.push(iEd);
            });


            break;
    }

}

//add an extension reference to the diff
function addExtensionReference(diff, extUrl, extED, root) {
    let name = extED.label;
    let extElement = {};
    extElement.id = root + ".extension:"+name;
    extElement.path = root + ".extension";
    extElement.sliceName = name;
    extElement.min = extED.min;
    extElement.max = extED.max;
    extElement.binding = extED.binding;
    let type = {code:'Extension',profile:extUrl}
    extElement.type = [type];
    diff.push(extElement);
   // if (extensionCount < 1) { //just while testing
      //  profile.differential.element.push(extElement);
   // }
}

//remove all the stuff that is clinfhir specific from the ed...
function cleanED(modelED,baseType) {

    delete modelED.extension;       //these are for clinFHIR use
    delete modelED.mapping;         //also clinFHIR specific
    //change the path to refer to the base profile
    let ar = modelED.path.split('.');
    ar[0] = baseType
    modelED.path = ar.join('.')

    //and change the base
    if (modelED.base && modelED.base.path) {
        let ar = modelED.base.path.split('.')
        ar[0] = baseType;
        modelED.base.path = ar.join('.')
    }

}


//returns true if the mapped ed is different to that in the base resource
function isDifferent(baseED) {

    //ignore extensions for now...
    if (baseED.path.indexOf('xtension') > -1) {
        return;
    }


    let path = baseED.path;     //the path in the base ED
    let mEd = modelPathHash[path];  //the ed in the model that is mapped to this element
    if (! mEd) {
        //must have been deleted from the model
        return {type:'missing',msg: "ED from path "+ path + ' not present in model'};
    }
   // console.log(mEd)
   // console.log('---------')




    let modelED =  mEd[0].ed;       //todo - temp, we'll lok for slicing stuff soon...
    if (modelED.min !== baseED.min) {
        return {type:'minmax',msg: "ED for path "+ path + ' has different min value from base (' + modelED.min + "/" + baseED.min + ")"};
    }

    if (modelED.max !== baseED.max) {
        return {type:'minmax',msg: "ED for path "+ path + ' has different max value from base (' + modelED.max + "/" + baseED.max + ")"};
    }


}

function getMappedPath(ed) {
    let mapPath;
    if (ed.mapping) {

        ed.mapping.forEach(function(map) {

            if (map.identity == 'fhir') {
                let ar = map.map.split('|')
                //console.log(ar[0])
                mapPath = ar[0]
            }

        })
    }
    return mapPath;
}



function getSingleExtensionValue(resource,url) {
    //return the value of an extension assuming there is only 1...
    var extension;
    if (resource && url) {
        resource.extension = resource.extension || []
        resource.extension.forEach(function(ext){
            if (ext.url == url) {extension = ext}
        });
    }

    return extension;
}