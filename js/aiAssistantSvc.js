angular.module("sampleApp").service('aiAssistantSvc', function($http) {

    let messageHistory = []


    async function build(messages) {
        const r = await fetch('ai/bundleBuilder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messages)
        });

        if (!r.ok) throw new Error('Builder failed');

        const { text } = await r.json();
        return text;
    }

    return { build };

/*
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
*/


    
})