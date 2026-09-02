#!/bin/bash


echo
echo "This will upload the docker compose file to clinFHIR. Make sure you have backed up the original first."
echo
read -n 1 -s -r -p "Press any key to continue or <ctrl>C to cancel"


scp docker-compose.yml root@clinfhir.com:/opt/clinfhir/docker-compose.yml