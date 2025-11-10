#!/bin/bash

echo
echo "This will build a multi-platform image of the portal and upload it to Docker Hub"
echo
read -n 1 -s -r -p "Press any key to continue or <ctrl>C to cancel"

docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t davidhay25/myhapi:latest \
  --push .