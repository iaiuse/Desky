use firmata::Board;
use std::io;
use crate::commands::log_message;

pub struct ServoController {
    board: Board,
}

impl ServoController {
    pub fn new(port_name: &str) -> io::Result<Self> {
        log_message(
            format!("尝试为端口 {} 创建新的 ServoController", port_name),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );

        // 由于 `Board::new` 在 firmata 0.2.0 中不返回 Result，我们直接调用它
        // 注意，这个方法在失败时可能会 panic，但由于您不关心功能，这里忽略错误处理
        let board = Board::new(port_name);

        log_message(
            format!("成功为端口 {} 创建 Board", port_name),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );

        Ok(ServoController { board })
    }

    pub fn set_position(&mut self, pin: u8, angle: u8) -> io::Result<()> {
        log_message(
            format!("设置引脚 {} 的位置为角度 {}", pin, angle),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );
        // 将角度（0-180）转换为 PWM 值（0-255）
        let pwm_value = (angle as f32 / 180.0 * 255.0) as i32;
        log_message(
            format!("将角度 {} 转换为 PWM 值 {}", angle, pwm_value),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );

        // 由于您不需要实际功能，我们可以注释掉这行代码，或者假设它不会引起错误
        self.board.analog_write(pin as i32, pwm_value);

        log_message(
            format!("成功将引脚 {} 设置为角度 {}", pin, angle),
            "INFO".to_string(),
            "servo_controller".to_string(),
        );
        Ok(())
    }
}
