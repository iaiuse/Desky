// 引入必要的外部依赖
use reqwest::{Client, Response};
use anyhow::Result;

// 引入本地日志模块
use crate::commands::log_message;

// 定义模块名称常量
const MODEL_NAME: &str = "HttpClient";

// HTTP客户端结构体定义
pub struct HttpClient {
    client: Client,
}

// 实现HTTP客户端的方法
impl HttpClient {
    // 创建新的HTTP客户端实例
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

    // 代理HTTP请求的核心方法
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
    
        // 设置multipart表单的boundary
        let boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        // 根据HTTP方法构建请求
        let request = match method {
            "GET" => self.client.get(target_url),
            "POST" => {
                let content_type = format!("multipart/form-data; boundary={}", boundary);
                log_message(
                    format!("Setting Content-Type: {}", content_type),
                    "DEBUG".to_string(),
                    MODEL_NAME.to_string(),
                );
                
                // 构建POST请求,设置Content-Type和请求体
                self.client.post(target_url)
                    .header("Content-Type", content_type)
                    .body(body)
            },
            _ => {
                // 处理不支持的HTTP方法
                log_message(
                    format!("Unsupported HTTP method: {}", method),
                    "ERROR".to_string(),
                    MODEL_NAME.to_string(),
                );
                return Err(anyhow::anyhow!("Unsupported HTTP method"));
            }
        };
    
        // 发送请求并获取响应
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

    // 发送请求并返回响应文本的方法
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

        // 发送请求并处理错误
        let response = self.proxy_request(target_url, method, body).await
            .map_err(|e| format!("Request failed: {}", e))?;
            
        // 将响应转换为文本
        response.text().await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }

    // 检查URL状态的方法
    pub async fn check_status(&self, url: &str) -> Result<bool, String> {
        let function_name = "check_status";
        log_message(
            format!("[{}] -- Checking status for {}", function_name, url),
            "DEBUG".to_string(),
            MODEL_NAME.to_string(),
        );

        // 发送GET请求检查状态
        let response = self.proxy_request(url, "GET", vec![]).await
            .map_err(|e| format!("Status check failed: {}", e))?;
            
        // 返回状态码是否为200
        Ok(response.status().as_u16() == 200)
    }

    pub async fn proxy_request_with_headers(
        &self,
        target_url: &str,
        method: &str,
        headers: std::collections::HashMap<String, String>,
        body: Vec<u8>,
    ) -> Result<Response> {
        log_message(
            format!("Proxying {} request to {} with headers", method, target_url),
            "DEBUG".to_string(),
            MODEL_NAME.to_string(),
        );

        // 根据HTTP方法构建请求
        let mut request_builder = match method {
            "GET" => self.client.get(target_url),
            "POST" => self.client.post(target_url),
            _ => {
                log_message(
                    format!("Unsupported HTTP method: {}", method),
                    "ERROR".to_string(),
                    MODEL_NAME.to_string(),
                );
                return Err(anyhow::anyhow!("Unsupported HTTP method"));
            }
        };

        // 添加headers
        for (key, value) in headers {
            // 在日志记录前先克隆值
            let key_clone = key.clone();
            let value_clone = value.clone();
            
            log_message(
                format!("Adding header: {} = {}", key_clone, value_clone),
                "DEBUG".to_string(),
                MODEL_NAME.to_string(),
            );

            request_builder = request_builder.header(key, value);
        }

        // 添加body并发送请求
        let response = request_builder.body(body).send().await?;
        
        log_message(
            format!(
                "Received response: Status={}, Content-Length={:?}",
                response.status(),
                response.headers().get("content-length")
            ),
            "INFO".to_string(),
            MODEL_NAME.to_string(),
        );

        Ok(response)
    }

    pub async fn send_request_with_headers(
        &self,
        target_url: &str,
        method: &str,
        headers: std::collections::HashMap<String, String>,
        body: Vec<u8>
    ) -> Result<String, String> {
        let function_name = "send_request_with_headers";
        log_message(
            format!("[{}] Sending {} request to {}", function_name, method, target_url),
            "DEBUG".to_string(),
            MODEL_NAME.to_string(),
        );

        let response = self.proxy_request_with_headers(target_url, method, headers, body).await
            .map_err(|e| format!("Request failed: {}", e))?;
            
        response.text().await
            .map_err(|e| format!("Failed to parse response: {}", e))
    }
}
