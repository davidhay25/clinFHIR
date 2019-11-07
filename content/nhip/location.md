
#### Description

The <a href="http://hl7.org/fhir/location.html" target="_blank">Location</a> resource is how facilities are represented. Examples are:

*   A hospital campus
*   A General Practice
*   An allied health clinic.


#### Key differences from spec

*   The alias element has a type extension
*   There is an extension for establishment period. 


#### Resource Identifier

As with the Practitioner resource, the id of the Location resource will be assigned by the HPI, and will also be present as an identifier.


#### Identifier systems
There are currently 2 identifier systems that are used in Location resources (others may appear later).

<table>
  <tr>

   <td><strong>System</strong>
   </td>
   <td><strong>Description</strong>
   </td>
  </tr>
  <tr>

   <td>https://standards.digital.health.nz/id/hpi-facility
   </td>
   <td>Represents a facility identifier assigned by the HPI
   </td>
  </tr>
  <tr>

   <td>https://standards.digital.health.nz/id/hpi-legacyfacility
   </td>
   <td>The 4 character legacy facility code assigned by the Ministry of Health to support the legacy National Collections. (New collections use the HPI facility id)
   </td>
  </tr>
</table>

