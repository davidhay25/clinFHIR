//const {gofshClient} = require("gofsh");
let Fhir = require('fhir').Fhir;


function setup(app) {
    app.post("/transformJson",function (req,res){
        //transform from Xml to Json
        const before = process.memoryUsage();
        const fhir = new Fhir();

        try {
            let body = JSON.stringify(req.body)
            //console.log('b4')
            let json = fhir.xmlToObj(body);
            //console.log('aft')
            res.send(json)
        } catch (ex) {
            console.log(ex)
            res.status(500).send({message:"Unable to convert to Json." + ex.message})
        } finally {
            const after = process.memoryUsage();
            const fmt = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';
            console.log(`[MEM transformJson] rss ${fmt(before.rss)} -> ${fmt(after.rss)} | external ${fmt(before.external)} -> ${fmt(after.external)}`);

        }



    })


// ---------- for the server query - to strt with
    app.post("/transformXML", function (req, res) {
        const before = process.memoryUsage();
        const fmt = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';

        let resource = req.body
        if (resource) {
            try {
                let fhir = new Fhir();
                let xml = fhir.objToXml(resource);
                res.send(xml)
            } catch (ex) {
                res.status(400).json({msg:ex.message})
            } finally {
                const after = process.memoryUsage();
              //  console.log(`[MEM transformXML] rss ${fmt(before.rss)} -> ${fmt(after.rss)} | heap ${fmt(before.heapUsed)} -> ${fmt(after.heapUsed)} | external ${fmt(before.external)} -> ${fmt(after.external)}`);
            }
        } else {
            const after = process.memoryUsage();
          //  console.log(`[MEM transformXML] rss ${fmt(before.rss)} -> ${fmt(after.rss)} | heap ${fmt(before.heapUsed)} -> ${fmt(after.heapUsed)} | external ${fmt(before.external)} -> ${fmt(after.external)}`);
            res.json({})
        }
    })

}

module.exports= {
    setup : setup
}