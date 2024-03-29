

The PractitionerRole (PR) resource is a ‘linking’ resource that represents a Practitioner resource working for an Organization at a Location in some particular role. 
The following diagram shows the relationships:


### Key differences from spec

*   There is a creator extension that is a reference to the Organization and person (as a Practitioner) that created the resource. 
In the image below, the 2 resources to the left indicate the person and organization that created the record.

![relationships](content/nhip/resources.png) 

### Resource Identifiers

To return the resources for a specific Practitioner, query using the practitioner element, eg:

GET [http://home.clinfhir.com:8054/baseR4/PractitionerRole?practitioner=prac3](http://home.clinfhir.com:8054/baseR4/PractitionerRole?practitioner=prac3)

Where prac3 is the CPN (person id) number. (This works because the id of the practitioner resource is set to be the same as the CPN. )

 When a person works in a single location this will return only one active record.
 However, doctors working in public and private practices, locums working across many locations, practitioners supporting clinics at different locations
 will all have multiple practitioner records. 

One of the envisaged uses for the PR resource is as an identifier that indicates a Practitioner at a given location and potentially for a specific role.  This supports a single identifier where multiple might otherwise have been needed, and can simply be the id of the PractitionerRole resource. This is further discussed in the Laboratory Ordering Use Case.

As with the Practitioner resource, the id of the PR resource will be assigned by the HPI, and will also be present as an identifier.

There may be other identifiers in the PR resource - an example being an ‘employee number’ assigned by the organization 
creating the resource. Each of these must have a distinct system value. 
For an organisation to add an identifier like employee number to a PR resource they must first apply to HISO for a system. The HPI will validate the system to ensure only HISO approved systems are updated on the HPI. HISO will require the organisation to have completed a Privacy impact assessment of the inclusion of the new identifier in the HPI.

#### practitionerRole identifier 

The format of the Practitioner role identifier is RXXNNNNNN-C, where R is a constant character, ‘X’ is an alphanumeric character, 
‘N’ is a number, and C is a check digit <link to check digit formula page>.  ‘I‘ and ‘O’ are excluded from the alpha character set because they can be confused with the number one ‘1’ and number zero ‘0’. 

<!--
Known identifier systems are shown in the top level Identifiers tab.
#### Identifier systems


<table>
  <tr>
   <td><strong>Path</strong>
   </td>
   <td><strong>System</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td>identifier
   </td>
   <td>https://standards.digital.health.nz/id/pr
   </td>
   <td>Represents a PR identifier assigned by the HPI
   </td>
  </tr>
</table>
-->


### Search parameters


>Todo move all the comments to the API tab

The following search parameters are supported.


<table>
  <tr>
   <td><strong>Parameter</strong>
   </td>
   <td><strong>Path</strong>
   </td>
   <td><strong>Description</strong>
   </td>
   <td><strong>Custom</strong>
   </td>
  </tr>
  <tr>
   <td>identifier
   </td>
   <td>identifier
   </td>
   <td>Needed to support _includes
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td>organization
   </td>
   <td>organization
   </td>
   <td>Used to retrieve all the PRs for a single organization - eg to find all the practitioners that work for that organization
   </td>
   <td>no
   </td>
  </tr>
  <tr>
   <td>practitioner
   </td>
   <td>practitioner
   </td>
   <td>Used to retrieve all the PRs for a single practitioner - eg to find out which organizations they work for, or where they work
   </td>
   <td>no
   </td>
  </tr>
  <tr>
   <td>location
   </td>
   <td>location
   </td>
   <td>Used to retrieve all the PRs for a single location - eg to find the practitioners at a location
   </td>
   <td>no
   </td>
  </tr>
  <tr>
   <td>role
   </td>
   <td>code
   </td>
   <td>The role code for the practitioner in this relationship
   </td>
   <td>
   </td>
  </tr>
</table>



### Search includes

[Includes](http://hl7.org/fhir/search.html#include) allow a query to include other resources that are referenced by a matching resource. For example a search on practitioner that also returns the location referenced by the PR record.

They only work in the context of a search (not a read of a resource by id)


<table>
  <tr>
   <td><strong>Parameter</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td>PractitionerRole:organization
   </td>
   <td>Organization referenced by this PR
   </td>
  </tr>
  <tr>
   <td>PractitionerRole:practitioner
   </td>
   <td>Practitioner referenced by this PR
   </td>
  </tr>
  <tr>
   <td>PractitionerRole:location
   </td>
   <td>Locations referenced by this PR
   </td>
  </tr>
</table>



### Chained parameters

[Chained parameters](http://hl7.org/fhir/search.html#chaining) allow a query to be based on an attribute of a referenced resource, rather than it’s id. Eg GET [host]/PractitionerRole?organization.name=Good Health Clinic. This avoids a call to find the id of the referenced resource, at the expense of a less precise query.


<table>
  <tr>
   <td><strong>Parameter</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>
   <td>location.name
   </td>
   <td>The name of the location
   </td>
  </tr>
</table>


>(Note that one of the examples uses this. If we decide not to support I’ll change the example)


### Creating and Updating

PractitionerRole resources can be created by end users who have the authority to do so (managed outside of the FHIR API). When a PR resource is created, the creator elements (and their referenced resources) are created by the system from information about the person creating it

The PractitionerRole resource can be updated by the user who created it
or by the organisation that is the subject of the role. This is done using a standard PUT operation.

>todo: need to add the security aspects of creating & updating