import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 调用火山引擎的语音识别 API
    const response = await fetch('https://rtc.volcengineapi.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 添加其他必要的认证头
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start voice chat' },
      { status: 500 }
    );
  }
} 