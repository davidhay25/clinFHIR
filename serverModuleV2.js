let fs = require('fs');
const parse = require('csv-parse/lib/sync')


function setup(app) {


    app.get('/v2/message/:name',function(req,res){
        console.log(req.params.name)
        const fileName = __dirname + '/artifacts/v2messages/'+req.params.name;

        fs.readFile(fileName, function(err,file)  {
            res.send(file)
        })


    });

    app.get('/v2/messages', function (req, res) {

        const msgFolder = __dirname + '/artifacts/v2messages';
        //console.log(msgFolder)


        let ar = []


        fs.readdir(msgFolder,function(err,files) {
            res.json(files)
        })


    });

    app.get('/v2/mapping', function (req, res) {

        const mapFolder = __dirname + '/artifacts/v2segments/';
        //let fileName = mapFolder+"MSH.csv";
        let fileName = mapFolder+"nk1-a.csv";


        fs.readFile(fileName,function(err,file){

            const rows = parse(file);


            let definition = [];
            let hashV2Path = {};        //to ensure that each v2 path has only a single row in the definition
            rows.forEach(function (arRow) {
                let v2Path = arRow[1];      //eg PID-1

                let row = hashV2Path[v2Path];
                if (! row) {
                    row = {v2:{},fhir:{}};
                    row.v2.sequence= arRow[0]
                    row.v2.identifier = arRow[1]
                    row.v2.name=arRow[2]
                    row.v2.dt = arRow[3]
                    row.v2.card = arRow[4]
                    row.fhir = {}

                    row.fhir.condition = []
                    row.fhir.path=[]
                    row.fhir.dt=[]
                    row.fhir.card=[]
                    row.fhir.mapDT=[]
                    row.fhir.mapVocab=[]
                    row.fhir.mapDerived=[]
                    row.fhir.notes=[]


                    hashV2Path[v2Path] = row;
                    definition.push(row)
                }

                //for each row in the csv where the v2 path is the same, there is a set of matching fhir values...

                //now add the fhir mappings...

                row.fhir.condition.push(arRow[5])
                row.fhir.path.push(arRow[6])
                row.fhir.dt.push(arRow[7])
                row.fhir.card.push(arRow[8])
                row.fhir.mapDT.push(arRow[9])
                row.fhir.mapVocab.push(arRow[10])
                row.fhir.mapDerived.push(arRow[11])
                row.fhir.notes.push(arRow[12])








                //let row = {v2:{},fhir:{}}


/*
                row.v2.sequence= arRow[0]
                row.v2.identifier = arRow[1]
                row.v2.name=arRow[2]
                row.v2.dt = arRow[3]
                row.v2.card = arRow[4]


                row.fhir = []
                */
                //when there are multiple files, there will be a row for each mapping...
             //   let fhirRow = {}
/*
                fhirRow.condition = [arRow[5]]
                fhirRow.path=[arRow[6]]
                fhirRow.dt=[arRow[7]]
                fhirRow.card=[arRow[8]]
                fhirRow.mapDT=[arRow[9]]
                fhirRow.mapVocab=[arRow[10]]
                fhirRow.mapDerived=[arRow[11]]
                fhirRow.notes=[arRow[12]]
                row.fhir = (fhirRow);

                definition.push(row)
                */

            });
console.log(definition)
            res.json(definition)

            /*

             let row = {condition:"",v2:{},fhir:{}}
            row.v2.sequence = "";
            row.v2.identifier = "";
            row.v2.name="";
            row.v2.dt = "";
            row.v2.card = "";

            row.fhir.path="";
            row.fhir.dt="";
            row.fhir.card="";
            row.fhir.mapDT="";
            row.fhir.mapVocab="";
            row.fhir.mapDerived="";
            row.fhir.notes="";

            console.log(file.toString())
            let map = file.toString();
            let ar = map.split('\n');
            let definition = [];
            ar.forEach(function (row) {
                let ar1 = row.split()

                let lne = {sequence:row[0]}

                definition.push(lne)
            })

*/


        })


    })

}

module.exports= {
    setup : setup
}