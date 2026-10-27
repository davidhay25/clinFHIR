angular.module("sampleApp").service('aiAssistantSvc', function($http) {



    return {
        differenceBetweenResources : function (resource1, resource2) {

            function flatten(node, path, out) {
                if (Array.isArray(node)) {
                    node.forEach((item, i) => flatten(item, `${path}[${i}]`, out));
                } else if (node !== null && typeof node === "object") {
                    for (const [key, value] of Object.entries(node)) {
                        flatten(value, `${path}.${key}`, out);
                    }
                } else {
                    out[path] = node;
                }
                return out;
            }

            function buildHash(versions, root = "Resource") {
                const flat = versions.map(v => flatten(v, root, {}));
                const allPaths = new Set(flat.flatMap(f => Object.keys(f)));
                const hash = {};
                for (const p of [...allPaths].sort()) {
                    hash[p] = flat.map(f => (p in f ? f[p] : undefined));
                }
                return hash;
            }

            const hash = buildHash([resource1, resource2], resource1.resourceType);
            console.log(hash)
            return hash

        },
        makeResourceDifferencesSummary : function(wfSummary) {
            //wfSummary is {step : [conversation: {messages : [bundle]}]}
            let hashResource = {}   //keyed on resource Id. contains array of step indexes where this resource appears

            let stepInx = -1
            for (let step of wfSummary.steps) {
                stepInx ++
                let messages = step.conversation?.messages
                if (messages?.length > 0) {
                    let bundle = messages[messages.length -1].bundle
                    for (const entry of bundle?.entry || []) {
                        let resource = entry.resource

                        hashResource[resource.id] = hashResource[resource.id] || {resource : resource,steps:[]} || hashResource[resource.id]
                        hashResource[resource.id].steps.push({stepInx:stepInx,
                            stepDescription : step.description,
                            stepTitle:step.title, resource:resource})
                    }
                }
            }

            console.log(hashResource)

            //const arr = Object.entries(hash).map(([path, values]) => ({ path, values }));

            let arResources = Object.values(hashResource)
            arResources.sort(function (a,b) {
                if (a?.resource?.resourceType > b?.resource?.resourceType) {
                    return 1
                } else {
                    return -1
                }

            })
            console.log(arResources)

            return {arResources : arResources,hashResource:hashResource}


        }
    }




/*

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

    */



    
})