use aws_config::profile::ProfileFileCredentialsProvider;
use aws_config::BehaviorVersion;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_ssm::types::ParameterType;
use aws_sdk_ssm::Client as SsmClient;
use serde::{Deserialize, Serialize};

// ── Shared types ─────────────────────────────────────────────────────────────

/// A single Parameter Store entry returned to the frontend.
#[derive(Serialize)]
pub struct RemoteParam {
    pub path: String,
    pub value: String,
    pub description: Option<String>,
}

/// One item from the diff computed on the frontend.
/// Field names are camelCase to match the TypeScript DiffItem interface.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffItem {
    pub action: String,
    pub path: String,
    pub local_value: Option<String>,
    pub is_secure: Option<bool>,
    pub description: Option<String>,
}

/// Result returned by ssm_apply_diff.
#[derive(Serialize)]
pub struct ApplyDiffResult {
    pub created: u32,
    pub updated: u32,
    pub deleted: u32,
}

// ── Credential helper ─────────────────────────────────────────────────────────

fn build_credentials_provider(
    profile: &str,
    credentials_file_path: Option<&str>,
) -> ProfileFileCredentialsProvider {
    // If the user configured a custom credentials file, point the SDK at it via
    // the standard environment variable. Safe for a single-user desktop app
    // (single-threaded caller context).
    // NOTE: std::env::set_var becomes `unsafe` in Rust Edition 2024. When
    // upgrading from edition 2021, wrap this in an unsafe block.
    if let Some(path) = credentials_file_path {
        std::env::set_var("AWS_SHARED_CREDENTIALS_FILE", path);
    }
    ProfileFileCredentialsProvider::builder()
        .profile_name(profile)
        .build()
}

async fn ssm_client(
    profile: &str,
    region: &str,
    credentials_file_path: Option<&str>,
) -> SsmClient {
    let creds = build_credentials_provider(profile, credentials_file_path);
    let config = aws_config::defaults(BehaviorVersion::latest())
        .region(aws_sdk_ssm::config::Region::new(region.to_owned()))
        .credentials_provider(creds)
        .load()
        .await;
    SsmClient::new(&config)
}

async fn s3_client(
    profile: &str,
    region: &str,
    credentials_file_path: Option<&str>,
) -> S3Client {
    let creds = build_credentials_provider(profile, credentials_file_path);
    let config = aws_config::defaults(BehaviorVersion::latest())
        .region(aws_sdk_s3::config::Region::new(region.to_owned()))
        .credentials_provider(creds)
        .load()
        .await;
    S3Client::new(&config)
}

// ── Error helper ─────────────────────────────────────────────────────────────

/// Extracts a detailed error message from an AWS SDK error.
/// Uses Debug format which includes the full cause chain (service code,
/// HTTP status, credential errors, etc.) instead of the generic Display.
fn detailed_aws_error<E: std::fmt::Debug>(err: &E) -> String {
    format!("{err:?}")
}

// ── Tauri commands ────────────────────────────────────────────────────────────
// Note: command functions must NOT be `pub` — the #[tauri::command] macro
// generates a __cmd__ macro, and `pub` causes it to be imported twice.

/// Fetches all parameters under `prefix` from SSM Parameter Store (paginated).
#[tauri::command]
async fn ssm_get_params(
    profile: String,
    region: String,
    prefix: String,
    credentials_file_path: Option<String>,
) -> Result<Vec<RemoteParam>, String> {
    let client = ssm_client(&profile, &region, credentials_file_path.as_deref()).await;
    let mut results: Vec<RemoteParam> = Vec::new();
    let mut next_token: Option<String> = None;

    // 1. Fetch all parameter values via GetParametersByPath (paginated)
    loop {
        let mut req = client
            .get_parameters_by_path()
            .path(&prefix)
            .recursive(true)
            .with_decryption(true);

        if let Some(token) = next_token {
            req = req.next_token(token);
        }

        let resp = req.send().await.map_err(|e| detailed_aws_error(&e))?;

        for param in resp.parameters() {
            if let (Some(name), Some(value)) = (param.name(), param.value()) {
                results.push(RemoteParam {
                    path: name.to_owned(),
                    value: value.to_owned(),
                    description: None,
                });
            }
        }

        match resp.next_token() {
            Some(token) => next_token = Some(token.to_owned()),
            None => break,
        }
    }

    // 2. Fetch descriptions via DescribeParameters (paginated).
    if !results.is_empty() {
        let path_filter = aws_sdk_ssm::types::ParameterStringFilter::builder()
            .key("Path")
            .option("Recursive")
            .values(&prefix)
            .build()
            .map_err(|e| detailed_aws_error(&e))?;

        let mut desc_map: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        let mut desc_token: Option<String> = None;

        loop {
            let mut desc_req = client
                .describe_parameters()
                .parameter_filters(path_filter.clone());

            if let Some(token) = desc_token {
                desc_req = desc_req.next_token(token);
            }

            let desc_resp = desc_req.send().await.map_err(|e| detailed_aws_error(&e))?;

            for meta in desc_resp.parameters() {
                if let (Some(name), Some(desc)) = (meta.name(), meta.description()) {
                    if !desc.is_empty() {
                        desc_map.insert(name.to_owned(), desc.to_owned());
                    }
                }
            }

            match desc_resp.next_token() {
                Some(token) => desc_token = Some(token.to_owned()),
                None => break,
            }
        }

        // Merge descriptions into results
        for result in &mut results {
            result.description = desc_map.remove(&result.path);
        }
    }

    Ok(results)
}

/// Applies a pre-computed diff to SSM Parameter Store.
#[tauri::command]
async fn ssm_apply_diff(
    profile: String,
    region: String,
    diff: Vec<DiffItem>,
    credentials_file_path: Option<String>,
) -> Result<ApplyDiffResult, String> {
    let client = ssm_client(&profile, &region, credentials_file_path.as_deref()).await;
    let mut created = 0u32;
    let mut updated = 0u32;
    let mut deleted = 0u32;

    for item in &diff {
        match item.action.as_str() {
            "create" | "update" => {
                let value = item.local_value.as_deref().unwrap_or("");
                let param_type = if item.is_secure.unwrap_or(false) {
                    ParameterType::SecureString
                } else {
                    ParameterType::String
                };
                let mut req = client
                    .put_parameter()
                    .name(&item.path)
                    .value(value)
                    .r#type(param_type)
                    .overwrite(true);
                if let Some(desc) = &item.description {
                    req = req.description(desc);
                }
                req.send()
                    .await
                    .map_err(|e| detailed_aws_error(&e))?;
                if item.action == "create" {
                    created += 1;
                } else {
                    updated += 1;
                }
            }
            "delete" => {
                client
                    .delete_parameter()
                    .name(&item.path)
                    .send()
                    .await
                    .map_err(|e| detailed_aws_error(&e))?;
                deleted += 1;
            }
            _ => {}
        }
    }

    Ok(ApplyDiffResult { created, updated, deleted })
}

/// Uploads a gzip-compressed backup to S3.
#[tauri::command]
async fn s3_upload_backup(
    profile: String,
    region: String,
    bucket: String,
    key: String,
    data: Vec<u8>,
    credentials_file_path: Option<String>,
) -> Result<(), String> {
    let client = s3_client(&profile, &region, credentials_file_path.as_deref()).await;
    client
        .put_object()
        .bucket(&bucket)
        .key(&key)
        .body(ByteStream::from(data))
        .content_type("application/gzip")
        .send()
        .await
        .map_err(|e| detailed_aws_error(&e))?;
    Ok(())
}

// ── App entry point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            ssm_get_params,
            ssm_apply_diff,
            s3_upload_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── DiffItem deserialization ──────────────────────────────────────────────
    // These tests guard the IPC contract: TypeScript sends camelCase JSON,
    // Rust must deserialize it correctly via #[serde(rename_all = "camelCase")].

    #[test]
    fn diff_item_create_deserializes_camel_case() {
        let json =
            r#"{"action":"create","path":"/ns/proj/dev/KEY","localValue":"val","isSecure":true,"description":"The API key"}"#;
        let item: DiffItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.action, "create");
        assert_eq!(item.path, "/ns/proj/dev/KEY");
        assert_eq!(item.local_value, Some("val".to_string()));
        assert_eq!(item.is_secure, Some(true));
        assert_eq!(item.description, Some("The API key".to_string()));
    }

    #[test]
    fn diff_item_update_deserializes_camel_case() {
        let json =
            r#"{"action":"update","path":"/ns/proj/dev/KEY","localValue":"new","isSecure":false}"#;
        let item: DiffItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.action, "update");
        assert_eq!(item.local_value, Some("new".to_string()));
        assert_eq!(item.is_secure, Some(false));
    }

    #[test]
    fn diff_item_delete_omits_optional_fields() {
        let json = r#"{"action":"delete","path":"/ns/proj/dev/KEY"}"#;
        let item: DiffItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.action, "delete");
        assert_eq!(item.local_value, None);
        assert_eq!(item.is_secure, None);
        assert_eq!(item.description, None);
    }

    #[test]
    fn diff_item_null_local_value_deserializes() {
        let json = r#"{"action":"create","path":"/p","localValue":null}"#;
        let item: DiffItem = serde_json::from_str(json).unwrap();
        assert_eq!(item.local_value, None);
    }

    #[test]
    fn diff_item_rejects_missing_required_fields() {
        let json = r#"{"action":"create"}"#;
        let result: Result<DiffItem, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }

    // ── RemoteParam serialization ─────────────────────────────────────────────

    #[test]
    fn remote_param_serializes_without_description() {
        let param = RemoteParam {
            path: "/ns/proj/dev/API_KEY".to_string(),
            value: "secret123".to_string(),
            description: None,
        };
        let json = serde_json::to_string(&param).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["path"], "/ns/proj/dev/API_KEY");
        assert_eq!(parsed["value"], "secret123");
        assert!(parsed["description"].is_null());
    }

    #[test]
    fn remote_param_serializes_with_description() {
        let param = RemoteParam {
            path: "/ns/proj/dev/API_KEY".to_string(),
            value: "secret123".to_string(),
            description: Some("The API key".to_string()),
        };
        let json = serde_json::to_string(&param).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["path"], "/ns/proj/dev/API_KEY");
        assert_eq!(parsed["value"], "secret123");
        assert_eq!(parsed["description"], "The API key");
    }

    // ── ApplyDiffResult serialization ────────────────────────────────────────

    #[test]
    fn apply_diff_result_serializes_all_counts() {
        let result = ApplyDiffResult { created: 3, updated: 1, deleted: 2 };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["created"], 3);
        assert_eq!(parsed["updated"], 1);
        assert_eq!(parsed["deleted"], 2);
    }

    #[test]
    fn apply_diff_result_zero_counts_serialize() {
        let result = ApplyDiffResult { created: 0, updated: 0, deleted: 0 };
        let json = serde_json::to_string(&result).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["created"], 0);
        assert_eq!(parsed["updated"], 0);
        assert_eq!(parsed["deleted"], 0);
    }

    // ── build_credentials_provider ────────────────────────────────────────────

    #[test]
    fn build_credentials_provider_default_profile() {
        let _provider = build_credentials_provider("default", None);
    }

    #[test]
    fn build_credentials_provider_custom_profile() {
        let _provider = build_credentials_provider("my-profile", None);
    }

    #[test]
    fn build_credentials_provider_sets_env_var_for_custom_path() {
        build_credentials_provider("default", Some("/custom/path/credentials"));
        assert_eq!(
            std::env::var("AWS_SHARED_CREDENTIALS_FILE").unwrap(),
            "/custom/path/credentials"
        );
        // Clean up so other tests aren't affected
        std::env::remove_var("AWS_SHARED_CREDENTIALS_FILE");
    }
}
