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



