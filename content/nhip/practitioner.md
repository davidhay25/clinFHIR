

The Practitioner resource represents any provider of healthcare - not restricted to those with formal qualifications. 

The current HPI contains practitioners covered by the Health Practitioners Competence Assurance Amendment Act 2019. This includes all  Dentists, Dental hygienist and Dental and Oral health therapist, Dietitians, Medical Laboratory Scientist and Technicians including phlebotomists and mortuary technicians, Anaesthetic Technologists, Medical Radiation Technologists, Medical Practitioners (all doctors and specialists), Midwifes, Nurses,	Occupational Therapists, Optometrists and optical dispensers, Pharmacists, Physiotherapists, Psychologists,	Psychotherapists. 	

Chiropractors, Podiatrist and Osteopaths also covered by the Act are working towards supplying their members data to the HPI also.

It is intended with the upgraded capabilities that other professional groups will also supply their members also eg Social Workers, Acupuncturists, Audiologists, Counsellors, Cardiac Physiologists, paramedics, Nutritionist.

Other groups of health workers will need a CPN to be identified in digital records eg Allied Health assistants, Aged care, Personal Care and support workers, administrative staff, practice managers, students working in healthcare setting,

Consideration is being given to ‘self-asserted’ data.


### Key differences from spec



*   DeathDate extension
*   Ethnicity extension
*   Qualification has a status (see more differences below)
*   Initial date of registration extension
*   Additional Authorizations extension (complex)
*   Scope of Practice extension (complex)
*   Conditions on Practice extension (complex)


### Registration Authority (RA)

A registration authority is an organization that asserts the information about a practitioner’s competence to perform a particular health role.  This includes the Responsible Authorities named under the Act and Professional bodies who require a level of education and professional development to be registered as a member and be issued a certificate to practice.  - Information supplied by the Registration Authority can only be changed by the Registration Authority.  Health provider organisations may add their workers to the HPI with personal identity details ie name, date of birth, gender, ethnicity and the languages they speak in order to get a CPN. At a later stage a Responsible Authority or a Professional body may add information about their registration with that body ie Annual Practicing Certificate dates, scopes of practice etc. 


### Resource identifiers

There are 2 levels of identifier in the practitioner resource. 

_Practitioner.identifier_ is the top level identifier assigned by the HPI (and the source of the resource id as described in the background section). There can be multiple identifiers for any given resource as part of managing the Practitioner (for example removal of duplicate identifiers). The current identifier will have a _use_ value of ‘official’, others will have a _use_ value of ‘old’. It is the client's responsibility to check the value of the use element.

_Practitioner.qualification.identifier_ is the identifier assigned by the Registration authority - for example the Medical Council Number, or Nursing Council number.


### Practitioner Qualifications

The Practitioner resource has a single qualification element that holds 2 distinct categories of information from the perspective of the HPI.



*   _Qualifications_ are regarded as recognition of a particular academic achievement. For example a medical or nursing degree
*   _Registrations_ are statements of ‘fitness to practice’ in New Zealand, and are conferred by the Registration authority. Generally - though not always - there is a degree as well, though it is at the discretion of the Registration Authority that fitness to practice is stated.

After some discussion, it was decided that only ‘registration’ information is to be included in the Practitioner resource to avoid confusion. This can be revisited if needed.

There are 2 elements within the qualification element that are related to the Registration Authority.



*   _qualification.issuer_ is a reference to the Organization resource that represents the asserter
*   _qualification.identifier.system_  is a url that represents the namespace of the Registration Authority

<!--
#### Identifier systems

<table>
  <tr>
   <td>Path
   </td>
   <td>Description
   </td>
   <td>system
   </td>
   <td>assigner
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td>HPI Facility Identifier
   </td>
   <td><a href="https://standards.digital.health.nz/id/hpi-organisation">https://standards.digital.health.nz/id/hpi-facility</a>
   </td>
   <td>G00001-G Ministry of Health
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td>HPI Organisation Identifier
   </td>
   <td><a href="https://standards.digital.health.nz/id/hpi-organisation">https://standards.digital.health.nz/id/hpi-organisation</a>
   </td>
   <td>G00001-G Ministry of Health
   </td>
  </tr>
  <tr>
   <td>identifier
   </td>
   <td>HPI Person Identifier - Also known as the HPI-CPN
   </td>
   <td><a href="https://standards.digital.health.nz/id/hpi-person">https://standards.digital.health.nz/id/hpi-person</a>
   </td>
   <td>G00001-G Ministry of Health
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Chiropractic Board Register number  (CH)
   </td>
   <td><a href="https://standards.digital.health.nz/id/Chiropractic-Board-person">https://standards.digital.health.nz/id/Chiropractic-Board-person</a>
   </td>
   <td>G00019-D
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Dental Council Register Number (DC)
   </td>
   <td><a href="https://standards.digital.health.nz/id/dental-council-person">https://standards.digital.health.nz/id/dental-council-person</a>
   </td>
   <td>G00002-J
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Dietitians Board Register Number (DI)
   </td>
   <td><a href="https://standards.digital.health.nz/id/dietitians-board-person">https://standards.digital.health.nz/id/dietitians-board-person</a>
   </td>
   <td>G00023-F
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Medical Laboratory Science Board Register Number (LT)
   </td>
   <td><a href="https://standards.digital.health.nz/id/medical-laboratory-science-board-person">https://standards.digital.health.nz/id/medical-laboratory-science-board-person</a>
   </td>
   <td>G00021-B
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Medical Council of New Zealand Register Number (MC)
   </td>
   <td><a href="https://standards.digital.health.nz/id/medical-council-person">https://standards.digital.health.nz/id/medical-council-person</a>
   </td>
   <td>G00004-B
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Midwifery Council Register Number (MW)
   </td>
   <td><a href="https://standards.digital.health.nz/id/midwifery-council-person">https://standards.digital.health.nz/id/midwifery-council-person</a>
   </td>
   <td>G00009-A
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Nursing Council of New Zealand Register Number (NC)
   </td>
   <td><a href="https://standards.digital.health.nz/id/nursing-council-person">https://standards.digital.health.nz/id/nursing-council-person</a>
   </td>
   <td>G00008-K
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Optometrists & Dispensing Opticians Board Register Number (OD)
   </td>
   <td><a href="https://standards.digital.health.nz/id/optometrists-dispensing-opticians-board-person">https://standards.digital.health.nz/id/optometrists-dispensing-opticians-board-person</a>
   </td>
   <td>G00015-G
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Osteopathic Council Register Number (OS)
   </td>
   <td><a href="https://standards.digital.health.nz/id/osteopathic-council-person">https://standards.digital.health.nz/id/osteopathic-council-person</a>
   </td>
   <td>G00022-D
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Occupational Therapy Board Register Number (OT)
   </td>
   <td><a href="https://standards.digital.health.nz/id/occupational-therapy-board-person">https://standards.digital.health.nz/id/occupational-therapy-board-person</a>
   </td>
   <td>G00000-E
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Psychologists Board Register Number (PC)
   </td>
   <td><a href="https://standards.digital.health.nz/id/psychologists-board-person">https://standards.digital.health.nz/id/psychologists-board-person</a>
   </td>
   <td>G00018-B
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Pharmacy Council of New Zealand Register Number (PM)
   </td>
   <td><a href="https://standards.digital.health.nz/id/pharmacy-council-person">https://standards.digital.health.nz/id/pharmacy-council-person</a>
   </td>
   <td>G00010-H
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Podiatrists Board Register Number (PO)
   </td>
   <td><a href="https://standards.digital.health.nz/id/podiatrists-board-person">https://standards.digital.health.nz/id/podiatrists-board-person</a>
   </td>
   <td>G00016-J
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Physiotherapy Board Register Number (PT)
   </td>
   <td><a href="https://standards.digital.health.nz/id/physiotherapy-board-person">https://standards.digital.health.nz/id/physiotherapy-board-person</a>
   </td>
   <td>G00007-H
   </td>
  </tr>
  <tr>
   <td>qualification. Identifier
   </td>
   <td>Medical Radiation Technologists Board Register Number (RT)
   </td>
   <td><a href="https://standards.digital.health.nz/id/medical-radiation-technologists-board-person">https://standards.digital.health.nz/id/medical-radiation-technologists-board-person</a>
   </td>
   <td>G00014-E
   </td>
  </tr>
  <tr>
   <td>
   </td>
   <td>
   </td>
   <td> 
   </td>
   <td> 
   </td>
  </tr>
</table>


 

_(should really move these out to a separate register (rather than in the IG) - but good to have them here for now…)_

 

(Note that every RA will have a unique uri)
-->

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
   <td>identifier
   </td>
   <td>identifier 
   </td>
   <td>Search for a resource with a specified identifier value and system (as per the table above). 
<p>
The HPI person number. Will include deprecated (dormant) identifiers as well - 
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td><del>identifier+system</del>
   </td>
   <td><del>identifier</del>
   </td>
   <td><del>Local system identifiers used to map to the HPI person number.</del>
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td>name
   </td>
   <td>name
   </td>
   <td>Allows search by name
   </td>
   <td>
   </td>
  </tr>
  <tr>
   <td>ra-identifier
   </td>
   <td>qualification.identifier
   </td>
   <td>The identifier supplied by the Registration Authority
   </td>
   <td>yes
   </td>
  </tr>
</table>



### Creating & Updating

There are no publically available updates supported. 

Shall we support patch update for identifier? See [https://hpi.zulipchat.com/#narrow/stream/212470-general/topic/Non-HPI.20identifiers](https://hpi.zulipchat.com/#narrow/stream/212470-general/topic/Non-HPI.20identifiers)

Are there any other updates to be supported via the API? Perhaps there is a restricted API that allows complete update (and only used by authorized users who must follow the rules - eg preserve extra identifiers that have been added) and a more widely available patch API - potentially for specific elements only. This could potentially be a pattern to apply to other resources where limited updates are needed (eg PractitionerRole.availableTime or Location.hoursOfOperation)

_ToDo_



*   _All valuesets_
