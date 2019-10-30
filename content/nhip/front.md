# Front Page

The HPI ([Health Practitioner Index](https://www.health.govt.nz/our-work/health-identity/health-provider-index)) is a national service that holds information about the providers of healthcare in New Zealand, including the organizations where they work and the facilities that they work from. The entities that are supported are:



*   The person - described by the FHIR [Practitioner](http://hl7.org/fhir/practitioner.html) resource. Note that these are intended to be all providers of healthcare. 
*   Facilities where healthcare is provided from ([Location](http://hl7.org/fhir/location.html))
*   Organizations such as DHB’s, PHO,s and primary care organizations ([Organization](http://hl7.org/fhir/organization.html))

In addition, there is support for registering where a Practitioner works, and in what role - the [PractitionerRole](http://hl7.org/fhir/practitionerrole.html) resource. 

The HPI serves 2 primary purposes:



*   A unique identifier for each individual or entity
*   The ‘source of truth’ for the key information about that entity. Note that the HPI itself is not necessarily that actual source of information (eg Practitioners are supplied by a registration authority) but it is the place to go to find the information.

_(More info about the HPI here)_

