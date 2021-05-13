
//functions to access the FHIR registry

//https://www.npmjs.com/package/download-tarball
let download = require('download-tarball')
let got = require('got')

let packageRoot = process.env.packageRoot || "fhirPackages/"; //where, on this machine, the packages are found

console.log("Package root: " + packageRoot)

let http = require('http')
let fs = require('fs')
let AdmZip = require("adm-zip");

function setup(app) {

    //List of known IGs - ie downloaded to the server...
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

    //get an example file...
    app.get('/registry/example/:name/:version/:fileName',function(req,res) {
        let name = req.params.name;
        let version = req.params.version;
        let fileName = req.params.fileName
        let fullFileName = packageRoot + name + "#" + version + "/package/example/" + fileName;
        let contents = fs.readFileSync(fullFileName, {encoding: 'utf8'});
        res.json(JSON.parse(contents))
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
        let hash = {ImplementationGuide: [],"Resource Profile":[],Extension:[],ValueSet:[],CodeSystem:[]}

        //look for the summary
        fs.access(summaryFileName, (err) => {
            if (err) {
                //the summary file is not present
                console.log("The clinFHIR package summary file does not exist.");

                //is the root folder for this package present? Can be sync as only checked before downloaded
                if (! fs.existsSync(dirName)) {
                    res.status(404).send({err:"Package not found"})
                    return;
                }


                processFolder(dirName,hash).then(
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
                        console.log('err',err)
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


        //don't worry about async within the function- it's only called once per package...
        function processFolder(dirName,hash) {
            let response = {name:name,version:version,files:[],dir:dirName};

            const myPromise = new Promise((resolve, reject) => {

                fs.readdirSync(dirName, {withFileTypes: true}).forEach(function (dirEnt) {

                    if (dirEnt.isFile()) {
                        let file = dirEnt.name;

                        response.files.push(file)

                        let ar = file.split('-')
                        let type = ar[0];       //assume the naming convention of {type}-{id}

                        let fullFileName = dirName + "/" + file;
                        //console.log(fullFileName)
                        try {
                            let contents = fs.readFileSync(fullFileName, {encoding: 'utf8'});

                            let resource = JSON.parse(contents)


//console.log("   " +  resource.resourceType)
                            if (! resource.resourceType) {
                                //this is not a resource.
                                switch (file) {
                                    case "package.json" :
                                        //hash['ImplementationGuide'].push(resource)
                                        hash['ImplementationGuide'].push({
                                            name: file,
                                            display: "package.json",
                                            kind: 'implementationguide',
                                            url: ""
                                        })
                                        response.packageJson = resource;    //intentional duplicate
                                        break;
                                }


                                console.log(file)
                            } else {

                                let display = resource.title || resource.name
                              // console.log('display='+ display)

                                switch (type) {
                                    case "StructureDefinition" :
                                        if (resource.type == "Extension") {
                                            hash.Extension = hash.Extension || []
                                            hash.Extension.push({
                                                name: file,
                                                type: 'StructureDefinition',
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
                                                        resource.snapshot.element.forEach(function (ed) {

                                                            if (ed.type) {
                                                                //look for extensions
                                                                ed.type.forEach(function (typ) {
                                                                    if (typ.code == "Extension" && typ.profile) {
                                                                        typ.profile.forEach(function (prof) {
                                                                            extensions.push({
                                                                                kind: 'extension',
                                                                                path: ed.path,
                                                                                profile: prof
                                                                            })
                                                                        })
                                                                    }
                                                                    //references

                                                                    if (typ.code == "Reference" && typ.targetProfile) {
                                                                        typ.targetProfile.forEach(function (prof) {
                                                                            references.push({
                                                                                kind: 'reference',
                                                                                path: ed.path,
                                                                                targetProfile: prof
                                                                            })

                                                                        })
                                                                    }


                                                                })
                                                            }

                                                            //look for bindings
                                                            if (ed.binding) {
                                                                let b = ed.binding;
                                                                delete b.extension;
                                                                bindings.push({
                                                                    kind: 'binding',
                                                                    path: ed.path,
                                                                    binding: b
                                                                })
                                                                //  console.log(ed.binding.valueSet)
                                                            }


                                                        })
                                                    }

                                                }
                                            }

                                            //console.log('SD display='+ display)
                                            hash[variety] = hash[variety] || []
                                            hash[variety].push({
                                                name: file,
                                                type: 'StructureDefinition',
                                                url: resource.url,
                                                profileType: resource.type,
                                                kind: kind,
                                                display: display,
                                                extensions: extensions,
                                                bindings: bindings,
                                                references: references
                                            })
                                        }
                                        break;

                                    case "CodeSystem":

                                    case "ConceptMap":

                                    case "ValueSet":

                                    case "SearchParameter":

                                    case "OperationDefinition":

                                    case "CapabilityStatement" :

                                    case "ImplementationGuide":
console.log("286 ",type,resource.resourceType)
                                        console.log('display='+ display)
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
                                        console.log(type)
                                        //If there is a .resourceType element, then assume it is an example. It looks like R3 didn't have a separate examples folder
                                       //make the type the display
                                        //**** display is already defined above! don't 'let' it again
                                        display = type || 'Unknown type'
                                        hash["Miscellaneous"] = hash["Miscellaneous"] || []
                                        hash["Miscellaneous"].push({name: file, display: display,  kind: "misc"})

                                        break;
                                }

                            }


                        } catch (ex) {
                            //console.log('there was an error', ex)
                            //Is this a result of Json parsing? If it is, then ignore it - as the file will be ignored as well...
                            if (! ex.message.indexOf('JSON')) {
                                console.log(ex)
                                reject(ex)
                            } else {
                                console.log('There was an error parsing ' + fullFileName + " ignored.")
                            }


                        }

                    } else {
                        //this is not a file - presumably a folder. Process examples...
                        //console.log(dirEnt)
                        if (dirEnt.name == 'example') {

                            //console.log('ex',hash)

                            //need to iterate through the examples as the .index.json is not always present...
                            let exHash = {}
                            fs.readdirSync(dirName + "/example", {withFileTypes: true}).forEach(function (dirEnt) {
                                let fullName = dirName+ "/example/" + dirEnt.name;
                                try {
                                    let contents = fs.readFileSync(fullName , {encoding: 'utf8'});
                                    //console.log(contents)
                                    let example = JSON.parse(contents)
                                    if (example.resourceType) {
                                        exHash[example.resourceType] = exHash[example.resourceType] || []
                                        exHash[example.resourceType].push({filename:dirEnt.name,id:example.id})
                                    }
                                } catch (ex) {
                                    console.log('Unable to read or parse ' + fullName + ' Ignored')
                                  //  console.log(ex)
                                }

                            });

                            hash["Example"] = hash["Example"] || []

                            Object.keys(exHash).forEach(function (key) {
                                hash["Example"].push({kind:'example',display:key,value:exHash[key]})
                            })

                        }
                    }

                })


                //console.log(hash)
                response.grouped = hash;
                resolve(response)
            })

            return myPromise;

        }

    })


    //download the manifest only from an IG in the build environment
    app.get('/buildenv/manifest',function(req,res){
        let url = req.query.url;       //the url to the root
        url = url.replace('index.html',"")      //might include the index page...

        let qry = url + "package.manifest.json"
        console.log(qry)
        got(qry,{json:true})
            .then(response => {
                res.json(response.body)
            }).catch(err => {
                console.log(err)
                res.status(500).json(err)

        });
    })

    //download from the build environment and save on the server...
    app.get('/buildenv',function(req,res){

        let url = req.query.url;       //the url to the root if the iG
        let version = req.query.version;
        let downloadUrl = url + "package.tgz";
        let name = req.query.name;     //the name to apply to the IG
        let folderName = name + "#" + version;     //assume this is the current version...
        let outFolder = packageRoot + folderName;      //the full path to where the artifacts should be stored

        download({
            url: downloadUrl,
            dir: outFolder
        }).then(() => {
            //The package has been downloaded and unzipped into the packageRoot

            res.json({path:outFolder,url:downloadUrl})
        }).catch(err => {

            res.status(404).send({err:"Package not found:" + url})
        });


        //todo - should qw create a package.json?

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