# Desky: 您的智能桌面伙伴

## 项目背景

Desky 是一个融合了人工智能对话、计算机视觉和硬件控制的智能桌面机器人。这个项目的灵感来源于人机交互的发展和个人助理机器人的潜力。我们的目标是创建一个能够进行自然语言对话，同时具备视觉感知和物理响应能力的桌面伙伴。

无论是在工作中需要快速查询信息，还是在学习时需要及时的解答，或者只是想找个伙伴聊聊天，Desky 都能成为您得力的助手。它不仅能听懂您的话，还能用温暖的声音回应您，甚至能通过摄像头"看"到您，用微小的头部动作与您互动。

## Desky 能做什么？

1. **智能对话**：利用先进的AI模型，Desky 可以理解并回应各种话题的对话。
2. **语音交互**：Desky 不仅能听，还能说，让您的交流更自然。
3. **视觉感知**：通过内置摄像头，Desky 能识别您的位置，保持"目光交流"。
4. **情感表达**：通过头部动作，Desky 能表达简单的情感和反应。
5. **个性化助手**：从日程提醒到信息查询，Desky 都能胜任。


## 原理

Desky 主要包含以下几个核心组件：

1. **AI 对话系统**：利用 OpenAI 的 GPT 模型进行自然语言处理和生成。这使得机器人能够理解用户输入并生成相应的回复。

2. **语音合成**：使用 OpenAI 的文本转语音（TTS）API 将机器人的文本回复转换为语音输出，提供更自然的交互体验。

3. **计算机视觉**：通过摄像头和 OpenCV 库实现实时人脸检测。这使得机器人能够"看到"用户，为进一步的交互奠定基础。

4. **舵机控制**：使用 Raspberry Pi 的 PWM 接口控制舵机，实现机器人头部的物理运动，使交互更加生动。

5. **Tauri 框架**：采用 Rust 和 Web 技术构建跨平台桌面应用，确保性能和易用性的平衡。

## 使用方法

### 准备工作

1. 确保您的系统已安装 Rust 和 Node.js。
2. 安装 Tauri CLI：`npm install -g @tauri-apps/cli`
3. 克隆本项目：`git clone https://github.com/iaiuse/desky.git`
4. 进入项目目录：`cd desky`

### 配置

1. 运行应用：`npm run tauri dev`
2. 在应用中，点击"Show Config"按钮。
3. 输入您的 OpenAI API 密钥。
4. 根据需要启用摄像头和舵机控制。
5. 点击"Save Configuration"保存设置。

### 使用

1. 在主界面的输入框中输入您想说的话。
2. 点击"Send"按钮或按回车键发送消息。
3. 等待机器人的回复，它会以文本和语音形式呈现。
4. 如果启用了摄像头，您可以在界面上看到摄像头捕捉的画面和人脸检测结果。
5. 如果启用了舵机控制，机器人的"头部"会根据检测到的人脸位置进行相应的转动。

## 注意事项

- 请确保您有足够的 OpenAI API 使用额度。
- 摄像头和舵机控制功能需要相应的硬件支持。
- 首次运行时，可能需要安装一些额外的依赖，请按照提示进行操作。

## 贡献

我们欢迎任何形式的贡献，无论是新功能的建议、bug 报告还是代码贡献。请随时提交 Issue 或 Pull Request。

## 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。

# 如果是比较旧的mac电脑，比如 macOS 11（Big Sur）：

1. 关于 macOS 11 的警告：
   虽然 Homebrew 官方不再支持 macOS 11，但这并不意味着我们不能继续使用它。只是在遇到问题时，可能需要更多的耐心和自行解决的能力。

2. 权限问题：
   这是我们当前可以解决的主要问题。请按照以下步骤操作：

   a. 首先，更改目录的所有权：
      ```
      sudo chown -R $(whoami) /usr/local/bin /usr/local/share/man/man1
      ```
   
   b. 然后，确保你有写入权限：
      ```
      chmod u+w /usr/local/bin /usr/local/share/man/man1
      ```

3. 更新 Homebrew：
   尽管你使用的是旧版 macOS，但保持 Homebrew 更新仍然很重要：
   ```
   brew update
   ```

4. 安装或更新必要的软件：
   ```
   brew install llvm opencv
   brew upgrade llvm opencv
   ```

5. 设置环境变量：
   将以下内容添加到你的 `~/.zshrc` 或 `~/.bash_profile` 文件中：

   ```bash
   export LLVM_HOME="/usr/local/opt/llvm"
   export PATH="$LLVM_HOME/bin:$PATH"
   export LDFLAGS="-L$LLVM_HOME/lib"
   export CPPFLAGS="-I$LLVM_HOME/include"
   export OPENCV_LIB_DIR="/usr/local/opt/opencv/lib"
   export OPENCV_INCLUDE_DIR="/usr/local/opt/opencv/include/opencv4"
   ```

   然后重新加载配置：
   ```
   source ~/.zshrc   # 或 source ~/.bash_profile
   ```

6. 对于 OpenCV 的编译问题，我们可以尝试使用系统级的 OpenCV 而不是通过 Cargo 编译。在你的 `Cargo.toml` 文件中，修改 OpenCV 依赖如下：



```toml
[dependencies]
tauri = { version = "1.0", features = ["shell-open"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
opencv = { version = "0.63", features = ["clang-runtime"], default-features = false }
serialport = "4.2"
log = "0.4"

[build-dependencies]
pkg-config = "0.3"

```

7. 在你的项目根目录创建一个 `build.rs` 文件，内容如下：

```rust
fn main() {
    pkg_config::probe_library("opencv").unwrap();
}

```

8. 清理之前的构建并重新尝试：
   ```
   cargo clean
   cargo build
   ```

如果在执行这些步骤后仍然遇到问题，请提供新的错误信息。我们可能需要考虑以下备选方案：

1. 使用较旧版本的 OpenCV：在 `Cargo.toml` 中指定 `opencv = "0.62"`。

2. 考虑使用其他视频处理库：如 `gstreamer`，虽然这需要对代码进行一些修改。

3. 如果可能的话，考虑更新你的 macOS 版本。这可能会解决许多兼容性问题。

# 如果需要安装cmake
# 下载 CMake 源代码
curl -O https://github.com/Kitware/CMake/releases/download/v3.30.5/cmake-3.30.5.tar.gz

# 解压源代码
tar -xzvf cmake-3.30.5.tar.gz

# 进入源代码目录
cd cmake-3.30.5

# 配置
./bootstrap

# 编译
make

# 安装
sudo make install