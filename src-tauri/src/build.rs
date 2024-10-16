fn main() {
    println!("cargo:rustc-link-search=/opt/local/lib");
    println!("cargo:rustc-env=OpenCV_DIR=/opt/local/libexec/opencv4/cmake");
    println!("cargo:include=/opt/local/include/opencv4");
    println!("cargo:rustc-link-lib=opencv_core");
    println!("cargo:rustc-link-lib=opencv_imgproc");
    println!("cargo:rustc-link-lib=opencv_highgui");
    // 添加其他需要的 OpenCV 模块
}