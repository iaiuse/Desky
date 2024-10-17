const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

// 替换为你的串口名称（例如 COM3 或 /dev/ttyUSB0）
const port = new SerialPort({ path: '/dev/cu.usbmodemF0F5BD543E182', baudRate: 9600 });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

port.on('open', () => {
  console.log('串口已打开');

  // 发送指令让舵机旋转到90度
  port.write('a', (err) => {
    if (err) {
      return console.log('Error on write: ', err.message);
    }
    console.log('已发送指令: 旋转到90度');
  });

  // 2秒后复位舵机到0度
  setTimeout(() => {
    port.write('r', (err) => {
      if (err) {
        return console.log('Error on write: ', err.message);
      }
      console.log('已发送指令: 复位到0度');
    });
  }, 2000);
});

port.on('error', (err) => {
  console.log('Error: ', err.message);
});

parser.on('data', (data) => {
  console.log('收到来自Arduino的数据: ', data);
});
