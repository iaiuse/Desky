# Desky: 您的智能桌面伙伴

## 项目背景

Desky 是一个融合了人工智能对话、计算机视觉和硬件控制的智能桌面机器人。这个项目的灵感来源于人机交互的发展和个人助理机器人的潜力。我们的目标是创建一个能够进行自然语言对话，同时具备视觉感知和物理响应能力的桌面伙伴。

无论是在工作中需要快速查询信息，还是在学习时需要及时的解答，或者只是想找个伙伴聊聊天，Desky 都能成为您得力的助手。它不仅能听懂您的话，还能用温暖的声音回应您，甚至能通过摄像头"看"到您，用微小的头部动作与您互动。

## Desky 能做什么？

1. **智能对话**：利用先进的AI模型，Desky 可以理解并回应各种话题的对话。
2. **语音交互**：Desky 不仅能听，还能说，让您的交流更自然。
3. **视觉感知**：通过内置摄像头，Desky 能识别您的位置，保持"目光交流"。
4. **情感表达**：通过头部动作，Desky 能表达简单的情感和反应。
5. **个性化助手**：从日程提醒到信息查询，Desky 都能任。

## 部分截图
主要交互界面
![主要交互界面](https://github.com/user-attachments/assets/dd888011-fc47-4171-bb61-41453143275e)

设备状态
![image](https://github.com/user-attachments/assets/3e5444c8-2c49-480e-9c79-b2d9e7bc83ea)

![image](https://github.com/user-attachments/assets/2c8808a8-2fe4-4e74-8c39-7973db597eb5)

设置界面-api设置，就是用来生成表情的

![image](https://github.com/user-attachments/assets/5a0fc2c0-ee23-4120-be63-9eccba212063)


设置界面-设备设置
![image](https://github.com/user-attachments/assets/0475562c-3ec4-44c3-9a54-017a6ecbdb1b)

![image](https://github.com/user-attachments/assets/eb605525-3816-4fce-b9dc-4e246cb2f8d0)

设置界面-tts
![image](https://github.com/user-attachments/assets/591af8d8-c750-419a-9271-ff144bee2c16)


## 原理

Desky 主要包含以下几个核心组件：

1. **AI 对话系统**：利用 OpenAI 的 GPT 模型进行自然语言处理和生成。这使得机器人能够理解用户输入并生成相应的回复。

2. **语音合成**：使用 OpenAI 的文本转语音（TTS）API 将机器人的文本回复转换为语音输出，提供更自然的交互体验。

3. **计算机视觉**：使用 face-api.js 实现实时人脸检测和追踪。具体实现包括:
   - 使用 TinyFaceDetector 模型进行轻量级人脸检测,支持实时检测
   - 通过 WebRTC 获取摄像头画面,每帧进行人脸位置、大小和置信度分析
   - 采用帧跳过机制(skipFrames)优化性能,只在必要时进行检测
   - 实现 FPS 计算和性能监控,确保流畅的视觉交互体验
   - 支持 WebGL 加速,提升检测性能
   这些技术让机器人能够"看到"并实时跟随用户,实现自然的视觉交互。

4. **舵机控制**：通过串口通信(SerialPort)与 Arduino 控制板连接，实现舵机的精确控制。具体实现包括:
   - 使用 9600 波特率建立串口连接,设置 1000ms 超时
   - 通过格式化命令字符串 "X,Y\n" 发送舵机位置指令
   - X、Y 值范围为 0-180 度,默认值为 90 度(居中位置)
   - 每次发送指令后等待 100ms 让 Arduino 处理
   - 支持读取 Arduino 的响应数据进行双向通信
   - 使用日志系统记录所有舵机控制操作
   这些机制确保了舵机控制的精确性和可靠性,使机器人能做出流畅的头部运动响应。

5. **Tauri 框架**：采用 Rust 和 Web 技术构建跨平台桌面应用，确保性能和易用性的平衡。通过 Tauri 的安全权限系统，实现对本地硬件和文件系统的可控访问。


## 项目结构

```mermaid  
graph TB
    classDef frontend fill:#e6f3ff,stroke:#4a90e2,stroke-width:2px
    classDef backend fill:#f5f0ff,stroke:#9b6dff,stroke-width:2px
    classDef hardware fill:#fff0f4,stroke:#ff6b81,stroke-width:2px
    classDef service fill:#f0fff4,stroke:#2ed573,stroke-width:2px

    UI[前端界面层]
    Backend[Tauri后端]
    Hardware[硬件控制]
    Vision[计算机视觉]
    Audio[音频处理]
    
    UI --> Backend
    Backend --> Hardware
    Backend --> Vision 
    Backend --> Audio

    subgraph 前端模块
        UI --> VideoFeed[视频流显示]
        UI --> Controls[舵机控制面板]
        UI --> Chat[对话交互界面]
    end

    subgraph 核心服务
        Backend --> DeviceManager[设备管理器]
        Backend --> ServoController[舵机控制器] 
        Backend --> WebSocket[WebSocket客户端]
    end

    class UI,VideoFeed,Controls,Chat frontend
    class Backend,Vision,Audio backend
    class Hardware,ServoController hardware
    class DeviceManager,WebSocket service
```


## 交互流程

```mermaid
sequenceDiagram
    participant User as 用户
    participant Client as 客户端程序
    participant LLM as 大语言模型
    participant TTS as 语音合成服务
    participant Server as Web服务
    participant Queue as 消息队列
    participant Mobile as 手机客户端
    
    User->>Client: 输入文字内容
    
    %% LLM处理阶段
    Client->>LLM: 发送文字+提示词
    LLM-->>Client: 返回文字内容和表情
    
    %% 语音合成阶段
    Client->>TTS: 发送处理后的文字
    TTS-->>Client: 返回合成的语音文件
    
    %% 服务器处理阶段
    Client->>Server: 发送语音文件和内容
    activate Server
    Server->>Server: 存储语音文件
    Server->>Queue: 将消息放入队列
    deactivate Server
    
    %% 手机端处理阶段
    loop 轮询检查
        Mobile->>Server: 请求新消息
        alt 有新消息
            Server-->>Mobile: 返回新消息内容
            Mobile->>Mobile: 显示内容
            Mobile->>Server: 请求语音文件
            Server-->>Mobile: 返回语音文件
            Mobile->>Mobile: 播放语音
        else 无新消息
            Server-->>Mobile: 返回空结果
        end
    end
```

## 开发环境要求

- Node.js >= 18
- Rust >= 1.75
- pnpm >= 8.0
- 操作系统：
  - macOS 10.15+
  - Windows 10+

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
- 首次运行时，可能需要安装一些额外的赖，请按照提示进行操作。

## 贡献

我们欢迎任何形式的贡献，无论是新功能的建议、bug 报告还是代码贡献。请随时提交 Issue 或 Pull Request。



## 许可证

本项目采用 MIT 许可证。详情请见 [LICENSE](LICENSE) 文件。