import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();
    
    // 调用火山引擎的API停止语音识别任务
    const response = await fetch('https://rtc.volcengineapi.com/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 添加其他必要的认证头
      },
      body: JSON.stringify({ taskId })
    });

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to stop voice chat' },
      { status: 500 }
    );
  }
} 