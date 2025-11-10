FROM hapiproject/hapi

# Copy our HTML landing page
COPY hapiConfig.yaml /app/config/hapiConfig.yaml

EXPOSE 8080

# Run with customized Spring config location
ENTRYPOINT ["java","-jar","/app/hapi-fhir-jpaserver.jar","--spring.config.location=file:///app/config/hapiConfig.yaml"]