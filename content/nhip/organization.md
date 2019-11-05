#### Description

An organization is a grouping of people for some purpose. Examples in the HPI include:



*   [District Health Boards](https://www.health.govt.nz/new-zealand-health-system/key-health-sector-organisations-and-people/district-health-boards) (DHB) 
*   [Primary Health Organization](https://www.health.govt.nz/new-zealand-health-system/key-health-sector-organisations-and-people/primary-health-organisations) (PHO)
*   Other Community group


#### Key differences from spec



*   The alias element has a type extension
*   There is an extension for establishment period. 


#### Resource Identifier

As with the Practitioner resource, the id of the Organisation resource will be assigned by the HPI, and will also be present as an identifier with a system value of ‘https://standards.digital.health.nz/id/hpi-organisation’.


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
   <td>https://standards.digital.health.nz/id/hpi-organisation
   </td>
   <td>Represents an organization identifier assigned by the HPI
   </td>
  </tr>
  <tr>
   <td>identifier
   </td>
   <td>https://standards.digital.health.nz/id/hpi-nzbn
   </td>
   <td>The New Zealand Business Number assigned to HPI Organisation that have been allocated one.
   </td>
  </tr>
</table>



### Search parameters


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
   <td>name
   </td>
   <td>name
   </td>
   <td>The name of the organization
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td>identifier
   </td>
   <td>identifier
   </td>
   <td>An identifier assigned to the organization. This could be the HPI organization id, or some other one such as the NZBN (New Zealand Business Number)
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td><del>nzbn+system</del>
   </td>
   <td><del>identifier</del>
   </td>
   <td><del>The New Zealand Business Number assigned to HPI Organisation that have been allocated one.</del>
   </td>
   <td>
   </td>
  </tr>
</table>



#### Common searches (todo - add examples)

Find Organization by HPI organization Id

Find Organization by NZBN


### Creating & Updating

There are no publically available updates supported. 

