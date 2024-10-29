use reqwest::{Client, Response};
use anyhow::Result;

use crate::commands::log_message;

const MODEL_NAME: &str = "HttpClient";

pub struct HttpClient {
    client: Client,
}

impl HttpClient {
    pub fn new() -> Self {
        log_message(
            "Initializing HTTP client".to_string(),
            "INFO".to_string(),
            MODEL_NAME.to_string(),
        );
        Self {
            client: Client::new()
        }
    }

    pub async fn proxy_request(
        &self,
        target_url: &str,
        method: &str,
        body: Vec<u8>,
    ) -> Result<Response> {
        log_message(
            format!("Proxying {} request to {}", method, target_url),
            "DEBUG".to_string(),
            MODEL_NAME.to_string(),
        );
    
        let boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        let request = match method {
            "GET" => self.client.get(target_url),
            "POST" => {
                let content_type = format!("multipart/form-data; boundary={}", boundary);
                log_message(
                    format!("Setting Content-Type: {}", content_type),
                    "DEBUG".to_string(),
                    MODEL_NAME.to_string(),
                );
                
                self.client.post(target_url)
                    .header("Content-Type", content_type)
                    .body(body)
            },
            _ => {
                log_message(
                    format!("Unsupported HTTP method: {}", method),
                    "ERROR".to_string(),
                    MODEL_NAME.to_string(),
                );
                return Err(anyhow::anyhow!("Unsupported HTTP method"));
            }
        };
    
        let response = request.send().await?;
        log_message(
            format!(
                "Received response: Status={}, Content-Length={:?}",
                response.status(),
                response.headers().get("content-length")
            ),
            "DEBUG".to_string(),
            MODEL_NAME.to_string(),
        );

        Ok(response)
    }

    pub async fn send_request(
        &self,
        target_url: &str,
        method: &str,
        body: Vec<u8>
    ) -> Result<String, String> {
        let function_name = "send_request";
        log_message(
            format!("[{}] Sending {} request to {}", function_name, method, target_url),
            "DEBUG".to_string(),
            MODEL_NAME.to_string(),
        );

        let response = self.proxy_request(target_url, method, body).await
            .map_err(|e| format!("Request failed: {}", e))?;
            
        response.text().await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    pub async fn check_status(&self, url: &str) -> Result<bool, String> {
        let function_name = "check_status";
        log_message(
            format!("[{}] -- Checking status for {}", function_name, url),
            "DEBUG".to_string(),
            MODEL_NAME.to_string(),
        );

        let response = self.proxy_request(url, "GET", vec![]).await
            .map_err(|e| format!("Status check failed: {}", e))?;
            
        Ok(response.status().as_u16() == 200)
    }
}
