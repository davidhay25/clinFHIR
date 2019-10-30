### Location

The Location resource is how facilities are represented. Examples are:



*   A hospital campus
*   A General Practice
*   An allied health clinic.


#### Key differences from spec



*   The alias element has a type extension
*   There is an extension for establishment period. 


#### Resource Identifier

As with the Practitioner resource, the id of the Location resource will be assigned by the HPI, and will also be present as an identifier.


##### Identifier systems


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
   <td>https://standards.digital.health.nz/id/hpi-facility
   </td>
   <td>Represents a facility identifier assigned by the HPI
   </td>
  </tr>
  <tr>
   <td>identifier
   </td>
   <td>
   </td>
   <td>The 4 character legacy facility code assigned by the Ministry of Health to support the legacy National Collections. (New collections use the HPI facility id)
   </td>
  </tr>
</table>



#### Search parameters


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
   <td>The name of the facility
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td>identifier
   </td>
   <td>identifier
   </td>
   <td>The HPI facility id 
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td><del>Facility code</del>
   </td>
   <td><del>identifier</del>
   </td>
   <td><del>The 4 character legacy facility code assigned by the Ministry of Health to support the legacy National Collections. (New collections use the HPI facility id)</del>
   </td>
   <td>
   </td>
  </tr>
</table>



##### Common searches todo add examples

Find Location by HPI facility Id

Find Location by facility code 


#### Creating & Updating

There are no publically available updates supported. 
