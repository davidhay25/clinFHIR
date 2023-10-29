# FHIR Sample creator

This project is an Angular  'Single Page Application' that has 2 purposes (and 2 target audiences):

 * To create sample files for a FHIR server
 * To develop an angular directive for building valid FHIR resources from a 'profile' resource - ie StructureDefinition

# Installation

 1. Clone (or download) the repository
 2. Set up a simple HTTP server that will serve the files to a browser. On Mac OS X/Linux, the file 'startServer.sh' will start up the python HTTP server that serves up pages on port 8000 by default. On Windows, the file 'startServerWindows.bat' will start up the python HTTP server on port 8000 (make sure python is installed).
 3. In a browser, navigate to *http://localhost:8000/launcher.html*

# Usage
As described above, this app is really targetted to 2 distinct sets of users.

## Developers
There is a need in the FHIR community for a component that can generate sample fhir resources from profiles (StructureDefinition resources). These are useful for educational purposes, to help a profile designer understand what the conformant instances will look like, and to generate examples that are really helpful for other developers.

The current app goes some way towards meeting this need, but suffers from a number of bugs with the more complex resource types and doesn't manage extensions at all well. The hope is that a small community of developers will add their expertise to enhancing the component - effectively moving it from the current 'single developer' project to one supported by a community.

## FHIR Users



# Folder layout

## artifacts
Configuration files such as *options.json* which contains options for the sample generation (eg resources to use, sample codesets etc)

## css
Style sheerts and image files
## fonts
Fonts
## includes
HTML files that are 'included' in the main html file
## js
JavaScript files used by the sample creator (not the resource builder ).

* *appConfigSvc.js* - returns the configuration object - noteably the servers to use. Also used by the resource builder
* *controllers.js* - the controller for the sample creator
* *filters.js* - filter definitions
* *resourceSvc.js* - a service that is used for instantiated resoruces. Currently generates the inwards and outwards resource references that are displayed when an existing resource is selected in the sample creator
* *services.js* - services used by the resource creator.

## prTemplates
HTML 'include' files that are used by the resource builder and are specific for each datatype. They are included by the renderProfile.html file.
 ## resourceBuilder
 The files used by the resource Builder directive.
  * *allResources.json* - a list of the base resources in fhir. Used when displaying the list of standard resource types  for a user to select. If 'reference' is true, then that indicates a resource type that is not referenced by a patient.
  * *confirmNewResource.html* - used when saving a new resource
  * *rbFrameCtrl.js* - the controlled file used by the sample creator when 'hosting' the resource builder directive. The directive requires a number of properties to be set, and exposes a number of events during its operation. This controller manages those funtions.
   * *rsServices.js* - A service that exposes functions used by the resource builder. An attempt to keep the resource builder size reasonable!
   * *renderProfile.js* - the javascript code used by the resource builder.
   * *renderProfile.html* - the directive html file. It includes the prTrmplates used to generate the UI
   * *vsBrowser.html/js* - the ValueSet browser files. Allows a user to example a valueset to see what it contains.


 # Current limitations

 1. The


