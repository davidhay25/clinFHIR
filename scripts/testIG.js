import PackageLoader from 'fhir-package-loader';

async function listResources(packageId, version, resourceType) {
    const loader = new PackageLoader();

    // downloads + caches the package
    await loader.loadPackage(packageId, version);

    // returns parsed JSON resources
    return loader.findResourceJSONs(resourceType);
}

(async () => {
    const sds = await listResources(
        'hl7.fhir.us.core',
        '6.1.0',
        'StructureDefinition'
    );

    console.log(`Found ${sds.length} StructureDefinitions`);
    console.log(sds.map(sd => sd.url));
})();
