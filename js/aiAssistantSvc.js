angular.module("sampleApp").service('aiAssistantSvc', function($http) {

    let messageHistory = []


    // onChunk is called with each piece of text as it arrives
    async function build(messages, onChunk) {
        console.log(messages)
        const r = await fetch('ai/bundleBuilder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages)
        });
        if (!r.ok) throw new Error('Builder failed');

        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            onChunk(decoder.decode(value, { stream: true }));
        }
    }

    return { build };


    /*
    return {
        sendMessage : function (msg) {
            //send a message to the ai



            let message = {}
            $http.post("ai/bundleBuilder",[{role:'user',content:msg}]).then(
                function (data) {
                    $scope.response = data.data
                },function (err) {
                    $scope.response = err
                }
            )
            
        },
        getMessageHistory : function () {
            
        }
    }

    */
    
})