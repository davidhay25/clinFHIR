#!/usr/bin/env node

const fs = require('fs')

let fileName = "./breastcancer.json";

let contents = fs.readFileSync(fileName, {encoding: 'utf8'});
let bundle = JSON.parse(contents)

//create a hash of all urls in each resource.
//if the value of an element is in the hash, then the assumption is that this is a canonical reference

let hashResources = {}
bundle.entry.forEach(function (entry) {
    let resource = entry.resource;
    if (resource.url) {
        hashResources[resource.url] = resource
    }
})

bundle.entry.forEach(function (entry) {
    let resource = entry.resource;
    switch (resource.resourceType) {
        case 'Measure' :
        case 'Library' :
            processResource(resource)
            break
    }
    //console.log(entry.resource.url)
})


return

function processResource(resource) {
    console.log('-----------')
    console.log(resource.resourceType + "   " + resource.id)

    let refs = []
    function processBranch(refs,parentPath,branch) {
        Object.keys(branch).forEach(function (key) {
            let element = branch[key]
            let typ = typeof(element)
            //console.log(key)
            switch (typ) {
                case "object" :
                    if (Array.isArray(element)){
                        console.log(parentPath, key,'array',element.length)
                        element.forEach(function (child) {
                            let path = parentPath + "." + key
                            //console.log('child',path,child,)
                            //if the content of the array element is a string, then forEach will iterate over each character
                            if (typeof(child) == 'string') {
                                console.log('---leaf:',path,child)
                                if (hashResources[child]) {
                                    //the assumption is that this is a canonical reference...
                                    let item={source:{id:resource.id}, path:path,url:child,target : {id:hashResources[child].id}}
                                    refs.push(item)
                                }
                            } else {
                                processBranch(refs,path,child)
                            }
                        })
                    } else {
                        console.log(parentPath, key,'object')
                        let path = parentPath + "." + key
                        processBranch(refs,path,element)
                    }
                    break
                case "string" :
                    //want the value...
                    let path = parentPath + '.' + key
                    if (hashResources[element]) {
                        //the assumption is that this is a canonical reference...
                        let item={source:{id:resource.id}, path:path,url:element,target : {id:hashResources[element].id}}
                        refs.push(item)
                    }

                    let display = element.substr(0,80)
                    console.log('---leaf:',path,display)
                    //console.log(key,element)
                    break
                default :
                    console.log('===========>',key,typ)

            }
            //console.log(key, typeof(element) )
        })

    }
    processBranch(refs,resource.resourceType,resource)

    console.log(refs)

}





const request = require('request');
let url = "https://raw.githubusercontent.com/cqframework/ecqm-content-r4/master/bundles/measure/BreastCancerScreeningFHIR/BreastCancerScreeningFHIR-bundle.json"

let options = {
    method: 'GET',
    uri: url,
    'content-type': 'application/json'
};

console.log(options)

request(options, function (error, response, body) {
    //console.log(body)
    let bundle = JSON.parse(body)
    bundle.entry.forEach(function (entry) {
        console.log(entry.resource.url)
    })

})