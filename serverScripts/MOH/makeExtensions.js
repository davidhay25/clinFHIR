#!/usr/bin/env node

//generate extensiondefinitions from models
//if an extension is used more than once in the



let fs = require('fs');
let syncRequest = require('sync-request');



let IGEntryType = 'http://clinfhir.com/StructureDefinition/igEntryType';
let canonicalUrl = 'http://clinfhir.com/fhir/StructureDefinition/canonicalUrl';


let nzPrefix = "http://hl7.org.nz/fhir/StructureDefinition";    //the prefix for NZ extensions...

//let remoteFhirServer = "http://home.clinfhir.com:8040/baseDstu3/";
let remoteFhirServer = "http://home.clinfhir.com:8054/baseR4/"; //the server where the models are stored


let uploadServer = "http://home.clinfhir.com:8054/baseR4/";     //the server to upload the Extension def SD's to...
//let uploadServer = null;

//the extension from the LM where the extension url is placed...
let extensionUrl = "http://clinfhir.com/fhir/StructureDefinition/simpleExtensionUrl";

let outFolder = "/Users/davidhay/sharedWithVB/mohProfiles/";

//let outFolder = "/Users/davidhay/Dropbox/contracting/MOH/ResourcesForIG/extensions/";


let hashValueSet = {missing:[]}   //all the valuesets in the models. missing are coded with no VS


//let arModels = ["HpiPractitionerRole"];
let arModels = [];

let options = {};
options.headers = {"accept": "application/json+fhir"}
options.timeout = 20000;        //20 seconds


//get all the models in the IG

//the implementation guide - the one on file...
let IGPath = "/Users/davidhay/Dropbox/contracting/MOH/ResourcesForIG/nzRegistry.json";
let IG = JSON.parse(fs.readFileSync(IGPath).toString());

/*
let url = remoteFhirServer + 'ImplementationGuide/cf-artifacts-nz3';
let response = syncRequest('GET', url, options);
let IG = JSON.parse(response.body.toString());

*/

IG.definition.resource.forEach(function (item) {
    if (item.exampleCanonical) {
        //this is an example...
    } else {
        let ar = item.reference.reference.split('/');
        let id = ar[ar.length - 1]
        //console.log(id)
        arModels.push(id)
    }
});


//arModels = ["HpiPractitioner"];

arModels = ["NzNHIPatient"];

//assume all the models are for the same IG...
let arIgEntry = [];   //a set of definition.resource entries to insert into an IG. ?todo directly update IG?

arModels.forEach(function (modelId) {
   // console.log('Examining '+modelId)
    let urlModel = remoteFhirServer + "StructureDefinition/"+modelId;
    //console.log("Load model: "+ urlModel)


    let response = syncRequest('GET', urlModel, options);
    let model = JSON.parse(response.body.toString());
    let hashExtension = {};
    let currentItem;        //

    model.snapshot.element.forEach(function(ed,inx) {
        let path = ed.path;

        let description = ed.definition;

        if (ed.mapping) {
            ed.mapping.forEach(function (map) {
                if (map.map) {
                    if (map.map.indexOf('xtension') > -1 ) {
                        //this is an extension defined in the NZ ...
                        currentItem = null;     //always reset the currentItem for a new extension

                        //get the dataType
                        let dataType;
                        if (ed.type && ed.type.length > 0) {
                            dataType = ed.type[0].code;
                        }

                        //get the url
                        let ext = getSingleExtensionValue(ed,extensionUrl);
                        if (ext) {
                            let url = ext.valueString;      //the url of the extension
                            let item = {path:path, ed:[ed]} ;    //note there could be multiple ed's - ie a complex extension

                            let arPath = path.split('.');
                            if (arPath.length == 2) {

                                item.context = [{type:'element',expression:'DomainResource'}];         //means it is off the root...
                            } else {

                                item.context = [{type:'element',expression:'Element'}];         //means it can be used anywhere...
                            }

                            item.dataType = dataType;
                            item.url = url;

                            //item.binding = ed

                            let key = path + url;
                            hashExtension[key] = item;
                            currentItem = item;     //used for complex extensions - the children will be added to it...






                        } else {
                            console.log('>>>>>>>>>>>> No extension url found for path '+path)
                        }

                    } else if (map.map[0] == '#') {
                            //yes, this is a child. Add the ED to the current one. Assume the 'child' is immediately after the 'parent'
                        if (currentItem) {      //will be null if the parent extension doesn't have a url defined...
                            currentItem.ed.push(ed);
                        }


                    }
                }

            })
        }

    });

    //console.log(JSON.stringify(hashExtension,null,2));

    for (var key in hashExtension) {
        let item = hashExtension[key]
        let url = item.url

        //only make ED's that are in NZ's domain...
        if (url.startsWith(nzPrefix))  {
            //console.log("working on "+url)

            let extDef;
            if (item.ed.length == 1) {
                //a simple extension...
                console.log("simple: "+key)
                extDef = makeSimpleExtDef(item);


                let filePath = outFolder + extDef.name + '.json';
                fs.writeFileSync(filePath,JSON.stringify(extDef,null,2))
                arIgEntry.push(makeIGResource(extDef));

            } else {
                //a complex extension...
                console.log("complex: "+key)
                extDef = makeComplexExtDef(item);

                //console.log((extDef))

                let filePath = outFolder + extDef.name + '.json';



                fs.writeFileSync(filePath,JSON.stringify(extDef,null,2))

                arIgEntry.push(makeIGResource(extDef));
            }

            //if there's an upload server specified...
            if (extDef && uploadServer) {

                let url = uploadServer + "StructureDefinition/" + extDef.id;

                var options = {}
                options.body = JSON.stringify(extDef);
                options.headers = {"content-type": "application/fhir+json"}
                options.timeout = 20000;        //20 seconds
                console.log('Uploading '+url);
                let putResponse = syncRequest('PUT', url, options);
                if (putResponse.statusCode !== 200 && putResponse.statusCode !== 201) {
                    console.log('--------------->   error uploading '+ url)
                    // console.log(response.body.toString())

                } else {
                    console.log(putResponse.statusCode + ' uploaded '+ url)

                }
            }
        }
    }

});

//now write out the snippet for the IG
//let filePath = outFolder +'IG-snippet.json';
//fs.writeFileSync(filePath,JSON.stringify(arIgEntry,null,2))

//write out the IG
if (IG) {
    fs.writeFileSync(IGPath,JSON.stringify(IG))
}



function makeIGResource(extDef){

    if (IG) {
        let found = false;
        let reference = "StructureDefinition/"+extDef.id;
        IG.definition.resource.forEach(entry =>{

            if (entry.reference && entry.reference.reference == reference) {
                found = true
            }
        });
        if (! found) {
            console.log('Adding to IG')
            let entry = {}
            entry.extension = [{url:IGEntryType,valueCode:'extension'},{url:canonicalUrl,valueUrl:extDef.url}]
            entry.reference = {reference:reference};
            entry.name = extDef.name;
            entry.description = extDef.id;
            IG.definition.resource.push(entry)

        }
    }




    let entry = {extension:[]};
    entry.name = extDef.name;
    entry.description = extDef.description;
    entry.reference = {reference:"StructureDefinition/"+extDef.id};
    let ext = {url:"http://clinfhir.com/StructureDefinition/canonicalUrl",valueUrl:extDef.url};
    entry.extension.push(ext);

    let extType = {url:"http://clinfhir.com/StructureDefinition/igEntryType",valueCode:'extension'};
    entry.extension.push(extType);

    return entry;

}

//generate a simple extension
function makeComplexExtDef (item) {
    //let sd = {resourceType:'StructureDefinition', url:url};
    let ar = item.url.split('/');
    let suffix = ':' + ar[ar.length-1];

    let sd = makeSDHeader(item,suffix);


    //the third element (extension.extension) needs a discriminator..
    let ele = sd.snapshot.element[2];
    ele.slicing = {discriminator : [{type:"value",path:'url'}],rules:'open'}



    //let ed = item.ed[0];

    //now add the elements for the child nodes...
    for (var i=1; i < item.ed.length; i++) {
        let ed = item.ed[i];

        //we know there must be a mapping, or it wouldn't be in the object
        let mapPath = ed.mapping[0].map
        console.log(mapPath)
        mapPath = mapPath.replace(/\|/g,'')
        mapPath = mapPath.replace(/#/g,'')
       // console.log(mapPath)

        let sliceName = mapPath


        let dataType = 'string';
        let short = "Short not present!"
        if (ed.short) {
             short = ed.short.trim();
        }

        if (ed.type && ed.type.length > 0) {
            dataType = ed.type[0].code;
        }

        let ele1 = {id:'Extension'+suffix+'.extension'+ ":" + sliceName,path:'Extension.extension',min:0,max:'*',base:{path:'Element.extension',min:0,max:'*'}};
        ele1.type = [{code:'Extension'}]
        ele1.definition = ed.definition;
        ele1.short = short;
        ele1.sliceName = sliceName;
        sd.snapshot.element.push(ele1);

        let ele2 = {id:'Extension'+suffix+'.extension:' + sliceName + ".id",path:'Extension.extension.id',short:'Extension id',min:0,max:'1',base:{path:'Element.id',min:0,max:'1'}};
        ele2.definition = "Unique id for referencing"
        ele2.type = [{code:'string'}]
        sd.snapshot.element.push(ele2);

        let ele3 = {id:'Extension'+suffix+'.extension:' + sliceName + '.extension',path:'Extension.extension.extension',short:'extension',min:0,max:'0',base:{path:'Element.extension',min:0,max:'*'}}
        ele3.type = [{code:'Extension'}]
        ele3.slicing = {discriminator:[{type:'value',path:'url'}],rules:"open"};
        ele3.definition = 'child extension'
        sd.snapshot.element.push(ele3);


        let ele4 = {id:'Extension'+suffix+'.extension:' + sliceName + '.url',path:'Extension.extension.url',short:'Extension url',min:1,max:'1',base:{path:'Extension.url',min:1,max:'1'}};
        ele4.type = [{code:'uri'}];
        ele4.fixedUri = sliceName;
        //ele4.url = sliceName;
        ele4.definition = 'The unique Url';
        sd.snapshot.element.push(ele4);

        let ele5 = {};
        let v = "value" + dataType[0].toUpperCase() + dataType.substr(1);
        ele5.id = "Extension"+suffix+".extension:" + sliceName + '.' +v
        ele5.path = "Extension.extension."+v;
        ele5.short = "Value of extension";
        ele5.definition = "Value of extension";
        ele5.min = 0;
        ele5.max = '1';
        ele5.base = {path:'Extension.value[x]',min:0,max:'1'};
        ele5.type = [{code:dataType}];
        ele5.definition = "The actual value of the extension";


        ele5.binding = ed.binding;


        sd.snapshot.element.push(ele5);

    }


    //the url for the overall complex extension...
    let ele4 = {id:'Extension.url',path:'Extension.url',short:'Extension url',min:1,max:'1',base:{path:'Extension.url',min:1,max:'1'}};
    ele4.type = [{code:'uri'}];
    ele4.fixedUri = item.url;
    ele4.definition = 'The unique Url'
    sd.snapshot.element.push(ele4);

    //the value
    let ele5 = {};
    let v = "value" + item.dataType[0].toUpperCase() + item.dataType.substr(1);
    ele5.id = "Extension.value[x]"
    ele5.path = "Extension.value[x]"
    ele5.short = "Value of extension";
    ele5.definition = "Value of extension";
    ele5.min = 0;
    ele5.max = '0';
    ele5.base = {path:'Extension.value[x]',min:0,max:'1'};
    ele5.type = [{code:item.dataType}];
    ele5.definition = "The actula value of the extension"
    sd.snapshot.element.push(ele5);

    return sd;
}



//generate a simple extension
function makeSimpleExtDef (item) {
    let url = item.url;
    //let sd = {resourceType:'StructureDefinition', url:url};
    let sd = makeSDHeader(item)
    let ed = item.ed[0];
/*
    let ele1 = {id:'Extension',path:'Extension',short:'Extension',min:0,max:'*',base:{path:'Extension',min:0,max:'*'}};
    ele1.definition = ed.definition;
    sd.snapshot.element.push(ele1);

    let ele2 = {id:'Extension.id',path:'Extension.id',short:'Extension id',min:0,max:'1',base:{path:'Extension.id',min:0,max:'1'}};
    ele2.definition = "Unique id for referencing"
    ele2.type = [{code:'string'}]
    sd.snapshot.element.push(ele2);

    let ele3 = {id:'Extension.extension',path:'Extension.extension',short:'Extension extension',min:0,max:'*',base:{path:'Extension.extension',min:0,max:'*'}}
    ele3.type = [{code:'Extension'}]
    ele3.slicing = {discriminator:[{type:'value',path:'url'}],rules:"open"};
    ele3.definition = 'extension on extension'
    sd.snapshot.element.push(ele3);
*/

    let ele4 = {id:'Extension.url',path:'Extension.url',short:'Extension url',min:1,max:'1',base:{path:'Extension.url',min:1,max:'1'}};
    ele4.type = [{code:'uri'}];
    ele4.fixedUri = url;
    ele4.definition = 'The unique Url'
    sd.snapshot.element.push(ele4);

    let ele5 = {};
    let v = "value" + item.dataType[0].toUpperCase() + item.dataType.substr(1);
    ele5.id = "Extension."+v + ":" + v;
    ele5.path = "Extension."+v;
    ele5.sliceName = v;
    ele5.short = "Value of extension";
    ele5.definition = "Value of extension";
    ele5.min = 0;
    ele5.max = '1';
    ele5.base = {path:'Extension.value[x]',min:0,max:'1'};
    ele5.type = [{code:item.dataType}];
    ele5.definition = "The actula value of the extension"
    sd.snapshot.element.push(ele5);

    return sd;

}

function makeSDHeader(item,suffix) {
    suffix = suffix || "";
    let url = item.url;
    let sd = {resourceType:'StructureDefinition', url:url};
    let ed = item.ed[0];

    //console.log(ed)

    let ext = getSingleExtensionValue(ed,'http://clinfhir.com/fhir/StructureDefinition/simpleExtensionUrl');

    //let ar = ed.path.split('.');
    let ar = ext.valueString.split('/');

    sd.text = {status:'additional',div:"<div xmlns='http://www.w3.org/1999/xhtml'>Extension Definition</div>"}
    sd.id = 'cf-' + ar[ar.length -1]
    let name = ar[ar.length -1];

    //the name has a constraint - this is not completely correct, but replaces the common letters
    name = name.replace(/-/g, '');
    name = name.replace(/_/g, '');


    sd.name = name[0].toUpperCase()+name.substr(1)
    sd.status = 'draft'
    sd.fhirVersion = "4.0.0"
    sd.kind = 'complex-type';
    sd.abstract = false;
    sd.publisher='clinFHIR';
    //sd.contextType = item.contextType;
    sd.context = item.context;
    sd.type = "Extension";
    sd.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Extension";
    sd.derivation = "constraint";
    sd.snapshot = {element:[]};
    //sd.differential = {element:[]};

    let ele1 = {id:'Extension' + suffix,path:'Extension',short:'Extension',min:0,max:'*',base:{path:'Extension',min:0,max:'*'}};
    ele1.definition = ed.definition;
    sd.snapshot.element.push(ele1);

    let ele2 = {id:'Extension'+suffix+'.id',path:'Extension.id',short:'Extension id',min:0,max:'1',base:{path:'Extension.id',min:0,max:'1'}};
    ele2.definition = "Unique id for referencing";
    ele2.type = [{code:'string'}]
    sd.snapshot.element.push(ele2);

    let ele3 = {id:'Extension'+suffix+'.extension',path:'Extension.extension',short:'Extension extension',min:0,max:'*',base:{path:'Element.extension',min:0,max:'*'}}
    ele3.type = [{code:'Extension'}]
    //ele3.slicing = {discriminator:[{type:'value',path:'url'}],rules:"open"};
    ele3.definition = 'extension on extension'
    sd.snapshot.element.push(ele3);

    return sd;
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