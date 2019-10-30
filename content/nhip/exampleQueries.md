# Example queries

_(Will replace all the host urls with the HPI dev server when established. Will have better sample data as well - these are a bit old)_

_(should we move these to each resource? Does feel a bit tidier in a single location)_


### Search Practitioner by identifier

[http://home.clinfhir.com:8054/baseR4/Practitioner?identifier=https://standards.digital.health.nz/id/hpi|prac-X](http://home.clinfhir.com:8054/baseR4/Practitioner?identifier=https://standards.digital.health.nz/id/hpi|prac-X)

Returns a bundle of Practitioners where the identifier matches. If the identifier in the query has been merged with another record (ie made dormant) then the resource that will be returned will have the dormant identifier in the identifier list with a ‘use’ value of ‘old’, along with the current identifier.

 This can include multiple Practitioners for merged Practitioners


### Search Practitioner by name

[http://home.clinfhir.com:8054/baseR4/Practitioner?name=welby](http://home.clinfhir.com:8054/baseR4/Practitioner?name=welby)

Returns a bundle of Practitioners where the name matches.


### Find Practitioners employed by an Organization

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?organization=organization1](http://home.clinfhir.com:8054/baseR4/PractitionerRole?organization=organization1)

Returns a bundle of PractitionerRole resources

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?organization=organization1&_include=PractitionerRole:practitioner](http://home.clinfhir.com:8054/baseR4/PractitionerRole?organization=organization1&_include=PractitionerRole:practitioner)

Returns a bundle of PractitionerRole resources and Practitioner resources

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?organization=organization1&_include=PractitionerRole:practitioner&_include=PractitionerRole:location](http://home.clinfhir.com:8054/baseR4/PractitionerRole?organization=organization1&_include=PractitionerRole:practitioner&_include=PractitionerRole:location)

Returns a bundle of PractitionerRole, Practitioner & Location resources.


### Find a Location by name

http://home.clinfhir.com:8054/baseR4/Location?name=East end

Returns a bundle of Location resources where the name starts with ‘East end’


### Find Practitioners at a location

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?location=location1&_include=PractitionerRole:practitioner](http://home.clinfhir.com:8054/baseR4/PractitionerRole?location=location1&_include=PractitionerRole:practitioner)

Returns a bundle of PractitionerRole and Practitioner resources. Note that it is the PractitionerRole that records the Practitioner working at a location.

http://home.clinfhir.com:8054/baseR4/PractitionerRole?location.name=east end&_include=PractitionerRole:practitioner&_include=PractitionerRole:location

Returns a bundle of PractitionerRole, Practitioner and Location resources, but doesn’t require that the location id is discovered first. Does return any Location with a matching name however, so the client does need to ensure they have the right location.


### Find locations where a particular Practitioner works

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?practitioner=practitionerY&_include=PractitionerRole:location](http://home.clinfhir.com:8054/baseR4/PractitionerRole?practitioner=practitionerY&_include=PractitionerRole:location)

Returns a bundle of PractitionerRole and Location resources.


### Find Practitioners with a specialty specialty

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?specialty=http://snomed.info/sct%7c394587001&_include=PractitionerRole:practitioner](http://home.clinfhir.com:8054/baseR4/PractitionerRole?specialty=http://snomed.info/sct%7c394587001&_include=PractitionerRole:practitioner)

Returns a bundle of PractitionerRole and Practitioner resources (as the specialty is recorded on the PractitionerRole - not the practitioner). Note that the format for the specialty includes the system (http://snomed.info/sct)  and value (394587001), delimited by a pipe character, which is url encoded (%7c).

Note also that the specialty code must match exactly.

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?specialty=http://snomed.info/sct%7c394587001&_include=PractitionerRole:practitioner&location=location1](http://home.clinfhir.com:8054/baseR4/PractitionerRole?specialty=http://snomed.info/sct%7c394587001&_include=PractitionerRole:practitioner&location=location1)

Limits the search to practitioners at a specific location, returning the Location resource as well


### Find Locations where there is a provider in a specific role

[http://home.clinfhir.com:8054/baseR4/PractitionerRole?role=http://snomed.info/sct%7c394587001&_include=PractitionerRole:practitioner](http://home.clinfhir.com:8054/baseR4/PractitionerRole?specialty=http://snomed.info/sct%7c394587001&_include=PractitionerRole:practitioner)

This is the same query as finding practitioners with a specialty


### Find Locations for a specific Organization where there are Practitioners in a specific role

http://home.clinfhir.com:8054/baseR4/PractitionerRole?role=http://snomed.info/sct%7c394587001&organization=organization1 &_include=PractitionerRole:practitioner&location=location1

Assumes that that the id of the Organization is known
