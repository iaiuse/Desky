#include <Servo.h>

Servo servoX;
Servo servoY;
// upload 到 r4以后，要断电，要不然会报设备busy 
void setup() {
  Serial.begin(9600);
  servoX.attach(9);  // X轴舵机连接到9号引脚
  servoY.attach(10); // Y轴舵机连接到10号引脚
  
  // 初始化舵机位置
  servoX.write(90);
  servoY.write(90);
}

void loop() {
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    int commaIndex = input.indexOf(',');
    
    if (commaIndex != -1) {
      int x = input.substring(0, commaIndex).toInt();
      int y = input.substring(commaIndex + 1).toInt();
      
      // 确保值在有效范围内
      x = constrain(x, 0, 180);
      y = constrain(y, 0, 180);
      
      servoX.write(x);
      servoY.write(y);
      
      // 发送确认信息回Node.js
      Serial.print("Position set to: ");
      Serial.print(x);
      Serial.print(",");
      Serial.println(y);
    }
  }
}