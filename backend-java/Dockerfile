FROM eclipse-temurin:17-jdk-jammy AS build

WORKDIR /workspace

COPY backend-java/.mvn backend-java/.mvn
COPY backend-java/mvnw backend-java/pom.xml backend-java/

WORKDIR /workspace/backend-java
RUN chmod +x mvnw && ./mvnw -B -DskipTests dependency:go-offline

COPY backend-java/src src
RUN ./mvnw -B -DskipTests package

FROM eclipse-temurin:17-jre-jammy

ENV SERVER_PORT=8080 \
    SPRING_PROFILES_ACTIVE=prod

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /workspace/backend-java/target/*.jar /app/app.jar

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:${SERVER_PORT}/api/tts/health" >/dev/null || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
