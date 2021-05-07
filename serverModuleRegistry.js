
//functions to access the FHIR registry

//https://www.npmjs.com/package/download-tarball
let download = require('download-tarball')

let http = require('http')
let fs = require('fs')
let AdmZip = require("adm-zip");

//todo - need to figure out how to set this on different machines
let packageRoot = "/Users/davidhay/.fhir/packages/";     //where, on this machine, the packages are found

function setup(app) {

    //List of known IGs
    app.get('/registry/list',function(req,res) {
        let dirName = packageRoot;
        let response = [];
        fs.readdirSync(dirName,{withFileTypes:true}).forEach(function(dirEnt) {
            if (! dirEnt.isFile()) {
                let fileName = dirEnt.name;
                console.log(fileName)
                let ar = fileName.split('#')

                response.push({display: fileName,name:ar[0],version:ar[1]})


            }
        })
        res.json(response)

    })


    //download from the registry
    app.get('/registry/download/:name/:version/',function(req,res) {

        //let url = "https://packages.simplifier.net/hl7.fhir.uv.ips/1.0.0"

        let url = "https://packages.simplifier.net/"+ req.params.name + "/" + req.params.version;
        console.log(url)

        let outFolder = packageRoot + req.params.name + "#" + req.params.version;

        download({
            url: url,
            dir: outFolder
        }).then(() => {
            //console.log('file is now downloaded!');
            res.json()
        }).catch(err => {
            //console.log('oh crap the file could not be downloaded properly');
            //console.log(err);
            res.status(404).send({err:"Package not found:" + url})
        });



    })

    //return a single file from that package
    app.get('/registry/:name/:version/:fileName',function(req,res) {
        let name = req.params.name;
        let version = req.params.version;
        let fileName = req.params.fileName

        let fullFileName = packageRoot + name + "#" + version + "/package/" + fileName;

        let contents = fs.readFileSync(fullFileName, {encoding: 'utf8'});

        res.json(JSON.parse(contents))

    })

    //todo - move this code to the import function and save as a direcory file - this function can then just return that file...
    app.get('/registry/:name/:version',function(req,res){
        let name = req.params.name;
        let version = req.params.version;

        let dirName = packageRoot + name + "#" + version + "/package";
        let response = {name:name,version:version,files:[],dir:dirName};

        let hash = {Extension:[],"Resource Profile":[],ValueSet:[],CodeSystem:[]}

        //hash.Extension = []

        fs.readdirSync(dirName,{withFileTypes:true}).forEach(function(dirEnt) {

            if (dirEnt.isFile()) {
                let file = dirEnt.name;
                response.files.push(file)

                //console.log(file)

                let ar = file.split('-')
                let type = ar[0];

                let fullFileName = dirName + "/" + file;
                //console.log(fullFileName)
                try {
                    let contents = fs.readFileSync(fullFileName, {encoding: 'utf8'});
                    let resource = JSON.parse(contents)
                    let display = resource.title || resource.name
                    switch (type) {
                        case "StructureDefinition" :
console.log(resource.type)
                            if (resource.type == "Extension") {
                                hash.Extension = hash.Extension || []
                                hash.Extension.push({name:file,kind:'extension',display:display})
                            } else {
                                let variety = "DataType Profile"
                                let kind = 'datatypeprofile'
                                if (resource.kind == 'resource') {
                                    variety = "Resource Profile"
                                    kind = "resourceprofile"
                                }

                                hash[variety] = hash[variety] || []
                                hash[variety].push({name:file,type:'StructureDefinition', profileType:resource.type,kind:kind,display:display})
                            }

                            break;
                        case "CodeSystem":

                        case "ConceptMap":

                        case "ValueSet":

                        case "SearchParameter":

                        case "OperationDefinition":

                            hash[type] = hash[type] || []
                            hash[type].push({name:file,display:display,kind:resource.resourceType.toLowerCase()})
                            break;
                        default :
                            //response.files.push(file)
                            hash["misc"] = hash["misc"] || []
                            hash["misc"].push({name:file,display:display,kind:"misc"})
                            break;
                    }

                } catch (ex) {
                    //assume that if it can't be read then it aint a file... (eg it's a folder)
                }

            }

        })


        response.grouped = hash;




        res.json(response)

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