
This is the design tool for the [HL7&reg; FHIR&copy;](http://hl7.org/fhir/) interface to the New Zealand HPI - Health Practitioner Index and
 NHI - National Health Identifier. It brings together all the artifacts that are necessary to  understand and use the FHIR API. Once complete, the artifacts will be assembled into a formal publication using the official tooling.

The HPI ([Health Practitioner Index](https://www.health.govt.nz/our-work/health-identity/health-provider-index)) is a national registry service that holds information about the providers of healthcare in New Zealand, including the organizations where they work and the facilities that they work from. The key entities that are supported are:



*   The **Person** - described by the FHIR [Practitioner](http://hl7.org/fhir/practitioner.html) resource. Note that these are intended to be all providers of healthcare. 
*   **Facilities** where healthcare is provided from. These are represented by [Location](http://hl7.org/fhir/location.html) resources.
*   **Organizations** such as DHB’s, PHO,s and primary care organizations ([Organization](http://hl7.org/fhir/organization.html))

In addition, there is support for registering where a Practitioner works, and in what role - the [PractitionerRole](http://hl7.org/fhir/practitionerrole.html) resource. 

The [NHI](https://www.health.govt.nz/our-work/health-identity/national-health-index) is a national Patient Identifier system, which
 has been in continuous use for over 20 years. It is represented using the FHIR [Patient](http://hl7.org/fhir/patient.html) resource.
 
The HPI and NHI serve 2 primary purposes:

* A **unique identifier** for each individual or entity
* The **source of truth** for the key information about that entity. Note that the HPI itself is not necessarily that actual source of information (eg Practitioners are supplied by a registration authority) but it is the place to go to find the information.




This guide is targeted at 2 distinct audiences.

* **Implementers** who wish to create applications that utilize the NHI services
* **Business Analysts** who need to understand how the HPI is organized

It is assumed that a reader has a basic understanding of [FHIR](http://hl7.org/fhir/index.html), though there are a number of places where background material is supplied - especially with regard to Terminology and the use of Identifiers.

The guide is organized into the following sections.

* **Usage Notes** These are general notes on how to use the API. How to gain access to the service, expectations of clients, security implemented.
* **General notes on resources** These are general notes that apply to all resources such as the relationship between the id and identifiers, merging of duplicates, references between resources
* The **Resource details** tab has a detailed section for each resource. The contents of this are substantially derived from the models created by the clinFHIR Logical Modeler and have a number of subtabs.
    * A **detailed description** of the resource 
    * A **tree view** that represents the logical model of the resource contents. This is a dynamic view - selecting an element will display details of the element including a ValueSet browser for coded elements.
    * A **table view** of the logical model. This is substantially the same information as in the tree view, but laid out as a static table. 
    * The **ValueSets** used by elements in this model. Also incorporates the ValueSet browser
    * The **Extensions** defined for the model. Has a link to the definition (a [StructureDefinition](http://hl7.org/fhir/structuredefinition.html))
    * The formal **profile** for the model. This describes how the logical model is expressed 'on the wire' as a resource with extensions.
    * **Examples** of conformant resources that represent this model. Each resource has the Json, XML and tree representation
    * A **Server API** tab that describes the details of the API for this resource. It is derived from the [CapabilityStatement]() for the HPI as a whole, and contains the supported operations (read / write), search parameters and _includes
* The **Terminology** tab provides background reading on the use of Termnology in FHIR and the specific resources used by this guide.
* **Example Queries** are provided to demonstrate how to interact with the API, and there is a query builder that can be used to assemble specific queries and execute them against the sample database. Samples are held in a generic FHIR server (provided by the [HAPI](https://hapifhir.io/) project).
* **Downloads** allow all of the FHIR aritfacts to be downloaded. It is not yet fully populated.

Feedback on any aspect of this guide is welcomed. Comments can be made on the [FHIR 'Zulip' chat stream](https://chat.fhir.org/#narrow/stream/179178-new-zealand) (preferred), or directly to david.hay25 at gmail.com 




