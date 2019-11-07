

There are 2 key terminology resources that are used by this guide.

* The [**CodeSystem**](http://hl7.org/fhir/codesystem.html) resource describes (and sometimes contains) the actual definition of the concepts. Examples include SNOMED and locally defined systems.
* The [**ValueSet**](http://hl7.org/fhir/valueset.html)  resource is a selector resource - it defines the set of concepts (from one or more CodeSystems) that apply to a particular resource element in some context (like in the HPI). The relationship between the resource element and the ValueSet is termed a *binding*, and the binding in turn has a *strength* which indicates whether the value of an element in a resource instance *must* be in teh ValueSet, or whether it just *should* be.


In general terms, the ValueSet is the one that most people will deal with. Terminology specialists are responsible for creating and mainting teh link between ValueSet and CodeSystem.

FHIR defines a number of terminology *operations* that make it easier to use ValueSets. The one that is most commonly used in this guide is the [$expand]() operation. This takes a ValueSet, and potentially a filter, and returns the list of concepts that match. This is the operation that is used when you click on a valueset Url in the guide and display the ValueSet explorer that allows you to list the contents. 

There are other operations on [CodeSystem](http://hl7.org/fhir/codesystem-operations.html) and [ValueSet](http://hl7.org/fhir/valueset-operations.html) that are useful in particular scenarios.

There is more detail in the terminology module of [the spec](http://hl7.org/fhir/terminology-module.html). Here is an image that shows the relationship of the primary terminology resources:

![relationships](content/nhip/terminology.png) 

