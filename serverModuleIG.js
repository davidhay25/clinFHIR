
const { setup } = require('./igLoader.cjs');

(async () => {
    await setup('HL7/fhir-us-core', '6.1.0', 'StructureDefinition');
})();


async function setup1(app) {
    const packageId = 'HL7/fhir-us-core';
    const version = '6.1.0';

    await setup(packageId, version, 'StructureDefinition');
}


