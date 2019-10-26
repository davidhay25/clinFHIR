
function setup(app) {



    app.get('/iphone/meds',function(req,res){

        let json = `
            [
                {"id":"1","name":"atenolol","dose":"1 mane"},
                 {"id":"2","name":"frusemide","dose":"1 nocte"}
            ]
        `;
console.log('call')
        res.json(JSON.parse(json))



    });


}

module.exports= {
    setup : setup
}