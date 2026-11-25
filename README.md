# Vimo Motion Research

Vimo 的本地运动科研工具原型。无需自建服务器、账号或远程 API，即可读取人体骨骼时序数据、计算可解释的二维运动学指标，并通过 CLI / TUI 浏览和导出结果。网页门户现以科研工作台为核心，保留原有调研与演示素材。

## Web 科研工作台

直接打开仓库根目录的 index.html，通过“进入科研工作台”进入 research/index.html。也可单独打开 research/index.html。页面使用原生 HTML、CSS 和 JavaScript，无需后端或第三方 CDN。GitHub Pages 可从合并后的 main 分支根目录发布；实际 Pages 配置需维护者确认。

支持导入同一 CSV 数据规范、调节可见度阈值、逐帧骨骼投影、关节角度曲线、覆盖率统计、下载模拟样例和导出 JSON/CSV。模拟样例包含 90 帧，其中左膝指标在默认阈值下有 80 帧有效。当前 Web 不支持直接视频提取。旧社区、账号与对话原型暂时从公开入口隐藏。

## 快速开始

Python 3.9 或以上。CSV 分析与模拟数据不需要第三方 Python 包；Linux/macOS 的 TUI 使用标准库 curses，Windows 可安装 windows-curses。

```sh
python research/vimo.py demo pose.csv
python research/vimo.py analyze pose.csv --json report.json --csv metrics.csv
python research/vimo.py tui pose.csv
```

TUI 中 ↑/↓ 切换指标，←/→ 浏览帧，q 退出。demo 生成的是人工构造的几何序列，不代表真实运动或算法准确率。

## 从本地视频提取骨骼（可选）

安装支持当前 Python 和系统的 MediaPipe、OpenCV 版本，并从 [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) 获取本地 .task 模型。模型权重不包含在仓库中。

```sh
python -m pip install mediapipe opencv-python
python research/vimo.py extract run.mp4 --model pose_landmarker_lite.task --output pose.csv
python research/vimo.py tui pose.csv
```

视频提取使用单人检测和名义恒定帧率。变帧率视频的时间轴可能不准确，多人场景的身份一致性未保证。该可选提取链尚待真实视频与指定依赖版本的端到端测试。

## 数据约定与分析

输入 CSV 表头：

```csv
frame,time_s,landmark,x,y,visibility
0,0,23,90,100,0.99
0,0,25,90,145,0.98
0,0,27,90,185,0.96
```

landmark 采用 MediaPipe 的 0–32 编号；x、y 必须使用同尺度的图像平面单位（如像素），y 轴向下，而非直接混用不同宽高归一化坐标。缺少关节时不插值；无检测的帧可用空 x/y、visibility=0 的占位行表示。帧时间须递增，同一帧不能有重复关节。coverage 是输入中记录帧的有效比例，不是采样完整性或置信区间。

计算左右膝、髋、肘的三点内夹角及肩髋中心连线与图像向上方向的夹角。输出最小值、中位数、最大值、有效帧数和覆盖率。关节可见度过滤阈值可通过 --visibility 设置，默认 0.5；它不是经过标定的概率。CSV 中缺失指标为空值，JSON 中为 null。

## 测试与研究边界

```sh
python -m unittest discover -s research -v
```

现有测试覆盖几何角度、低可见度、空观测和非法 CSV。当前原型只计算二维投影量，不恢复真实三维生物力学参数，不输出动作质量总分、损伤风险或医疗建议。后续计划包括数据接口适配、参考运动序列匹配、公开数据集验证、浏览器本地视频提取及可复现实验记录。

仓库公开不等于已获开源许可。项目许可证及第三方数据、模型授权需由维护者确认后再正式发布。
