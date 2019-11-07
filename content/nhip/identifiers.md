
**Identifiers** are used to identify some entity, and consist of a value that is unique within some namespace (or system).
Examples from outside of health would be a passport or a drivers license. There are a number of elements to an
 identifier.

* The _system_ represents the namespace within which the value is unique - such as New Zealand driving licenses. In FHIR it is generally a URI. There is a separate resource (the NameSpace) that defines the system
* The _value_ of the identifier. This is guarenteed to be unique within the system
* The _type_ of identifier. This is a high level categorization of identifiers - for example to indicate that it is a driving license of some sort or a passport from some country
* The _use_ to which the identifier can be used. eg this is an official identifier, or it is one that is old.
* The _period_ over which the identifier is valid
* The _assigned_ of the identifier - eg the New Zealand government.

Of these, the system and value are most commonly present. Indeed, if they are not both present then uniqueness cannot be assumed.

In this guide, the __use__ element is also important as it indicates identifiers that have been deprecated (or made dormant) - eg an identifier determined to be a duplicate. In this case the use element will have a value of _old_.
 
Identifiers differ from the id of a resource (thought they are often confused).
* The Identifier is a property of the resource. If the resource is copied or moved to a different server then it will be the same.
* The resource id locates the element (like the url of a web page). If the resource is moved to another server then it will almost certainly change.

All of the FHIR resources in this implementation have both an id and an identifier.



Here is an example of an identifier:


```
"identifier": [
  {
    "use": "official",
    "system": "https://standards.digital.health.nz/id/hpi-person",
    "value": "96ZZZZ"
  }
]
```

The [NamingSystem](http://hl7.org/fhir/namingsystem.html) resource is used to describe the meaning of an identifier system. 
Because it's possible that a single entity can have more than one identifier (In healthcare it was common to use OID's 
but this is changing in favour of urls), each entity has a single resource, and the systems that are associated with it are
held in the _uniqueId_ element. The NamingSystem resource does not have an identifier (as this would be meaningless).

In this guide, there is a NamingSystem for each system - they are used to generate the list on the next tab.