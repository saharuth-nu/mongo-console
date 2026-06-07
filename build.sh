#!/bin/bash
if [ $# -lt 1 ]; then
  echo "No image version found"
  echo "Usage: " $0 " {image version} 2.0"
  echo "example: " $0 " 1.0 2.0"
  exit 1
else
  # npm run build:prod
  docker login
  docker buildx build --platform linux/amd64 --build-arg BASE_PATH=/db-console -t saharuth20/mongo-console:$1 .
  docker push saharuth20/mongo-console:$1
fi
