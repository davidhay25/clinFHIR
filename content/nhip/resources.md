

The following notes apply to all resources in this implementation.

### Key relationships between resources

![relationships](content/nhip/resources.png) 

Note that the 2 'CreatedBy' references are to support the ability for end-users to create and modify PractitionerRole
resources (to ensure that they are updated by the organizations/people that created them). The other references are
the key 'structural' relationships with the PractitionerRole recording a Practitioner working for an Organization at
a Location.

### Resource representation: Json & XML

Resources can be expressed either as Json or XML, and both formats are supported by this implementation.


### Id and Identifiers
  
All of the FHIR resources in this implementation have both an id and an identifier.

The id is the ‘physical’ identity of the resource, and the identifier is the business identifier. 
Refer to the 'Identifier' tab for further details


In this implementation, **the id of the resource will always be the same as the value of the identifier assigned by the HPI with a use value of ‘official’**. (There will only ever be a single identifier with this use type in a resource). Thus the id for the resource above would be ‘96ZZZZ’, and the url something like:

[http://hpi.moh.nz/fhir/Practitioner/](http://hpi.moh.nz/fhir/Practitioner/prac-X)96ZZZZ 

(The actual root url for the HPI has not yet been determined).

This design allows an implementer to retrieve a resource from the HPI and save it on their own system, but still be able to retrieve the original to check for updates. This can be done in 2 ways.


#### Read resource by id


Extract the value of the identifier where the value of use is ‘official’, and use that as the id for a direct read from the server. 

Example: [http://hpi.moh.nz/fhir/Practitioner](http://hpi.moh.nz/fhir/Practitioner/prac-X)/96ZZZZ


#### Query resource

Use the identifier in a search query. 


    Example: [http://hpi.moh.nz/fhir/Practitioner?](http://hpi.moh.nz/fhir/Practitioner/prac-X)identifier=https://standards.digital.health.nz/id/hpi|96ZZZZ


(Note that both system and value are included in the query, with values separated by a ‘|’. When making the query, the ‘|’ needs to be url-escaped)

This will return a bundle of Practitioner resources with only a single entry. 


### References between resources

References are directional - from a source to a target. There are 2 ways that references between resources can be represented in this implementation. 


#### As a reference to the id of the target resource. 

The following example shows a reference to a Practitioner with the id of "example"


``
"practitioner": {
"reference": "Practitioner/example",
"display": "Dr Marcus welby"
  }
...
``


This is a relative reference (ie the target is on the same server as the source) from a property called ‘practitioner’ to the practitioner resource. This format is used when possible.


#### Using the target resource identifier



```
...
  "practitioner": {
    "identifier": {
        "system": "https://standards.digital.health.nz/id/hpi",
        "value": "96ZZZZ"
    },
    "type":"Practitioner",
    "display": "Dr Adam Careful"
  }

...
```


This is a reference from a property called ‘practitioner’ to a Practitioner resource that has the identifier _96ZZZZ_ 
in the system _https://standards.digital.health.nz/id/hpi_  It has the disadvantage that if the client wishes to
retrieve the target resource, then it must do a query by identifier. There are also a number of search queries
that require a direct reference rather than an identifier.


### Merging resource and Dormant identifiers

In some cases, a single entity may have been accidentally assigned multiple identifiers. When this is discovered to have occurred, one of the identifiers is deprecated and becomes a ‘dormant’ identifier, leaving the other as the active one. Both identifiers will appear in the active resource identifier list, with the dormant identifiers having a _use_ value of ‘old’ and the active having a _use_ value of ‘official’. 

When reading the resource, if the deprecated id is used, then the resource that is returned will have the deprecated id, but the identifiers will be the correct ones (ie the 

For example, assume that there are 2 Practitioner resources exposed by the HPI, each with a single identifier. The id of the resource matches the identifier value.


```
{
  "resourceType":"Practitioner",
  "id" : "96ZZZ",
  "identifier" : [
        {"system":"https://standards.digital.health.nz/id/hpi-person","value":"96ZZZ","use":"official"}


  ]
… other data
}
```


(returned by GET [host]/Practitioner/96ZZZ)

And 


```
{
  "resourceType":"Practitioner",
  "id" : "96YYY",
  "identifier" : [
        {"system":"https://standards.digital.health.nz/id/hpi-person","value":"96YYY","use":"official"}


  ]… other data (may be different to 96ZZZ)

}
```


(returned by GET [host]/Practitioner/96YYY)

They are determined to be the same person, and the identifier 96YYY is deprecated (made dormant) in favour of 96ZZZ.

A GET call of GET [host]/Practitioner/96ZZZ) will return


```
{
  "resourceType":"Practitioner",
  "id" : "96ZZZ",
  "identifier" : [
        {"system":"https://standards.digital.health.nz/id/hpi-person","value":"96ZZZ","use":"official"},
        {"system":"https://standards.digital.health.nz/id/hpi-person","value":"96YYY","use":"old"}


  ]
… other data

}
```


And a get call of GET [host]/Practitioner/96YYY) will return


```
{
  "resourceType":"Practitioner",
  "id" : "96YYY",
  "identifier" : [
        {"system":"https://standards.digital.health.nz/id/hpi-person","value":"96ZZZ","use":"official"},
        {"system":"https://standards.digital.health.nz/id/hpi-person","value":"96YYY","use":"old"}


  ]
… other data - the same as GET [host]/Practitioner/96ZZZ

}
```


(note that in this case the id of the resource does not match the official HPI value)

Resources that reference the Practitioner (such as the PractitionerRole resource) can use either id. For example, to return PractitionerRole resources for this Practitioner, either of the following queries will return the same set of PractitionerRole resources:

GET [host]/PractitionerResource?practitioner=96ZZZ

GET [host]/PractitionerResource?practitioner=96YYY

### Must support

The 'must support' indicator means that the client must have a strategy to deal with this element. details [here](http://hl7.org/fhir/profiling.html#mustsupport)

(todo - more details needed)

### Contained resources

Contained resources are where the referenced (target) resource is contained within the source resource.


### Modifier Extensions

