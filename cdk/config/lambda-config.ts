import { readFileSync } from "fs";

export interface ServiceLambdaConfig {
    FUNCTION_NAME: string;
    ENVIRONMENT_VARIABLES: {
        ARTIFACT_BUCKET_NAME: string,
    }
}

export interface ApiGatewayConfig {
    API_NAME: string;
}

export interface ArtifactConfig {
    BUCKET_NAME: string;
}

export interface IConfig {
    lambda: ServiceLambdaConfig;
    api: ApiGatewayConfig;
    artifact: ArtifactConfig;
}

// dynamically import correct config file
const CONFIG: IConfig = JSON.parse(
    readFileSync(
        `environments/${process.env.LOCAL_DEPLOY !== "true" ? "" : "local."}${process.env.ENV
        }.config.json`,
        "utf-8"
    )
);


export default CONFIG;
