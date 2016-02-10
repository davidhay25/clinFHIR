# Resource Builder

A directive to allow a user to build a resource from a profile - ie a
StructureDefinition resource.

## Attributes of the Directive

The attributes that should be set (and altered)

eg:

```html
<profile-form
    patient="dynamic.currentPatient"
    profile="dynamic.profile"
    allresources="dynamic.allresources"
    current-user="dynamic.currentUser"

    updated = "dynamic.updated"
    parkresource="dynamic.parkResource"
    select-profile="dynamic.selectProfile">
</profile-form>

```


Note that all attributes should be an object property - eg dynamic.SDName

### Properties (set by the client)

#### patient
The patient resource against whom the resource will be assigned (assuming
this is the type of resource that references a patient). There's a watcher
in the directive that responds to changes of patient.

#### profile
The profile (StructureDefinition) that the resource is being created against.
There is a watcher in the directive that is triggered when the value of this changes
to start a
 new resource (if there is one being built that hasn't been saved a warning is given)

#### allresources
A list of all the resources for the current patient. This is actually an
object hash where the hash is the resource type and the value a bundle of
resources. ie:

allResources['Condition'] = {bundle of condition resources}

#### current-user
The current user. This is intended to all a user to enter a comment during
 resource creation - eg if there is an error they wanted to get help with or
 make a comment. Not currently used.



### Events (fired by the directive)
All of these should be assigned to a client side function that can respond to the
event.

#### updated() ####
Fired whenever a new value is added to a resource. It simply allows the client to
be aware that a change has occurred.

#### parkresource(profile,text)
Called when the used clicks the 'park resource' option. The client is expected to
save the resource being constructed and the functionity to return it to the
editor.

The *profile* parameter is the profile with attached values
the *text* profile is not currently used

(Note that this is currently not enabled in the sample creator)

#### selectProfile(type)

An instruction to the client to retrieve the indicated profile type
 (ie StructureDefinition) and load it into the builder (by setting the SD to
 the profile attribute). This will cause the Resource Builder to load the new
 type. It is used by the 'parkAndBuild' convenience function to allow the user
 to quickly create another resource.

  'parkAndBuild' will have saved the current resource first using the 'park' function
  described above.

  At the moment this signature will only work with a base fhir resource -
  should probably be a profile url.

  Note that the sample creator doesn't support this at the moment.



## How the resource is created

The resource is created by adding a 'value' property to 'parent' nodes in the profile
 (StructureDefinition) which hold the entered values for 'children' of that node. a parent
 node is either a DomainResource or a BackBone element

 This is set up by the function *drawListOfElements* - which is called to display the
 immediate children of some node (in dstu2 these are elements of type BackBoneElement)

 If there can be multiple instances of the BackBoneElement then it will be an array of values -
 if not then a single object property. The property then holds the actual values in a hash.
 When the profile is loaded, then initial parent will be the resource itself, and will not be multiple.
 eg CarePlan will have an object as its 'value', but when the user selects CarePlan.Participant then
 it will be an array.

 When an actual value is added to the resource (eg CarePlan.description) then a similar process
 if followed - if there can only be a single value, then the value of the hash will be an object,
 otherwise an array. eg CarePlan.desciption will be an object, CarePlan.support will be an array.

 You can see this in $scope.saveNewDataType which actually adds a specific element value to the
 profile. It calls *addValue* ( var addValue = function(v,dataType,text,isPrimitive) { ) to
 actually populate the value element - which determines whether to use an object or an array
 (and note that this needs to use the base definition of the profile - ie the 'original' resource
 in the case of a profiled one.)

 Things get further complicated as the hierarchy gets deeper - which 'branch' is being edited?
 This is tracked by the variable *selectedPage* which is also added to the parent. See the
 function *$scope.addPage*

 The resource itself is built by a function in the *rbServices.js* service (*makeResource*)- itself called by the
 *buildResource* function in renderProfile. This parses the profile by a rather crude technique and
 constructs an actual resource from the profile and the value elements.

 ### Extensions
 An extension is basically an extra element (or elements - they can nest) that the designer adds to
 a profile. The underlying StructureDefinition is still used to describe the 'profiled resource'.
 I've done a number of posts on profiles - http://fhirblog.com/?s=profile and there is a lot of detail
  in the spec

  In the profile builder, I used the pattern of adding them to the profile (SD) as if they were ordinary
  elements - this is done by *drawListOfElements()* - and then the *addValue* function adds them.

 ## Questions

 This all seems to work OK for simple profiles, but starts to fail for more complex ones.
 For example, where there are multiple instances of BackBoneElement - only the first branch gets
  updated.

  And extensions are particularly troublesome

  So there are a couple of key questions.

  * Is the overall algorithm the correct one? ie the idea that the valuse are stored in the profile and added
   as a batch. Or, would it be better to have a 'stand alone' resource than gets updated 'one element at a time' as
   teh user selects values. Or, some other...

   * Is it just that there are bugs in the application (I know there are a number!) - the function that actually
   builds the resource is particularly hard coded - it ought to be recursive I suspect...

   * How best to handle extensions?

   Part of the issue is that the resource builder was originally developed against DSTU1 - and before a lot
   of the supporting infrastrcutire (like ValueSets for example) were in place. Things were rapidly changing
   and a lot of hacks were needed to make it all work. Many of those hacks persist - is a 'fresh look' needed?