
//functions to access the FHIR registry

//https://www.npmjs.com/package/download-tarball
let download = require('download-tarball')

let http = require('http')
let fs = require('fs')
let AdmZip = require("adm-zip");

//todo - need to figure out how to set this on different machines
//let packageRoot = "/Users/davidhay/.fhir/packages/";     //where, on this machine, the packages are found

let packageRoot = "fhirPackages/";     //where, on this machine, the packages are found

function setup(app) {

    //List of known IGs
    app.get('/registry/list',function(req,res) {
        let dirName = packageRoot;
        let response = [];
        fs.readdirSync(dirName,{withFileTypes:true}).forEach(function(dirEnt) {
            if (! dirEnt.isFile()) {
                let fileName = dirEnt.name;
               // console.log(fileName)
                let ar = fileName.split('#')

                response.push({display: fileName,name:ar[0],version:ar[1]})
            }
        })
        res.json(response)

    })

    //download from the FHIR registry
    app.get('/registry/download/:name/:version/',function(req,res) {

        let url = "https://packages.simplifier.net/"+ req.params.name + "/" + req.params.version;

        let outFolder = packageRoot + req.params.name + "#" + req.params.version;

        download({
            url: url,
            dir: outFolder
        }).then(() => {
            //The package has been downloaded and unzipped into the packageRoot


            res.json()
        }).catch(err => {

            res.status(404).send({err:"Package not found:" + url})
        });



    })

    //return a single file from a package. Assume it is on file - todo - should check this...
    app.get('/registry/:name/:version/:fileName',function(req,res) {
        let name = req.params.name;
        let version = req.params.version;
        let fileName = req.params.fileName
        let fullFileName = packageRoot + name + "#" + version + "/package/" + fileName;

        let contents = fs.readFileSync(fullFileName, {encoding: 'utf8'});
        res.json(JSON.parse(contents))

    })

    //retrieve a package based on name & version.
    app.get('/registry/:name/:version',function(req,res){
        let name = req.params.name;
        let version = req.params.version;

        let dirName = packageRoot + name + "#" + version + "/package";      //where the package contents should be...
        let summaryFileName = packageRoot + name + "#" + version + "/clinFhirSummary.json"      //a summary of the package


        //add fields to set a specific order...
        let hash = {Extension:[],"Resource Profile":[],ValueSet:[],CodeSystem:[]}

        //look for the summary
        fs.access(summaryFileName, (err) => {
            if (err) {
                //the summary file is not present
                console.log("The file does not exist.");

                //is the root folder for this package present? Can be sync as only checked before downloaded
                if (! fs.existsSync(dirName)) {
                    res.status(404).send({err:"Package not found"})
                    return;
                }


                processFolder(dirName).then(
                    function(summary) {
                        //write the summary file for next time
                        /* temp removed while updating summary file
                        fs.writeFile(summaryFileName, JSON.stringify(summary), (err) => {
                            if (err) {
                                res.status(500).send({err:err})
                            } else {
                                res.send(summary)
                            }
                        })
                        */
                        res.send(summary) //temp!!!
                    },
                    function(err) {
                        //there was an error creating the summary
                        res.status(500).send({err:err})
                    }
                )




            } else {
                //the summary file exists
                console.log('summary file exists')
                fs.readFile(summaryFileName, {encoding: 'utf8'}, (err,data) => {
                    if (err) {
                        res.status(500).send({err:err})
                    }
                    res.json(JSON.parse(data))

                });

            }
        });


        //todo - make async...
        function processFolder(dirName) {
            let response = {name:name,version:version,files:[],dir:dirName};

            const myPromise = new Promise((resolve, reject) => {

                fs.readdirSync(dirName, {withFileTypes: true}).forEach(function (dirEnt) {

                    if (dirEnt.isFile()) {
                        let file = dirEnt.name;
                        response.files.push(file)

                        let ar = file.split('-')
                        let type = ar[0];

                        let fullFileName = dirName + "/" + file;
                        try {
                            let contents = fs.readFileSync(fullFileName, {encoding: 'utf8'});
                            let resource = JSON.parse(contents)
                            let display = resource.title || resource.name
                            switch (type) {
                                case "StructureDefinition" :
                                    if (resource.type == "Extension") {
                                        hash.Extension = hash.Extension || []
                                        hash.Extension.push({
                                            name: file,
                                            kind: 'extension',
                                            display: display,
                                            url: resource.url
                                        })
                                    } else {
                                        let variety = "DataType Profile"
                                        let kind = 'datatypeprofile'
                                        let extensions = [];    //array of extensions this profile references
                                        let bindings = [];      //array of bindings this profile references
                                        let references = [];        //array of references from this profile

                                        if (resource.kind == 'resource') {
                                            variety = "Resource Profile"
                                            kind = "resourceprofile"

                                            if (kind == "resourceprofile" && true) {
                                                //for resource profiles, we want the extension and bindings so we can draw the graph...
                                                if (resource.snapshot && resource.snapshot.element) {
                                                    resource.snapshot.element.forEach(function (ed){

                                                        if (ed.type) {
                                                            //look for extensions
                                                            ed.type.forEach(function (typ) {
                                                                if (typ.code == "Extension" && typ.profile) {
                                                                    typ.profile.forEach(function (prof) {
                                                                        extensions.push({kind:'extension',path:ed.path,profile:prof})
                                                                    })
                                                                }
                                                                //references

                                                                if (typ.code == "Reference" && typ.targetProfile) {
                                                                    typ.targetProfile.forEach(function (prof) {
                                                                        references.push({kind:'reference',path:ed.path,targetProfile:prof})

                                                                    })
                                                                }


                                                            })
                                                        }

                                                        //look for bindings
                                                        if (ed.binding) {
                                                            let b = ed.binding;
                                                            delete b.extension;
                                                            bindings.push({kind:'binding',path: ed.path, binding:b})
                                                          //  console.log(ed.binding.valueSet)
                                                        }



                                                    })
                                                }

                                            }
                                        }


                                        hash[variety] = hash[variety] || []
                                        hash[variety].push({
                                            name: file,
                                            type: 'StructureDefinition',
                                            url: resource.url,
                                            profileType: resource.type,
                                            kind: kind,
                                            display: display,
                                            extensions : extensions,
                                            bindings : bindings,
                                            references : references
                                        })
                                    }
                                    break;
                                case "CodeSystem":

                                case "ConceptMap":

                                case "ValueSet":

                                case "SearchParameter":

                                case "OperationDefinition":

                                    hash[type] = hash[type] || []
                                    hash[type].push({
                                        name: file,
                                        display: display,
                                        kind: resource.resourceType.toLowerCase(),
                                        url: resource.url
                                    })
                                    break;
                                default :
                                    //response.files.push(file)
                                    hash["misc"] = hash["misc"] || []
                                    hash["misc"].push({name: file, display: display, kind: "misc"})
                                    break;
                            }

                        } catch (ex) {
                            //assume that if it can't be read then it aint a file... (eg it's a folder)
                        }

                    }

                })


                response.grouped = hash;
                resolve(response)
            })

            return myPromise;

        }

    })

}

/*

for downloading a package

var download = function(filename, url) {
    var tmpFilePath = "assets/tmp/" + filename + ".zip"
    http.get(url, function(response) {
        response.on('data', function (data) {
            fs.appendFileSync(tmpFilePath, data)
        });
        response.on('end', function() {
            var zip = new AdmZip(tmpFilePath)
            zip.extractAllTo("assets/extracted/" + filename)
            fs.unlink(tmpFilePath)
        })
    });
}

*/


module.exports= {
    setup : setup
}